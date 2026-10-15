# 00_setup – Dev-Infrastruktur in der Claude-Code-Sandbox

> **Für KI-Agenten:** Diese Datei zuerst lesen. Alles hier wurde am 2026-10-15 in einer
> Claude-Code-Cloud-Session praktisch geprüft. Nicht neu untersuchen – Skripte ausführen.

## TL;DR – Dev-Stack in ~2 Minuten

```bash
cd /home/user/agentic-engineering-research/agent_doc/00_setup/scripts
./00_docker_start.sh        # Docker-Daemon + Kernel-Parameter (idempotent)
./40_compose_up.sh          # Postgres, SonarQube, Grafana, Prometheus, Loki, Alloy
./90_verify.sh compose      # 22 End-to-End-Checks
```

| Dienst | URL / Port (Compose) | Login |
|---|---|---|
| Postgres | `localhost:5432` | `appdb` / `devuser` / `devpass` |
| SonarQube | http://localhost:9000 | `admin` / `admin` |
| Grafana | http://localhost:3000 | `admin` / `admin` – Dashboard „Devstack: Spring Boot + React“ |
| Prometheus | http://localhost:9090 | – |
| Loki | http://localhost:3100 | – |
| Alloy | Faro `:12347/collect`, OTLP `:4317`/`:4318`, UI `:12345` | – |

Stoppen: `./99_stop.sh compose` (mit `--purge` inkl. Volumes).

## Ergebnis der Prüfung

| Technologie | Status | Kurzfazit | Doku |
|---|---|---|---|
| Docker 29.8 + Compose v5 | ✅ | Daemon muss per Skript gestartet werden; Container-HTTPS braucht CA-Bundle | [02_docker.md](02_docker.md) |
| Rancher 2.15 (Docker-Install) | ✅ mit Workarounds | läuft, Cluster `local` aktiv, Stack per Rancher deploybar – 5 Sandbox-Fixes nötig | [03_rancher_k3s.md](03_rancher_k3s.md) |
| k3s nativ (Rancher-K8s) | ✅ mit Workarounds | leichtgewichtiges Kubernetes in ~30 s | [03_rancher_k3s.md](03_rancher_k3s.md) |
| Postgres 16 | ✅ | Compose & Rancher | [04_postgres_sonarqube.md](04_postgres_sonarqube.md) |
| SonarQube Community 26.10 | ✅ mit Workarounds | ES-Limits umgangen; Maven-Analyse getestet | [04_postgres_sonarqube.md](04_postgres_sonarqube.md) |
| Grafana 13 + Prometheus 3 + Loki 3 + Alloy 1.20 | ✅ | Spring Boot (Metriken+Logs) und React (Faro) E2E getestet | [05_observability_spring_boot_react.md](05_observability_spring_boot_react.md) |
| microsandbox 0.7.8 | ❌ | braucht `/dev/kvm` – fehlt (Sandbox ist PVM-Gast, keine Nested Virtualization) | [08_microvm_microsandbox.md](08_microvm_microsandbox.md) |
| microVM via QEMU `-M microvm` (TCG) | ✅ | Docker-Image → microVM in ~5,7 s, Netz/Workspace/Ports; CPU ~15× langsamer | [08_microvm_microsandbox.md](08_microvm_microsandbox.md) |
| gVisor (runsc) | ✅ | Docker-Runtime mit User-Space-Kernel, ≈ native Leistung – **Empfehlung für isolierte Code-Ausführung** | [08_microvm_microsandbox.md](08_microvm_microsandbox.md) |

**Entscheidung:** Docker Compose als Standard für Development-Sessions, Rancher wenn Kubernetes
Teil der Aufgabe ist → [06_entscheidung_docker_vs_rancher.md](06_entscheidung_docker_vs_rancher.md).
Postgres, SonarQube und Grafana wurden wie gewünscht **auch über Rancher** gestartet und mit
22/22 Checks verifiziert.

## Isolierte Code-Ausführung (microVM / gVisor)

```bash
./55_gvisor_install.sh --test                                   # gVisor als Docker-Runtime
docker run --rm --runtime=runsc -v "$PWD":/work -w /work python:3.12-alpine python3 script.py

./50_microvm_setup.sh                                           # QEMU-microVM (ohne KVM, TCG)
./51_microvm_run.sh --work "$PWD" python:3.12-alpine -- python3 /work/script.py
./52_microsandbox_check.sh                                      # microsandbox, nur mit /dev/kvm
```

