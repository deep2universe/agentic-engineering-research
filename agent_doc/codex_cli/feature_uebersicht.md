# Codex CLI — Komplette Feature-Übersicht

> Stand: 2026-04-16 · Referenz: CLI v0.121.0, IDE-Extension `openai.chatgpt`

Diese Seite listet **alle wesentlichen Features** der Codex CLI in thematischen Gruppen mit Flag, Slash-Command oder Config-Key. Für Konfigurations-Details siehe [`konfiguration_und_anpassung.md`](konfiguration_und_anpassung.md), für Sicherheits-Features [`sicherheit_und_sandboxing.md`](sicherheit_und_sandboxing.md).

## 1. Laufmodi

![Sieben Laufmodi der Codex CLI als Mode-Dial-Panel-Grid: Interactive TUI, Headless Exec, Resume, Cloud Handoff, MCP Server, Review, Completion](svg/feature_uebersicht_01_laufmodi.svg)

| Modus | Aufruf | Zweck |
|---|---|---|
| **Interactive TUI** | `codex` | Default, Full-Screen-UI mit Prompt-Box, Diff-View, Thinking-Panel |
| **Headless Exec** | `codex exec "<prompt>"` | Nicht-interaktiv, CI/Scripts, finale Antwort auf stdout |
| **Resume** | `codex resume`, `codex resume --last`, `/resume` | Letzte Session oder Picker mit History laden |
| **Cloud Handoff** | `codex cloud exec --env <ID>`, `codex cloud list`, `codex cloud logs`, `codex cloud pull` | Remote-Task delegieren, Status und Diff zurückholen |
| **MCP Server** | `codex mcp serve` | Codex als MCP-Server für andere Agenten exponieren |
| **Review** | `codex review` bzw. `/review` | Dedizierter Review-Lauf, fokussiert auf Behavior-Changes und fehlende Tests |
| **Completion** | `codex completion bash\|zsh\|fish\|powershell` | Shell-Completion-Scripts generieren |

## 2. Eingabe-Modi

![Eingabe-Pipelines als Trichter: Inline-Prompt, Prompt-Datei, Image, Drag-and-Drop, @-Mention, Skill-Trigger](svg/feature_uebersicht_02_eingabe_modi.svg)

- **Prompt inline**: `codex "fix the failing tests"` startet TUI mit vorbelegtem Prompt.
- **Prompt-Datei**: `codex exec --prompt-file task.md` bzw. `-f`.
- **Image-Input**: `-i screenshot.png` oder `--image`, Drag-and-Drop in die TUI, Paste aus Clipboard.
  - Full-Resolution-Inspection für Design-Review, Visual-Debugging.
  - Image-History persistiert über `codex resume` — wichtig für Multi-Day-UI-Arbeit.
  - `view_image` Tool im Code-Mode liefert resolvable URLs.
- **Clipboard / @-Mention**: `@<file>` fuzzy-sucht Dateien und fügt sie dem Kontext hinzu.
- **Skill-Trigger**: bei passender Beschreibung lädt Codex ein *Agent Skill* automatisch nach (siehe §6).

## 3. Slash-Commands (TUI)

![Sechzehn Slash-Commands gruppiert nach Session, Modell/Policy, Workflow und Utilities als Kommando-Tafel mit Slash-Dial](svg/feature_uebersicht_03_slash_commands.svg)

Type `/` im Composer öffnet das Slash-Popup. Alle Commands sind Markdown-Dateien; Custom-Commands via `~/.codex/prompts/<name>.md` (siehe §6).

