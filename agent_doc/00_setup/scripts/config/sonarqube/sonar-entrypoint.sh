#!/bin/bash
# Wrapper-Entrypoint fuer SonarQube in der Claude-Code-Sandbox.
# Problem: Das eingebettete Elasticsearch rechnet Disk-Watermarks prozentual von der
# 252-GB-Disk, die Sandbox-Quota ist aber viel kleiner (~40 GB). Ergebnis: "flood stage"
# -> Indizes read-only, Merges blockiert, SonarQube stoppt nach einigen Minuten.
# Loesung: Sobald ES (localhost:9001) antwortet, Disk-Checks per Cluster-API abschalten.
# Die Settings sind "persistent" (liegen im ES-Datenverzeichnis). NUR fuer Dev!
(
  for _ in $(seq 1 120); do
    if curl -s -o /dev/null http://localhost:9001; then
      curl -s -XPUT http://localhost:9001/_cluster/settings -H 'Content-Type: application/json' -d '{
        "persistent": {
          "cluster.routing.allocation.disk.threshold_enabled": false,
          "indices.merge.disk.watermark.high": "100%",
          "indices.merge.disk.watermark.high.max_headroom": "0b"
        }}' >/dev/null && echo "[sonar-es-fix] ES-Disk-Watermarks deaktiviert"
      # read-only-Bloecke entfernen, falls ES sie vorher schon gesetzt hat
      curl -s -XPUT 'http://localhost:9001/_all/_settings' -H 'Content-Type: application/json' \
        -d '{"index.blocks.read_only_allow_delete": null}' >/dev/null
      break
    fi
    sleep 5
  done
) &
exec /opt/sonarqube/docker/entrypoint.sh "$@"