## Rancher-Variante

```bash
./00_docker_start.sh
./20_rancher_start.sh            # Rancher-UI https://127.0.0.1:8443 (admin / admin12345678)
./30_rancher_deploy_stack.sh     # Stack in Namespace devstack, NodePorts 30100-30108
./90_verify.sh rancher
./99_stop.sh rancher [--purge]
```

## Dateien

```
00_setup/
├── README.md                         ← Einstieg (diese Datei)
├── 01_sandbox_umgebung.md            ← Limits der Sandbox + Workaround-Tabelle
├── 02_docker.md
├── 03_rancher_k3s.md
├── 04_postgres_sonarqube.md
├── 05_observability_spring_boot_react.md
├── 06_entscheidung_docker_vs_rancher.md
├── 07_troubleshooting.md             ← Fehlerbilder, Diagnose, Agent-Fallen
├── 08_microvm_microsandbox.md        ← KVM-Befund, microsandbox, QEMU-microVM, gVisor
├── _quellen.md
├── scripts/
│   ├── lib.sh                        ← gemeinsame Helfer (wait_for, ensure_kubectl, prepare_ca_dir)
│   ├── 00_docker_start.sh
│   ├── 10_k3s_native_start.sh        ← optional: k3s ohne Rancher
│   ├── 20_rancher_start.sh
│   ├── 30_rancher_deploy_stack.sh
│   ├── 40_compose_up.sh
│   ├── 50_microvm_setup.sh           ← QEMU + Gastkernel (microVM ohne KVM)
│   ├── 51_microvm_run.sh             ← Befehl in frischer microVM aus Docker-Image ausfuehren
│   ├── 52_microsandbox_check.sh      ← microsandbox installieren/pruefen (braucht KVM)
│   ├── 55_gvisor_install.sh          ← gVisor-Runtime fuer Docker
│   ├── 90_verify.sh                  ← E2E-Test (compose|rancher)
│   ├── 99_stop.sh                    ← compose|rancher|rancher-stack|k3s|all
│   └── config/                       ← EINE Quelle für Compose und Rancher
│       ├── docker-compose.yml
│       ├── k8s/devstack.yaml
│       ├── prometheus.yml, config.alloy
│       ├── grafana/ (datasources, dashboard provider, devstack_overview.json)
│       ├── postgres/init.sql
│       ├── sonarqube/sonar-entrypoint.sh
│       ├── microvm/init.sh           ← PID 1 in der microVM
│       ├── rancher-k3s-config.yaml
│       └── containerd-config.toml.tmpl
└── examples/
    ├── spring_boot_demo/             ← Spring Boot 4.1 + Actuator/Prometheus + Loki4j + Sonar/JaCoCo
    └── react_faro_demo/              ← Vite + React 19 + Grafana Faro + Playwright-Smoke-Test
```

## Wichtigste Fakten (Kurzfassung von 01)

- cgroup v1, root ohne `CAP_SYS_RESOURCE`, `nofile` hart 20000, Disk-Quota ~40 GB obwohl `df` 252 GB zeigt.
- Egress über TLS-inspizierenden Proxy: Host vertraut ihm, **Container brauchen das CA-Bundle** `/root/.ccr/ca-bundle.crt`.
- Gesperrt: GitHub-Downloads (außer freigegebene Repos), `start.spring.io`, `grafana.com`. Erreichbar: Docker Hub, Maven Central, npm.
- Kein `/dev/kvm` → keine KVM-microVMs (microsandbox, Firecracker, Kata). Alternativen: gVisor, QEMU-TCG.
- Docker Hub kann mit `429 Too Many Requests` antworten (anonymes Rate-Limit) → erneut versuchen, Images wiederverwenden.
- Die Sandbox-VM kann zwischendurch **neu booten**: Prozesse (dockerd, k3s) sind weg, die Disk bleibt →
  `00_docker_start.sh` erneut ausführen; Rancher startet per Restart-Policy von selbst.
- Alle Daten sind **ephemer** – der Container wird nach der Session verworfen. Persistentes gehört ins Git-Repo.
