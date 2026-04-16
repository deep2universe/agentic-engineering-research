# OpenAI Codex CLI – Approval-Modi

> Stand: 2026-04-16. Quellen: https://developers.openai.com/codex/agent-approvals-security, https://developers.openai.com/codex/concepts/sandboxing. Approval und Sandbox sind komplementär: die Sandbox verhindert zerstörerisches Verhalten auf OS-Ebene, die Approval-Policy verankert die menschliche Aufsicht.

## 1. Policy-Werte

| Wert | Verhalten |
|---|---|
| `untrusted` | Für jedes Shell-Kommando, jeden Patch und jeden nicht-allowlisted MCP-Tool-Call kommt eine Rückfrage. Sehr sicher, sehr „langsam". |
| `on-request` | Codex entscheidet selbst, ob ein Schritt sicher ist; nur bei unsicher eingestuften Aktionen wird gefragt (**Default** im interaktiven Modus). |
| `never` | Keine Approval-Prompts. Alles, was die Sandbox zulässt, läuft durch; der Rest scheitert sofort. Für CI/CD und `codex exec`. |
| `granular` | Feinkörniger Modus: Einzelne Tool-/Kommandoklassen können unterschiedlich behandelt werden (per Config/Policy). Seit v0.116 stabilisiert. |
| `on-failure` (deprecated) | Früher: fragt erst, wenn ein Befehl in der Sandbox scheiterte. Seit 2026 durch `granular` abgelöst. |

Setzen in `config.toml`:
```toml
approval_policy = "on-request"
```

Pro Aufruf:
```bash
codex --ask-for-approval never "lint fix"
codex -a untrusted
```

In TUI zur Laufzeit:
```
/approvals on-request
```

## 2. Interaktive Approval-Dialoge

Ein Approval-Popup in der TUI zeigt:
- Kommando + Arbeitsverzeichnis
- Unified-Diff (bei Patches)
- MCP-Tool-Name und Payload (gekürzt)
- Zusammenfassung, warum Codex diese Aktion möchte

Bedienung:

| Taste | Wirkung |
|---|---|
| `y` / `Enter` | Einmal genehmigen |
| `a` | Für gesamte Session genehmigen (nützlich z. B. bei `pnpm test` in TDD) |
| `n` / `Esc` | Ablehnen – Agent bekommt das Feedback und passt Plan an |
| `e` | Kommando editieren, dann ausführen |
| `Shift+Tab` | Modus zyklen |

## 3. Kombinationsmatrix Approval × Sandbox × Netzwerk

| Approval | Sandbox | Netzwerk | Erwartetes Verhalten |
|---|---|---|---|
| `untrusted` | `read-only` | off | maximale Sicherheit; nur Lesezugriff, jede Aktion bestätigen |
| `on-request` | `read-only` | off | Review-Modus: Analyse ohne Schreiben, interaktive Klarifizierung |
| `on-request` | `workspace-write` | off | **Standard-Pair-Programming**, keine Exfiltration |
| `on-request` | `workspace-write` | on | Alltag mit Paket-Downloads, Agent fragt bei Heikem |
| `never` | `workspace-write` | off | „Autopilot"-Implementierung, CI-tauglich |
| `never` | `workspace-write` | on | Lange Runs mit Netzwerk (Migrations, Upgrades); nur wenn Prompt klar umrissen |
| `never` | `danger-full-access` | on | **YOLO**: nur in throwaway-Containern |
| `granular` | `workspace-write` | on | teamweite Feintuning; schreibende Tools extra zu bestätigen |

## 4. Empfehlungen pro Szenario

### 4.1 Lokales Pair-Programming

```toml
approval_policy = "on-request"
sandbox_mode    = "workspace-write"
[sandbox_workspace_write]
network_access = false
```
Sporadische `curl`/`npm install`-Schritte per Approval bestätigen; kritische Kommandos in `a`-Modus (Session-Approve) zusammenfassen.

### 4.2 Exploratives Durchforsten fremder Repos

```toml
approval_policy = "untrusted"
sandbox_mode    = "read-only"
```
Stärkster Schutz gegen Prompt-Injection in README/AGENTS.md.

### 4.3 CI/CD – headless `codex exec`

```bash
codex exec "review diff" \
  --ask-for-approval never \
  --sandbox read-only
```
Approval `never` ist Pflicht, weil `exec` nicht interaktiv fragen kann. Sandbox sollte so restriktiv wie möglich sein.

### 4.4 YOLO in Container

Innerhalb eines wegwerfbaren Docker-Containers:
```bash
docker run --rm -it -v "$PWD":/workspace -e OPENAI_API_KEY ghcr.io/openai/codex \
  codex exec "Migriere ESLint-Config auf Flat Config" \
  --ask-for-approval never --sandbox danger-full-access
```
Der Container ist selbst die Sandbox.

### 4.5 Review-Modus (Commit vor Push)

