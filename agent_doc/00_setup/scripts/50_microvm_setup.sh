#!/usr/bin/env bash
# Richtet echte microVMs OHNE KVM ein: QEMU (Maschinentyp "microvm", Software-Emulation TCG)
# + Ubuntu-Kernel + 9p-Module. Hintergrund: Die Sandbox hat kein /dev/kvm (siehe 08_microvm_microsandbox.md),
# deshalb laufen microsandbox/Firecracker/Kata nicht. TCG ist ~5-20x langsamer, aber voll isoliert.
#
# Ergebnis: /opt/microvm/{vmlinuz,busybox,modules/} – danach scripts/51_microvm_run.sh nutzen.
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
M=/opt/microvm

if [[ -e /dev/kvm ]]; then
  ok "/dev/kvm vorhanden -> KVM-Beschleunigung moeglich (microsandbox/Firecracker waeren nutzbar)"
else
  warn "/dev/kvm fehlt -> QEMU nutzt Software-Emulation (TCG)"
fi

if ! command -v qemu-system-x86_64 >/dev/null || [[ ! -x /bin/busybox ]] || ! command -v zstd >/dev/null; then
  log "Installiere qemu-system-x86, busybox-static, zstd (apt)"
  DEBIAN_FRONTEND=noninteractive apt-get update -qq
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq --no-install-recommends qemu-system-x86 busybox-static zstd >/dev/null
fi
ok "$(qemu-system-x86_64 --version | head -1)"

if [[ ! -f "$M/vmlinuz" || ! -f "$M/modules/9p.ko" ]]; then
  # Gastkernel aus dem Ubuntu-Archiv (GitHub/kernel.org-Downloads sind nicht noetig)
  KPKG=$(apt-cache depends linux-image-virtual | awk '/Depends: linux-image-[0-9]/{print $2; exit}')
  KVER=${KPKG#linux-image-}
  log "Lade Gastkernel $KVER"
  tmp=$(mktemp -d); pushd "$tmp" >/dev/null
  apt-get download -qq "linux-image-$KVER" "linux-modules-$KVER" 2>/dev/null
  for d in *.deb; do dpkg-deb -x "$d" x; done
  mkdir -p "$M/modules"
  cp x/boot/vmlinuz-* "$M/vmlinuz"
  # virtio-net/-blk/-mmio sind fest eingebaut; nur 9p (Ordner-Freigabe) ist Modul
  for m in fs/netfs/netfs net/9p/9pnet net/9p/9pnet_virtio fs/9p/9p; do
    zstd -dqf "x/lib/modules/$KVER/kernel/$m.ko.zst" -o "$M/modules/$(basename "$m").ko"
  done
  echo "$KVER" > "$M/kernel-version"
  popd >/dev/null; rm -rf "$tmp"
fi
cp /bin/busybox "$M/busybox"
ok "Gastkernel $(cat "$M/kernel-version" 2>/dev/null) in $M"
echo "   Test: scripts/51_microvm_run.sh alpine:3.20 -- uname -a"
