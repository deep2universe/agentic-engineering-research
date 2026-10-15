#!/usr/bin/env bash
# End-to-End-Funktionstest des Dev-Stacks.
#   ./90_verify.sh compose   -> Docker-Compose-Ports (5432, 9000, 3000, ...)
#   ./90_verify.sh rancher   -> Rancher-NodePorts (30100-30108)
# Prueft nicht nur "Port offen", sondern echte Nutzung: SQL, Log-Push + Query,
# Faro-Event (React), OTLP-Logs/-Metriken (Spring Boot), Grafana-Datasource-Proxy.
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
set +e
MODE="${1:-compose}"
if [[ "$MODE" == "rancher" ]]; then
  PG=30100; SONAR=30101; GRAFANA=30102; PROM=30103; LOKI=30104; FARO=30105; OTLP=30106; ALLOY_UI=30108
else
  PG=5432; SONAR=9000; GRAFANA=3000; PROM=9090; LOKI=3100; FARO=12347; OTLP=4318; ALLOY_UI=12345
fi
H=127.0.0.1; PASS=0; FAILED=0; RUN_ID="verify-$(date +%s)"
check() { local d="$1"; shift; if "$@" >/dev/null 2>&1; then ok "$d"; ((PASS++)); else fail "$d"; ((FAILED++)); fi; }
now_ns() { date +%s%N; }

echo "== Modus: $MODE  (Run-ID $RUN_ID)"

# --- Postgres
check "Postgres: SQL als devuser/appdb (CREATE/INSERT/SELECT)" bash -c \
  "PGPASSWORD=devpass psql -h $H -p $PG -U devuser -d appdb -tAc \
   \"CREATE TABLE IF NOT EXISTS verify(id serial, run text); INSERT INTO verify(run) VALUES('$RUN_ID'); \
     SELECT count(*) FROM verify WHERE run='$RUN_ID';\" | grep -qx 1"
check "Postgres: sonar-DB erreichbar (sonar/sonar)" bash -c \
  "PGPASSWORD=sonar psql -h $H -p $PG -U sonar -d sonar -tAc 'select 1' | grep -qx 1"

# --- SonarQube
check "SonarQube: /api/system/status = UP" bash -c \
  "curl -sf http://$H:$SONAR/api/system/status | grep -q '\"status\":\"UP\"'"
SONAR_AUTH="admin:${SONAR_PASSWORD:-admin}"   # nach Passwortwechsel: SONAR_PASSWORD=... setzen
check "SonarQube: Login admin (/api/authentication/validate)" bash -c \
  "curl -sf -u $SONAR_AUTH http://$H:$SONAR/api/authentication/validate | grep -q '\"valid\":true'"
# Direkt nach "UP" ist health kurz YELLOW -> bis 90 s warten
check "SonarQube: /api/system/health = GREEN" timeout 90 bash -c \
  "until curl -sf -u $SONAR_AUTH http://$H:$SONAR/api/system/health | grep -q GREEN; do sleep 5; done"

# --- Prometheus
check "Prometheus: ready" curl -sf http://$H:$PROM/-/ready
check "Prometheus: Query up{job=\"prometheus\"} == 1" bash -c \
  "curl -sf 'http://$H:$PROM/api/v1/query?query=up%7Bjob%3D%22prometheus%22%7D' | grep -q '\"1\"\]'"

# --- Loki: Push + Query
TS=$(now_ns)
check "Loki: ready" bash -c "curl -sf http://$H:$LOKI/ready | grep -q ready"
check "Loki: Log-Push (HTTP API)" bash -c \
  "curl -sf -o /dev/null -w '%{http_code}' -H 'Content-Type: application/json' -X POST http://$H:$LOKI/loki/api/v1/push \
   -d '{\"streams\":[{\"stream\":{\"job\":\"verify\",\"run\":\"$RUN_ID\"},\"values\":[[\"$TS\",\"hello loki $RUN_ID\"]]}]}' | grep -q 204"

