#!/usr/bin/env bash
# OPTIONAL: Startet k3s (Rancher-Kubernetes-Distribution) nativ auf dem Sandbox-Host –
# ohne Rancher-UI. Leichter als Rancher (~500 MB RAM), sinnvoll wenn nur ein
# Kubernetes-Cluster (kubectl/Helm) gebraucht wird.
#
# Binaries kommen aus dem Docker-Image rancher/k3s (GitHub-Releases sind in der
# Sandbox gesperrt). Kubeconfig: /etc/rancher/k3s/k3s.yaml
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
require_docker
export PATH="$K3S_BIN_DIR:$PATH"

# Wichtig: NICHT `pgrep -x k3s` verwenden – das trifft auch den k3s im Rancher-Container!
PID_FILE=/run/k3s-native.pid
if [[ -f "$PID_FILE" ]] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
  ok "k3s laeuft bereits"
else
  if [[ ! -x "$K3S_BIN_DIR/containerd" ]]; then
    log "Extrahiere k3s, containerd, runc und CNI-Plugins aus $K3S_IMAGE"
    tmp=$(mktemp -d)
    cid=$(docker create "$K3S_IMAGE")
    docker export "$cid" | tar -x -C "$tmp" bin/
    docker rm "$cid" >/dev/null
    mkdir -p "$K3S_BIN_DIR"
    for b in k3s containerd containerd-shim-runc-v2 runc ctr crictl cni; do
      cp -L "$tmp/bin/$b" "$K3S_BIN_DIR/"
    done
    # CNI-Plugins sind Symlinks auf das Multi-Call-Binary "cni"
    for p in bandwidth bridge firewall flannel host-local loopback portmap; do
      ln -sf cni "$K3S_BIN_DIR/$p"
    done
    rm -rf "$tmp"
    ln -sf "$K3S_BIN_DIR/k3s" /usr/local/bin/kubectl
  fi
  # containerd-Template mit restrict_oom_score_adj=true (fehlendes CAP_SYS_RESOURCE)
  mkdir -p /var/lib/rancher/k3s/agent/etc/containerd
  cp "$CONFIG_DIR/containerd-config.toml.tmpl" /var/lib/rancher/k3s/agent/etc/containerd/config.toml.tmpl
  log "Starte k3s server (Log: /var/log/k3s.log)"
  nohup k3s server \
    --kubelet-arg=fail-cgroupv1=false \
    --kubelet-arg="eviction-hard=nodefs.available<1Gi,imagefs.available<1Gi,memory.available<200Mi" \
    --kube-proxy-arg=conntrack-max-per-core=0 \
    --disable=traefik --disable=metrics-server \
    --write-kubeconfig-mode=644 >/var/log/k3s.log 2>&1 &
  echo $! > "$PID_FILE"
fi

export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
coredns_ok() { kubectl -n kube-system get pods -l k8s-app=kube-dns 2>/dev/null | grep -q '1/1.*Running'; }
wait_for "k3s Node + CoreDNS" 240 coredns_ok
kubectl get nodes -o wide
echo "   export KUBECONFIG=/etc/rancher/k3s/k3s.yaml"
