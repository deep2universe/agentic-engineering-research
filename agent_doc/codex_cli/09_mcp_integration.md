# OpenAI Codex CLI – MCP-Integration

> Stand: 2026-04-16. Quellen: https://developers.openai.com/codex/mcp, https://modelcontextprotocol.io, https://github.com/modelcontextprotocol/servers.

Codex CLI ist **bidirektional MCP-fähig**: als Client spricht er externe MCP-Server an (GitHub, Filesystem, Playwright …), als Server stellt er selbst Tools bereit (`codex`, `codex-reply`), sodass andere Agenten Codex als Sub-Agent nutzen können.

## 1. MCP-Grundlagen (kurz)

- Model Context Protocol (MCP) = JSON-RPC-basiertes Tool-Interface für LLM-Agenten.
- Transports: **STDIO** (Subprocess), **Streaming-HTTP/SSE**, neuerdings auch **WebSocket**.
- Ein MCP-Server exponiert `tools`, `resources`, `prompts` und reagiert auf `call_tool`-Requests.
- Ein MCP-Client (wie Codex) verwaltet Verbindung, Discovery, Lebenszyklus und gibt die Tools an das Sprachmodell weiter.

## 2. Codex als MCP-Client – `[mcp_servers.<name>]`

Konfiguration in `~/.codex/config.toml` oder projektweit in `.codex/config.toml`.

### 2.1 Felder

| Feld | Bedeutung |
|---|---|
| `command` | Pflicht bei stdio – Binary-Pfad (z. B. `npx`, `docker`, `python`) |
| `args` | Argumentliste |
| `env` | Extra-Umgebungsvariablen (werden von der Shell-Env-Policy durchgeschleust, `set`-Einträge überschreiben) |
| `cwd` | Arbeitsverzeichnis des Sub-Prozesses |
| `startup_timeout_ms` | wie lange Codex auf Handshake wartet (Default 5 000) |
| `tool_timeout_sec` | Max-Laufzeit pro Tool-Call |
| `supports_parallel_tool_calls` | parallel aufrufbar (seit v0.121.0) |
| `streamable_http_url` | URL bei HTTP-Transport |
| `oauth` | `true` aktiviert OAuth-Flow gegen den MCP-Server |
| `tools.<tool_name>.approval_mode` | pro Tool Approval erzwingen (`"approve"`) |
| `tools.<tool_name>.enabled` | Tool gezielt aktivieren/deaktivieren |

### 2.2 Typische Server

```toml
# GitHub Official (docker)
[mcp_servers.github]
command = "docker"
args = ["run", "-i", "--rm",
        "-e", "GITHUB_TOKEN",
        "ghcr.io/github/github-mcp-server"]
env = { GITHUB_TOKEN = "${GITHUB_TOKEN}" }
startup_timeout_ms = 10000
supports_parallel_tool_calls = true
tools = { create_pull_request = { approval_mode = "approve" },
          merge_pull_request  = { approval_mode = "approve" } }

# Filesystem-Server (explicit Scopes)
[mcp_servers.fs]
command = "npx"
args = ["-y", "@modelcontextprotocol/server-filesystem",
        "/home/user/projects",
        "/tmp/workspaces"]

# Playwright MCP (Browser-Automatisierung)
[mcp_servers.playwright]
command = "npx"
args = ["-y", "@playwright/mcp"]
tool_timeout_sec = 300

# Context7 (Library-Docs)
[mcp_servers.context7]
command = "npx"
args = ["-y", "@upstash/context7-mcp"]
env = { UPSTASH_REDIS_REST_URL = "...", UPSTASH_REDIS_REST_TOKEN = "..." }

# Postgres Read-Only
[mcp_servers.postgres]
command = "uvx"
args = ["mcp-server-postgres", "--read-only",
        "--db-url", "postgres://user:pwd@localhost/db"]

# HTTP-MCP (z. B. OAuth)
[mcp_servers.notion]
streamable_http_url = "https://notion.com/mcp"
oauth = true
```

### 2.3 `codex mcp` – Verwaltung von der Shell

```bash
codex mcp list                                      # installierte Server
codex mcp tools github                              # Tools eines Servers auflisten
codex mcp run github.create_issue \
   --input '{"owner":"me","repo":"x","title":"Bug"}' # Tool direkt aufrufen
codex mcp add github \
   --command docker \
   --args "run -i --rm ghcr.io/github/github-mcp-server" \
   --env GITHUB_TOKEN=$GITHUB_TOKEN                 # zur Config hinzufügen
codex mcp add notion --streamable-http-url https://notion.com/mcp --oauth
codex mcp remove github
codex mcp doctor                                    # Health-Check (Startup, Tools, Versionen)
codex mcp logs github                               # zuletzt produzierte Logs
```

### 2.4 Parallele Tool-Calls

Seit v0.121.0 kann Codex mehrere MCP-Tool-Calls parallel absetzen, wenn:
1. das Modell die Aufrufe nebenläufig emittiert,
2. der jeweilige Server `supports_parallel_tool_calls = true` signalisiert,
3. die Tool-Klassen nicht implizit zu Race-Conditions führen (Filesystem-Writes auf gleiche Datei werden serialisiert).

## 3. Codex als MCP-Server – `codex mcp serve`

`codex mcp serve` startet einen STDIO-MCP-Server, der die Codex-Fähigkeiten exponiert. Ein anderer Agent (z. B. Claude Code, OpenAI Agents SDK) kann Codex damit als Sub-Agent in seine Tool-Liste aufnehmen.

Beispiel-Konfig in Claude Code (`~/.claude/claude_desktop_config.json` bzw. `mcp_config`):

```json
{
  "mcpServers": {
    "codex": {
      "command": "codex",
      "args": ["mcp", "serve"],
      "env": { "OPENAI_API_KEY": "${OPENAI_API_KEY}" }
    }
  }
}
```

