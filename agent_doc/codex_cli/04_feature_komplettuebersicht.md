# OpenAI Codex CLI – Komplette Feature-Übersicht

> Stand: 2026-04-16, Bezug auf stable v0.121.0. Diese Datei ist die Panorama-Sicht auf alle CLI-Features; tiefere Details zu Sandbox, Approvals, MCP und Konfiguration stehen in den Dateien 05–09.

## 1. Basis-Modi

Codex kennt drei grundsätzliche Betriebsarten:

| Modus | Aufruf | Einsatz |
|---|---|---|
| **Interaktive TUI** | `codex` ohne Argumente | Pair-Programming, Exploration, Reviews |
| **Non-interaktive Exec** | `codex exec "<prompt>"` | CI/CD, Skripte, einmalige Aufgaben |
| **Resume** | `codex resume [id]`, `codex resume --last`, `codex exec resume <id>` | Fortsetzung früherer Sessions |

Session-State liegt unter `~/.codex/sessions/<id>.jsonl`; `/resume` und `/undo` in der TUI greifen darauf zu.

## 2. CLI – Subcommands

```bash
codex                      # TUI starten
codex "<prompt>"           # TUI starten, Prompt vorbelegen
codex exec "<prompt>"      # Headless
codex resume [id]          # Session fortsetzen
codex exec resume <id>     # Headless fortsetzen
codex login                # OAuth-Flow / API-Key registrieren
codex logout               # Credentials löschen
codex mcp add|list|remove|run|tools|serve   # MCP-Management
codex completion bash|zsh|fish|powershell   # Shell-Completion generieren
codex plugin install|list|remove            # Marketplace-Plugins (seit v0.121.0)
codex --version
codex --help
```

> Der Prompt kann auch via stdin übergeben werden: `echo "fix lint" | codex exec`.

## 3. CLI-Flags (Top-Level)

| Flag | Beschreibung |
|---|---|
| `--model <name>`, `-m` | Modell für diese Session (z. B. `gpt-5.3-codex`) |
| `--profile <name>` | Profil aus `config.toml` aktivieren |
| `--config key=value` | Einzelnen Config-Wert für diesen Aufruf überschreiben (mehrfach wiederholbar) |
| `--ask-for-approval <policy>`, `-a` | `untrusted` / `on-request` / `never` / `granular` (siehe Datei 08) |
| `--sandbox <mode>`, `-s` | `read-only` / `workspace-write` / `danger-full-access` |
| `--cd <dir>` | Arbeitsverzeichnis setzen (statt `pwd`) |
| `--image <datei>`, `-i` | Bild anhängen (TUI: Paste/Drag&Drop möglich) |
| `--skip-git-repo-check` | Warnung bei Nicht-Git-Ordner unterdrücken |
| `--dangerously-bypass-approvals-and-sandbox` | Alle Sicherheitsschranken aus (nur für Container/Throwaway) |
| `--continue` | Letzte Session fortsetzen (gleich wie `resume --last`) |
| `--last` | Shortcut für letzte Session |
| `--log-level <error\|warn\|info\|debug\|trace>` | Loglevel |
| `--log-file <pfad>` | Logziel-Datei |
| `--version`, `-V` | Version |
| `--help`, `-h` | Hilfe |

## 4. `codex exec` – spezifische Flags

Für den Non-Interactive-Modus kommen zusätzliche Flags hinzu:

| Flag | Beschreibung |
|---|---|
| `--json` | stdout wird JSONL-Stream (ein Event pro Zeile) |
| `--output-last-message <datei>`, `-o` | finale Antwort in Datei schreiben |
| `--output-schema <schema.json>` | Strukturiertes Output gemäß JSON-Schema |
| `--include-plan-tool` | `update_plan`-Tool aktivieren (Default in TUI, optional in exec) |
| `--color <auto\|always\|never>` | Farbsteuerung |
| `--no-banner` | Banner in exec unterdrücken |
| `--silent` | nur finale Antwort, keine Stats |
| `--cd <dir>`, `--sandbox …`, `--ask-for-approval …` | wie oben |

Beispiel – Review als JSONL:

```bash
codex exec "Review den Diff vs origin/main für Sicherheitsprobleme" \
  --json --output-last-message review.md \
  --ask-for-approval never --sandbox read-only
```

