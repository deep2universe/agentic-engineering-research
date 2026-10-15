# 08 – microVMs, microsandbox und gVisor

> Frage: Können wir in der Sandbox **microsandbox** bzw. **microVMs** nutzen, z. B. um von Agenten
> erzeugten Code isoliert auszuführen? Stand 2026-10-15, praktisch geprüft.

## Kurzfazit

| Technologie | Status | Isolation | Start | CPU-Leistung | Einsatz |
|---|---|---|---|---|---|
| **microsandbox** 0.7.8 (libkrun) | ❌ hier nicht lauffähig | microVM (KVM) | – | – | erste Wahl auf Hosts **mit** `/dev/kvm` |
| Firecracker / Cloud Hypervisor / Kata | ❌ (brauchen KVM) | microVM | – | – | – |
| **QEMU `-M microvm` + TCG** | ✅ `51_microvm_run.sh` | echte VM, eigener Kernel 6.8 | **~5,7 s** | **~15–17× langsamer** | maximale Isolation, kurze Jobs, Kernel-Tests |
| **gVisor** (`runsc`, systrap) | ✅ `55_gvisor_install.sh` | User-Space-Kernel | ~0,4 s | ≈ nativ (fork/exec ~4,6× langsamer) | **Empfehlung** für isolierte Code-Ausführung |
| Docker (runc) | ✅ | Namespaces/cgroups | ~0,33 s | nativ | normale Dev-Services |

**Empfehlung:** Für „untrusted code“ in dieser Sandbox **gVisor** (`docker run --runtime=runsc`).
Echte microVMs nur, wenn ein eigener Kernel nötig ist oder maximale Isolation wichtiger ist als Tempo.
Läuft eine künftige Umgebung mit KVM, ist microsandbox die beste Wahl (`52_microsandbox_check.sh` erkennt das).

## Warum kein KVM? (Befund)

```
/dev/kvm                    fehlt;  mknod c 10 232 -> open(): ENODEV
/proc/cpuinfo               Flag "hypervisor", KEINE vmx/svm
Kernel-Config               CONFIG_KVM=y, CONFIG_KVM_PVM=y, CONFIG_PVM_GUEST=y, kein KVM_INTEL/AMD
/proc/misc                  kein "kvm"-Eintrag
```
Die Sandbox ist selbst ein **PVM-Gast** (Pagetable-based Virtual Machine, Ant Group/Alibaba:
Virtualisierung ohne VMX per Shadow-Paging) in einer Firecracker-artigen VM. Das KVM-Subsystem ist
einkompiliert, aber kein Vendor-Modul initialisiert sich, also wird kein `/dev/kvm` registriert.
Nested Virtualization ist **nicht** verfügbar. Das lässt sich von innen nicht ändern.

## microsandbox – was getestet wurde

- Installation: `get.microsandbox.dev` ist gesperrt, aber **npm** (`microsandbox`, enthält `msb`-Binary +
  `libkrunfw.so`) bzw. PyPI (`microsandbox`-Wheel) funktionieren.
- `msb run alpine -- …` pullt das OCI-Image erfolgreich, dann bricht der VMM ab:
  `panicked at msb_krun_vmm…/vstate.rs: Error creating the Kvm object: Error(2)`.
- `msb doctor`: `✗ CPU virt not found`, `✗ KVM device missing`.
- Skript: `scripts/52_microsandbox_check.sh` (installiert nach `/opt/microsandbox`, führt `doctor` aus,
  testet nur, wenn `/dev/kvm` existiert).

## QEMU-microVM ohne KVM (`50_microvm_setup.sh`, `51_microvm_run.sh`)

**Idee:** Das Root-Dateisystem kommt aus einem beliebigen Docker-Image (`docker export` → initramfs,
gecacht). Eine statische busybox-Init richtet Netzwerk und Workspace ein und führt den Befehl aus.
Der Exit-Code wird an den Host zurückgegeben. Im Prinzip also ein „microsandbox-light“ auf TCG-Basis.

```bash
cd agent_doc/00_setup/scripts
./00_docker_start.sh
./50_microvm_setup.sh                       # apt: qemu-system-x86, busybox-static, zstd; Ubuntu-Kernel 6.8 (~1 min)
./51_microvm_run.sh alpine:3.20 -- uname -a
./51_microvm_run.sh --work "$PWD" python:3.12-alpine -- python3 /work/script.py
./51_microvm_run.sh --port 18080:8000 python:3.12-alpine -- python3 -m http.server 8000
./51_microvm_run.sh --mem 2048 --cpus 4 --env FOO=bar node:22-alpine -- node -e 'console.log(process.env.FOO)'
```

