#!/usr/bin/env bash
# Fuehrt einen Befehl in einer frischen microVM aus (QEMU -M microvm, eigener Kernel, volle Isolation).
# Das Root-Dateisystem kommt aus einem beliebigen Docker-Image (docker export -> initramfs, gecacht).
#
#   ./51_microvm_run.sh [Optionen] IMAGE -- BEFEHL...
#   Optionen:
#     --mem MB        RAM der VM (Default 1024; initramfs liegt komplett im RAM!)
#     --cpus N        vCPUs (Default 2, TCG multi-threaded)
#     --work DIR      Host-Verzeichnis als /work in die VM (virtio-9p, read-write)
#     --port H:G      Host-Port H -> Gast-Port G (mehrfach moeglich)
#     --env K=V       Umgebungsvariable (mehrfach moeglich)
#     --timeout SEK   Gesamt-Timeout fuer die VM (Default 900)
#     --rebuild       Rootfs-Cache fuer IMAGE neu bauen
#   Beispiele:
#     ./51_microvm_run.sh alpine:3.20 -- uname -a
#     ./51_microvm_run.sh --work "$PWD" python:3.12-alpine -- python3 /work/script.py
#     ./51_microvm_run.sh --port 18080:8000 python:3.12-alpine -- python3 -m http.server 8000
# Exit-Code = Exit-Code des Befehls in der VM. Voraussetzung: 50_microvm_setup.sh
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
M=/opt/microvm; CACHE=$M/cache; mkdir -p "$CACHE"
MEM=1024; CPUS=2; WORK=""; PORTS=(); ENVS=(); REBUILD=0; TIMEOUT=900
while [[ $# -gt 0 ]]; do
  case "$1" in
    --mem) MEM=$2; shift 2 ;;  --cpus) CPUS=$2; shift 2 ;;
    --work) WORK=$(cd "$2" && pwd); shift 2 ;;
    --port) PORTS+=("$2"); shift 2 ;;  --env) ENVS+=("$2"); shift 2 ;;
    --rebuild) REBUILD=1; shift ;;  --timeout) TIMEOUT=$2; shift 2 ;;
    --) shift; break ;;
    *) IMAGE=$1; shift ;;
  esac
done
[[ -n "${IMAGE:-}" && $# -gt 0 ]] || { sed -n '2,18p' "$0"; exit 2; }
[[ -f $M/vmlinuz ]] || { fail "Kein Gastkernel -> zuerst 50_microvm_setup.sh"; exit 1; }

# --- 1. Rootfs aus Docker-Image (gecacht als gzip-cpio)
BASE="$CACHE/$(echo "$IMAGE" | tr '/:@' '___').cpio.gz"
if [[ $REBUILD == 1 || ! -f $BASE ]]; then
  require_docker
  docker image inspect "$IMAGE" >/dev/null 2>&1 || docker pull -q "$IMAGE" >/dev/null
  log "Baue microVM-Rootfs aus $IMAGE"
  root=$(mktemp -d)
  cid=$(docker create "$IMAGE" /bin/true); docker export "$cid" | tar -x -C "$root"; docker rm "$cid" >/dev/null
  # docker export liefert /dev/console als leere Datei -> Init-Ausgabe ginge in eine Datei.
  rm -rf "$root/dev"; mkdir -p "$root/dev"
  mknod -m 600 "$root/dev/console" c 5 1; mknod -m 666 "$root/dev/null" c 1 3
  mkdir -p "$root/.microvm" "$root/etc/ssl/certs"
  cp "$M/busybox" "$root/.microvm/busybox"
  cp -r "$M/modules" "$root/.microvm/modules"
  cp "$CONFIG_DIR/microvm/init.sh" "$root/.microvm/init"; chmod +x "$root/.microvm/init"
  # Egress ist TLS-intercepted -> CA-Bundle der Sandbox ins Gast-System
  cp "$HOST_CA_BUNDLE" "$root/etc/ssl/certs/ca-certificates.crt"
  [[ -e "$root/bin/sh" ]] || ln -s /.microvm/busybox "$root/bin/sh"
  (cd "$root" && find . | "$M/busybox" cpio -o -H newc 2>/dev/null | gzip -1 > "$BASE")
  rm -rf "$root"
  ok "Rootfs-Cache: $BASE ($(du -h "$BASE" | cut -f1))"
fi

# --- 2. Pro-Lauf-Segment (Befehl + Env), wird an das Basis-initramfs angehaengt
run=$(mktemp -d); mkdir -p "$run/.microvm"
printf '%q ' "$@" > "$run/.microvm/cmd"; echo >> "$run/.microvm/cmd"
{ for e in "${ENVS[@]}"; do printf 'export %q\n' "$e"; done
  [[ -n $WORK ]] && echo "MICROVM_WORKDIR=/work"; } > "$run/.microvm/env"
INITRD=$(mktemp --suffix=.cpio.gz)
cat "$BASE" > "$INITRD"
(cd "$run" && find . | "$M/busybox" cpio -o -H newc 2>/dev/null | gzip -1 >> "$INITRD")
rm -rf "$run"

# --- 3. QEMU microvm starten
ACCEL=tcg,thread=multi; [[ -e /dev/kvm ]] && ACCEL=kvm
# Unter TCG schlaegt die TSC-Kalibrierung sporadisch fehl ("tsc: Unable to calibrate against PIT")
# und der Kernel haengt (~10-40 % der Boots). TSC-Frequenz + loops_per_jiffy vorgeben -> 0/15 Haenger.
KHZ=$(awk -F: '/cpu MHz/{printf "%d", $2*1000; exit}' /proc/cpuinfo)
TIMER_ARGS="tsc_early_khz=$KHZ tsc=reliable lpj=$((KHZ * 4)) no_timer_check"
NET="user,id=n0"; for p in "${PORTS[@]}"; do NET+=",hostfwd=tcp::${p%%:*}-:${p##*:}"; done
ARGS=(-M microvm -accel "$ACCEL" -cpu max -smp "$CPUS" -m "$MEM"
      -nodefaults -no-user-config -nographic -serial stdio -no-reboot
      -kernel "$M/vmlinuz" -initrd "$INITRD"
      -append "console=ttyS0 quiet loglevel=1 panic=-1 $TIMER_ARGS rdinit=/.microvm/init"
      -netdev "$NET" -device virtio-net-device,netdev=n0)
[[ -n $WORK ]] && ARGS+=(-fsdev "local,id=w,path=$WORK,security_model=none" -device virtio-9p-device,fsdev=w,mount_tag=work)

rc_file=$(mktemp)
# Ausgabe: CR und ANSI-Sequenzen (SeaBIOS) entfernen, Boot-/Shutdown-Zeilen ausblenden
timeout "$TIMEOUT" qemu-system-x86_64 "${ARGS[@]}" </dev/null 2>&1 | stdbuf -oL tr -d '\r' | sed -u -e 's/\x1b\[[0-9;?]*[a-zA-Z]//g' -e 's/\x1bc//g' \
  | grep --line-buffered -vE '^(SeaBIOS|Booting from ROM|\[ *[0-9.]+\] reboot: Power down|c?$)' | while IFS= read -r line; do
  if [[ $line == __MICROVM_EXIT__=* ]]; then echo "${line#*=}" > "$rc_file"; else printf '%s\n' "$line"; fi
done
rc=$(cat "$rc_file" 2>/dev/null); rm -f "$rc_file" "$INITRD"
exit "${rc:-1}"
