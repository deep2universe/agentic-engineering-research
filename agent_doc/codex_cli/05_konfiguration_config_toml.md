# OpenAI Codex CLI – Konfiguration (config.toml)

> Stand: 2026-04-16. Referenz für die Datei `~/.codex/config.toml` und projektweite Overrides in `.codex/config.toml`. Quellen: https://developers.openai.com/codex/config-reference, https://developers.openai.com/codex/config-basic, https://developers.openai.com/codex/config-advanced, https://github.com/openai/codex/blob/main/docs/config.md sowie `codex-rs/core/config.schema.json` im Repo.

## 1. Lokationen

| OS | Default |
|---|---|
| Linux | `~/.codex/config.toml` |
| macOS | `~/.codex/config.toml` |
| Windows | `%USERPROFILE%\.codex\config.toml` |

Projekt-Overrides: `.codex/config.toml` im Repo-Root (werden in die Nutzerkonfig **gemergt**, nicht komplett ersetzt).  
Alternativer Pfad: `CODEX_HOME=/pfad/zum/ordner` setzt alles (Config + State) dorthin.  
Einzelne Werte zur Laufzeit überschreiben: `--config key=value` (mehrfach).

## 2. Top-Level-Keys

```toml
# Modell und Provider
model               = "gpt-5.3-codex"
model_provider      = "openai"            # openai | ollama | lmstudio | <custom-id>

# Reasoning
model_reasoning_effort  = "medium"        # minimal | low | medium | high
model_reasoning_summary = "auto"          # auto | detailed | none
model_verbosity         = "medium"        # minimal | low | medium | high
plan_mode_reasoning_effort = "high"       # optional separater Effort im Plan-Modus

# Approval & Sandbox
approval_policy = "on-request"            # untrusted | on-request | never | granular
sandbox_mode    = "workspace-write"       # read-only | workspace-write | danger-full-access

# Pfade / Runtime
cwd                        = "."          # Arbeitsverzeichnis
sqlite_home                = "~/.codex"   # Location der SQLite DB
cli_auth_credentials_store = "auto"       # auto | file | keyring
auto_upgrade               = true

# Notifications
notify = ["terminal-notifier", "-title", "Codex"]

# Default-Profil
profile = "dev"
```

### 2.1 Bedeutung der wichtigsten Schlüssel

| Key | Wirkung |
|---|---|
| `model` | Default-Modell, überschreibbar via `--model` oder Profil |
| `model_provider` | verweist auf `[model_providers.<id>]` oder Built-in |
| `approval_policy` | Default-Approval-Policy (siehe Datei 08) |
| `sandbox_mode` | Default-Sandbox (siehe Datei 07) |
| `model_reasoning_effort` | Qualität vs. Latenz/Kosten |
| `model_reasoning_summary` | wie viel CoT im Transkript landet |
| `model_verbosity` | Länge der Modell-Antworten |
| `plan_mode_reasoning_effort` | separater Effort, wenn Plan-Tool aktiv |
| `cli_auth_credentials_store` | Keyring vs. Klartext-Datei für Tokens |
| `auto_upgrade` | CLI fragt bei Updates |
| `profile` | aktives Default-Profil |

## 3. Profile `[profiles.<name>]`

Profile bündeln wiederkehrende Presets. Aktivierung: `codex --profile review`.

```toml
[profiles.dev]
model = "gpt-5.3-codex"
approval_policy = "on-request"
sandbox_mode    = "workspace-write"
model_reasoning_effort = "medium"

[profiles.review]
model = "gpt-5.3-codex"
approval_policy = "never"
sandbox_mode    = "read-only"
model_reasoning_effort = "high"

[profiles.yolo]
approval_policy = "never"
sandbox_mode    = "danger-full-access"

[profiles.local-ollama]
model          = "llama3.3:70b-instruct"
model_provider = "ollama"
approval_policy = "on-request"
sandbox_mode    = "workspace-write"
```