| Command | Wirkung |
|---|---|
| `/init` | Legt ein `AGENTS.md`-Gerüst im aktuellen Repo an. |
| `/model` | Modell umschalten (TUI-Dialog, meist gefolgt von `/reasoning`). |
| `/reasoning` | Reasoning-Effort `low` / `medium` / `high` setzen. |
| `/approvals` | Approval-Policy zur Laufzeit ändern (Alias, nicht mehr im Popup). |
| `/compact` | Verlauf zu kompaktem Summary zusammenfassen, Kontext-Budget sparen. |
| `/diff` | Git-Diff (staged, unstaged, untracked) inline anzeigen. |
| `/review` | Dedizierter Review-Agent auf dem Working-Tree. |
| `/status` | Session-Status, aktives Modell, Token-Usage. |
| `/resume` | Picker der letzten Sessions. |
| `/new` | Neue Session, alten Kontext verwerfen. |
| `/title` | Session-Titel manuell setzen. |
| `/mention` | Datei oder Symbol in den Kontext ziehen. |
| `/plugins` | Plugin-Marketplace aufrufen (ab v0.121.0). |
| `/copy` | Letzte Agent-Antwort in die Zwischenablage kopieren. |
| `/logout` | Ausloggen. |
| `/help` | Hilfe-Panel. |

## 4. Kommandozeilen-Flags (Kurzliste)

![CLI-Flags als DIP-Switch-Matrix gruppiert nach Modell/Profil, Sandbox/Approval, Output, Modus und Debug](svg/feature_uebersicht_04_kommandozeilen_flags.svg)

| Flag | Wirkung |
|---|---|
| `-m`, `--model <name>` | Modell wählen |
| `-c`, `--config <key=value>` | Config-Override |
| `-p`, `--profile <name>` | Profil laden |
| `-s`, `--sandbox <mode>` | Sandbox-Mode (read-only \| workspace-write \| danger-full-access) |
| `-a`, `--ask-for-approval <policy>` | Approval-Policy (untrusted \| on-request \| on-failure \| never) |
| `--full-auto` | `workspace-write` + `on-request` |
| `--dangerously-bypass-approvals-and-sandbox`, `--yolo` | Keine Sandbox, kein Approval |
| `--search` | Live-Web-Search statt Cached-Mode |
| `-i`, `--image <path>` | Bild anhängen |
| `--oss` | Shortcut für lokales OSS-Provider-Setup |
| `--output-last-message <file>` | In exec-Mode: finale Message speichern |
| `--output-schema <json>` | Strukturierter Output gegen JSON-Schema |
| `--json` | exec: JSONL-Event-Stream |
| `-v`, `--verbose` | detailliertes Logging |

## 5. Kontext- und Session-Management

![Session-Timeline mit Compaction, Resume und History als Akkordeon: Turns werden zu kompakter Summary gefaltet, Reverse-Search erschliesst alte Prompts](svg/feature_uebersicht_05_kontext_session.svg)

- **Compaction** (`/compact`, `model_reasoning_summary`) fasst Turns zusammen, damit Kontext-Fenster nicht überläuft. Mit **GPT-5.1-Codex-Max** und **5.3-Codex** sind Multi-Hour-Sessions robust.
- **Resume** lädt komplette Session-History inkl. Images.
- **History** (`history.persistence`, `history.max_bytes`) steuert SQLite-Speicher.
- **Ctrl+R** Reverse-History-Search (seit v0.121.0).
- **Session-Title** und **PR-Badges** (in IDE) erleichtern Wiederfinden.

## 6. Custom Prompts, Skills, Marketplace

![Drei Artefakttypen als Plugin-Regal: Custom Slash-Commands, Agent Skills mit implicit invocation, Marketplace-Bundles](svg/feature_uebersicht_06_custom_prompts_skills.svg)

### 6.1 Custom Slash-Commands

Datei `~/.codex/prompts/refactor.md` → `/refactor` Command. Platzhalter:

- `$1`…`$9` — positionale Argumente
- `$ARGUMENTS` — alle Argumente zusammen
- `$KEY` — benannte Platzhalter (`/refactor FILE=app.ts`)

Custom Prompts liegen **nur lokal** im Codex-Home → nicht repo-geteilt. Für geteilte Prompts → Skills.

### 6.2 Agent Skills

Ein Skill ist ein **Verzeichnis** mit `SKILL.md` (mit `name`, `description`) und optionalen Scripts/Files. Codex liest nur Metadaten beim Start und lädt den vollen Inhalt **on demand**, wenn der Task zur Beschreibung passt.

