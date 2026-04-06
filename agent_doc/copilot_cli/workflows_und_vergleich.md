# GitHub Copilot CLI – Workflows, CI/CD, Vergleich, Best Practices (Stand 2026-04-06)

Die GitHub Copilot CLI (GA Februar 2026) bringt den Copilot Coding Agent direkt ins Terminal. Sie unterstützt mehrere Modelle (Claude Sonnet/Opus 4.6, Haiku 4.5, GPT-5), Plan-Mode, parallele Subagenten (`/fleet`), Custom Agents über `AGENTS.md` sowie MCP-Server.

## 1. Typische Workflows

### 1.1 Bug-Fix
1. `copilot` starten, Issue referenzieren (`#123`) – CLI lädt Kontext via GitHub-MCP.
2. Plan-Mode (Shift+Tab) erzwingen: Copilot stellt Rückfragen, erstellt Reproduktion.
3. Implementierung mit menschlicher Approval pro Tool-Call.
4. `/review` für Pre-Commit-Sanity-Check, dann `gh pr create` mit `--add-reviewer @copilot`.

### 1.2 Feature-Entwicklung
- `/plan` → strukturierter Implementierungsplan mit Akzeptanzkriterien.
- Bei großen Features: `/fleet "implement OAuth flow"` parallelisiert Tests, Backend, Doku in Subagenten und konvergiert das Ergebnis.
- Session-Memory hält Kontext über mehrere Schritte, ohne erneutes Re-Prompting.

### 1.3 Refactor (große Codebases)
- Erst `/research` oder `Explore`-Agent nutzen – versteht Modulgrenzen, bevor geschrieben wird.
- Inkrementell vorgehen: ein Modul pro Session, Linter-Output in Datei pipen und als Checklist abarbeiten.
- Für Cross-Cutting-Refactors: `/fleet` + `autopilot` Mode für lange, unbeaufsichtigte Läufe.
- Nach jedem Schritt `/review` und Tests laufen lassen.

### 1.4 Test-Generation
- Prompt: „Generate pytest cases for `services/billing.py`, target 90% branch coverage, mock Stripe."
- Specialized `Task`-Agent delegiert Test-Schreiben; Coverage-Tool via Bash-Approval ausführen.

### 1.5 Doku
- `copilot -p "Aktualisiere README anhand der letzten 20 Commits"` – nutzt `gh` für Commit-Historie.
- ADRs/Architecture Docs aus `/research`-Output generieren.

### 1.6 Code-Review
- Lokal: `/review path/to/changes` (staged + unstaged) gibt high-signal Findings.
- Remote: `gh pr edit <num> --add-reviewer @copilot` oder Auto-Review im Repo aktivieren – funktioniert auch ohne Copilot-Lizenz für PR-Autor.

### 1.7 Migration
- Beispiel Java 8 → 21: AGENTS.md mit Coding-Standards, Migration-Plan, Verbotsliste. Plan-Mode → `/fleet` pro Modul → Tests grün halten.

### 1.8 Onboarding
- Neuer Dev startet `copilot "Erkläre mir die Architektur des `payment` Service"`. CLI liest AGENTS.md, generiert Walkthrough mit Datei-Referenzen.

## 2. CI/CD & Automation

### 2.1 GitHub Actions Integration
Die CLI läuft headless im Runner. Programmatic Mode (`copilot -p "<prompt>" --allow-tool ...`) liefert deterministische Outputs für Pipelines.

```yaml
jobs:
  copilot-triage:
    runs-on: ubuntu-latest
    permissions: { contents: read, pull-requests: write, issues: write }
    steps:
      - uses: actions/checkout@v4
      - run: npm install -g @github/copilot
      - name: Run Copilot CLI
        env:
          COPILOT_GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          copilot -p "Analyze failing tests in last run, post summary as PR comment" \
            --allow-tool shell --allow-tool github
```

### 2.2 Headless Auth
- ENV-Variablen: `COPILOT_GITHUB_TOKEN`, `GH_TOKEN`, `GITHUB_TOKEN` (in dieser Priorität).
- OAuth-Device-Flow nur für interaktive Sessions; für Container: Service-Account-Token oder GitHub App.