JSONL-Events (Auswahl – Quelle: https://developers.openai.com/codex/noninteractive, Issue #17501):

| Event-Typ | Bedeutung |
|---|---|
| `thread.started` | Session initialisiert |
| `turn.started` | Neuer Modell-Turn beginnt |
| `turn.completed`, `turn.failed` | Turn-Ende |
| `item.message` | Agent-Nachricht an Nutzer |
| `item.reasoning` | Reasoning-Summary |
| `item.command` | ausgeführter Shell-Befehl mit stdout/stderr |
| `item.file_change` | Datei-Änderung via apply_patch |
| `item.mcp_call` | MCP-Tool-Aufruf |
| `item.web_search` | Web-Search-Aufruf |
| `item.plan` | update_plan-Fortschritt |
| `error` | Fehlerereignis |

## 5. Umgebungsvariablen

| Variable | Zweck |
|---|---|
| `OPENAI_API_KEY` | API-Key-Auth |
| `OPENAI_BASE_URL` | Alternative Endpoint (Azure, self-hosted) |
| `CODEX_HOME` | State-/Config-Verzeichnis (Default `~/.codex`) |
| `CODEX_SQLITE_HOME` | SQLite-Store separat |
| `CODEX_CA_CERTIFICATE` | Corporate CA-Bundle |
| `HTTP_PROXY`, `HTTPS_PROXY`, `NO_PROXY` | Proxy-Steuerung |
| `NO_COLOR` | Farbausgabe abschalten |
| `CODEX_LOG_LEVEL` | Loglevel ohne Flag |
| `CODEX_CONFIG` | alternative Config-Datei |

## 6. Prompt-Artefakte

### 6.1 AGENTS.md

Codex lädt **beim Start** eine Kette aus AGENTS.md-Dateien:

1. `~/.codex/AGENTS.md` (global)
2. optional `~/.codex/AGENTS.override.md`
3. Repo-Root `AGENTS.md`
4. alle `AGENTS.md` auf dem Pfad von Repo-Root bis `cwd`

Die Reihenfolge ist **append-only, mit Override-Semantik**: spätere Dateien ergänzen/überschreiben frühere. Default-Größenlimit ~32 KiB je Datei.

Typischer Inhalt:

```markdown
# AGENTS.md
## Projekt: payments-api
Stack: Node 22 + TypeScript, Fastify, Postgres, Prisma.
Tests: vitest, 80 % Coverage-Gate.
Konventionen: Conventional Commits, strict TS, ESLint airbnb-base.
Don't: keine globalen Mutationen, kein console.log in prod-Code.
Do: Dependency-Injection, Zod-Validation an allen Grenzen.
Modul-Index:
- src/auth/* -> JWT + Session
- src/payments/* -> Stripe-Adapter
```

### 6.2 Custom Prompts (`.codex/prompts/`)

Projektweite Slash-Commands entstehen durch `.md`-Dateien in `.codex/prompts/`:

```text
.codex/prompts/add-test.md
.codex/prompts/review-security.md
.codex/prompts/release-notes.md
```

Dateiinhalt ist ein **Prompt-Template** mit Platzhaltern (`{{args}}`). Aufruf in der TUI: `/add-test src/foo.ts`.

### 6.3 Globale Prompts

`~/.codex/prompts/*.md` gelten global für alle Projekte des Nutzers.

## 7. Planning / `update_plan`

Das Plan-Tool wird automatisch in der TUI aktiviert, optional in `exec` per `--include-plan-tool`. Es erlaubt Codex, einen **TODO-Plan** zu pflegen und Fortschritt zu markieren:

```
[ ] Analyse-Phase abschließen
[x] API-Vertrag skizzieren
[ ] Unit-Tests schreiben
```

In JSONL erscheint das als `item.plan`-Events. Nützlich für Sichtbarkeit langer Tasks.

## 8. File-Editing: `apply_patch`

Codex schreibt Dateien **nicht direkt**, sondern emittiert Unified-Diffs, die über das interne Tool `apply_patch` eingespielt werden. Vorteile:
- Approval-gate sieht explizit jede Änderung.
- Multi-File-Patches in einem Schritt möglich.
- Atomisches Rollback (`/undo`).

Typischer Fluss in TUI:
1. Agent schlägt Patch vor.
2. Diff-Preview erscheint.
3. Nutzer:in bestätigt (Enter), verwirft (Esc) oder fordert Anpassung.

## 9. Shell-Tool

Das generische Shell-Tool führt Befehle in der konfigurierten Sandbox aus. Relevante Punkte:
- Environment wird durch `shell_environment_policy` gefiltert (Datei 05).
- Netzwerk Default **aus** in `workspace-write`.
- Lange Prozesse werden mit Timeout beendet; TUI zeigt streaming stdout.
- Kommando + Output landen im Transkript (JSONL: `item.command`).

## 10. Web-Search-Tool

Aktivierbar via `--search` (historisch) bzw. über Config `tools.web_search = true`. Liefert Websuche-Ergebnisse direkt an das Modell. Für Recherche, Dokumentationsabfragen, API-Referenzen.

```toml
[tools]
web_search = true
```

## 11. Reasoning & Verbosity

Drei Stellschrauben:
- `model_reasoning_effort` (minimal/low/medium/high)
- `model_reasoning_summary` (auto/detailed/none) – wie sichtbar der CoT wird
- `model_verbosity` (minimal/low/medium/high) – wie lang die Antworten

Pro Profil unterschiedlich setzbar.

## 12. Output-Schema (Structured Outputs)

Mit `--output-schema schema.json` erzwingt Codex ein JSON-Schema-konformes Endergebnis. Ideal für Pipelines:

```bash
codex exec "Analysiere package.json und gib Upgrades zurück" \
  --output-schema ./schemas/upgrade-report.json \
  --ask-for-approval never --sandbox read-only
```

Codex liefert ausschließlich JSON, das der nachgelagerte `jq`-Filter verarbeiten kann.

## 13. Session-Management

- Speicherort: `~/.codex/sessions/`, eine JSONL-Datei je Session.
- Indexdatenbank: SQLite (`~/.codex/state.sqlite3`).
- Kommandos: `codex resume`, `codex resume --last`, TUI `/resume`, `/undo`.
- Memory-Mode (seit v0.121.0): optionales Gedächtnis über Sessions hinweg, per `/memory` bedienbar.

## 14. Notifications

Desktop-Notifies für lange Runs:

```toml
[tui.notifications]
enabled = true
command = ["terminal-notifier", "-title", "Codex", "-message"]   # macOS
# Linux: notify-send; Windows: ggf. PowerShell-Toast
```

Codex ruft das konfigurierte Kommando am Ende eines Turns oder bei Approval-Bedarf auf.

## 15. Telemetry & OTel

- Anonyme Nutzungs-Telemetrie standardmäßig aktiv; kann in Config/CLI deaktiviert werden.
- OpenTelemetry-Export via `[otel]`-Block – Traces/Metriken an OTLP-Endpunkte, ideal für self-hosted Observability.

```toml
[otel]
enabled = true
endpoint = "http://otel-collector.internal:4318"
service_name = "codex-cli"
```

## 16. Marketplace-Plugins (seit v0.121.0)

`codex plugin install <git-url|ghcr-ref|local-path>` lädt Plugins, die MCP-Server, Prompt-Bundles oder Skill-Pakete bereitstellen. Verwaltung via `codex plugin list|remove`.

## 17. Experimentelle Flags

Sammelüberblick (in `config.toml` unter `experimental_*`):

| Flag | Zweck |
|---|---|
| `experimental_realtime_start_instructions` | Realtime-API-Startnachricht ersetzen |
| `experimental_use_responses_experimental_message` | testweise neue Message-Shape |
| `experimental_resume` | verbesserter Resume-Pfad |
| `experimental_child_agents_md` | Sub-AGENTS.md-Scope |
| `experimental_plan_autorun` | Plan-Tool automatisch schließen |

Experimente können zwischen Releases entfernt werden – Changelog beachten.

## 18. TUI-spezifische Features

- **Ratatui-basiert**, Truecolor, Mouse-Support optional.
- **Alternate Screen** (`tui-alternate-screen`) für sauberes Ein-/Aussteigen.
- **Chat Composer** mit Multi-Line (`Ctrl+J`), History (`Ctrl+R` seit v0.121.0), Paste-Bild.
- **Stream-Chunking**: Modell-Output wird block-für-block gerendert für bessere Readability.
- **Slash-Commands**: siehe Datei 06.
- **Approval-Popup**: inline mit Preview.

## 19. Completion / Shell-Integration

```bash
codex completion zsh > ~/.zfunc/_codex
fpath+=~/.zfunc
autoload -U compinit && compinit
```

Liefert Slash-Completion für Profile, Modelle, Flags.

## 20. Schnellübersicht: Feature-Kategorien

| Kategorie | Wichtigste Features |
|---|---|
| **Eingabe** | TUI-Prompt, exec-Prompt, Bilder, Paste, stdin, Custom-Prompts |
| **Reasoning** | effort, summary, verbosity, plan-tool |
| **Ausführung** | Shell-Tool, apply_patch, Web-Search, MCP-Tools |
| **Sicherheit** | Sandbox (Seatbelt/Landlock/bubblewrap/AppContainer), Approval-Policies, execpolicy |
| **Kontext** | AGENTS.md-Hierarchie, Custom-Prompts, Profiles, Memory-Mode |
| **Output** | Text, JSONL (`--json`), `--output-schema`, `--output-last-message` |
| **Integration** | MCP (Client+Server), GitHub Action, IDE-Extension, Codex Cloud |
| **Ops** | Sessions, Resume, Notifications, OTel, Logs |
| **Plug-in** | Marketplace-Plugins (git/ghcr/local) |

## 21. Verweise

- GitHub: https://github.com/openai/codex
- Features-Seite: https://developers.openai.com/codex/cli/features
- Reference CLI-Flags: https://developers.openai.com/codex/cli/reference
- Non-interactive / JSON: https://developers.openai.com/codex/noninteractive
- Plan-Tool-Diskussion: https://github.com/openai/codex/issues/1673 (Output-Schema)
