# OpenAI Codex CLI – Installation und Setup

> Stand: 2026-04-16. Bezugsversion: stable **v0.121.0** (npm: `@openai/codex@latest`, Homebrew Cask `codex`, GitHub Releases). Quelle: https://github.com/openai/codex/releases.

## 1. Systemvoraussetzungen

| Komponente | Empfehlung | Quelle |
|---|---|---|
| Betriebssystem | macOS (Apple Silicon arm64 / x86_64), Linux (x86_64 / arm64), Windows (experimentell, WSL2 empfohlen) | https://github.com/openai/codex |
| Node.js | nur bei npm‑Installation: **v22+** (das npm‑Paket trägt das vorgebaute Rust‑Binary, Node ist optional eigentlich nicht zur Laufzeit nötig, aber für globale Installation/Updater empfohlen) | https://www.npmjs.com/package/@openai/codex |
| Shell | zsh, bash, fish, PowerShell (TUI funktioniert in jedem Terminal mit modernem Truecolor‑Support) | https://developers.openai.com/codex/cli |
| RAM | praktisch ≥ 1 GB frei für Agent + Shell‑Subprozesse | empirisch |
| Plattenplatz | ≈ 60–120 MB für das Binary, plus Sessions/SQLite unter `~/.codex/` | empirisch |
| Netzwerk | HTTPS zu `api.openai.com` (Responses API) und `auth.openai.com` (OAuth) | https://developers.openai.com/codex/auth |

