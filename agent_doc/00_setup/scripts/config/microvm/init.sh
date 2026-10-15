#!/.microvm/busybox sh
# PID 1 in der microVM (wird von 51_microvm_run.sh als /.microvm/init ins initramfs gelegt).
# Nutzt ein statisches busybox, damit beliebige Docker-Images (Alpine, Debian, ...) funktionieren.
B=/.microvm/busybox
export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
$B mkdir -p /proc /sys /dev /tmp /run /work
$B mount -t proc proc /proc
$B mount -t sysfs sys /sys
$B mount -t devtmpfs dev /dev 2>/dev/null
$B mkdir -p /dev/pts /dev/shm && $B mount -t devpts devpts /dev/pts && $B mount -t tmpfs tmpfs /dev/shm
$B mount -t tmpfs tmpfs /tmp
$B hostname microvm

# Netzwerk: QEMU user-mode (SLIRP) -> feste Adressen, kein DHCP noetig
$B ip link set lo up
if $B ip link show eth0 >/dev/null 2>&1; then
  $B ip addr add 10.0.2.15/24 dev eth0
  $B ip link set eth0 up
  $B ip route add default via 10.0.2.2
  echo "nameserver 10.0.2.3" > /etc/resolv.conf
fi

# Workspace-Freigabe (virtio-9p), falls vom Host angeboten
if [ -d /.microvm/modules ]; then
  for m in netfs 9pnet 9pnet_virtio 9p; do $B insmod /.microvm/modules/$m.ko 2>/dev/null; done
  $B mount -t 9p -o trans=virtio,version=9p2000.L,msize=262144 work /work 2>/dev/null \
    && echo "[microvm] /work gemountet" >&2
fi

# Laufzeit-Parameter (vom Host pro Lauf als zweites initramfs-Segment angehaengt)
[ -f /.microvm/env ] && . /.microvm/env
export SSL_CERT_FILE=/etc/ssl/certs/ca-certificates.crt HOME=${HOME:-/root}
cd "${MICROVM_WORKDIR:-/}"

/bin/sh /.microvm/cmd
rc=$?
echo "__MICROVM_EXIT__=$rc"
$B sync
$B poweroff -f
