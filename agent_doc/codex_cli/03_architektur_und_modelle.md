# OpenAI Codex CLI – Architektur und Modelle

> Stand: 2026-04-16. Dieses Dokument beschreibt die innere Architektur des Codex CLI sowie die unterstützten Modelle und Provider.

## 1. Architektur-Überblick

Codex CLI ist ein **Rust-Binary** (Cargo-Workspace `codex-rs`), das lokal auf dem Entwicklerrechner läuft. Es bündelt drei funktionale Schichten:

1. **Frontend-Schicht** – entweder TUI (Ratatui-basiert) oder `codex exec` (non-interaktiv).
2. **Agent-Loop** – liest Prompt + Kontext, ruft die OpenAI **Responses API**, verarbeitet Tool-Calls.
3. **Tool-Execution-Schicht** – führt Shell-Befehle, Datei-Patches und MCP-Calls lokal aus; alle Aktionen durchlaufen **Sandbox + Approval**.

```
┌────────────────────────────────────────────────────────────┐
│  TUI (Ratatui)   oder   codex exec (JSONL / stdout)        │
└───────────────────────────┬────────────────────────────────┘
                            │
                  ┌─────────▼─────────┐
                  │   Agent-Loop      │   ← liest AGENTS.md, config.toml
                  │  (codex-core)     │   ← kennt Plan-Tool, Memory
                  └──┬─────────┬──────┘
                     │         │
          ┌──────────▼─┐   ┌───▼───────────┐
          │ Responses  │   │  Tool-Runtime │
          │   API      │   │  (Shell, PATCH│
          │ (OpenAI/   │   │   MCP, Web-   │
          │  custom)   │   │   Search)     │
          └────────────┘   └───┬───────────┘
                               │
                     ┌─────────▼──────────┐
                     │   Sandbox-Layer    │
                     │ Seatbelt/Landlock/ │
                     │ bubblewrap/AppCont.│
                     └────────────────────┘
```

### 1.1 Rust-Cargo-Workspace `codex-rs`