Vorteile:
- **Repo-geteilt** (z. B. unter `skills/` im Projekt).
- **Implicit Invocation** via Beschreibungs-Match.
- **Versionierbar**, PR-fähig.

Beispiel `skills/release/SKILL.md`:

```markdown
---
name: release
description: Bump version, generate changelog, tag, push.
---
# Release-Skill

Schritte:
1. Prüfe `CHANGELOG.md` auf unveröffentlichte Einträge.
2. Bump-Version gemäß SemVer.
3. Tagge `vX.Y.Z`, pushe Tag.
4. Öffne Release-PR.
```

### 6.3 Marketplace

`codex marketplace add <name>` (ab v0.121.0) installiert Plugin-Bundles (Slash-Commands + Skills + MCP-Server-Defs).

## 7. Tools, mit denen der Agent arbeitet

![Werkzeuggürtel des Codex-Agenten mit acht Tool-Kategorien: File R/W/E, Shell Exec, Web Search, View Image, Apply Patch, Plan Mode, MCP Tools, Custom Tools](svg/feature_uebersicht_07_tools.svg)

- **File Read / Write / Edit** — primäre Tools, Diff-Erzeugung, Patch-Apply über internes `apply_patch` Protokoll.
- **Shell Execution** — sandboxed; stdout/stderr gestreamt.
- **Web Search** — default cached, `--search` / `/search` für live; konfigurierbar via `tools.web_search`.
- **View Image** — resolvable URL aus Image-Inputs.
- **Custom Tools** via `[tools]` in config.toml (neue Namespaces).
- **MCP Tools** — beliebige MCP-Server-Tools sichtbar als Funktionen.
- **Apply Patch** — Unified-Diff-Format, konsistent für LLM-gelieferte Edits.
- **Plan Mode / Todo-List** — Agent pflegt eigene Task-Liste; `plan_mode_reasoning_effort` separat konfigurierbar.

## 8. Modelle & Reasoning

![Codex-Cockpit: Modell-Wähler mit Default gpt-5.3-codex, Reasoning-Effort-Dial low/medium/high, Preamble-Beispiel und Phase-Parameter-Hinweis](svg/feature_uebersicht_08_modelle_reasoning.svg)

- **GPT-5.3-Codex** (Default seit 02/2026), plus `-Spark` (Research Preview, >1000 tok/s).
- **GPT-5.2-Codex**, **GPT-5.1-Codex-Max**, **GPT-5-Codex**, **GPT-5.4** als Alternative.
- **Legacy**: `o3`, `o4-mini`, `gpt-4.1`.
- **Reasoning-Effort**: `low` / `medium` (Default) / `high`. Bei `high` nutzt Codex bis zu 10× mehr Tokens, aber löst auch mehr Tasks autonom.
- **Reasoning-Summary**: bei GPT-5.x als *Preamble-Messages* sichtbar (1 Satz Ack + 1–2 Sätze Plan pro Tool-Call).
- **Phase-Parameter** (Responses-API): `phase` ist für GPT-5.3-Codex zwingend gesetzt, sonst deutliche Performance-Drops.

## 9. TUI-Features

![Stilisiertes TUI-Mockup mit Chat-Panel, Thinking-Panel, Diff-Anzeige, Composer, Status-Bar, Notification-Badge und Theme-Hinweis](svg/feature_uebersicht_09_tui_features.svg)

- **Full-Screen UI**, Mouse-Support, Hover-Tooltips.
- **Reverse-Search** (Ctrl+R) über History.
- **Thinking-Panel** mit Live-Reasoning.
- **Diff-Anzeige** für vorgeschlagene Änderungen (Hunk-Approve).
- **Notification-Badges** bei Cloud-Tasks.
- **Themes**: `tui.theme = "dark" | "light" | "high-contrast"`, weitere Farb-Variablen verfügbar.
- **Status-Bar**: aktives Modell, Token-Verbrauch, Session-ID.

## 10. IDE-Extension (Feature-Kurzfassung)

