# 01 – Sandbox-Umgebung: Fakten, Limits, Workarounds

> Stand: 2026-10-15 · geprüft in einer Claude-Code-Cloud-Session (Remote-Container)
> Zweck: Diese Fakten **nicht** in jeder Session neu herausfinden.

## Eckdaten der Sandbox

| Eigenschaft | Wert | Konsequenz |
|---|---|---|
| OS | Ubuntu 24.04.5 LTS, Kernel `6.18.x-fc` (Firecracker-VM) | – |
| User | `root`, **aber ohne `CAP_SYS_RESOURCE`** (CapEff `000001fffeffffff`) | kein negativer `oom_score_adj`, kein Anheben von Limits |
| CPU / RAM | 4 vCPU / ~16 GB, kein Swap | Rancher + SonarQube zusammen ≈ 6,5 GB |
| Disk | `df` zeigt 252 GB, **echte Quota ≈ 40 GB** (frei anfangs ~30 GB) | Tools mit %-Schwellen (Kubelet, Elasticsearch) rechnen falsch |
| cgroups | **cgroup v1** (`/sys/fs/cgroup/memory`, …) | Kubernetes ≥ 1.35 verweigert Start ohne Flag |
| init | kein systemd | Daemons per `nohup … &` starten |
| `ulimit -n` | 20000 (hart, nicht anhebbar) | Elasticsearch-Bootstrap-Check (65535) schlägt fehl |
| `vm.max_map_count` | 65530 (per `sysctl -w` auf 262144 setzbar ✅) | für SonarQube nötig, wird von `00_docker_start.sh` gesetzt |
| Vorinstalliert | Docker 29.8 (CLI + dockerd + compose v5 + buildx), Java 21, Maven 3.9, Gradle 8.14, Node 20/21/22, `psql` 16, Chromium (`/opt/pw-browsers`) | – |
| Nicht vorinstalliert | kubectl, k3s, helm, Rancher | kommen aus Docker-Images (siehe 03) |

## Netzwerk / Egress

- Ausgehendes HTTPS läuft über einen **TLS-inspizierenden Proxy** (`HTTPS_PROXY=http://127.0.0.1:<port>`).
- **Host-Prozesse** vertrauen dem Proxy bereits (System-Trust-Store, JVM-Truststore, npm, Maven).
- **Container-Traffic** wird transparent abgefangen (keine Proxy-Env nötig), aber mit einer
  **anderen CA** („sandbox-egress-gateway-production Egress Gateway CA“). Container brauchen daher
  das CA-Bundle:
  - Debian/Alpine-Images: `-v /root/.ccr/ca-bundle.crt:/etc/ssl/certs/ca-certificates.crt:ro`
  - SUSE-Images (z. B. `rancher/rancher`): einzelne CA-Dateien nach `/etc/pki/trust/anchors/`
    (SUSE liest pro Datei nur das erste Zertifikat!) → `prepare_ca_dir` in `scripts/lib.sh`
    erzeugt `/opt/sandbox-ca/anthropic-*.crt`.
- `dockerd` muss mit gesetztem `HTTPS_PROXY` gestartet werden (erbt die Env) → Pulls von Docker Hub funktionieren.

### Erreichbarkeit (getestet)

| Ziel | Status | Bemerkung |
|---|---|---|
| Docker Hub (`registry-1.docker.io`) | ✅ | alle Images gepullt |
| Maven Central (`repo.maven.apache.org`) | ✅ | Artefakte 200 (Root-URL liefert 429 – irrelevant) |
| npm Registry | ✅ | `npm create vite`, `npm install` |
| plugins.gradle.org | ✅ | – |
| **github.com (Releases/Downloads)** | ❌ | nur für freigegebene Repos; k3s-Binary daher aus Docker-Image |
| **start.spring.io** | ❌ 403 | Spring-Projekte von Hand/aus Template (`examples/spring_boot_demo`) |
| **grafana.com** (Dashboard-Import per ID) | ❌ 403 | eigenes Dashboard wird provisioniert |

Gesperrte Hosts nicht erneut versuchen; Status prüfen mit
`curl -sS "$HTTPS_PROXY/__agentproxy/status"` (Feld `recentRelayFailures`).

## Übersicht der Workarounds

| # | Problem (Symptom) | Ursache | Workaround | Wo umgesetzt |
|---|---|---|---|---|
| 1 | `docker: failed to connect … docker.sock` | kein systemd | `nohup dockerd &` | `00_docker_start.sh` |
| 2 | Kubelet: `kubelet is configured to not run on a host using cgroup v1` | K8s ≥ 1.35, `failCgroupV1=true` | `--kubelet-arg=fail-cgroupv1=false` | `config/rancher-k3s-config.yaml`, `10_k3s_native_start.sh` |
| 3 | Pods hängen in `ContainerCreating`: `runc create failed … can't get final child's PID from pipe: EOF` / `failed to update /proc/self/oom_score_adj: Permission denied` | Kubelet setzt `oom_score_adj=-998` für Pod-Sandboxes, ohne `CAP_SYS_RESOURCE` verboten | containerd `restrict_oom_score_adj = true` (Template) | `config/containerd-config.toml.tmpl` |
| 4 | `x509: certificate signed by unknown authority` bei Image-Pulls im Cluster | TLS-Inspection im Egress | CA-Bundle/Anchors mounten, im Rancher-Container zusätzlich `SSL_CERT_DIR`/`SSL_CERT_FILE` überschreiben (Image setzt `SSL_CERT_DIR=/etc/rancher/ssl`) | `20_rancher_start.sh` |
| 5 | Pods `Evicted`, Node `DiskPressure` | Kubelet rechnet %-Schwellen auf 252 GB | absolute `eviction-hard`-Werte (`<1Gi`) | `config/rancher-k3s-config.yaml` |
| 6 | Elasticsearch: `max file descriptors [20000] … too low` | Hard-Limit, nicht anhebbar | `SONAR_ES_BOOTSTRAP_CHECKS_DISABLE=true` | Compose + K8s-Manifest |
| 7 | SonarQube stoppt nach Minuten, `flood stage disk watermark [95%] exceeded`, `no_shard_available_action_exception` | ES-Watermarks in % von 252 GB | Wrapper-Entrypoint setzt ES-Disk-Settings per API | `config/sonarqube/sonar-entrypoint.sh` |
| 8 | `kube-proxy: Failed to set sysctl nf_conntrack_max` | nicht schreibbar | `conntrack-max-per-core=0` | k3s-Konfig |
| 9 | Playwright: `Executable doesn't exist …chromium_headless_shell-XXXX` | Playwright-Version ≠ vorinstallierter Browser | `executablePath: '/opt/pw-browsers/chromium'`, nie `playwright install` | `examples/react_faro_demo/faro_smoke_test.mjs` |

Details und Diagnose-Kommandos: `07_troubleshooting.md`.