### 2.3 Typische Automation-Use-Cases
- **Smart Failure Triage** – CI-Logs an Copilot CLI senden, Root-Cause-Kommentar im PR posten.
- **Nightly Reports** – Repo-Aktivität zusammenfassen, in Issue/Discussion schreiben.
- **PR-Bot** – Auto-Review auf jedes neue Commit, plus `/research`-getriebene Security-Scans.
- **Scaffold-Jobs** – Issues mit Label `scaffold` → Copilot erstellt Branch + Boilerplate via `mcp__github__create_pull_request_with_copilot`.

## 3. Vergleichstabelle (Stand April 2026)

| Kriterium | Copilot CLI | Claude Code | Gemini CLI | OpenAI Codex CLI | Cursor CLI |
|---|---|---|---|---|---|
| Hersteller | GitHub/MS | Anthropic | Google | OpenAI | Anysphere |
| Modelle | Claude Sonnet/Opus/Haiku 4.6, GPT-5 | Claude Opus/Sonnet/Haiku 4.6 | Gemini 2.5/3 Pro+Flash (auto-route) | GPT-5, o-Serie | Multi (Claude, GPT, Gemini) |
| Kontextfenster | bis 1M (Opus) | bis 1M | 1M | ~400k | modellabhängig |
| Preis Einstieg | $10/mo Pro (2k Comp.), Free Tier | $20/mo Pro, $100/mo Max | Free 1000 req/Tag | ChatGPT Sub + API | $20/mo Pro |
| MCP | Ja (nativ + GitHub MCP) | Ja (Referenzimpl.) | Ja | Ja (eingeschränkt) | Ja |
| Sandbox | Approval pro Tool, kein FS-Sandbox | Permission-Modi, Bash-Allowlist | gVisor-ähnlich, Auto-Approval-Stufen | Auto/Suggest/Full-Auto (Sandbox) | Cursor-Agent Sandbox |
| Headless / Programmatic | `copilot -p` + ENV-Token | `claude -p` | `gemini -p` | `codex exec` | `cursor-agent -p` |
| Subagenten / Parallelität | `/fleet`, specialized agents (Explore/Task/Review/Plan) | Sub-Agents, Task-Tool | Auto-Routing | Eingeschränkt | Multi-Agent (Beta) |
| Plan-Mode | Ja (Shift+Tab) | Ja | Nein | Nein | Ja |
| GitHub-Integration | Nativ (Issues, PRs, Actions, Coding Agent Delegation) | Über MCP/`gh` | Über `gh` | Über `gh` | Über `gh` |
| Custom Agents Config | `~/.copilot/agents`, `.github/agents`, `AGENTS.md` | `CLAUDE.md`, `.claude/agents` | `GEMINI.md` | `AGENTS.md` | `.cursor/rules` |
| Plattformen | macOS, Linux, Windows, Codespaces, Actions | macOS, Linux, Windows (WSL) | Cross-Platform | Cross-Platform | macOS, Linux, Windows |
| Stärken | GitHub-Workflow, Multi-Model, Pricing | Refactoring-Tiefe, Reasoning | Free Tier, Context | Lightweight, OpenAI-Stack | IDE-Brücke |
| Schwächen | Approval-Reibung, jüngste GA | Pricing, kein natives GH | Weniger Tooling-Ökosystem | Wenig Agentik | CLI nachgelagert zu IDE |

## 4. Best Practices für Senior Devs / Architekten

### 4.1 Kontext-Engineering
- **AGENTS.md im Repo-Root** mit: Coding-Standards, Build-Befehle, Testkommandos, Dependencies, "Do not touch"-Pfaden, Domänen-Glossar.
- **`.github/agents/<name>.md`** für rollenspezifische Subagenten (z. B. `security-reviewer`, `db-migrator`).
- **`~/.copilot/agents/`** für persönliche, repo-übergreifende Skills.
- AGENTS.md bewusst klein halten (<300 Zeilen) – Token-Budget zählt.