![IDE-Mockup der Codex-Extension: Side-Panel-Chat, Inline-Approval, Task-Tracker mit PR-Badges, Diff-Preview und Continue-in-Cloud-Button](svg/feature_uebersicht_10_ide_extension.svg)

- Chat-Panel mit Thread-Integration (VS Code / Cursor / Windsurf).
- Inline-Approval für Shell/Schreib-Tools.
- Task-Tracker mit PR-Badges (draft/open/merged/closed).
- Cloud-Handoff "Continue in cloud".
- Diff-Preview für Cloud-Patches.
- Shared config.toml mit CLI.
  
Details in [`integrationen_ide_ci_cd.md`](integrationen_ide_ci_cd.md).

## 11. MCP-Integration

![MCP-Integration bidirektional: Codex als Client bindet fremde MCP-Server ein, als Server via codex mcp serve exponiert er sich andere Agenten, mit Per-Tool-Approval](svg/feature_uebersicht_11_mcp_integration.svg)

- **Client**: beliebige MCP-Server anbinden (stdio, HTTP ab v0.115).
- **Server**: `codex mcp serve` — andere Agenten sprechen Codex an.
- Per-Tool-Approval-Mode (`tools.<name>.approval_mode`).
- Parallel-Tool-Calls (`supports_parallel_tool_calls = true`).

## 12. GitHub-Integration

![Vier Arme der Codex-GitHub-Integration: codex-action@v1, Codex Review App, Autofix via workflow_run und Issue-to-PR-Flow über Cloud-Tasks](svg/feature_uebersicht_12_github_integration.svg)

- **openai/codex-action@v1** (GitHub Action) — siehe [`integrationen_ide_ci_cd.md`](integrationen_ide_ci_cd.md).
- **Codex Review App** (GitHub App) — auto-Review auf PRs.
- **Cookbook-Pattern**: Autofix nach CI-Fail via `workflow_run`.
- Issue-zu-PR Flow über Cloud-Tasks.

## 13. Notify / Hooks

![Notify-Hook als Signallampe mit JSON-Payload-Feldern status, title, summary, duration, url, last_assistant_message und drei Konsumenten-Beispielen (Slack, Desktop, Mail)](svg/feature_uebersicht_13_notify_hooks.svg)

`notify`-Hook wird bei `agent-turn-complete` aufgerufen. Script erhält JSON auf stdin: `status`, `title`, `summary`, `duration`, `url`, `last_assistant_message`. Beispiele in [`integrationen_ide_ci_cd.md`](integrationen_ide_ci_cd.md) §6.

## 14. Provider-Pluralität

![Codex-Hub mit Speichen zu neun Providern: OpenAI, Azure, Anthropic, Gemini, OpenRouter, Mistral, Morph, Ollama, LM Studio, unterteilt nach Wire-API responses vs. chat](svg/feature_uebersicht_14_provider_pluralitaet.svg)

- **OpenAI** (Default, `responses` API)
- **Azure OpenAI** (`responses` API, Foundry-kompatibel)
- **Anthropic, Gemini, OpenRouter, Mistral, Morph, LM Studio, Ollama** (`chat` API)
- `--oss` Shortcut für lokale Modelle
- Profile pro Provider (`codex --profile local`)

## 15. Kostenkontrolle & Telemetrie

![Tacho-Dashboard für Kostenkontrolle: Rate-Limit-Tacho, codex-usage-Output, ZDR-Switch, Session-Log-Pfade und OpenTelemetry-Pipeline](svg/feature_uebersicht_15_kostenkontrolle_telemetrie.svg)

- **Rate Limits** je ChatGPT-Plan (siehe Installation-Doku).
- `codex usage` — Token-/Cost-Statistik.
- `disable_response_storage = true` für ZDR.
- Session-Logs unter `~/.codex/log/` und `~/.codex/sessions/*.jsonl`.
- OpenTelemetry-Integration via externem MCP-Server (community).

## 16. Experimentelle / Neuere Features (Stand 04/2026)

