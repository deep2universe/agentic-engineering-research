#!/usr/bin/env bash
# Stoppt Komponenten des Dev-Stacks.
#   ./99_stop.sh compose          -> Compose-Stack stoppen (Volumes bleiben)
#   ./99_stop.sh compose --purge  -> Compose-Stack + Volumes loeschen
#   ./99_stop.sh rancher-stack    -> Namespace devstack im Rancher-Cluster loeschen
#   ./99_stop.sh rancher          -> Rancher-Container stoppen + entfernen (Volume rancher-data bleibt)
#   ./99_stop.sh rancher --purge  -> zusaetzlich Volume rancher-data loeschen
#   ./99_stop.sh k3s              -> natives k3s beenden
#   ./99_stop.sh all              -> alles oben (ohne --purge), dockerd laeuft weiter
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
set +e
what="${1:-}"; purge="${2:-}"

stop_compose() { (cd "$CONFIG_DIR" && docker compose down ${purge:+-v}); ok "Compose gestoppt"; }
stop_rancher_stack() {
  KUBECONFIG="$STATE_DIR/rancher-kubeconfig.yaml" kubectl delete namespace devstack --ignore-not-found
}
stop_rancher() {
  docker rm -f rancher >/dev/null 2>&1; ok "Rancher-Container entfernt"
  [[ "$purge" == "--purge" ]] && docker volume rm rancher-data >/dev/null 2>&1 && ok "Volume rancher-data geloescht"
}
stop_k3s() {
  # Nur den nativen k3s (PID-Datei) beenden – `pkill -x k3s` wuerde auch den k3s
  # im Rancher-Container killen (Container-Prozesse sind im Host-ps sichtbar)!
  [[ -f /run/k3s-native.pid ]] && kill "$(cat /run/k3s-native.pid)" 2>/dev/null && sleep 3
  rm -f /run/k3s-native.pid
  # Pod-Prozesse (containerd-shims) laufen nach Ende von k3s weiter -> mit beenden.
  # Anker "^$K3S_BIN_DIR" trifft nur die k3s-Binaries (nicht dockerd/containerd von Docker).
  pkill -f "^$K3S_BIN_DIR/containerd-shim-runc-v2"; pkill -f "^$K3S_BIN_DIR/containerd"
  ok "k3s gestoppt"
}

case "$what" in
  compose)        stop_compose ;;
  rancher-stack)  stop_rancher_stack ;;
  rancher)        stop_rancher ;;
  k3s)            stop_k3s ;;
  all)            purge=""; stop_compose; stop_rancher; stop_k3s ;;
  *) sed -n '2,9p' "$0"; exit 1 ;;
esac