| Feature | Umsetzung | Getestet |
|---|---|---|
| Kernel | Ubuntu `linux-image-6.8.0-*-generic` aus dem Apt-Archiv (virtio-mmio/-net/-blk fest eingebaut) | ✅ |
| Rootfs | Docker-Image → `/opt/microvm/cache/<image>.cpio.gz` (alpine 5 MB, python:3.12-alpine 20 MB) | ✅ |
| Befehl/Env pro Lauf | zweites initramfs-Segment wird angehängt (Kernel entpackt beide) | ✅ |
| Netzwerk | QEMU user-mode (SLIRP), Gast 10.0.2.15, DNS 10.0.2.3 | ✅ HTTPS zu PyPI/Docker Hub |
| TLS-Egress | Sandbox-CA-Bundle wird nach `/etc/ssl/certs/ca-certificates.crt` kopiert | ✅ |
| Workspace | virtio-9p (`--work DIR` → `/work`, read-write), 9p-Module aus `linux-modules-*` | ✅ |
| Port-Forwarding | `--port H:G` (hostfwd) | ✅ `curl localhost:18090` |
| Exit-Code | Marker `__MICROVM_EXIT__=<rc>` auf der seriellen Konsole | ✅ |
| Stabilität | 20/20 Läufe erfolgreich, Ø 5,7 s | ✅ |

### Fallstricke (gelöst, im Skript dokumentiert)
1. **Sporadischer Boot-Hänger (10–40 %)** unter TCG: `tsc: Unable to calibrate against PIT …
   No reference (HPET/PMTIMER)`, danach hängt der Kernel. Fix: TSC-Frequenz vorgeben:
   `tsc_early_khz=<Host-kHz> tsc=reliable lpj=<kHz*4> no_timer_check` → 0/15 bzw. 20/20.
   (`pit=on,rtc=on` allein half nicht; mit `-smp 1` war es sogar schlechter.)
2. `docker export` enthält `/dev/console` als **leere Datei** → Init-Ausgabe verschwindet.
   Fix: `/dev` leeren, `mknod console c 5 1` und `null c 1 3`.
3. Kein `cpio` installiert → `busybox cpio -o -H newc`.
4. Ubuntu-Module sind `.ko.zst` → busybox `insmod` braucht entpackte `.ko` (zstd auf dem Host).
5. Ausgabe-Pipeline: `stdbuf -oL tr`, ANSI-/SeaBIOS-Zeilen filtern, QEMU-stdin auf `/dev/null`.

### Grenzen
- **Performance:** reine CPU-Last ~15× (Python-Schleife 6,3 s vs. 0,43 s), SHA-256 ~17× langsamer. Für
  Builds/Tests (Maven, npm) zu langsam; okay für Skripte, Smoke-Tests, Sicherheits-Isolation.
- Rootfs liegt komplett im RAM (initramfs) → `--mem` ≥ 3× Image-Größe.
- Kein persistenter Zustand zwischen Läufen (gewollt: frische VM pro Aufruf).
- Möglicher Zusatznutzen: Gast mit **cgroup v2** und eigenem Kernel (z. B. Kernel-Features testen),
  wäre unter TCG aber sehr langsam für k3s & Co.

## gVisor (`55_gvisor_install.sh`)

- Installation: gvisor.dev gesperrt, Apt-Pool auf `storage.googleapis.com/gvisor/releases` erreichbar.
  Das Skript lädt das neueste `runsc.deb`, prüft SHA256 aus dem `Packages`-Index, `dpkg -i`,
  `runsc install` (trägt die Runtime in `/etc/docker/daemon.json` ein) und `kill -HUP dockerd`.
- Plattform **systrap** (Default, braucht kein KVM).
- Getestet: Gast-Kernel `4.19.0-gvisor`, HTTPS-Egress (mit CA-Mount), Port-Mapping (nginx 200),
  Volumes, Python-Benchmark.

```bash
docker run --rm --runtime=runsc -v "$PWD":/work -w /work python:3.12-alpine python3 script.py
```

| Messung (ohne Last durch Rancher) | runc | runsc |
|---|---|---|
| Container-Start (`alpine true`) | 333 ms | 390 ms |
| 300× fork/exec | 456 ms | 2089 ms |
| 200 MB schreiben | 738 ms | 564 ms |
| Python-CPU-Schleife (2 Mio.) | 0,43 s | 0,35 s |
| SHA-256 ×200k | 0,17 s | 0,16 s |

Hinweis: Benchmarks bei laufendem Rancher schwanken extrem (bis 12 s pro Start). Für saubere
Messungen schwere Container vorher stoppen.

## Entscheidungshilfe für Agenten

```
Brauche ich Isolation für fremden/generierten Code?
 ├─ nein ─────────────────────────────▶ Docker (runc)
 └─ ja
     ├─ /dev/kvm vorhanden? ── ja ────▶ microsandbox (52_microsandbox_check.sh)
     └─ nein (diese Sandbox)
         ├─ normal/schnell ───────────▶ gVisor: docker run --runtime=runsc
         └─ eigener Kernel / max. Isolation, Tempo egal ─▶ 51_microvm_run.sh (QEMU-TCG)
```