![Labor-Tisch mit neun Experiment-Flaschen: Plan-Mode, Realtime-Start-Instructions, RMCP-Client, Codex-Spark, Devcontainer via bwrap, Marketplace, Reverse-Search, Phase-Parameter, MCP-Apps, mit Stabilitätsampel je Feature](svg/feature_uebersicht_16_experimentelle_features.svg)

| Feature | Ort |
|---|---|
| **Plan-Mode mit separatem Reasoning** | `plan_mode_reasoning_effort` |
| **experimental_realtime_start_instructions** | kurze Start-Briefings zur Latenzreduktion |
| **experimental_use_rmcp_client** | native Rust-MCP-Client-Implementierung |
| **Codex-Spark** (GPT-5.3-Codex-Spark) | >1000 tok/s, Realtime-Coding, ChatGPT Pro Preview |
| **Devcontainer-Sandbox via bubblewrap** | seit v0.121.0 |
| **Marketplace** | `codex marketplace add` |
| **Reverse-Search** (Ctrl+R) | v0.121.0 |
| **Phase-Parameter** | GPT-5.3-Codex |
| **MCP-Apps** | Tool-Calls via MCP-Registry |

## 17. Tastatur-Shortcuts (TUI)

![Keyboard-Diagramm mit hervorgehobenen Codex-Tasten Ctrl+C, Ctrl+D, Tab, Shift+Tab, Ctrl+R, Pfeile, Esc, @, / und Cmd/Ctrl+F, mit Referenz-Liste rechts](svg/feature_uebersicht_17_tastatur_shortcuts.svg)

| Taste | Wirkung |
|---|---|
| `Ctrl+C` | Aktuelle Operation abbrechen |
| `Ctrl+D` | Codex beenden |
| `Tab` | Auto-Complete / Approval "Ja" |
| `Shift+Tab` | Approval "Nein" |
| `Ctrl+R` | Reverse-History-Search |
| `↑` / `↓` | History-Navigation |
| `Esc Esc` | letzte Message bearbeiten |
| `@` | File-Fuzzy-Finder |
| `/` | Slash-Command-Popup |
| `Cmd/Ctrl+F` | Suche (mit aktueller Auswahl als Seed) |

---

## Mini-Matrix: Feature vs. Aktivierung

![Stellwerks-Dashboard als Feature-mal-Aktivierung-Matrix mit Spalten CLI-Flag, Slash-Command, config.toml, Environment-Variable für zwölf Features](svg/feature_uebersicht_18_mini_matrix.svg)

| Feature | CLI-Flag | Slash | config.toml | Env |
|---|---|---|---|---|
| Modellwechsel | `-m` | `/model` | `model` | – |
| Reasoning | – | `/reasoning` | `model_reasoning_effort` | – |
| Approval | `-a` | `/approvals` | `approval_policy` | – |
| Sandbox | `-s` | – | `sandbox_mode` | – |
| Web-Search | `--search` | `/search` | `tools.web_search.enabled` | – |
| Image-Input | `-i` | drag & paste | – | – |
| Custom Prompt | – | via `.md`-Datei | – | `CODEX_HOME` |
| MCP-Server | `codex mcp add` | – | `[mcp_servers.*]` | – |
| Cloud-Handoff | `codex cloud exec` | – | – | – |
| Profile | `-p` | – | `[profiles.*]` | – |
| ZDR | – | – | `disable_response_storage` | – |
| Notify | – | – | `notify` | – |

---

**Verwandte Dokumente**

- [installation_und_setup.md](installation_und_setup.md)
- [konfiguration_und_anpassung.md](konfiguration_und_anpassung.md)
- [sicherheit_und_sandboxing.md](sicherheit_und_sandboxing.md)
- [integrationen_ide_ci_cd.md](integrationen_ide_ci_cd.md)
- [entwicklungs_lebenszyklus.md](entwicklungs_lebenszyklus.md)
- [praktische_workflows.md](praktische_workflows.md)
- [cheat_sheet.md](cheat_sheet.md)
- [_quellen.md](_quellen.md)