Profile können alle Top-Level-Schlüssel überschreiben; nicht gesetzte Werte erben die globalen Defaults.

## 4. Model Providers `[model_providers.<id>]`

Jeder Eintrag beschreibt ein OpenAI-kompatibles Backend. Built-in-IDs `openai`, `ollama`, `lmstudio` sind reserviert.

### 4.1 Schlüssel

| Key | Pflicht | Bedeutung |
|---|---|---|
| `name` | ja | anzuzeigender Name |
| `base_url` | ja | Basis-URL (inkl. `/v1`, wenn Provider das braucht) |
| `env_key` | optional | Name der ENV, aus der der API-Key gelesen wird |
| `env_key_fallback` | optional | Fallback-ENV, z. B. `"NONE"` für keine Auth |
| `wire_api` | optional | `responses` (Default) oder `chat` |
| `requires_openai_auth` | optional | setzt OpenAI-Header zusätzlich |
| `query_params` | optional | zusätzliche Query-Parameter (z. B. `api-version`) |
| `headers` | optional | statische HTTP-Header |

### 4.2 Beispiele

```toml
[model_providers.azure]
name = "Azure OpenAI"
base_url = "https://my.openai.azure.com/openai/v1"
env_key = "AZURE_OPENAI_API_KEY"
wire_api = "responses"
query_params = { api-version = "2025-04-01-preview" }

[model_providers.openrouter]
name = "OpenRouter"
base_url = "https://openrouter.ai/api/v1"
env_key = "OPENROUTER_API_KEY"
wire_api = "chat"

[model_providers.vllm]
name = "Self-hosted vLLM"
base_url = "http://10.0.0.10:8000/v1"
env_key_fallback = "NONE"
wire_api = "chat"

[model_providers.lmstudio]
name = "LM Studio"
base_url = "http://localhost:1234/v1"
wire_api = "chat"
```

## 5. MCP-Server `[mcp_servers.<name>]`

Codex spricht STDIO- und Streaming-HTTP-MCP-Server.

```toml
[mcp_servers.github]
command = "docker"
args = ["run", "-i", "--rm", "-e", "GITHUB_TOKEN", "ghcr.io/github/github-mcp-server"]
env = { GITHUB_TOKEN = "${GITHUB_TOKEN}" }
startup_timeout_ms = 10000
tool_timeout_sec = 120
supports_parallel_tool_calls = true

[mcp_servers.filesystem]
command = "npx"
args = ["-y", "@modelcontextprotocol/server-filesystem", "/home/user/projects"]

[mcp_servers.playwright]
command = "npx"
args = ["-y", "@playwright/mcp"]
tool_timeout_sec = 300

[mcp_servers.context7]
command = "npx"
args = ["-y", "@upstash/context7-mcp"]
```

Weitere optionale Schlüssel:
- `tools.<tool_name>.approval_mode = "approve"` – einzelnes Tool zusätzlich absichern.
- `cwd` – Arbeitsverzeichnis des Sub-Prozesses.
- `log` – Debug-Pfad.
- `streamable_http_url` – URL bei HTTP-Transport.
- `oauth = true` – OAuth-Flow (`codex mcp add --oauth ...`).

Tiefergehend: Datei 09.

## 6. Shell-Environment-Policy `[shell_environment_policy]`

Steuert, welche ENV-Variablen an Shell-Tool-Subprozesse durchgereicht werden.

```toml
[shell_environment_policy]
inherit = "core"            # core | all | none
ignore_default_excludes = false
exclude = ["*_TOKEN", "*_SECRET", "AWS_*", "OPENAI_API_KEY"]
include_only = []
set = { LANG = "C.UTF-8", CI = "1" }
```

