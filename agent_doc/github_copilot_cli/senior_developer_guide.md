# Senior Developer & Architect Guide – GitHub Copilot CLI

> Stand: 2026-04-06 · Voraussetzung: `installations_und_setup_guide.md` gelesen

Dieser Guide erklärt **Agentic Engineering** mit der Copilot CLI für Senior Developer und Architekten. Er fokussiert auf Denkmodelle, Repo-Hygiene, Kontext-Engineering, Sicherheit und produktive Patterns – nicht auf Anfänger-Tutorials.

## 1. Mentales Modell: Was ist ein Coding-Agent wirklich?

Ein Coding-Agent ist eine **LLM-getriebene Schleife**:

```
Observe (Kontext lesen)
   ↓
Plan      (Was muss getan werden?)
   ↓
Act       (Tool aufrufen: read/write/bash/MCP)
   ↓
Verify    (Output prüfen, Tests, Linter)
   ↓
↻ wiederhole bis Ziel erreicht oder abgebrochen
```

Die Copilot CLI implementiert genau dieses Muster mit:

- **Context-Quellen**: AGENTS.md, Memory, MCP, Filesystem, Git-State
- **Tool-Use**: Built-ins (`view`, `create`, `edit`, `bash`) + MCP-Server
- **Planning**: `Shift+Tab` Plan-Mode, optional **Critic Agent** als Reviewer
- **Verification**: Hooks (`pre_tool`, `post_tool`, `on_finish`), Tests, `/review`
- **Subagents**: `/fleet` (parallel lokal), `/delegate` (asynchron in der GitHub-Cloud)

**Konsequenz für Senior Devs**: Du arbeitest **nicht** mehr nur mit einem Autocomplete, sondern mit einem System, dem du **Kontext, Werkzeuge und Leitplanken** geben musst. Dein Hebel ist **Context Engineering**, nicht Prompt Engineering.

## 2. Context Engineering – die wichtigste Disziplin

### 2.1 AGENTS.md als Verfassung

`AGENTS.md` im Repo-Root ist die **kompakte Verfassung** für jeden Agent-Run. Faustregel: **< 300 Zeilen**, alles darüber wird verwässert.

Empfohlene Struktur:

```markdown
# AGENTS.md

## Stack & Build
- Node 22, pnpm 9, TypeScript strict
- `pnpm test` muss vor jedem Commit grün sein
- `pnpm lint --fix` automatisch erlaubt

## Architektur in einem Satz
Hexagonale Domain-Schicht (`/src/domain`), Adapter unter `/src/adapters`,
HTTP-Layer in `/src/http`. **Keine** Domain-Imports aus Adaptern.

## Don't touch
- `/legacy/**`, `/migrations/**`, `*.generated.*`

## Konventionen
- Conventional Commits, snake_case Filenames, Tests neben Source
- Keine neuen Dependencies ohne ADR

## Glossar
- "Booking": Reservierung mit Status PENDING|CONFIRMED|CANCELLED
- "Tenant": Mandant in Multi-Tenancy
```

**Hierarchie**: Tiefere `AGENTS.md` (z. B. `services/payments/AGENTS.md`) überschreiben Root-Werte. Mehrere Dateien werden **kombiniert**, nicht ersetzt.

### 2.2 Custom Agents & Skills

`.github/agents/refactor.agent.md`:

```markdown
---
name: refactor
tools: [view, edit, "shell(rg:*)", "shell(pnpm:test)"]
model: claude-opus-4-6
---
Du bist ein konservativer Refactoring-Agent. Regeln:
1. Niemals API-Signaturen ändern.
2. Nach jedem Schritt: `pnpm test`. Bei Rotwerden: revert.
3. Berichte Diff-Stats nach jedem Modul.
```

Aufruf in der Session: `@refactor Splitte den BookingService nach Feature.`

### 2.3 Memory

`/memory` persistiert sessionsübergreifende Notizen (z. B. "Repo nutzt Vitest, nicht Jest"). Memory ist mächtig, aber **explizit pflegen** – sonst wird sie zur Mülldeponie.

### 2.4 Token-Effizienz

| Anti-Pattern | Besser |
|---|---|
| Ganze Files in den Prompt pasten | Agent mit `view` + `rg` arbeiten lassen |
| Lange Sessions ohne `/clear` | Nach jedem abgeschlossenen Task `/clear` |
| Default-Modell für Trivialitäten | Haiku für mechanische Aufgaben |
| Plan im Prompt wiederholen | Plan in `docs/specs/*.md` persistieren |

## 3. Sicherheits-Mindset

Agentic Coding **multipliziert dein Risiko**: Ein einziger Prompt-Injection-Trigger (Issue-Body, Webseite, Logfile) kann den Agent dazu bringen, Dateien zu ändern oder Tokens zu exfiltrieren.

### Goldene Regeln

1. **Default = Interactive Approval**. `--allow-all-tools` nur in Sandbox.
2. **Deny > Allow**. Setze harte Denies für `rm`, `curl`, `env`, `chmod`.
3. **Trust Workspaces**. Niemals fremden Code "trusten" ohne Review.
4. **Fine-grained PATs** mit minimalem Scope, nie Prod-Credentials.
5. **MCP-Allowlist** auf Org-Ebene – jeder MCP-Server ist ein Tool-Universum.
6. **Hooks als Wächter**: `post_tool`-Hook scannt Diffs auf Secrets / verbotene Pfade.
7. **Audit-Log aktivieren**: Enterprise Audit + Purview, lokal Hook-Logging.

### Bekannte Failure Modes

| Failure Mode | Mitigation |
|---|---|
| Indirekte Prompt-Injection | Untrusted-Quellen markieren, Output-Filter |
| `env curl ... \| sh` Bypass | Strenge Argument-Validation, Deny `env` |
| Approval-Fatigue | Granulare Allow-Listen statt Auto-Approve |
| Tool-Halluzination | Tool-Liste in AGENTS.md explizit |
| Context-Bloat | `/clear`, Subagents, kürzere Tasks |
| Loop / Stuck | Plan-Mode + max-iterations Hook |

## 4. Patterns für die tägliche Arbeit

### 4.1 Plan-then-Execute

```
> /plan Migriere Express → Fastify, gleiche Routes, gleiche Tests grün.
# Plan reviewen, ggf. korrigieren ("nimm Pino-Logger statt Morgan")
> Führe den Plan aus.
```

**Wann**: Jede Änderung > 50 Zeilen oder mit Architektur-Impact.

### 4.2 TDD-Loop mit Subagents

```
> /fleet
  - Agent A: Schreibe Vitest-Tests für BookingService nach Spec docs/spec.md
  - Agent B: Implementiere BookingService bis A grün ist
  - Agent C: Generiere ADR für Designentscheidungen
```

### 4.3 Spec-driven Development

1. `/research` lässt den Agent Issues, Web und Repo durchsuchen.
2. Output → `docs/specs/feature_x.md` (manuell reviewt).
3. `/plan` erzeugt Implementierungsplan **aus** der Spec.
4. `/fleet` setzt um.

### 4.4 Multi-Repo / Mono-Workspace

- Mehrere Klone in einem Workspace, `--add-dir` pro Repo
- Filesystem-MCP **scoped pro Repo**
- GitHub-MCP für Cross-Repo-PRs

### 4.5 Cloud-Delegation

`/delegate` (oder `mcp__github__create_pull_request_with_copilot`) startet einen **asynchronen** Cloud-Coding-Agent auf einem neuen Branch. Ideal für lange Refactors, während du lokal weiterarbeitest.

### 4.6 Lokales Quality-Gate

Pre-commit-Hook:

```bash
copilot -p "/review --staged" --output-format json --silent \
  --allow-tool 'view' --deny-tool 'edit,bash' \
  | jq -e '.findings[] | select(.severity=="high")' \
  && exit 1 || exit 0
```

## 5. CI/CD-Integration

### Headless-Run in GitHub Actions

```yaml
- uses: actions/setup-node@v4
  with: { node-version: 22 }
- run: npm i -g @github/copilot
- env:
    GH_TOKEN: ${{ secrets.COPILOT_PAT }}
  run: |
    copilot -p "Triagiere die letzten 5 fehlgeschlagenen CI-Runs und kommentiere im PR." \
      --output-format json --silent \
      --allow-tool 'view,gh(issue:*),gh(pr:comment:*)' \
      --deny-tool 'edit,bash'
```

### Use Cases

- **Smart Failure Triage**: CI-Logs analysieren → PR-Comment
- **Nightly Reports**: Repo-Health, Dependency-Drift
- **PR-Bot**: Auto-Review pro Push
- **Scaffold-Jobs**: via Coding-Agent-Delegation

## 6. Vergleich der CLI-Agents (Kurzfassung)

| Kriterium | Copilot CLI | Claude Code | Gemini CLI | Codex CLI | Cursor CLI |
|---|---|---|---|---|---|
| Modelle | Claude 4.6, GPT-5, Gemini 3 | Claude Opus/Sonnet/Haiku | Gemini 2.5/3 | GPT-5, o-Serie | Multi |
| Plan-Mode | ✅ (Shift+Tab) | ✅ | ❌ | ❌ | ✅ |
| Subagents | `/fleet`, Custom Agents | Sub-Agents | Auto-Routing | eingeschränkt | Multi-Agent (Beta) |
| MCP | ✅ nativ | ✅ | ✅ | ✅ (beschränkt) | ✅ |
| Headless | `copilot -p` | `claude -p` | `gemini -p` | `codex exec` | `cursor-agent -p` |
| GitHub-Integration | nativ | via MCP | via `gh` | via `gh` | via `gh` |
| Cloud-Delegation | `/delegate` | – | – | – | – |
| Stärke | GitHub-Workflow, Multi-Model, Pricing | Tiefes Reasoning | Free Tier | Lightweight | IDE-Brücke |

Vollständig in `workflows_und_vergleich.md`.

## 7. Reife-Stufen für ein Team

| Stufe | Merkmal |
|---|---|
| **0 – Experiment** | Einzelne nutzen `copilot` ad hoc, kein AGENTS.md |
| **1 – Repo-fähig** | AGENTS.md vorhanden, Trust-Workspaces, Pro-Lizenzen |
| **2 – Team-fähig** | Custom Agents in `.github/agents/`, MCP-Allowlist, Org-Policies |
| **3 – CI-integriert** | Headless-Runs in Actions, PR-Bots, Audit-Logging |
| **4 – Agentic-First** | Spec-driven, `/fleet`-Workflows, `/delegate` für lange Tasks, Hooks als Quality-Gates |

## 8. Top-10-Empfehlungen für Architekten

1. AGENTS.md ist Produktionscode – review es, versioniere es, halte es klein.
2. Trenne **persönliche** (`~/.copilot/agents`) und **shared** (`.github/agents`) Agents sauber.
3. Nutze **Plan-Mode immer** bei Architektur-Impact – auch wenn es 30 s "kostet".
4. Setze **Org-Policies** für Modelle, MCP-Server und Content-Exclusions.
5. **Sandbox** alles, was `--allow-all-tools` braucht. Container-First.
6. Mache **Hooks** zum Quality-Gate (Secret-Scan, Diff-Stats, Test-Verify).
7. Trenne **Modell-Tier** nach Aufgabe: Haiku → mechanisch, Sonnet → Standard, Opus → Architektur.
8. Persistiere **Plans und Specs** im Repo (`docs/specs/`) – nicht in Sessions.
9. Nutze `/delegate` für Tasks > 30 Min – nicht den lokalen Agent blockieren.
10. Etabliere ein **AI-Postmortem-Format**: Was hat der Agent getan, was hätte er nicht tun dürfen?

---

Weiterführend: `cheat_sheet.md` (täglicher Spickzettel), `agentic_engineering_mcp_security.md` (tiefer Sicherheits-Drill-Down), `workflows_und_vergleich.md` (Tool-Vergleich, CI/CD).