# --- Alloy: Faro (React) + OTLP (Spring Boot)
check "Alloy: UI/ready" curl -sf http://$H:$ALLOY_UI/-/ready
check "Alloy Faro-Receiver: Frontend-Log angenommen" bash -c \
  "curl -sf -o /dev/null -X POST http://$H:$FARO/collect -H 'Content-Type: application/json' \
   -d '{\"meta\":{\"app\":{\"name\":\"verify-react\",\"version\":\"1.0\"}},\"logs\":[{\"message\":\"hello faro $RUN_ID\",\"level\":\"info\",\"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%S.000Z)\"}]}'"
check "Alloy OTLP/HTTP: Log angenommen (/v1/logs)" bash -c \
  "curl -sf -o /dev/null -X POST http://$H:$OTLP/v1/logs -H 'Content-Type: application/json' \
   -d '{\"resourceLogs\":[{\"resource\":{\"attributes\":[{\"key\":\"service.name\",\"value\":{\"stringValue\":\"verify-backend\"}}]},\"scopeLogs\":[{\"logRecords\":[{\"timeUnixNano\":\"$(now_ns)\",\"severityText\":\"INFO\",\"body\":{\"stringValue\":\"hello otlp $RUN_ID\"}}]}]}]}'"
check "Alloy OTLP/HTTP: Metrik angenommen (/v1/metrics)" bash -c \
  "curl -sf -o /dev/null -X POST http://$H:$OTLP/v1/metrics -H 'Content-Type: application/json' \
   -d '{\"resourceMetrics\":[{\"resource\":{\"attributes\":[{\"key\":\"service.name\",\"value\":{\"stringValue\":\"verify-backend\"}}]},\"scopeMetrics\":[{\"metrics\":[{\"name\":\"verify_gauge\",\"gauge\":{\"dataPoints\":[{\"asDouble\":42,\"timeUnixNano\":\"$(now_ns)\"}]}}]}]}]}'"

log "Warte 15s auf Ingestion (Alloy-Batching, Loki-Flush) ..."
sleep 15
# loki_has <LogQL-Selector>: true, wenn eine Zeile mit $RUN_ID in den letzten 10 min existiert
loki_has() {
  curl -sfG "http://$H:$LOKI/loki/api/v1/query_range" \
    --data-urlencode "query=$1 |= \"$RUN_ID\"" \
    --data-urlencode "start=$(( $(date +%s) - 600 ))000000000" | grep -q "$RUN_ID"
}
check "Loki: Direkt gepushter Log abfragbar" loki_has '{job="verify"}'
check "Loki: Faro-Log (React) abfragbar"     loki_has '{source="faro"}'
check "Loki: OTLP-Log (Backend) abfragbar"   loki_has '{exporter="OTLP"}'
check "Prometheus: OTLP-Metrik via Remote-Write"  bash -c \
  "curl -sf 'http://$H:$PROM/api/v1/query?query=verify_gauge' | grep -q verify_gauge"

# --- Grafana
check "Grafana: /api/health" bash -c "curl -sf http://$H:$GRAFANA/api/health | grep -q '\"database\": *\"ok\"'"
check "Grafana: Datasources provisioniert (Prometheus + Loki)" bash -c \
  "curl -sf -u admin:admin http://$H:$GRAFANA/api/datasources | grep -q '\"uid\":\"prometheus\"' && \
   curl -sf -u admin:admin http://$H:$GRAFANA/api/datasources | grep -q '\"uid\":\"loki\"'"
check "Grafana: Dashboard 'devstack-overview' provisioniert" bash -c \
  "curl -sf -u admin:admin http://$H:$GRAFANA/api/dashboards/uid/devstack-overview | grep -q devstack-overview"
check "Grafana -> Prometheus (Datasource-Proxy-Query)" bash -c \
  "curl -sf -u admin:admin 'http://$H:$GRAFANA/api/datasources/proxy/uid/prometheus/api/v1/query?query=up' | grep -q success"
check "Grafana -> Loki (Datasource-Proxy, Labels)" bash -c \
  "curl -sf -u admin:admin 'http://$H:$GRAFANA/api/datasources/proxy/uid/loki/loki/api/v1/labels' | grep -q success"

echo
echo "== Ergebnis ($MODE): $PASS bestanden, $FAILED fehlgeschlagen"
(( FAILED == 0 ))