| Key | Wirkung |
|---|---|
| `inherit` | `core` = Basis (HOME, PATH, LANG, …), `all` = komplettes Env, `none` = nichts |
| `exclude` | Glob-Patterns, die aus dem Env entfernt werden |
| `include_only` | wenn gesetzt, bleibt **nur** die Allowlist |
| `set` | fest gesetzte Variablen (überschreibt alles) |
| `ignore_default_excludes` | Default-Blocklist für Secrets deaktivieren (nicht empfohlen) |

Sicherheits-Default: Secret-Patterns landen nicht im Agent-Context.

## 7. Sandbox `[sandbox_workspace_write]`

Konfiguration für `sandbox_mode = "workspace-write"` (Details in Datei 07).

```toml
[sandbox_workspace_write]
writable_roots         = ["${CWD}", "${CODEX_HOME}/sessions"]
network_access         = false
exclude_tmpdir_env_var = false
exclude_paths          = ["node_modules/.cache"]
```

| Key | Bedeutung |
|---|---|
| `writable_roots` | zusätzliche Schreib-Pfade (neben `cwd` und `/tmp`) |
| `network_access` | Default `false`; `true` lässt Netzwerk zu |
| `exclude_tmpdir_env_var` | wenn `true`, wird `$TMPDIR` nicht automatisch freigegeben |
| `exclude_paths` | Patterns innerhalb `writable_roots`, die nicht beschreibbar sein sollen |

## 8. History `[history]`

```toml
[history]
persist      = true
max_bytes    = 52428800          # 50 MiB
scrub_secrets = true
```

- `persist`: Session-Transkripte in `~/.codex/sessions/` speichern.
- `max_bytes`: Größenlimit, ältere Sessions werden rotiert.
- `scrub_secrets`: Secrets im Transkript automatisch maskieren.

## 9. TUI `[tui]` und `[tui.notifications]`

```toml
[tui]
mouse            = true
alternate_screen = true
color_scheme     = "auto"      # light | dark | auto

[tui.notifications]
enabled = true
command = ["notify-send", "Codex"]
```

## 10. OpenTelemetry `[otel]`

```toml
[otel]
enabled      = true
endpoint     = "http://otel-collector:4318"
protocol     = "http/protobuf"  # http/protobuf | grpc
service_name = "codex-cli"
resource     = { env = "dev", team = "platform" }
```

Sendet Traces (Turn-Start/End, Tool-Calls) und Metriken (Token-Usage, Latenzen).

## 11. Tools `[tools]`

Schaltet modell-seitige Built-in-Tools:

```toml
[tools]
web_search = true
```

## 12. Notice / Netzinformationen `[notice]`

`[notice]` steuert einmalige UI-Hinweise (z. B. Release-Banner). Praktisch für Enterprise-Rollouts.

## 13. Logging

```toml
log_level = "info"                # error|warn|info|debug|trace
log_file  = "~/.codex/codex.log"
```

## 14. Experimente

```toml
experimental_realtime_start_instructions = "You are a senior engineer ..."
experimental_use_responses_experimental_message = false
experimental_resume = true
experimental_child_agents_md = true
experimental_plan_autorun = false
```

> Experimentelle Flags sind nicht stabil und können zwischen Releases entfernt werden.

## 15. Vollständige Beispiel-Konfigurationen

### 15.1 Einzelentwickler:in mit ChatGPT-Login

```toml
model                      = "gpt-5.3-codex"
model_provider             = "openai"
approval_policy            = "on-request"
sandbox_mode               = "workspace-write"
model_reasoning_effort     = "medium"
model_reasoning_summary    = "auto"
cli_auth_credentials_store = "auto"
profile                    = "dev"

[profiles.dev]
model = "gpt-5.3-codex"

[profiles.review]
model = "gpt-5.3-codex"
approval_policy = "never"
sandbox_mode    = "read-only"
model_reasoning_effort = "high"

[profiles.plan]
model = "o3"
approval_policy = "never"
sandbox_mode    = "read-only"
plan_mode_reasoning_effort = "high"

[sandbox_workspace_write]
network_access = false

[shell_environment_policy]
inherit = "core"
exclude = ["*_TOKEN", "*_SECRET", "AWS_*"]
```

