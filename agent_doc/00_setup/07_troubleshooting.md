# 07 – Troubleshooting & Lessons Learned

## Agent-spezifische Fallen (kosten sonst viele Tokens)

| Falle | Erklärung | Richtig |
|---|---|---|
| `pkill -f '<muster>'` beendet die **eigene Shell** (Exit-Code 144) | Das Bash-Tool führt `bash -c "<ganzer Befehl>"` aus – das Muster steht in der eigenen Kommandozeile | Muster verankern: `pkill -f '^java -jar target/demo'`, oder PID-Datei |
| `pgrep/pkill -x k3s` trifft Rancher | Prozesse in Containern sind im Host-`ps` sichtbar | PID-Datei `/run/k3s-native.pid` |
| Config geändert, Container sieht alte Version | Bind-Mount einer Datei hängt am Inode; `sed -i`/Python-Rewrite erzeugt neuen Inode | `docker compose restart <svc>` (Prometheus `/-/reload` reicht dann nicht) |
| Foreground-`sleep` blockiert | Tool erlaubt kein langes `sleep` | `timeout N bash -c 'until <check>; do sleep 3; done'` oder `run_in_background` |
| Lange Deploys > 10 min | Tool-Timeout | Skript mit `nohup … > log &` starten und Log pollen |
| `playwright install` | lädt Browser, unnötig | `executablePath: '/opt/pw-browsers/chromium'` |

## Diagnose-Kommandos

```bash
# Docker
docker info; tail -50 /var/log/dockerd.log
# Proxy / gesperrte Hosts
curl -sS "$HTTPS_PROXY/__agentproxy/status" | python3 -m json.tool | less
# Rancher
docker logs rancher 2>&1 | grep -E 'FATAL|ERROR' | tail
docker exec rancher tail -100 /var/lib/rancher/k3s.log        # eingebetteter k3s
docker exec rancher kubectl get pods -A
docker exec rancher kubectl describe node local-node | grep -A8 Conditions
# Pod-Probleme
kubectl -n devstack describe pod -l app=<name> | tail -20
kubectl -n devstack logs deploy/<name> --previous
# natives k3s
tail -100 /var/log/k3s.log
# SonarQube / Elasticsearch
docker logs devstack-sonarqube-1 | grep -E 'sonar-es-fix|ERROR'
docker exec devstack-sonarqube-1 tail /opt/sonarqube/logs/es.log
docker exec devstack-sonarqube-1 curl -s 'localhost:9001/_cluster/health?pretty'
# Disk (Quota! df zeigt 252 GB)
df -h /; docker system df
```

## Fehlerbilder → Ursache

| Symptom | Ursache | Fix |
|---|---|---|
| Rancher-Container startet ständig neu, `k3s.log`: `kubelet is configured to not run on a host using cgroup v1` | cgroup v1 | `rancher-k3s-config.yaml` mounten |
| Danach: `Managed etcd cluster membership was previously reset … reset-flag` | Folgefehler alter Daten | `./99_stop.sh rancher --purge` und neu |
| Pods `ContainerCreating`, `can't get final child's PID from pipe: EOF` | `oom_score_adj` | containerd-Template |
| `ErrImagePull … x509: certificate signed by unknown authority` | CA fehlt | CA-Anchors + `SSL_CERT_*` (Rancher) / Bundle mounten |
| Rancher FATAL `kube-apiserver did not contact the rancher imperative api in time` | Folge von ErrImagePull (Pods kommen nicht hoch) | CA-Fix |
| Rancher FATAL `failed calling webhook … rancher-webhook` (Loop) | Webhook-Pod nach unsauberem Neustart nicht da | Webhook-Configs löschen (macht `20_rancher_start.sh`) |
| Pods `Evicted`, `low on resource: ephemeral-storage` | Kubelet-%-Schwellen | absolute `eviction-hard` |
| PVC `Pending`, `unbound immediate PersistentVolumeClaims` | Rancher-k3s ohne local-path | hostPath |
| SonarQube: `Elasticsearch died … exit code: 78`, `max file descriptors [20000]` | nofile-Limit | `SONAR_ES_BOOTSTRAP_CHECKS_DISABLE=true` |
| SonarQube läuft, stoppt nach Minuten; `es.log`: `flood stage disk watermark` | ES-%-Watermarks | `sonar-entrypoint.sh` |
| `/api/system/status` = `STARTING` lange | DB-Migration / ES-Start | 1–2 min warten |
| Spring-Logs erscheinen erst nach 60 s in Loki | Loki4j `batchTimeout` Default 60 s | `<batch><timeoutMs>2000</timeoutMs></batch>` |
| Prometheus: Label `exported_application` | statisches Label kollidiert | im Scrape-Job kein `application`-Label |
| Loki-Query `{app=~".*"}` → 400 | leerer Matcher nicht erlaubt | `.+` |
| `curl https://… ` 403 bei CONNECT | Host per Policy gesperrt | nicht wiederholen, Alternative nutzen |
