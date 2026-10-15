#!/usr/bin/env bash
# Installiert gVisor (runsc) als zusaetzliche Docker-Runtime: Container mit eigenem
# User-Space-Kernel (Sentry) -> deutlich staerkere Isolation als runc, OHNE KVM (Plattform systrap).
# Nutzung danach:  docker run --runtime=runsc ...
#
# gvisor.dev (Install-Skript, Signing-Key) ist in der Sandbox gesperrt; das Apt-Repo auf
# storage.googleapis.com ist erreichbar. Integritaet: SHA256 aus dem Packages-Index (TLS).
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
require_docker
REPO=https://storage.googleapis.com/gvisor/releases

if ! command -v runsc >/dev/null; then
  tmp=$(mktemp -d)
  curl -fsS "$REPO/dists/release/main/binary-amd64/Packages" -o "$tmp/Packages"
  # letzter Eintrag = neueste Version
  FILE=$(awk '/^Filename:/{f=$2} END{print f}' "$tmp/Packages")
  SHA=$(awk '/^SHA256:/{s=$2} END{print s}' "$tmp/Packages")
  log "Lade $FILE"
  curl -fsS "$REPO/$FILE" -o "$tmp/runsc.deb"
  echo "$SHA  $tmp/runsc.deb" | sha256sum -c --quiet || { fail "SHA256 falsch"; exit 1; }
  dpkg -i "$tmp/runsc.deb" >/dev/null
  rm -rf "$tmp"
fi
ok "$(runsc --version | head -1)"

if ! docker info --format '{{json .Runtimes}}' | grep -q runsc; then
  runsc install >/dev/null 2>&1        # traegt runsc in /etc/docker/daemon.json ein
  kill -HUP "$(pgrep -x dockerd)"      # dockerd laedt Runtimes per SIGHUP neu (kein systemd)
  sleep 2
fi
docker info --format '{{json .Runtimes}}' | grep -q runsc && ok "Docker-Runtime 'runsc' registriert"

if [[ "${1:-}" == "--test" ]]; then
  docker run --rm --runtime=runsc alpine:3.20 uname -r | grep -q gvisor && ok "Container laeuft unter gVisor-Kernel"
fi