Der Quellcode liegt unter `codex-rs/` im Repo und besteht aus mehreren Crates, deren Rollen sich gut trennen lassen (Quelle: https://github.com/openai/codex/blob/main/codex-rs/README.md):

| Crate | Rolle |
|---|---|
| `codex-core` | Agent-Loop, Tool-Dispatcher, Responses-API-Client, Approval-/Sandbox-Orchestration. |
| `codex-tui` | Interaktive Ratatui-Oberfläche. |
| `codex-exec` | Non-interaktiver Modus (`codex exec`). |
| `codex-cli` | Top-Level-Einstiegspunkt mit `clap`-Argumentenparser; kombiniert tui/exec/login/mcp/resume/completion. |
| `codex-protocol` | Wire-Formate, Events, JSON-Schemas (z. B. für `--json`). |
| `codex-mcp-client` & `codex-mcp-server` | MCP-Integration in beide Richtungen. |
| `codex-login` | OAuth-Flow, API-Key-Handling, Keyring. |
| `codex-execpolicy` | Allow-/Deny-Logik für Shell-Commands (deklarative Policy). |
| `codex-plan-tool` | Optionales `update_plan`-Tool. |

### 1.2 Sprachaufteilung

- ~95 % **Rust** (Core, TUI, Exec, MCP, Policy).
- Kleine TypeScript-Anteile für IDE-Bridge und das Node.js-Paket (`@openai/codex`), das in erster Linie das passende vorgebaute Binary aus GitHub-Releases nachlädt.
- Build-Infrastruktur mit `just` und `cargo`.

## 2. Datenflüsse

### 2.1 Was geht an OpenAI

- **Prompt** des Nutzers und Konversationsverlauf der aktuellen Session.
- Ausgewählte **Dateisnippets/Diffs**, die das Modell aktiv anfordert (Tool-Call `read_file`, `apply_patch`-Kontext).
- **Shell-Output** (stdout/stderr) von Befehlen, die der Agent ausgeführt hat und zurückliefern soll.
- Optional **Bilder** (`--image` / TUI-Paste).

### 2.2 Was bleibt lokal

- Dateisystem, Secrets, Git-Historie als Ganzes – das Modell sieht nur, was Tools explizit lesen.
- Alle Ausführungen (Shell, Patches, MCP) passieren auf der Maschine der Nutzerin, unter Sandbox- und Approval-Regeln.
- Session-State: `~/.codex/sessions/<id>.jsonl` (und SQLite unter `~/.codex/`).

### 2.3 Responses-API statt Chat-Completions

Codex CLI nutzt die **Responses API** (`/v1/responses`) als Transport – nicht die ältere Chat-Completions-API. Vorteile für agentische Workflows:
- Natives Konzept für **Tool-Turns** und Multi-Step-Reasoning.
- Integrierte Unterstützung für `update_plan`, Structured Output (`--output-schema`) und Reasoning-Summaries.
- Streaming von Events (thread.started, turn.started, item.* etc.), die in `codex exec --json` als JSONL durchgereicht werden.

> Custom Provider (z. B. Ollama, vLLM) sprechen entweder die **Responses API** (wire_api="responses") oder die klassische **Chat-Completions-API** (wire_api="chat"); beides ist über `[model_providers.xxx]` konfigurierbar (siehe Datei 05).

## 3. Unterstützte Modelle

Codex CLI wird von OpenAI primär auf die **GPT-5-Codex-Reihe** optimiert. Alle aktuellen Modelle (Stand 2026-04-16):

| Modell | Einsatz | Besonderheiten |
|---|---|---|
| **gpt-5.3-codex** (Release 2026-02-05) | **Default** in ChatGPT-Plans, bevorzugt für agentische Coding-Tasks | ca. 25 % schneller als 5.2-Codex, starke Tool-Use-Fähigkeiten. Quelle: https://openai.com/index/introducing-gpt-5-3-codex/ |
| gpt-5.2-codex | weiterhin verfügbar | Vorgänger, gute Balance Kosten/Qualität |
| gpt-5-codex | Legacy-Default (seit 2025-09) | stabil, günstig |
| gpt-5 / gpt-5.1 | general-purpose | für nicht-codex-spezifische Aufgaben |
| gpt-4.1 | Fallback | günstiger, ältere Architektur |
| o3, o4-mini | Reasoning-Modelle | für schwere Analyse/Architektur-Fragen |

Modell setzen (flag oder config):
```bash
codex --model gpt-5.3-codex "Refactor die Auth-Schicht"
```
```toml
# config.toml
model = "gpt-5.3-codex"
```

### 3.1 Reasoning Effort

```toml
model_reasoning_effort = "medium"   # minimal | low | medium | high
```

| Stufe | Wirkung |
|---|---|
| `minimal` | kaum Chain-of-Thought, sehr schnell, günstig; gut für triviale Patches |
| `low` | knappe Überlegung, gut für Routine-Refactorings |
| `medium` | Default, guter Kompromiss |
| `high` | tiefe Analyse, teurer, langsamer – Architektur/Security-Reviews |

Zusätzliche Schlüssel:
```toml
model_reasoning_summary = "auto"   # auto | detailed | none
model_verbosity        = "medium"  # minimal | low | medium | high (wirkt auf Antwortlänge)
plan_mode_reasoning_effort = "high"   # optional separater Effort im Plan-Modus
```

### 3.2 Kontextfenster (Richtwerte)

| Modell | Kontext-Fenster |
|---|---|
| gpt-5.3-codex / 5.2-codex | ≈ 400k Tokens (agentisch optimiert) |
| gpt-5 / 5.1 | ≈ 200k Tokens |
| gpt-4.1 | 128k–200k |
| o3/o4-mini | 200k |

(Zahlen beziehen sich auf öffentlich kommunizierte Eckwerte Stand 2026-04; konkret kann sich das per Modell-Release verschieben – Quelle: OpenAI-Modellseiten.)

### 3.3 Modell-Auswahl-Empfehlung

| Aufgabentyp | Modell | Effort |
|---|---|---|
| Triviale Patches, Formatierung | gpt-5-codex | minimal |
| Routine-Refactorings | gpt-5.3-codex | low/medium |
| Implementierung neuer Features | gpt-5.3-codex | medium |
| Architektur, Spec, ADR | gpt-5.3-codex oder o3 | high |
| Tiefes Debugging, seltene Bugs | o3 / gpt-5.3-codex | high |
| Schnelle Iterationen (Pair-Programming) | gpt-5.3-codex | low |

## 4. Model Providers

Codex CLI ist **provider-agnostisch**. Via `[model_providers.<id>]` lassen sich beliebige Backends einbinden, solange sie die Responses- oder Chat-Completions-API sprechen.

### 4.1 Eingebaute Provider

- `openai` – Standard, `https://api.openai.com/v1`, benötigt `OPENAI_API_KEY` oder ChatGPT-OAuth.
- `ollama` – lokale Inferenz via Ollama (`http://localhost:11434/v1`).
- `lmstudio` – LM Studio lokaler Server.

Die built-in IDs sind reserviert und können nicht überschrieben werden (Quelle: https://developers.openai.com/codex/config-reference).

### 4.2 Custom Provider (Beispiele)

```toml
# Azure OpenAI
[model_providers.azure]
name = "Azure OpenAI"
base_url = "https://my-resource.openai.azure.com/openai/v1"
env_key = "AZURE_OPENAI_API_KEY"
wire_api = "responses"
query_params = { api-version = "2025-04-01-preview" }
requires_openai_auth = false

# OpenRouter (Anthropic/Google/… gemischt)
[model_providers.openrouter]
name = "OpenRouter"
base_url = "https://openrouter.ai/api/v1"
env_key = "OPENROUTER_API_KEY"
wire_api = "chat"

# vLLM self-hosted
[model_providers.vllm]
name = "Local vLLM"
base_url = "http://10.0.0.10:8000/v1"
env_key = "VLLM_API_KEY"
env_key_fallback = "NONE"
wire_api = "chat"
```

Aktivierung pro Aufruf:
```bash
codex --profile azure "Erkläre src/lib/payments.ts"
```
oder in einem Profil:
```toml
[profiles.azure]
model = "gpt-5.3-codex"
model_provider = "azure"
```

## 5. Codex Cloud vs. Lokaler CLI

Codex Cloud läuft in OpenAI-verwalteten Containern (im ChatGPT-Interface unter "Codex"), der CLI läuft lokal. Beide nutzen denselben Agent-Kern und dieselben Modelle; Unterschiede:

| Aspekt | CLI (lokal) | Codex Cloud (ChatGPT) |
|---|---|---|
| Ausführungsumgebung | Dev-Rechner unter Sandbox | managed Container |
| Parallelität | 1 Session je Terminal | n Tasks parallel |
| Dauer | bis Terminal schließt | Stunden-Jobs möglich |
| GitHub-PR-Output | manuell (gh, codex exec) | built-in PR-Erzeugung |
| Secrets | lokale Umgebung | im Cloud-Projekt hinterlegt |
| Kostenmodell | API-/ChatGPT-Plan | ChatGPT-Plan |

Ausführliche Gegenüberstellung in Datei 14.

## 6. Model Context Protocol (MCP)

Codex ist in beiden Richtungen MCP-fähig:
- **Client**: `[mcp_servers.<name>]` in `config.toml` – spricht STDIO- und Streaming-HTTP-Server.
- **Server**: `codex mcp` (subcommand) stellt `codex()` und `codex-reply()` als Tools bereit, sodass andere Agenten (z. B. Claude Code, OpenAI Agents SDK) Codex als Sub-Agent nutzen können.

Seit v0.121.0 werden parallele Tool-Calls unterstützt (`supports_parallel_tool_calls = true`).

Details und Beispiele: Datei 09.

## 7. Kontext-Artefakte

Codex lädt vor jeder Session eine definierte Hierarchie an Dokumenten:

1. Global: `~/.codex/AGENTS.md` (und optional `AGENTS.override.md`)
2. Projektweit: Repo-Root `AGENTS.md`
3. Verzeichnisweit: `AGENTS.md` in Zwischen-Verzeichnissen bis zum `cwd`
4. `.codex/prompts/*.md` – projekt-spezifische Slash-Commands
5. `~/.codex/config.toml` + ggf. `.codex/config.toml` (Projekt-Overrides)
6. Session-History für `resume`

Dieser Kontext wird als **Systeminstruction** vor den Nutzerprompt gesetzt. Größe per Default bei ~32 KiB pro Datei.

## 8. Authentifizierung

Zwei primäre Pfade, Implementierung in `codex-login`:

- **ChatGPT-OAuth** (`codex login`): Browser-Flow gegen `auth.openai.com`, Token in `~/.codex/auth.json` oder OS-Keyring; automatischer Refresh.
- **API-Key** (`OPENAI_API_KEY` oder `codex login --api-key`): für CI/CD und Headless-Umgebungen.

Steuerung via `cli_auth_credentials_store = "auto" | "file" | "keyring"`.

## 9. Datenschutz und Telemetrie

- **Telemetry**: opt-in/opt-out über Config; Default meldet anonyme Nutzungsereignisse.
- **OTel** (`[otel]`): Codex kann OpenTelemetry-Traces/-Metriken an einen OTLP-Endpunkt senden – nützlich für Self-Hosted-Monitoring (Details in Datei 05).
- **Zero-Data-Retention**: greift, wenn der Account in ChatGPT Business/Enterprise angesiedelt ist bzw. der API-Key auf einem ZDR-tauglichen Projekt liegt.
- **DSGVO**: Prompts/Code gehen an OpenAI – Verantwortliche:r muss Auftragsverarbeitung prüfen. Für regulierte Daten empfiehlt sich Azure OpenAI (DPA/ADV in EU) oder self-hosted Modelle via Custom Provider.

## 10. Versionen und Upgrade-Pfad

| Zeit | Ereignis |
|---|---|
| 2025-04-16 | Erste TS/Node-Version, `ink`-TUI |
| 2025-05 / 06 | Ankündigung + Beta Rust-Rewrite (`@openai/codex@native`) |
| 2025-07 | 0.2.0 – Rust wird Default, TypeScript deprecated |
| 2025-09 | GPT-5-Codex Release, Default-Wechsel |
| 2025-12 | TypeScript-CLI eingestellt |
| 2026-02-05 | GPT-5.3-Codex Release |
| 2026-03-19 | v0.116.0 – Enterprise-Features |
| 2026-04-15 | **v0.121.0** (aktuell stable) – Marketplace-Plugins, Ctrl+R, bubblewrap-devcontainer |

Upgrade ganz simpel: `npm i -g @openai/codex@latest` oder `brew upgrade --cask codex`.

## 11. Referenzen

- Repo / Workspace: https://github.com/openai/codex und https://github.com/openai/codex/tree/main/codex-rs
- Responses API-Hintergrund: https://platform.openai.com/docs/api-reference/responses
- Configuration Reference: https://developers.openai.com/codex/config-reference
- Modelle: https://openai.com/index/introducing-gpt-5-3-codex/
- MCP: https://developers.openai.com/codex/mcp
