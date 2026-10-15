#!/usr/bin/env bash
# Prueft, ob microsandbox (libkrun-microVMs, https://github.com/superradcompany/microsandbox) nutzbar ist.
# In der Claude-Code-Sandbox (Stand 2026-10-15): NEIN – kein /dev/kvm, keine vmx/svm-Flags
# -> msb panics mit "Error creating the Kvm object". Dieses Skript ist fuer Umgebungen MIT KVM
# (eigener Rechner, VM mit Nested Virtualization) und dokumentiert den Installationsweg ueber npm
# (get.microsandbox.dev ist hier gesperrt, npm-Registry erreichbar).
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
MSB_DIR=/opt/microsandbox
mkdir -p "$MSB_DIR"
if [[ ! -x "$MSB_DIR/node_modules/.bin/msb" ]]; then
  log "Installiere microsandbox (npm, enthaelt msb-Binary + libkrunfw, ~110 MB)"
  (cd "$MSB_DIR" && npm install --silent microsandbox >/dev/null 2>&1)
fi
MSB="$MSB_DIR/node_modules/.bin/msb"
"$MSB" --version 2>/dev/null | head -1
"$MSB" doctor 2>&1 | grep -E '✓|✗|error' || true

if [[ -e /dev/kvm ]]; then
  log "KVM vorhanden -> Testlauf"
  "$MSB" run alpine -- uname -a && ok "microsandbox laeuft"
else
  warn "Kein /dev/kvm -> microsandbox hier nicht lauffaehig."
  echo "   Alternativen in dieser Sandbox: 51_microvm_run.sh (QEMU-microVM, TCG) oder 55_gvisor_install.sh (gVisor)"
  exit 1
fi
