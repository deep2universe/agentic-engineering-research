#!/usr/bin/env bash
# Startet den Docker-Daemon in der Sandbox (kein systemd vorhanden) und setzt Kernel-Parameter.
# Idempotent: laeuft dockerd schon, wird nur geprueft.
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

# SonarQube/Elasticsearch braucht vm.max_map_count >= 262144 (Default in der Sandbox: 65530).
# Der Wert ist kernel-global und gilt damit auch fuer Container und Rancher-Pods.
sysctl -qw vm.max_map_count=262144 && ok "vm.max_map_count=262144"

if docker_running; then
  ok "dockerd laeuft bereits"
else
  [[ -n "${HTTPS_PROXY:-}" ]] || warn "HTTPS_PROXY nicht gesetzt -> Image-Pulls werden vermutlich scheitern"
  log "Starte dockerd (Log: /var/log/dockerd.log)"
  # dockerd erbt HTTPS_PROXY/NO_PROXY aus der Umgebung -> Pulls laufen ueber den Agent-Proxy.
  nohup dockerd >/var/log/dockerd.log 2>&1 &
  wait_for "Docker-Daemon" 60 docker info
fi

prepare_ca_dir

if [[ "${1:-}" == "--test" ]]; then
  docker run --rm hello-world | grep -q "Hello from Docker" && ok "hello-world Container laeuft"
  docker run --rm -v "$HOST_CA_BUNDLE:/etc/ssl/certs/ca-certificates.crt:ro" alpine:3.20 \
    wget -q --spider https://registry-1.docker.io/v2/ 2>&1 | grep -q 401 \
    && ok "Container-Egress (HTTPS mit CA-Bundle) funktioniert" || true
fi

docker info --format 'Docker {{.ServerVersion}} | Storage {{.Driver}} | Cgroup v{{.CgroupVersion}}'
