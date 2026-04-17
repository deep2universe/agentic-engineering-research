# Codex CLI — Senior Developer Guide

> Stand: 2026-04-16

Dieses Dokument zielt auf Entwickler, die Codex CLI **bereits produktiv nutzen** und den Hebel auf fortgeschrittene Ebenen heben wollen: programmatische Nutzung via SDK, Sub-Agent-Orchestrierung, Integration in den Agents-SDK-Stack, Advanced Prompting, Observability und Reproduzierbarkeit.

## 1. Codex SDK — Codex programmatisch steuern

Das Paket [`@openai/codex-sdk`](https://www.npmjs.com/package/@openai/codex-sdk) spawnt die CLI im Hintergrund und tauscht JSONL-Events über stdio aus. Damit kannst Du Codex aus einer eigenen Node-/TypeScript-Anwendung heraus **als Komponente** einsetzen — in einem Backend, einem Electron-Tool oder einem Automations-Service.

### 1.1 Installation

```bash
npm install @openai/codex-sdk
# erfordert Node ≥ 18 und eine installierte codex CLI
```

### 1.2 Minimal-Programm

```ts
import { Codex } from "@openai/codex-sdk";

const codex = new Codex({
  // env: { OPENAI_API_KEY: process.env.CODEX_API_KEY! }, // Sandbox-Host
});

const thread = codex.startThread({
  profile: "daily",
  sandbox: "workspace-write",
  askForApproval: "never",
  model: "gpt-5.3-codex",
});

const turn = await thread.run(
  "Diagnose the failing test in tests/cart.spec.ts and fix the root cause."
);

console.log(turn.finalResponse);
```

### 1.3 Streaming-Events

```ts
const gen = thread.runStreamed("Refactor src/billing for readability.");
for await (const event of gen) {
  switch (event.type) {
    case "reasoning_delta":    /* live thinking */            break;
    case "tool_call":          /* shell/apply_patch call   */ break;
    case "file_change":        /* on-disk mutation         */ break;
    case "message_delta":      /* agent message token      */ break;
    case "turn_completed":     /* turn end                 */ break;
  }
}
```

### 1.4 Threads fortsetzen (Resume)

```ts
const t2 = codex.resumeThread("<thread-id>");
await t2.run("Pick up where you left off; start with the remaining test.");
```

### 1.5 Strukturierter Output

```ts
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

const schema = z.object({
  summary: z.string(),
  status:  z.enum(["ok", "action_required"]),
  actions: z.array(z.object({ path: z.string(), severity: z.enum(["low","med","high"]) })),
});

const turn = await thread.run("Review the diff and report findings.", {
  outputSchema: zodToJsonSchema(schema, { target: "openAi" }),
});
const result = schema.parse(JSON.parse(turn.finalResponse));
```

### 1.6 Sandbox-Isolation des Host-Prozesses

Standardmäßig erbt die CLI die Node-Env. Bei Electron-Apps, Multi-Tenant-Servern oder wenn Du Secrets filtern willst:

```ts
const codex = new Codex({
  env: { PATH: process.env.PATH!, HOME: process.env.HOME! },
});
```

Keine Secrets im Child-Prozess bedeutet: `shell_environment_policy` greift in `config.toml` nur noch auf die explizit durchgereichten Variablen.

## 2. Subagents — parallelisierte Spezialisten

Codex kann **Subagenten** spawnen (explizit auf Anforderung), die jeweils einen engen Scope, ein eigenes Modell und einen eigenen Tool-Satz haben. Ideal für:

- Codebase-Exploration (ein Agent pro Verzeichnis/Modul)
- Feature-Umsetzung in mehreren parallelen Aspekten (UI / API / Tests)
- Review-Swarm (Security, Perf, Style parallel)

### 2.1 Definition in `AGENTS.md`

```markdown
## Sub-Agents

### sec-reviewer
description: Scans a changeset for OWASP issues, secrets, and injection risks. Read-only.
model: gpt-5.3-codex
sandbox: read-only
prompt: |
  Focus exclusively on security. Report by severity.

### perf-reviewer
description: Analyzes hot paths for O(N²) loops, repeated queries, sync IO.
sandbox: read-only

### doc-writer
description: Generates/refreshes docstrings matching Google style.
```

### 2.2 Aufruf-Pattern

Du bittest den Haupt-Agent, Aufgaben zu delegieren:

> *"Delegate to the `sec-reviewer` and `perf-reviewer` subagents in parallel on the current diff. Collect their findings, deduplicate, and present a ranked list."*

### 2.3 Praxishinweise

- **Token-Preis**: Subagenten kosten mehr, sind aber oft schneller.
- **Narrow descriptions**: je schärfer die `description`, desto besser matcht Codex.
- **Tool-Minimum**: jedem Subagent nur das geben, was er braucht (z. B. `sandbox: read-only` für Reviewer).
- **Ergebnis-Konsolidierung**: der Haupt-Agent synthetisiert — Subagenten reden nicht direkt mit Dir.

## 3. Integration mit dem OpenAI Agents SDK

Das **OpenAI Agents SDK** (`openai-agents-python` bzw. `@openai/agents`) ist ein Framework für Multi-Agent-Systeme mit Handoffs, Guardrails, Tracing. Codex passt hinein als **Tool oder Handoff-Target**.

### 3.1 Codex als Tool im Agents SDK

```python
from agents import Agent, function_tool
from openai_codex_sdk import Codex  # hypothetischer Python-Wrapper oder eigener Binding via subprocess

@function_tool
async def codex_edit(prompt: str) -> str:
    codex = Codex()
    thread = codex.start_thread(profile="daily")
    turn = await thread.run(prompt)
    return turn.final_response

triage = Agent(
    name="triage",
    instructions="Route incoming issues. Use codex_edit for code changes.",
    tools=[codex_edit],
)
```

### 3.2 Codex als Handoff-Target

```python
from agents import Agent, handoff

codex_agent = Agent(
    name="codex",
    instructions="Implement code changes using the Codex CLI.",
    tools=[codex_edit],
)

router = Agent(
    name="router",
    instructions="If the task requires code changes, hand off to the codex agent.",
    handoffs=[handoff(codex_agent)],
)
```

Die SDK macht aus `handoff()` automatisch ein Tool, das der LLM als `transfer_to_codex` aufruft.

### 3.3 Agents-SDK-Harness 2026

Das aktualisierte Agents-SDK-Harness (04/2026) ergänzt:

- konfigurierbares Memory
- Sandbox-aware Orchestration (Codex-ähnlich)
- Filesystem-Tools
- Standardisierte Integrationen mit gängigen Agenten-Primitiven

Für Codex heißt das: Du kannst die bekannten Sandbox- und Approval-Konzepte nahtlos auf Multi-Agent-Systeme übertragen.

## 4. Advanced Prompting — Preambles & Phase-Parameter

### 4.1 Preambles

GPT-5.3-Codex und GPT-5.4 geben **Preambles** vor Tool-Calls aus: 1 Satz Acknowledgement + 1–2 Sätze Plan. Das hält das Thread-Log lesbar. Konfigurierbar über `model_reasoning_summary = "detailed"` (lange) oder `"concise"` (kurz). In AGENTS.md kannst Du eine Stil-Regel vorgeben:

```markdown
## Preambles
- ein kurzer Satz Bestätigung, ein kurzer Satz Plan
- keine emoji, keine Ausrufezeichen
- auf Deutsch
```

### 4.2 Phase-Parameter (nur `gpt-5.3-codex`)

Die Responses-API verlangt bei GPT-5.3-Codex einen `phase`-Parameter je Turn (`plan` / `act` / `summarize`). Die CLI setzt ihn automatisch korrekt; beim **direkten API-Gebrauch** ohne CLI musst Du das selbst tun — falsch gesetzt führt zu signifikant schlechterer Performance.

### 4.3 Reasoning-Budget dynamisch

```bash
codex -c model_reasoning_effort=high "$(cat complex_spec.md)"
codex -c model_reasoning_effort=low "Fix the typo in README line 12."
```

Gute Heuristik:

- `low`: Edits mit klarer Spezifikation.
- `medium`: Default.
- `high`: Architektur-/Refactor-/Debug-Sessions.

### 4.4 Prompt-Architektur

1. **Rolle / Identität** (*"You are a senior payments engineer."*)
2. **Kontext-Einbettung** (`@file`, AGENTS.md-Auszug, ADRs)
3. **Goal / Constraints / DoD** (siehe `praktische_workflows.md` §1)
4. **Output-Vertrag** (Schema, Dateinamen, Commit-Konvention)

## 5. Observability, Tracing und Reproduzierbarkeit

### 5.1 Session-Transkripte

Unter `~/.codex/sessions/<uuid>.jsonl` liegt jeder Turn als JSONL. Beispiel-Parser:

```bash
jq -c 'select(.type=="tool_call")' ~/.codex/sessions/<uuid>.jsonl
```

Damit lassen sich nachträglich Metriken bauen (Tool-Call-Frequenz, Fehlerquote, Token-Usage pro Turn).

### 5.2 Structured Logs

```bash
RUST_LOG=codex=debug,info codex exec --json "<prompt>" \
  | tee -a run.jsonl
```

Kombiniert mit `jq` oder Vector lassen sich Logs in Loki/OpenSearch hieven — Codex ist damit voll observable.

### 5.3 Reproduzierbarkeit

- **Model pinnen**: `codex -c model="gpt-5.3-codex-2026-02-05"`
- **Config-Hash** in AGENTS.md committen (CI prüft identisches Setup).
- **Seed** (`codex -c seed=42`) — reduziert Variance, kein Determinismus-Versprechen.
- **Session-ID** in PR-Body kleben (`/status` liefert sie) — Audit-Trail für Compliance.

### 5.4 OpenTelemetry via MCP

Community-MCP-Server `mcp-server-otel` schickt Spans vom Agent-Loop an Deinen Collector. Kombiniert mit einem Jaeger/Honeycomb-Setup sieht man:

- Tool-Call-Dauer
- Approval-Wartezeit
- LLM-Latency pro Turn
- Kosten-Aggregation

## 6. CI/CD — fortgeschrittene Patterns

### 6.1 Issue-to-PR-Pipeline

Ein Workflow, der Issues mit Label `codex:implement` aufgreift:

```yaml
on:
  issues:
    types: [labeled]

jobs:
  implement:
    if: github.event.label.name == 'codex:implement'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: openai/codex-action@v1
        with:
          openai-api-key: ${{ secrets.OPENAI_API_KEY }}
          sandbox: workspace-write
          safety-strategy: unprivileged-user
          prompt: |
            Implement the feature described in GitHub issue #${{ github.event.issue.number }}.
            Read the issue body via the GH CLI. Open a PR titled
            "feat: <short summary> (closes #${{ github.event.issue.number }})".
          codex-args: "--full-auto --model gpt-5.3-codex"
```

### 6.2 Cost-Gate

```yaml
      - name: Cost gate
        run: |
          tokens=$(jq -s '[.[].usage.total_tokens] | add' output.jsonl)
          if (( tokens > 500000 )); then
            echo "::error::Codex exceeded 500k tokens"
            exit 1
          fi
```

### 6.3 Matrix-Sub-Agenten

GitHub-Actions-Matrix mit je einem Sub-Agent pro Modul — parallele Ausführung:

```yaml
strategy:
  matrix:
    module: [billing, auth, ui]
jobs:
  per_module:
    steps:
      - uses: openai/codex-action@v1
        with:
          working-directory: packages/${{ matrix.module }}
          prompt-file: .codex/prompts/module_review.md
          sandbox: read-only
```

## 7. Enterprise-Betrieb

- **Shared Codex Cloud Workspace**: zentrales Task-Monitoring, Quotas pro Team, Kostenabrechnung pro Workspace.
- **ZDR + SSO + SCIM + Audit-Logs** (siehe `sicherheit_und_sandboxing.md`).
- **Model-Restriction** per Org-Policy (z. B. nur GPT-5.x-Codex) — verhindert Accidental-OSS-Modelle in sensiblen Repos.
- **Custom Responses-API-Proxy** (Azure OpenAI oder self-hosted Relay) für Compliance-Filter.

## 8. Anti-Patterns aus der Praxis

| Anti-Pattern | Warum schlecht | Fix |
|---|---|---|
| `--yolo` auf Laptop | Sandbox umgehen ist kein Produktivitätsgewinn | VM/Container mit YOLO, lokal `--full-auto` |
| AGENTS.md > 32 KB | wird abgeschnitten | Skills auslagern |
| Subagenten bei trivialen Tasks | Verschwendung von Tokens | Erst bei echter Parallelität |
| Cloud-Task ohne Prompt-File | nicht reproduzierbar | Prompts ins Repo committen |
| `approval_policy=never` + Cloud + `danger-full-access` | nichts dokumentiert, alles erlaubt | Mindestens `on-request`, Sandbox-Cloud vertrauen nur mit Netz-Allow-List |
| Tests nach Implementation schreiben | kein externer Feedback-Loop für Codex | TDD: Red-Commit zuerst |
| Keine `/review`-Pipeline | Bugs rutschen durch | Self-Review + GH Action + menschliches Pair |
| Kontext überladen mit `@file` | Signal-/Rausch-Quote fällt | Nur relevante Dateien, sonst `/compact` |

## 9. Checkliste für ein "Senior-Ready" Codex-Setup

- [ ] `~/.codex/config.toml` mit **≥ 3 Profilen** (daily, planning, review, ci).
- [ ] `AGENTS.md` im Repo ≤ 32 KB, mit **Tooling + Style + Gotchas + Security-Regeln**.
- [ ] `.codex/prompts/` mit mindestens `pr_review.md`, `release.md`, `security_review.md`.
- [ ] `skills/` mit `release/`, `hotfix/`, `docs_sync/`.
- [ ] MCP-Server für `github`, `playwright`, ggf. `sentry`/`postgres`.
- [ ] GitHub-Action `openai/codex-action@v1` für **Review + Autofix** aktiv.
- [ ] `notify`-Hook für Slack / Desktop.
- [ ] Session-ID-Capture in PR-Templates.
- [ ] Cost-Gate in CI (Token-Limit).
- [ ] Trust-Levels für alle Dev-Repos explizit gesetzt.
- [ ] Logs und Transkripte regelmäßig in Observability-Stack gepumpt.

---

**Verwandte Dokumente**

- [entwicklungs_lebenszyklus.md](entwicklungs_lebenszyklus.md)
- [praktische_workflows.md](praktische_workflows.md)
- [konfiguration_und_anpassung.md](konfiguration_und_anpassung.md)
- [sicherheit_und_sandboxing.md](sicherheit_und_sandboxing.md)
- [vergleich_zu_alternativen.md](vergleich_zu_alternativen.md)
- [_quellen.md](_quellen.md)
