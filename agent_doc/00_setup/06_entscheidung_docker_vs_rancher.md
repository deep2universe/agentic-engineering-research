# 06 – Entscheidung: Docker Compose oder Rancher?

## Empfehlung

**Für Software-Development-Sessions: Docker Compose (`40_compose_up.sh`) als Standard.**
Rancher nur, wenn Kubernetes selbst Teil der Aufgabe ist (Manifeste/Helm testen, Rancher-UI/-API,
K8s-Deployment der App). Für reines Kubernetes ohne UI: natives k3s (`10_k3s_native_start.sh`).

Beide Varianten sind lauffähig und nutzen **dieselben Config-Dateien** (`scripts/config/`) – ein
Wechsel ist jederzeit möglich.

## Vergleich (gemessen in dieser Sandbox)

| Kriterium | Docker Compose | Rancher (+ eingebetteter k3s) | natives k3s |
|---|---|---|---|
| Start bis Stack nutzbar | **~1–1,5 min** | ~1 min Rancher + ~3,5 min Deploy (gesamt ~4,5 min) | ~30 s Cluster + Deploy |
| RAM (kompletter Stack) | **~3,4 GB** (davon SonarQube 2,9) | ~6,5 GB | ~0,5 GB + Workloads |
| Disk zusätzlich | Images ~5 GB | + Rancher-Image 3 GB + Images doppelt (~5 GB) | Images doppelt |
| Sandbox-Workarounds | 2 (nur SonarQube) | 7 (cgroup v1, OOM-Score, CA, Eviction, conntrack, local-path, SonarQube) | 4 |
| Robustheit | hoch | mittel (Webhook-Restart-Loop möglich, `pkill`-Falle) | hoch |
| Ports | Standard (5432, 9000, 3000 …) | NodePorts 30100–30108 | NodePort/port-forward |
| Spring-Boot-App auf Host scrapen | ✅ `host.docker.internal` | ⚠️ nicht direkt | ⚠️ |
| Kubernetes-Realismus | – | ✅ inkl. Rancher-UI/API, Fleet | ✅ |
| E2E-Test `90_verify.sh` | 22/22 ✅ | 22/22 ✅ | (Basis-Netz getestet) |

## Begründung
- Compose ist schneller, braucht halb so viel RAM und hat kaum Fehlerquellen – wichtig, weil jede
  Session in einem frischen, kurzlebigen Container startet und Tokens/Zeit sparen soll.
- Rancher funktioniert nur durch tiefe Eingriffe in k3s/containerd (cgroup v1, fehlendes
  `CAP_SYS_RESOURCE`, TLS-Inspection); die Workarounds sind in den Skripten gekapselt, aber jede
  neue Rancher-Version kann neue Probleme bringen (z. B. geänderte containerd-Config-Version).
- Parallelbetrieb beider Varianten ist möglich (unterschiedliche Ports), aber RAM/Disk-kritisch –
  vorher die andere Variante stoppen (`99_stop.sh`).