### 15.2 Enterprise: Azure OpenAI + restriktive Sandbox

```toml
model          = "gpt-5.3-codex"
model_provider = "azure"
approval_policy = "untrusted"
sandbox_mode    = "workspace-write"
cli_auth_credentials_store = "keyring"

[model_providers.azure]
name = "Azure OpenAI"
base_url = "https://corp.openai.azure.com/openai/v1"
env_key = "AZURE_OPENAI_API_KEY"
wire_api = "responses"
query_params = { api-version = "2025-04-01-preview" }

[sandbox_workspace_write]
writable_roots = ["${CWD}"]
network_access = false
exclude_paths  = ["node_modules", ".git/hooks"]

[shell_environment_policy]
inherit = "core"
exclude = ["*_TOKEN", "*_SECRET", "*_KEY", "AWS_*", "AZURE_*", "GCP_*", "OPENAI_API_KEY", "AZURE_OPENAI_API_KEY"]
set     = { CI = "1", LANG = "C.UTF-8" }

[otel]
enabled      = true
endpoint     = "https://otel.corp:4318"
service_name = "codex-cli"

[history]
persist       = true
max_bytes     = 104857600   # 100 MiB
scrub_secrets = true

[tui.notifications]
enabled = false
```

### 15.3 Lokal mit Ollama

```toml
model          = "llama3.3:70b-instruct"
model_provider = "ollama"
approval_policy = "on-request"
sandbox_mode    = "workspace-write"
model_reasoning_effort = "low"

[model_providers.ollama]
name     = "Ollama"
base_url = "http://localhost:11434/v1"
env_key_fallback = "NONE"
wire_api = "chat"

[profiles.qwen-code]
model = "qwen2.5-coder:32b"
model_provider = "ollama"

[tools]
web_search = false

[sandbox_workspace_write]
network_access = true   # lokal ok, da Ollama lokal läuft
```

## 16. Laufzeit-Override per CLI

```bash
codex --config approval_policy=never \
      --config sandbox_mode=read-only \
      --config model_reasoning_effort=high \
      "review the diff"
```

Mehrere `--config`-Flags stapeln sich; die Präzedenz ist:
1. CLI-Flags / `--config`
2. `.codex/config.toml` (Projekt-Override)
3. `~/.codex/config.toml` (User)
4. eingebaute Defaults

## 17. Managed-Config (Enterprise)

Für Flotten-Rollouts lässt sich eine **Managed Configuration** per `CODEX_MANAGED_CONFIG=/etc/codex/managed.toml` erzwingen. Diese Datei kann bestimmte Keys **lockdown** setzen, sodass Nutzerüberschreibungen ignoriert werden (Quelle: https://developers.openai.com/codex/enterprise/managed-configuration).

```toml
# /etc/codex/managed.toml – read-only
model_provider = "azure"
sandbox_mode   = "workspace-write"
approval_policy = "untrusted"

[shell_environment_policy]
inherit = "core"
exclude = ["*_TOKEN", "*_SECRET"]
```

## 18. Quick-Check-Kommandos

```bash
codex --help                   # zeigt alle aktuellen Flags
codex config show              # (sofern verfügbar) druckt effektive Config
codex --config model=gpt-5 --help   # effektive Werte sehen
```

## 19. Referenzen

- Vollständige Reference: https://developers.openai.com/codex/config-reference
- Basic: https://developers.openai.com/codex/config-basic
- Advanced: https://developers.openai.com/codex/config-advanced
- Sample: https://developers.openai.com/codex/config-sample
- Managed-Config: https://developers.openai.com/codex/enterprise/managed-configuration
- Schema im Repo: `codex-rs/core/config.schema.json`