### 4.2 Repo-Layout
- Monorepo: pro Service eine `AGENTS.md`; Root-AGENTS.md verweist auf Service-Spezifika.
- `.copilot/instructions/` für Markdown-Snippets, die per Slash-Command nachgeladen werden.

### 4.3 Token-Effizienz
- Plan-Mode benutzen: spart Re-Runs durch klare Spezifikation.
- `/fleet` nur für tatsächlich parallelisierbare Tasks – Subagenten konsumieren Tokens linear.
- Große Dateien nicht komplett laden, sondern via Grep/Glob durch Copilot indizieren lassen.
- Sessions nach Feature-Abschluss schließen – Session-Memory behält alten Kontext.

### 4.4 Reviews
- Doppelschleife: lokal `/review` vor Commit, `@copilot` als Reviewer im PR für zweite Iteration.
- Auto-Review pro Push aktivieren, aber menschliches Approval als Required Check beibehalten.

### 4.5 Sicherheit
- MCP-Server mit minimalem Scope (OAuth statt PAT bevorzugen).
- `--allow-tool` Allowlists in CI statt `--yolo` / Auto-Approve.
- Secret-Scanning-MCP integrieren, bevor Copilot autonom committet.

## 5. Troubleshooting & häufige Fehler

| Problem | Ursache | Lösung |
|---|---|---|
| `Rate limit exceeded` trotz Pro | Token-Bucket pro Modell, oft Backend-Bug seit 1.0.x | Modell wechseln (`/model`), warten, ggf. GitHub Support kontaktieren |
| `401 Unauthorized` headless | `GITHUB_TOKEN` ohne `copilot`-Scope | `COPILOT_GITHUB_TOKEN` mit Fine-Grained PAT setzen |
| Tool-Hang in Actions | Interaktive Prompts in non-TTY | `-p` (programmatic) + explizite `--allow-tool` Flags |
| MCP-Server startet nicht | Falscher Pfad in `mcp.json`, fehlende ENV | `copilot mcp list`, `copilot mcp test <name>` |
| Stale Auth nach Update | Cache in `~/.copilot` | `copilot auth logout && copilot auth login`, Cache löschen |
| Plan-Mode endlos | Unklares Ziel, Copilot fragt loops | Konkrete Akzeptanzkriterien + Beispieldateien angeben |
| Riesige Diffs nicht reviewbar | Kein /fleet split | `/review` mit Pfad-Filter, Diffs in Chunks |
| `command not found: copilot` | Falscher PATH nach `npm i -g` | `npm root -g` prüfen, PATH ergänzen |
| VPN/IP-basierter Rate-Limit | Shared Egress | VPN aus oder dedizierte Egress-IP |

## 6. Tipps & Tricks / Hidden Gems

- **`Shift+Tab` Plan-Mode-Toggle** – Wechsel mitten in der Session ohne Neustart.
- **`/fleet`** für Migration, Mass-Refactor, Multi-Sprache-Übersetzung.
- **`/research`** – „Deep Research"-Modus, der Web + Repo + Issues kombiniert; nützlich vor Architekturentscheidungen.
- **`gh pr edit --add-reviewer @copilot`** non-interaktiv aus Scripts.
- **Coding-Agent-Delegation**: aus der CLI heraus einen Background-Job auf GitHub.com starten (`@copilot continue async`).
- **`.github/agents/`** wird automatisch geladen – ideal für Team-shared Custom Agents.
- **MCP-Chaining**: GitHub MCP + Postgres MCP + Sentry MCP → echte Ende-zu-Ende-Triage ohne Kontextwechsel.
- **Programmatic `--output-format json`** für Agentic Pipelines (parsebare Steps).
- **Session-Replay**: `copilot session list` / `copilot session resume <id>` rettet abgebrochene Refactors.
- **Multi-Repo-Mode**: in einem Workspace-Verzeichnis mit mehreren Klones starten – Copilot referenziert Cross-Repo.
- **Cost-Hack**: Haiku 4.5 für mechanische Tasks (Tests, Doku), Opus 4.6 nur für Architektur/komplexes Reasoning.
- **Pre-commit Hook**: `copilot -p "/review --staged" --fail-on high` als Quality-Gate lokal.

## Quellen
Siehe `_quellen.md`.
