#!/usr/bin/env bash
# Startet den Dev-Stack als Docker-Compose-Projekt "devstack" (empfohlene Variante fuer
# Software-Development-Sessions: schnell, wenig RAM/Disk, keine Kubernetes-Workarounds).
#
#   Postgres   localhost:5432   SonarQube http://localhost:9000   Grafana http://localhost:3000
#   Prometheus localhost:9090   Loki      localhost:3100           Alloy   12345/12347/4317/4318
#
# Optional: Dienste einschraenken, z. B. ./40_compose_up.sh postgres grafana
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
require_docker

cd "$CONFIG_DIR"
docker compose up -d "$@"

pg_ok()      { docker compose exec -T postgres pg_isready -U devuser -d appdb; }
grafana_ok() { curl -sf http://localhost:3000/api/health; }
prom_ok()    { curl -sf http://localhost:9090/-/ready; }
loki_ok()    { curl -sf http://localhost:3100/ready | grep -q ready; }
sonar_ok()   { curl -sf http://localhost:9000/api/system/status | grep -q '"status":"UP"'; }

running() { docker compose ps --services --status running | grep -qx "$1"; }
running postgres   && wait_for "Postgres"   60  pg_ok
running prometheus && wait_for "Prometheus" 60  prom_ok
running loki       && wait_for "Loki"       120 loki_ok
running grafana    && wait_for "Grafana"    90  grafana_ok
running sonarqube  && wait_for "SonarQube (dauert 1-3 min)" 300 sonar_ok

docker compose ps --format 'table {{.Service}}\t{{.Status}}\t{{.Ports}}'
echo "Pruefen: scripts/90_verify.sh compose"
