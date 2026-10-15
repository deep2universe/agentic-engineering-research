#!/usr/bin/env bash
# Startet Rancher (Single-Node, Docker-Install) mit allen Sandbox-Workarounds,
# wartet bis der "local"-Cluster aktiv ist und erzeugt eine Kubeconfig,
# die kubectl ueber den Rancher-API-Proxy (/k8s/clusters/local) leitet.
#
# Ergebnis:
#   UI:          https://127.0.0.1:8443  (admin / $RANCHER_PASSWORD)
#   Kubeconfig:  $STATE_DIR/rancher-kubeconfig.yaml
#   API-Token:   $STATE_DIR/rancher-token
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
require_docker
[[ -d "$CA_DIR" && -n "$(ls -A "$CA_DIR" 2>/dev/null)" ]] || prepare_ca_dir

if docker ps --format '{{.Names}}' | grep -qx rancher; then
  ok "Rancher-Container laeuft bereits"
else
  docker rm -f rancher >/dev/null 2>&1 || true
  log "Starte Rancher ($RANCHER_IMAGE)"
  # Workarounds (Details: 03_rancher_k3s.md):
  #  1. rancher-k3s-config.yaml   -> kubelet fail-cgroupv1=false (Host hat cgroup v1)
  #  2. containerd-config.toml.tmpl -> restrict_oom_score_adj=true (kein CAP_SYS_RESOURCE)
  #  3. CA-Anchors + SSL_CERT_*   -> Image-Pulls durch TLS-inspizierenden Egress-Proxy
  #  4. -p 30100-30110            -> NodePorts der Dev-Services auf dem Host erreichbar
  docker run -d --name rancher --privileged --restart=unless-stopped \
    -p 8080:80 -p 8443:443 -p 30100-30110:30100-30110 \
    -e CATTLE_BOOTSTRAP_PASSWORD="$RANCHER_PASSWORD" \
    -e SSL_CERT_DIR=/etc/ssl/certs -e SSL_CERT_FILE=/etc/ssl/ca-bundle.pem \
    -v rancher-data:/var/lib/rancher \
    -v "$CONFIG_DIR/rancher-k3s-config.yaml:/etc/rancher/k3s/config.yaml:ro" \
    -v "$CONFIG_DIR/containerd-config.toml.tmpl:/var/lib/rancher/k3s/agent/etc/containerd/config.toml.tmpl:ro" \
    -v "$CA_DIR:/etc/pki/trust/anchors:ro" \
    "$RANCHER_IMAGE" >/dev/null
fi

# Bekanntes Problem nach unsauberem Neustart (z. B. gekilltem k3s): Rancher stirbt mit
# "failed calling webhook ... no endpoints available for service rancher-webhook"
# (Henne-Ei). Fix: Webhook-Configs loeschen, Rancher legt sie beim Start neu an.
fix_webhook_loop() {
  if docker logs --since 60s rancher 2>&1 | grep -q 'FATAL.*failed calling webhook'; then
    warn "Rancher-Webhook-Restart-Schleife erkannt -> loesche Webhook-Configs"
    docker exec rancher kubectl delete validatingwebhookconfiguration rancher.cattle.io --ignore-not-found >/dev/null 2>&1 || true
    docker exec rancher kubectl delete mutatingwebhookconfiguration rancher.cattle.io --ignore-not-found >/dev/null 2>&1 || true
  fi
}
ping_ok()    { fix_webhook_loop; curl -sk --max-time 5 "$RANCHER_URL/ping" | grep -q pong; }
cluster_ok() { docker exec rancher kubectl get clusters.management.cattle.io local \
                 -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}' 2>/dev/null | grep -q True; }
wait_for "Rancher /ping" 300 ping_ok
wait_for "Rancher-Cluster 'local' Ready" 600 cluster_ok

# --- API-Login (lokaler Provider) -> Bearer-Token
TOKEN=$(curl -sk -X POST "$RANCHER_URL/v3-public/localProviders/local?action=login" \
  -H 'content-type: application/json' \
  -d "{\"username\":\"admin\",\"password\":\"$RANCHER_PASSWORD\",\"responseType\":\"token\"}" \
  | python3 -c 'import sys,json; print(json.load(sys.stdin)["token"])')
echo "$TOKEN" > "$STATE_DIR/rancher-token"; chmod 600 "$STATE_DIR/rancher-token"
ok "API-Token gespeichert: $STATE_DIR/rancher-token"

api() { curl -sk -H "Authorization: Bearer $TOKEN" -H 'content-type: application/json' "$@"; }

# server-url setzen (sonst fragt die UI beim ersten Login danach) + Telemetrie aus.
api -X PUT "$RANCHER_URL/v3/settings/server-url" -d "{\"value\":\"$RANCHER_URL\"}" >/dev/null
api -X PUT "$RANCHER_URL/v3/settings/telemetry-opt" -d '{"value":"out"}' >/dev/null || true

# --- Kubeconfig ueber Rancher erzeugen (kubectl -> Rancher-Auth-Proxy -> local-Cluster)
api -X POST "$RANCHER_URL/v3/clusters/local?action=generateKubeconfig" \
  | python3 -c 'import sys,json; print(json.load(sys.stdin)["config"])' > "$STATE_DIR/rancher-kubeconfig.yaml"
chmod 600 "$STATE_DIR/rancher-kubeconfig.yaml"
ok "Kubeconfig: $STATE_DIR/rancher-kubeconfig.yaml"

ensure_kubectl
KUBECONFIG="$STATE_DIR/rancher-kubeconfig.yaml" kubectl get nodes
echo
ok "Rancher bereit: $RANCHER_URL  (admin / $RANCHER_PASSWORD)"
echo "   export KUBECONFIG=$STATE_DIR/rancher-kubeconfig.yaml"
