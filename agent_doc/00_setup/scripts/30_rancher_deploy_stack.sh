#!/usr/bin/env bash
# Deployt Postgres, SonarQube, Grafana, Prometheus, Loki, Alloy in den Rancher-"local"-Cluster
# (Namespace devstack). kubectl spricht ueber die von Rancher erzeugte Kubeconfig,
# d. h. alle Requests laufen ueber Rancher (sichtbar in der Rancher-UI unter local > devstack).
#
# Voraussetzung: scripts/20_rancher_start.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
require_docker
ensure_kubectl
export KUBECONFIG="$STATE_DIR/rancher-kubeconfig.yaml"
[[ -f "$KUBECONFIG" ]] || { fail "Keine Rancher-Kubeconfig -> zuerst 20_rancher_start.sh"; exit 1; }

# Optional: lokal (Host-Docker) vorhandene Images in den containerd von Rancher importieren.
# Spart den erneuten Pull (SonarQube ~1 GB). Fehlt ein Image lokal, pullt k3s selbst.
IMAGES=(postgres:16-alpine sonarqube:community grafana/grafana:latest prom/prometheus:latest grafana/loki:latest grafana/alloy:latest)
if [[ "${SKIP_IMAGE_IMPORT:-0}" != "1" ]]; then
  for img in "${IMAGES[@]}"; do
    if docker image inspect "$img" >/dev/null 2>&1; then
      log "Importiere $img in Rancher-containerd"
      # Hinweis: `k3s ctr` gibt es im Rancher-k3s nicht -> /usr/bin/ctr mit k3s-Socket.
      docker save "$img" | docker exec -i rancher ctr --address /run/k3s/containerd/containerd.sock \
        -n k8s.io images import - >/dev/null 2>&1 \
        && ok "$img importiert" || warn "Import von $img fehlgeschlagen (k3s pullt selbst)"
    fi
  done
fi

kubectl create namespace devstack --dry-run=client -o yaml | kubectl apply -f -
# ConfigMaps aus denselben Dateien wie die Compose-Variante
cm() { kubectl -n devstack create configmap "$1" "${@:2}" --dry-run=client -o yaml | kubectl apply -f -; }
cm prometheus-config   --from-file=prometheus.yml="$CONFIG_DIR/prometheus.yml"
cm alloy-config        --from-file=config.alloy="$CONFIG_DIR/config.alloy"
cm grafana-datasources --from-file=datasources.yaml="$CONFIG_DIR/grafana/datasources.yaml"
cm grafana-dashboard-provider --from-file=dashboards.yaml="$CONFIG_DIR/grafana/dashboards.yaml"
cm grafana-dashboards  --from-file=devstack_overview.json="$CONFIG_DIR/grafana/devstack_overview.json"
cm postgres-init       --from-file=10-init.sql="$CONFIG_DIR/postgres/init.sql"
cm sonar-entrypoint    --from-file=sonar-entrypoint.sh="$CONFIG_DIR/sonarqube/sonar-entrypoint.sh"

kubectl apply -f "$CONFIG_DIR/k8s/devstack.yaml"

for d in postgres prometheus loki alloy grafana sonarqube; do
  kubectl -n devstack rollout status "deploy/$d" --timeout=600s
done
kubectl -n devstack get pods,svc -o wide
echo
ok "Stack laeuft im Rancher-Cluster. Host-Ports:"
cat <<EOF
   Postgres   : localhost:30100  (appdb/devuser/devpass, sonar/sonar/sonar)
   SonarQube  : http://localhost:30101  (admin/admin -> Passwortwechsel beim 1. Login)
   Grafana    : http://localhost:30102  (admin/admin)
   Prometheus : http://localhost:30103
   Loki       : http://localhost:30104
   Alloy Faro : http://localhost:30105/collect   OTLP-HTTP: 30106   OTLP-gRPC: 30107   UI: 30108
Pruefen: scripts/90_verify.sh rancher
EOF