Exportierte Tools:

| Tool | Zweck |
|---|---|
| `codex` | startet eine neue Codex-Session mit übergebenem Prompt, gibt Session-ID + finale Antwort zurück |
| `codex-reply` | hängt eine weitere User-Nachricht an eine bestehende Session an |
| `codex-status` | fragt Meta-Infos zur Session ab |

Use-Cases:
- Claude Code orchestriert mehrere Sub-Agenten, Codex übernimmt OpenAI-spezifische Tasks.
- Agents-SDK-Workflows nutzen Codex als „Heavy-Lift"-Tool für Refactorings.
- Automatisierte Vergleichs-Runs (Anthropic vs. OpenAI) in Benchmarks.

## 4. Tool-Permissions und Sicherheit

Wichtig: **MCP-Tool-Aufrufe laufen nicht automatisch in der OS-Sandbox** – die Sandbox schützt nur Shell- und Filesystem-Aktionen der Agent-Schicht. MCP-Server sind eigenständige Prozesse, die z. B. ins Netz gehen oder Dateien schreiben können.

Schutzmaßnahmen:
1. **Approval-Policy** greift auch für MCP-Tools: in `untrusted`/`on-request` kommen Popups. Für kritische Tools zusätzlich `tools.<name>.approval_mode = "approve"`.
2. **Tool-Allowlist**: `tools.<name>.enabled = false` schaltet einzelne Tools hart ab.
3. **Minimal-Scope**: Filesystem-Server nur auf Projektpfade zeigen, GitHub-Token mit Least-Privilege (nur `repo: contents, pull-requests`), Datenbank-Server mit `--read-only`.
4. **Vertrauenswürdige Quelle**: MCP-Server aus offiziellen Registries oder signierten ghcr.io-Images; selbst-geschriebene Server im eigenen Repo.
5. **Separate Provider**: GitHub-Token nicht im selben Env wie `OPENAI_API_KEY`, sondern nur an den GitHub-MCP-Server via `env`.
6. **OTel** aktivieren, um Tool-Calls zu protokollieren.

## 5. Debugging

- `codex mcp doctor` zeigt Startup-Fehler, Handshake-Probleme, fehlende ENV-Vars.
- `codex mcp logs <server>` zeigt Stderr-Ausgabe des MCP-Subprozesses.
- `[mcp_servers.*.log]` kann Log-Level/Datei überschreiben.
- Bei STDIO-Servern: ein manueller Test hilft – `echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | <command>`.
- Häufige Ursache für Timeouts: `startup_timeout_ms` zu niedrig (Docker-Pulls).
- Wenn Parallel-Calls streiken: `supports_parallel_tool_calls = false` als Workaround.

## 6. Performance-Tipps

- `startup_timeout_ms = 15000` bei Docker-basierten Servern einplanen.
- Lang laufende Tools (`playwright.screenshot`, `pg.query`) → `tool_timeout_sec = 300` oder höher.
- Häufig genutzte Server in einem **hot pool** halten: MCP-Prozess bleibt zwischen Sessions aktiv (`codex mcp keep-alive` – experimentell in v0.121.0).
- Statt Docker direkt `npx` oder `uvx` nutzen, wenn akzeptabel (weniger Cold-Start).

## 7. Beispiel: eigener MCP-Server

```python
# weather_mcp.py – minimaler Server mit FastMCP
from fastmcp import FastMCP
mcp = FastMCP("weather-mcp")

@mcp.tool()
def get_forecast(city: str) -> dict:
    "Liefert das Wetter für eine Stadt (Stub)."
    return {"city": city, "forecast": "sunny", "temp_c": 21}

if __name__ == "__main__":
    mcp.run_stdio()
```

Konfig in Codex:

```toml
[mcp_servers.weather]
command = "uv"
args = ["run", "/home/user/mcp/weather_mcp.py"]
```

## 8. Vergleich zu anderen MCP-Clients

| Aspekt | Codex CLI | Claude Code | Cursor |
|---|---|---|---|
| STDIO | ✔ | ✔ | ✔ |
| Streamable HTTP | ✔ | ✔ | ✔ |
| OAuth gegen MCP-Server | ✔ | ✔ (seit 2025) | teilweise |
| Parallel Tool Calls | ✔ (0.121+) | ✔ | ✔ |
| Eigene Tool-Allowlist | ✔ | ✔ (hooks) | begrenzt |
| MCP-Server-Modus (selbst exponieren) | ✔ (`codex mcp serve`) | ✔ (`claude mcp serve`) | kein offizielles Pendant |

## 9. Typische MCP-Stacks für Codex

**Produktiver Monorepo-Workflow**
- github + filesystem + postgres (read-only) + playwright
- Tools: Code-Kontext, Datenbank-Inspection, Browser-Smoke-Tests.

**Research-Stack**
- context7 + web-search + arxiv-mcp + reddit-mcp
- Tools: Library-Docs, Paper-Recherche.

**Ops-Stack**
- kubernetes-mcp + grafana-mcp + sentry-mcp
- Tools: Cluster-Status, Logs, Metriken.

**Security-Review**
- filesystem (read-only) + semgrep-mcp + snyk-mcp
- Tools: SAST, Dependency-Check, Secret-Scan.

## 10. Referenzen

- Offizielle MCP-Seite: https://modelcontextprotocol.io
- Server-Sammlung: https://github.com/modelcontextprotocol/servers
- Codex MCP-Doku: https://developers.openai.com/codex/mcp
- Codex Agents-SDK-Guide: https://developers.openai.com/codex/guides/agents-sdk
- Issue #17501 (MCP-Startup in JSONL): https://github.com/openai/codex/issues/17501
