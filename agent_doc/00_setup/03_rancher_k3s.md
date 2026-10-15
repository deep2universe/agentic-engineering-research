# 03 – Rancher (und k3s)

**Status: ✅ funktionsfähig – aber nur mit 5 Sandbox-Workarounds.**
Rancher v2.15.2 (Single-Node-Docker-Install, eingebetteter k3s v1.36) läuft, der Cluster `local`
ist `active`, Workloads lassen sich über die Rancher-API/-Kubeconfig deployen und sind über
NodePorts vom Host aus erreichbar.

> Mit „Rencher“ in der Aufgabenstellung ist **Rancher** (SUSE) gemeint. Rancher Desktop (GUI-App)
> ist in der Sandbox nicht nutzbar; geprüft wurden **Rancher Server** (Container `rancher/rancher`)
> und **k3s** (Rancher-Kubernetes-Distribution) nativ.

## Schnellstart

```bash
cd agent_doc/00_setup/scripts
./00_docker_start.sh            # Docker + sysctl + CA-Verzeichnis
./20_rancher_start.sh           # Rancher-Container, wartet auf Cluster, erzeugt Kubeconfig (~1 min)
./30_rancher_deploy_stack.sh    # Postgres, SonarQube, Grafana, Prometheus, Loki, Alloy (~3–4 min inkl. Image-Import)
./90_verify.sh rancher          # 22 End-to-End-Checks
```

| Was | Wert |
|---|---|
| Rancher-UI | `https://127.0.0.1:8443` (selbstsigniert) · `admin` / `admin12345678` (`RANCHER_PASSWORD`) |
| Kubeconfig (über Rancher-Proxy `/k8s/clusters/local`) | `/opt/devstack/rancher-kubeconfig.yaml` |
| API-Token | `/opt/devstack/rancher-token` (Bearer) |
| Direkter Cluster-Zugriff (Debug) | `docker exec rancher kubectl …` |
| Dev-Services | NodePorts 30100–30108 → 1:1 auf den Host gemappt (siehe Tabelle unten) |

```bash
export KUBECONFIG=/opt/devstack/rancher-kubeconfig.yaml
kubectl -n devstack get pods
# Rancher-API (Steve) – dieselben Workloads wie in der UI:
curl -sk -H "Authorization: Bearer $(cat /opt/devstack/rancher-token)" \
  "https://127.0.0.1:8443/v1/apps.deployments?filter=metadata.namespace=devstack"
```

## Die Workarounds im Detail

Der Rancher-Container wird so gestartet (`20_rancher_start.sh`):

```bash
docker run -d --name rancher --privileged --restart=unless-stopped \
  -p 8080:80 -p 8443:443 -p 30100-30110:30100-30110 \
  -e CATTLE_BOOTSTRAP_PASSWORD=admin12345678 \
  -e SSL_CERT_DIR=/etc/ssl/certs -e SSL_CERT_FILE=/etc/ssl/ca-bundle.pem \
  -v rancher-data:/var/lib/rancher \
  -v $CONFIG/rancher-k3s-config.yaml:/etc/rancher/k3s/config.yaml:ro \
  -v $CONFIG/containerd-config.toml.tmpl:/var/lib/rancher/k3s/agent/etc/containerd/config.toml.tmpl:ro \
  -v /opt/sandbox-ca:/etc/pki/trust/anchors:ro \
  rancher/rancher:latest
```

| Mount / Env | Löst | Ohne Workaround |
|---|---|---|
| `/etc/rancher/k3s/config.yaml` → `kubelet-arg: fail-cgroupv1=false` | cgroup v1 | k3s stirbt sofort, Rancher Restart-Loop (danach `reset-flag`-Fehler) |
| `config.yaml` → `eviction-hard=…<1Gi`, `image-gc-*` | Disk-Quota vs. 252-GB-Anzeige | Pods `Evicted`, Node `DiskPressure` |
| `config.yaml` → `kube-proxy-arg: conntrack-max-per-core=0` | conntrack-sysctl | Fehler-Logs |
| `config.toml.tmpl` (containerd) → `restrict_oom_score_adj = true` | fehlendes `CAP_SYS_RESOURCE` | **kein Pod startet** (`can't get final child's PID from pipe: EOF`) |
| `/etc/pki/trust/anchors` + `SSL_CERT_DIR/FILE` | TLS-Inspection | `x509: certificate signed by unknown authority`, CoreDNS/Fleet `ErrImagePull`, Rancher FATAL „imperative api“ |

Weitere Erkenntnisse:
- k3s liest `/etc/rancher/k3s/config.yaml` auch im Rancher-Container – darüber lassen sich alle
  k3s/Kubelet-Flags setzen (das Rancher-Entrypoint bietet keine eigenen k3s-Args).