WSL2 ist auf Windows die empfohlene Variante für Produktiveinsatz, da nur dort der **Landlock/bubblewrap‑Sandbox** wirkt (Stand 2026‑04, WSL1 wird seit Codex 0.115 nicht mehr unterstützt – Quelle: https://codex.danielvaughan.com/2026/04/01/codex-cli-windows-native-sandbox-wsl/).

## 2. Installationsmethoden

Codex CLI wird als **vorgebautes Rust‑Binary** in mehreren Kanälen ausgeliefert. Die Wahl des Kanals ist Geschmackssache; alle liefern dasselbe Binary.

### 2.1 npm (plattformübergreifend, am häufigsten dokumentiert)

```bash
# Erstinstallation
npm install -g @openai/codex

# Update
npm install -g @openai/codex@latest

# Bestimmte Version anpinnen
npm install -g @openai/codex@0.121.0
```

Das npm‑Paket lädt das passende vorgebaute Binary für macOS/Linux/Windows. Voraussetzung: Node.js **22+**.

### 2.2 Homebrew (macOS, Linuxbrew)

```bash
# macOS / Linuxbrew – Cask ist die offizielle Variante seit v0.2.0
brew install --cask codex

# Update
brew upgrade --cask codex

# Info / Pfad anzeigen
brew info --cask codex
```

Hinweis: Frühere Anleitungen nennen auch `brew install codex` (ohne Cask). Seit der Rust‑Umstellung ist der **Cask** der von OpenAI gepflegte Pfad (https://github.com/openai/codex).

### 2.3 Direkter Binary‑Download von GitHub Releases

Auf https://github.com/openai/codex/releases/latest gibt es plattformspezifische Archive:

```bash
# Beispiel macOS (Apple Silicon)
curl -L -o codex.tar.gz \
  https://github.com/openai/codex/releases/latest/download/codex-aarch64-apple-darwin.tar.gz
tar -xzf codex.tar.gz
sudo mv codex /usr/local/bin/
codex --version
```

Verfügbare Targets (Stand 2026‑04):
- `aarch64-apple-darwin` (Apple Silicon)
- `x86_64-apple-darwin` (Intel Mac)
- `x86_64-unknown-linux-gnu`
- `aarch64-unknown-linux-gnu`
- `x86_64-pc-windows-msvc` (experimentell)

### 2.4 cargo install (für Rust‑Nutzer und Eigenbauten)

```bash
# Aus dem GitHub‑Repo direkt bauen
cargo install --git https://github.com/openai/codex codex-cli

# Oder lokales Workspace‑Build
git clone https://github.com/openai/codex.git
cd codex/codex-rs
just fmt    # optionales Format
just fix    # optional Lints
cargo build --release -p codex-cli
./target/release/codex --version
```

Voraussetzung: aktuelle stabile Rust‑Toolchain (≥ 1.78 empfohlen). Das `codex-rs` Cargo‑Workspace enthält die Crates **core**, **exec**, **tui**, **cli** (https://github.com/openai/codex/blob/main/codex-rs/README.md).

### 2.5 Windows nativ vs. WSL2

| Variante | Status | Empfehlung |
|---|---|---|
| **WSL2 + Linux‑Build** | stabil, voller Landlock/bubblewrap‑Sandbox | **empfohlen für Produktion** |
| **Native Windows (npm/Binary)** | experimentell; AppContainer‑Sandbox seit Anfang 2026 | für Testing okay |
| **WSL1** | **nicht mehr unterstützt** (seit v0.115) | nicht verwenden |

Detail‑Anleitung: https://developers.openai.com/codex/windows.

### 2.6 Vergleich der Installationswege

| Methode | Vorteil | Nachteil |
|---|---|---|
| `npm i -g @openai/codex` | überall identisch, einfacher Updater | benötigt Node.js 22+ |
| `brew install --cask codex` | systemnah, automatische Update‑Checks | nur macOS / Linuxbrew |
| GitHub‑Binary | keinerlei Abhängigkeiten, ideal für Container/CI | Updates manuell |
| `cargo install` | volle Kontrolle, eigene Patches möglich | Rust‑Toolchain nötig, längere Build‑Zeit |

## 3. Authentifizierung

Codex CLI kennt zwei Hauptpfade: **ChatGPT‑Account (OAuth)** und **API‑Key**. Der Login‑Flow wird beim ersten Aufruf von `codex` gestartet oder explizit via `codex login`.

### 3.1 ChatGPT‑Login (empfohlen für Plus/Pro/Business/Edu/Enterprise)

```bash
codex login
# Öffnet Browser, OAuth-Flow gegen auth.openai.com,
# Token wird zurück an die CLI übergeben.
```

Hintergrund: *„When you sign in with ChatGPT from the Codex CLI, Codex opens a browser window for you to complete the login flow, and after you sign in, the browser returns an access token to the CLI."* (https://developers.openai.com/codex/auth).

Vorteile:
- Plan‑Quoten von ChatGPT Plus/Pro/Business/Edu/Enterprise gelten direkt.
- Tokens werden **automatisch refreshed** vor Ablauf.
- Gleicher Account‑Kontext wie in der IDE‑Extension und in Codex Cloud.

### 3.2 API‑Key

```bash
export OPENAI_API_KEY="sk-..."
codex login --api-key   # oder Key über stdin pipen
```

Die API‑Key‑Variante ist der empfohlene Modus für **CI/CD und programmatische Workflows**, weil sie keinen Browser‑Roundtrip braucht (https://developers.openai.com/codex/auth/ci-cd-auth).

### 3.3 Headless / Device Auth

Für SSH‑Sessions ohne Browser:

```bash
codex login --device-auth
# Anzeige eines Codes + URL, den man auf einem anderen Gerät bestätigt
```

### 3.4 Logout & Status

```bash
codex logout      # entfernt gespeicherte Credentials
codex login --status   # zeigt aktuell aktive Auth-Methode
```

### 3.5 Speicherort der Credentials

| Pfad | Inhalt |
|---|---|
| `~/.codex/auth.json` | OAuth‑Token, Refresh‑Token, ggf. API‑Key (Default‑Storage) |
| OS‑Keychain | wenn `cli_auth_credentials_store = "keyring"` (oder `"auto"`) |

Konfiguration in `~/.codex/config.toml`:

```toml
cli_auth_credentials_store = "auto"   # "file" | "keyring" | "auto"
```

Sicherheitswarnung der Doku: *„If you use file-based storage, treat ~/.codex/auth.json like a password because it contains access tokens — don't commit it, paste it into tickets, or share it in chat."* (https://developers.openai.com/codex/auth).

`CODEX_HOME` überschreibt den Default `~/.codex` global – nützlich für Multi‑Tenant‑Setups oder containerisierte Build‑Agents.

### 3.6 Wechsel zwischen Auth‑Methoden

```bash
codex logout
codex login              # ChatGPT-OAuth
# oder
export OPENAI_API_KEY=...; codex login --api-key
```

## 4. Update‑ und Upgrade‑Prozess

| Installationsweg | Update‑Befehl |
|---|---|
| npm | `npm install -g @openai/codex@latest` |
| Homebrew Cask | `brew upgrade --cask codex` |
| Binary | erneuter Download von GitHub Releases |
| cargo | `cargo install --git https://github.com/openai/codex codex-cli --force` |

Codex zeigt in der TUI einen Hinweis, wenn eine neuere Version verfügbar ist. Achtung: ab Anfang 2026 honoriert der npm‑Updater die `min-release-age`‑Policy (Bug‑Tracking unter https://github.com/openai/codex/issues/16488); Updates werden gelegentlich verzögert ausgerollt.

## 5. Proxy- und Enterprise‑Setup

Codex CLI honoriert die üblichen Proxy‑Variablen für **alle** ausgehenden HTTP‑Clients:

```bash
export HTTP_PROXY="http://proxy.example.com:3128"
export HTTPS_PROXY="http://proxy.example.com:3128"
export NO_PROXY="localhost,127.0.0.1"
```

Für Corporate‑TLS/MITM‑Proxies mit eigener CA:

```bash
export CODEX_CA_CERTIFICATE=/etc/ssl/certs/corp-ca-bundle.pem
# Fallback ohne CODEX_CA_CERTIFICATE: SSL_CERT_FILE
```

Beides gilt sowohl für die Modell‑Aufrufe gegen die Responses API als auch für den OAuth‑Flow gegen `auth.openai.com` und für MCP‑Verbindungen (https://developers.openai.com/codex/auth, https://github.com/openai/codex/issues/6849).

Weitere Enterprise‑relevante Variablen:

| Variable | Zweck |
|---|---|
| `CODEX_HOME` | Konfigurations- und State‑Verzeichnis (Default `~/.codex`) |
| `CODEX_SQLITE_HOME` | überschreibt den SQLite‑State‑Ort separat |
| `CODEX_CA_CERTIFICATE` | benutzerdefiniertes CA‑Bundle für HTTPS/WS |
| `OPENAI_API_KEY` | API‑Key‑Login |
| `OPENAI_BASE_URL` | benutzerdefinierter Endpoint (z. B. Azure OpenAI) |

Mit v0.116.0 sind erweiterte Enterprise‑Features eingezogen, u. a. robusterer Proxy‑Pfad und feingranulareres Approval‑Routing (https://www.augmentcode.com/learn/openai-codex-cli-enterprise).

## 6. Erste Schritte – „Hello World" in 3 Minuten

```bash
# 1) Installieren
npm install -g @openai/codex

# 2) Anmelden (öffnet Browser)
codex login

# 3) In ein Repo wechseln und Codex starten
cd ~/code/mein-projekt
codex
```

In der TUI:

```
> Erkläre mir, was dieses Repo tut, und schlage drei Refactorings vor.
```

Codex liest jetzt:
1. das **globale** `~/.codex/AGENTS.md` (sofern vorhanden),
2. ggf. eine **Override** `~/.codex/AGENTS.override.md`,
3. das **projekt‑weite** `AGENTS.md` im Repo‑Root,
4. ggf. weitere **AGENTS.md** in Unterverzeichnissen bis zum aktuellen `cwd` (https://developers.openai.com/codex/guides/agents-md).

Für nicht‑interaktive Aufrufe:

```bash
codex exec "Schreibe Tests für src/utils/parse.ts" \
  --model gpt-5.3-codex \
  --ask-for-approval on-request \
  --sandbox workspace-write
```

`codex resume` (mit oder ohne `--last`) öffnet eine frühere Session; `codex mcp add …` registriert MCP‑Server.

## 7. Erstes `~/.codex/config.toml` (Minimalbeispiel)

```toml
# Default-Modell und Provider
model = "gpt-5.3-codex"
model_provider = "openai"

# Vorsichtige Defaults
approval_policy = "on-request"
sandbox_mode = "workspace-write"
model_reasoning_effort = "medium"
model_reasoning_summary = "auto"

# Credentials lieber im OS-Keyring
cli_auth_credentials_store = "auto"

# Optional: alternative Profile
[profiles.review]
model = "gpt-5.3-codex"
approval_policy = "never"
sandbox_mode = "read-only"
model_reasoning_effort = "high"

[profiles.yolo]
approval_policy = "never"
sandbox_mode = "danger-full-access"
```

Aktivierung pro Aufruf:

```bash
codex --profile review
```

## 8. Häufige Installations- und Setup‑Probleme

| Symptom | Ursache / Behebung |
|---|---|
| `codex: command not found` nach `npm i -g` | npm‑global‑bin nicht im `PATH`. `npm prefix -g`/`PATH` prüfen. |
| `Error: Node 22 or later required` | Node‑Version zu alt. Mit `nvm install 22` aktualisieren. |
| `EACCES` bei `npm i -g` | Globale Installationen ohne sudo via nvm/asdf oder `npm config set prefix ~/.npm-global`. |
| Login‑Browser öffnet sich nicht | Headless‑Umgebung → `codex login --device-auth` verwenden. |
| OAuth schlägt hinter Proxy fehl | `HTTPS_PROXY` und `CODEX_CA_CERTIFICATE` setzen (https://github.com/openai/codex/issues/6849). |
| WSL1 → Sandbox‑Fehler | Auf WSL2 wechseln; WSL1 ist seit v0.115 nicht mehr unterstützt. |
| „Sandbox denied" bei normalem `npm install` | Approval/Sandbox zu strikt. `--sandbox workspace-write` oder Profile anpassen. |
| Homebrew installiert noch alte TS‑Version | Cask explizit verwenden: `brew install --cask codex` und ggf. `brew untap`. |
| `cargo install` schlägt mit Linker‑Fehler fehl | Build‑Toolchain (clang, openssl‑dev / pkg‑config) installieren. |
| Update funktioniert nicht (npm) | `min-release-age`‑Policy aktiv, siehe Issue #16488 – `--ignore-scripts` oder explizite Versions‑Pinning. |
| AGENTS.md wird nicht gelesen | Pfad/Größe (Default 32 KiB) prüfen, ggf. `~/.codex/AGENTS.md` separat anlegen (Issue #8759). |

## 9. Deinstallation

```bash
# npm
npm uninstall -g @openai/codex

# Homebrew
brew uninstall --cask codex

# Binary
sudo rm /usr/local/bin/codex

# Optional: alle Daten löschen (ACHTUNG: enthält Auth!)
rm -rf ~/.codex
```

## 10. Referenzen

- README & Releases: https://github.com/openai/codex und https://github.com/openai/codex/releases
- npm Paket: https://www.npmjs.com/package/@openai/codex
- Auth‑Doku: https://developers.openai.com/codex/auth
- CI/CD‑Auth: https://developers.openai.com/codex/auth/ci-cd-auth
- Windows‑Doku: https://developers.openai.com/codex/windows
- Sandbox‑Doku: https://developers.openai.com/codex/concepts/sandboxing
- Praxis‑Guide macOS: https://itecsonline.com/post/install-codex-macos
- Praxis‑Guide Windows 2026: https://itecsonline.com/post/how-to-install-codex-cli-on-windows-2026-guide