```bash
codex exec --profile review \
  "Review staged changes, finde Bugs und Security-Issues, Format Table."
```
Profile:
```toml
[profiles.review]
model = "gpt-5.3-codex"
approval_policy = "never"
sandbox_mode    = "read-only"
model_reasoning_effort = "high"
```

## 5. Approval-Logik pro Tool-Typ

| Tool | Approval-Behandlung |
|---|---|
| **Shell-Tool** | Abhängig von `approval_policy`. Kommando-Hash/Pattern kann in `execpolicy.toml` als allow/deny vorgemerkt werden, sodass kein Popup entsteht. |
| **apply_patch** | Zeigt Unified-Diff, wird immer mindestens einmal (außer bei `never`) genehmigt. |
| **MCP-Tool** | Default wird nach `approval_policy` behandelt. Pro Tool: `tools.<name>.approval_mode = "approve"` erzwingt Popup trotz `never`. |
| **Web-Search** | gilt bei `on-request` als „sicher" (reiner Lesezugriff), wird bei `untrusted` trotzdem bestätigt. |
| **Plan-Tool (`update_plan`)** | nie approval-pflichtig (interne Plan-Updates). |

## 6. `execpolicy` – deklarative Regeln

`~/.codex/execpolicy.toml` (optional). Beispiel:

```toml
[[allow]]
pattern = "^git "
note    = "lesende/schreibende Git-Kommandos ok"

[[allow]]
pattern = "^(pnpm|npm|pip|cargo|go|just) "

[[deny]]
pattern = "^rm -rf /"
note    = "absolutes Root-Löschen verboten"

[[deny]]
pattern = "^curl https?://"
note    = "ausgehendes Netz nur mit ausdrücklicher Approval"
```

Die Policy wird **unabhängig** von `approval_policy` geprüft: was `deny` ist, scheitert immer; was `allow` ist, läuft ohne Popup. Die Policy greift vor der OS-Sandbox und liefert so eine weitere Schutzschicht.

## 7. Approval im Headless-Modus

- `codex exec` prüft beim Start die Policy. Ist sie `on-request` oder `untrusted` **ohne TTY**, bricht Codex ab oder wechselt je nach Version auf `never` mit Warnung.
- Für CI stets explizit `--ask-for-approval never` setzen, um Überraschungen zu vermeiden.

## 8. Approval-Events in JSONL

Im `--json`-Stream werden Approval-relevante Ereignisse sichtbar:

| Event | Bedeutung |
|---|---|
| `item.approval.request` | Agent möchte etwas tun, wartet auf Freigabe |
| `item.approval.decision` | Freigabe oder Ablehnung (nur mit Input-Channel) |
| `item.policy.violation` | execpolicy hat blockiert |
| `item.sandbox.denied` | OS-Sandbox hat blockiert |

Nützlich für CI-Dashboards, die Blocker sichtbar machen.

## 9. UX-Walkthrough: typische Session

1. `codex` startet, lädt AGENTS.md. Policy `on-request`, Sandbox `workspace-write`.
2. Prompt: „Refactor die `users`-Route so, dass sie Zod nutzt, und schreibe Tests."
3. Agent skizziert Plan (Plan-Tool), führt `rg`-Suchen aus.
4. Schlägt Patch für `src/routes/users.ts` vor → Diff-Popup → `Enter`.
5. Will `pnpm test` laufen lassen → Popup → `a` (Session-Approve).
6. Tests schlagen fehl → Agent passt Code an → neuer Diff-Popup → `Enter`.
7. Tests grün → Commit-Vorschlag → `y` → `git commit` läuft.
8. Agent beendet mit Zusammenfassung.

## 10. Häufige Fehler

| Problem | Ursache | Lösung |
|---|---|---|
| Codex bleibt bei `untrusted` ständig stehen | zu viele kleine Commands | Schritt kompakter formulieren; oder `on-request` wählen |
| `exec` bricht ab mit „approval required but no TTY" | Policy `on-request`/`untrusted` in headless | `--ask-for-approval never` |
| Agent führt trotz `never` keine `curl`-Calls aus | Sandbox/Netz blockiert | `network_access = true` und/oder execpolicy anpassen |
| Approval-Popup zeigt kryptisches Kommando | `eval`-ähnliche Konstrukte | `e` drücken, editieren, dann ausführen |
| `granular` verhält sich unerwartet | Policy-Bundle nicht geladen | Pfad zu `execpolicy.toml` prüfen |

## 11. Zusammenfassung

- **Approval** = menschliche Schleife; **Sandbox** = OS-Schicht; **execpolicy** = deklarative Allow/Deny.
- Policy `on-request` + Sandbox `workspace-write` + Netz aus = guter Standard.
- Policy `never` nur wenn Sandbox oder Container ausreichend isolieren.
- Für `exec` immer explizit `--ask-for-approval never` setzen.

## 12. Referenzen

- Approvals + Security: https://developers.openai.com/codex/agent-approvals-security
- Sandbox: https://developers.openai.com/codex/concepts/sandboxing
- execpolicy (Doku): https://github.com/openai/codex/blob/main/docs/execpolicy.md
