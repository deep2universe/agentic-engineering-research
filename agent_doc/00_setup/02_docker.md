# 02 – Docker

**Status: ✅ voll funktionsfähig** (Daemon, Pull, Run, Port-Mapping, Volumes, Compose, Buildx)

## Start

```bash
agent_doc/00_setup/scripts/00_docker_start.sh          # idempotent
agent_doc/00_setup/scripts/00_docker_start.sh --test   # + hello-world + Container-Egress-Test
```

Das Skript
1. setzt `vm.max_map_count=262144` (SonarQube/Elasticsearch),
2. startet `dockerd` per `nohup` (Log: `/var/log/dockerd.log`), falls nicht aktiv,
3. legt `/opt/sandbox-ca/` mit den Egress-CAs an (für Rancher, siehe 01).

## Geprüfte Eigenschaften

| Prüfung | Ergebnis |
|---|---|
| `docker info` | Server 29.8.2, Storage `overlayfs` (containerd-Snapshotter), Cgroup-Driver `cgroupfs`, **cgroup v1** |
| Pull von Docker Hub | ✅ über `HTTPS_PROXY` des Daemons (8 Images parallel, ~10 GB, wenige Minuten) |
| `docker run hello-world` | ✅ |
| Port-Mapping (`-p`) | ✅ (userland-proxy), z. B. 5432, 3000, 9000 |
| Named Volumes, Bind-Mounts | ✅ |
| `docker compose` v5 | ✅ (`scripts/40_compose_up.sh`) |
| `--privileged` | ✅ (nötig für Rancher) |
| `host.docker.internal` via `extra_hosts: host-gateway` | ✅ (Prometheus scrapt Spring Boot auf dem Host) |
| HTTPS aus Containern | ⚠️ nur mit gemountetem CA-Bundle (`/root/.ccr/ca-bundle.crt`) |
| `--ulimit nofile>20000`, `--oom-score-adj<0` | ❌ (kein `CAP_SYS_RESOURCE`) |

## Hinweise

- **Docker-in-Docker / Kubernetes-in-Docker** (z. B. `rancher/k3s` als Container, k3d, kind)
  scheitert ohne den containerd-Workaround #3 aus `01_sandbox_umgebung.md`. Rancher funktioniert,
  weil wir das containerd-Template in den Container mounten.
- Bind-Mount einzelner Dateien: Wird die Datei auf dem Host durch Ersetzen (neuer Inode, z. B. `sed -i`,
  Editor mit Atomic-Save) geändert, sieht der Container weiterhin die **alte** Version →
  `docker compose restart <service>` bzw. `up -d --force-recreate <service>`.
- Disk sparen: `docker image prune`, `docker volume prune`; Images der Rancher-Variante liegen
  zusätzlich im containerd von Rancher (doppelter Platzbedarf).
