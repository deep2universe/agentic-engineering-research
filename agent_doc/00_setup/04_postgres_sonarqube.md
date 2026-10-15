# 04 – Postgres und SonarQube

## Postgres — Status: ✅

| | Compose | Rancher |
|---|---|---|
| Image | `postgres:16-alpine` (16.15) | dto. |
| Host-Port | `5432` | `30100` |
| App-DB | `appdb` / `devuser` / `devpass` | dto. |
| SonarQube-DB | `sonar` / `sonar` / `sonar` (aus `config/postgres/init.sql`) | dto. |
| Persistenz | Volume `devstack_pg-data` | hostPath im Volume `rancher-data` |

```bash
PGPASSWORD=devpass psql -h localhost -p 5432 -U devuser -d appdb -c 'select version();'
```
Spring Boot:
```properties
spring.datasource.url=jdbc:postgresql://localhost:5432/appdb
spring.datasource.username=devuser
spring.datasource.password=devpass
```
Geprüft: Login, `CREATE TABLE`/`INSERT`/`SELECT`, zweiter User/DB (`sonar`). `psql` 16 ist auf dem Host vorinstalliert.

> Hinweis: `init.sql` läuft nur beim **ersten** Start (leeres Datenverzeichnis). Nach Änderungen:
> `./99_stop.sh compose --purge` bzw. hostPath löschen.

## SonarQube — Status: ✅ (mit 2 Workarounds)

| | Compose | Rancher |
|---|---|---|
| Image | `sonarqube:community` (Community Build 26.10.0) | dto. |
| URL | `http://localhost:9000` | `http://localhost:30101` |
| Login | `admin` / `admin` (UI erzwingt Passwortwechsel beim 1. Login; API geht vorher) | dto. |
| DB | Postgres `sonar` | dto. |
| Startzeit | ~45–90 s bis `UP` | ~1–2 min |
| RAM | ~2,9 GB | dto. |

### Sandbox-Workarounds (beide nötig!)
1. `SONAR_ES_BOOTSTRAP_CHECKS_DISABLE=true` – Hard-Limit `nofile=20000` kann nicht auf 65535
   angehoben werden.
2. Wrapper-Entrypoint `config/sonarqube/sonar-entrypoint.sh`: setzt nach ES-Start per
   `PUT localhost:9001/_cluster/settings` `cluster.routing.allocation.disk.threshold_enabled=false`
   und `indices.merge.disk.watermark.high=100%`. Ohne das: nach einigen Minuten
   `flood stage disk watermark [95%] exceeded` → Indizes read-only → SonarQube beendet sich
   (`no_shard_available_action_exception`). Log-Zeile bei Erfolg: `[sonar-es-fix] ES-Disk-Watermarks deaktiviert`.
   - Versuch über `SONAR_SEARCH_JAVAADDITIONALOPTS=-D…` reichte **nicht** (Merge-Watermark blieb aktiv).
3. `vm.max_map_count=262144` auf dem Host (macht `00_docker_start.sh`).

### Analyse eines Projekts (getestet mit `examples/spring_boot_demo`)

```bash
# Token erzeugen (Analyse-Token)
TOKEN=$(curl -s -u admin:admin -X POST http://localhost:9000/api/user_tokens/generate \
  -d name=agent-$(date +%s) -d type=GLOBAL_ANALYSIS_TOKEN | python3 -c 'import sys,json;print(json.load(sys.stdin)["token"])')

# Maven (sonar-maven-plugin 5.8, JaCoCo-Coverage)
cd agent_doc/00_setup/examples/spring_boot_demo
mvn -B verify sonar:sonar -Dsonar.token=$TOKEN            # Rancher: -Dsonar.host.url=http://localhost:30101

# Ergebnis abfragen
curl -s -u admin:admin "http://localhost:9000/api/qualitygates/project_status?projectKey=spring-boot-demo"
curl -s -u admin:admin "http://localhost:9000/api/measures/component?component=spring-boot-demo&metricKeys=ncloc,coverage,bugs,code_smells"
```
Ergebnis im Test: Quality Gate `OK`, 87 NCLOC, Coverage 66,7 %, 0 Bugs, 0 Code Smells.

Für React/TypeScript: `npx sonarqube-scanner` (npm, erreichbar) oder `sonar-scanner`-Docker-Image
`sonarsource/sonar-scanner-cli` mit `-Dsonar.host.url=http://host.docker.internal:9000` – nicht separat getestet.
