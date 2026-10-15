#!/usr/bin/env bash
# Gemeinsame Helfer fuer alle Setup-Skripte. Wird per `source` eingebunden.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_DIR="$SCRIPT_DIR/config"
STATE_DIR="${STATE_DIR:-/opt/devstack}"     # session-lokaler Zustand (Kubeconfig, Token)
CA_DIR="/opt/sandbox-ca"                    # einzelne Anthropic-Egress-CAs (fuer SUSE-basierte Images)
HOST_CA_BUNDLE="/root/.ccr/ca-bundle.crt"   # komplettes Bundle inkl. Proxy-CAs
K3S_BIN_DIR="/opt/k3s/bin"

# Rancher-Defaults (nur Dev-Sandbox!)
RANCHER_URL="${RANCHER_URL:-https://127.0.0.1:8443}"
RANCHER_PASSWORD="${RANCHER_PASSWORD:-admin12345678}"
RANCHER_IMAGE="${RANCHER_IMAGE:-rancher/rancher:latest}"
K3S_IMAGE="${K3S_IMAGE:-rancher/k3s:latest}"

mkdir -p "$STATE_DIR"

log()  { printf '\033[1;34m[setup]\033[0m %s\n' "$*"; }
ok()   { printf '\033[1;32m[ OK ]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[WARN]\033[0m %s\n' "$*"; }
fail() { printf '\033[1;31m[FAIL]\033[0m %s\n' "$*"; }

# wait_for <beschreibung> <timeout-sekunden> <kommando...>
wait_for() {
  local desc="$1" timeout="$2"; shift 2
  local start=$SECONDS
  log "Warte auf: $desc (max ${timeout}s)"
  until "$@" >/dev/null 2>&1; do
    if (( SECONDS - start >= timeout )); then fail "Timeout: $desc"; return 1; fi
    sleep 3
  done
  ok "$desc (nach $((SECONDS - start))s)"
}

docker_running() { docker info >/dev/null 2>&1; }

require_docker() {
  docker_running || { fail "Docker-Daemon laeuft nicht -> zuerst scripts/00_docker_start.sh"; exit 1; }
}

# Stellt kubectl bereit: vorhandenes kubectl oder k3s-Binary (Multi-Call) aus dem rancher/k3s-Image.
ensure_kubectl() {
  if command -v kubectl >/dev/null 2>&1; then return 0; fi
  require_docker
  log "kubectl fehlt -> extrahiere k3s-Binary aus $K3S_IMAGE"
  mkdir -p "$K3S_BIN_DIR"
  local cid; cid=$(docker create "$K3S_IMAGE")
  docker cp "$cid:/bin/k3s" "$K3S_BIN_DIR/k3s"
  docker rm "$cid" >/dev/null
  ln -sf "$K3S_BIN_DIR/k3s" /usr/local/bin/kubectl
  ok "kubectl -> $(kubectl version --client 2>/dev/null | head -1)"
}

# Extrahiert alle Anthropic-CAs aus dem Host-Bundle als Einzeldateien nach $CA_DIR.
# Grund: SUSE-Images (rancher/rancher) lesen aus /etc/pki/trust/anchors nur das erste
# Zertifikat pro Datei; Container-Traffic laeuft ueber eine andere CA
# ("sandbox-egress-gateway ... Egress Gateway CA") als der Host-Proxy.
prepare_ca_dir() {
  mkdir -p "$CA_DIR"
  rm -f "$CA_DIR"/*.crt
  awk -v dir="$CA_DIR" '/BEGIN CERT/{n++; buf=""} {buf=buf $0 "\n"} /END CERT/{f=dir "/tmp-" n ".crt"; printf "%s", buf > f; close(f)}' "$HOST_CA_BUNDLE"
  local f
  for f in "$CA_DIR"/tmp-*.crt; do
    if openssl x509 -in "$f" -noout -subject 2>/dev/null | grep -q 'O *= *Anthropic'; then
      mv "$f" "$CA_DIR/anthropic-$(basename "${f#*tmp-}")"
    else
      rm -f "$f"
    fi
  done
  ok "Egress-CAs in $CA_DIR: $(ls "$CA_DIR" | wc -l) Dateien"
}