- Das containerd-Template nutzt k3s-Template-Variablen (`{{ .NodeConfig.AgentConfig.CNIBinDir }}` …)
  und funktioniert deshalb unverändert für Rancher **und** natives k3s.
- Rancher-k3s hat **keinen local-path-Provisioner** → Postgres nutzt ein `hostPath`-Volume
  (`/var/lib/rancher/devstack/pg-data`, liegt im Docker-Volume `rancher-data`).
- `k3s ctr` existiert im Rancher-k3s nicht; Image-Import mit
  `docker save IMG | docker exec -i rancher ctr --address /run/k3s/containerd/containerd.sock -n k8s.io images import -`.
- Metrics-API (`kubectl top`) ist nicht verfügbar.

## Gemessene Werte

| Messung | Wert |
|---|---|
| `20_rancher_start.sh` (frisch, Image vorhanden) | ~40–60 s bis `/ping` + Cluster `local` Ready |
| `30_rancher_deploy_stack.sh` (inkl. Import von 6 Images) | ~3,5 min im frischen Durchlauf (erster Versuch mit Fehlersuche deutlich länger) |
| Kompletter Neuaufbau 20 → 30 → 90 | **~4,5 min** (gemessen 266 s) |
| RAM Rancher-Container mit Stack | ~6,5 GB (Rancher selbst ~2,5–3 GB) |
| Disk | `rancher/rancher`-Image ~3 GB + Stack-Images ~5 GB im Rancher-containerd (zusätzlich zu Docker) |
| Ergebnis `90_verify.sh rancher` | **22/22 bestanden** |

## NodePorts der Dev-Services (Rancher-Variante)

| Service | Host-Port | Zugang |
|---|---|---|
| Postgres | 30100 | `appdb`/`devuser`/`devpass`, `sonar`/`sonar`/`sonar` |
| SonarQube | 30101 | `admin`/`admin` |
| Grafana | 30102 | `admin`/`admin` |
| Prometheus | 30103 | – |
| Loki | 30104 | – |
| Alloy Faro (React) | 30105 | `http://localhost:30105/collect` |
| Alloy OTLP HTTP / gRPC | 30106 / 30107 | – |
| Alloy UI | 30108 | – |

## Bekannte Stolperfallen

1. **`pkill -x k3s` / `pgrep -x k3s` auf dem Host trifft auch den k3s IM Rancher-Container**
   (Container-Prozesse sind im Host-`ps` sichtbar). Folge: Rancher-Restart-Loop. Natives k3s daher
   nur über PID-Datei `/run/k3s-native.pid` stoppen (`99_stop.sh k3s`).
2. **Restart-Loop „failed calling webhook … rancher-webhook: no endpoints“** nach unsauberem Neustart:
   ```bash
   docker exec rancher kubectl delete validatingwebhookconfiguration rancher.cattle.io
   docker exec rancher kubectl delete mutatingwebhookconfiguration rancher.cattle.io
   ```
   Rancher legt sie neu an. `20_rancher_start.sh` erkennt und behebt das automatisch.
3. Rollout-Deadline: SonarQube braucht länger → `progressDeadlineSeconds: 1200`; die Readiness-Probe
   prüft auf `"status":"UP"` (der Endpoint liefert auch bei `STARTING` HTTP 200).
4. Bei Volume-Resten aus abgebrochenen Starts: `./99_stop.sh rancher --purge` (löscht `rancher-data`).

## Alternative: natives k3s (ohne Rancher-UI)

```bash
./10_k3s_native_start.sh     # ~30 s, Kubeconfig /etc/rancher/k3s/k3s.yaml
./99_stop.sh k3s
```
- Binaries (k3s, containerd, runc, CNI-Plugins) werden aus dem Image `rancher/k3s` extrahiert
  (GitHub-Releases gesperrt) nach `/opt/k3s/bin`; `kubectl` → Symlink auf k3s.
- Gleiche Workarounds (cgroup v1, containerd-Template, Eviction). Image-Pulls funktionieren hier
  ohne CA-Mount, weil der Host-Trust-Store genutzt wird.
- Getestet: Node Ready, CoreDNS, local-path-Provisioner, Pod-Netz, NodePort und `kubectl port-forward` ✅.
- Leichtgewichtig (~0,5 GB RAM) – sinnvoll, wenn nur Kubernetes (kubectl/Helm/Manifeste) gebraucht wird.
- **Fehlversuch dokumentiert:** k3s mit `--docker` (cri-dockerd) scheitert am selben
  `oom_score_adj`-Problem, und hier greift kein containerd-Template → nicht verwenden.
