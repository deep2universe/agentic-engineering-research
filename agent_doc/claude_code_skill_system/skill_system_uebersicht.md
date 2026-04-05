# Das Skill-System in Claude Code -- Umfassende Recherche

## 1. Was sind Skills in Claude Code?

Skills sind **erweiterbare, prompt-basierte Anweisungspakete**, die Claudes Faehigkeiten in Claude Code erweitern. Im Kern funktioniert ein Skill so: Man erstellt eine `SKILL.md`-Datei mit Anweisungen, und Claude fuegt diese zu seinem Werkzeugsatz hinzu. Claude nutzt Skills, wenn sie relevant sind, oder man kann sie direkt mit `/skill-name` aufrufen.

### Architektur-Prinzip: Meta-Tool

Das Skill-System basiert auf einer **Meta-Tool-Architektur**. Ein Tool namens `Skill` fungiert als Container und Dispatcher fuer alle einzelnen Skills. Anstatt Aktionen direkt auszufuehren, injizieren Skills **spezialisierte Anweisungen in den Konversationskontext** und modifizieren dynamisch Claudes Ausfuehrungsumgebung -- ohne ausfuehrbaren Code zu schreiben.

**Dreistufiges Lademodell (Progressive Disclosure):**

| Stufe | Was wird geladen | Wann | Umfang |
|-------|-----------------|------|--------|
| Level 1 | Metadaten (Name + Beschreibung) | Immer im Kontext | ~100 Woerter |
| Level 2 | SKILL.md Body | Wenn Skill ausgeloest wird | <500 Zeilen ideal |
| Level 3 | Gebundelte Ressourcen | Bei Bedarf | Unbegrenzt |

### Offener Standard: Agent Skills

Claude Code Skills folgen dem [Agent Skills](https://agentskills.io) Open Standard, der uebergreifend in mehreren AI-Tools funktioniert. Claude Code erweitert den Standard mit zusaetzlichen Features wie Invocation Control, Subagent-Ausfuehrung und Dynamic Context Injection. Dieselben Skill-Dateien funktionieren plattformuebergreifend in Claude Code, Cursor, Gemini CLI, Codex CLI und Antigravity IDE.

---

## 2. Wie werden Skills definiert, registriert und aufgerufen?

### 2.1 Skill-Definition: Die SKILL.md-Datei

Jeder Skill benoetigt eine `SKILL.md`-Datei mit zwei Teilen:

1. **YAML Frontmatter** (zwischen `---`-Markern): Konfigurationsmetadaten
2. **Markdown-Inhalt**: Anweisungen, denen Claude folgt

**Beispiel:**

```yaml
---
name: explain-code
description: Explains code with visual diagrams and analogies. Use when explaining how code works, teaching about a codebase, or when the user asks "how does this work?"
---

When explaining code, always include:

1. **Start with an analogy**: Compare the code to something from everyday life
2. **Draw a diagram**: Use ASCII art to show the flow
3. **Walk through the code**: Explain step-by-step what happens
4. **Highlight a gotcha**: What's a common mistake?
```

### 2.2 Verzeichnisstruktur

Jeder Skill ist ein Verzeichnis mit `SKILL.md` als Einstiegspunkt:

```
my-skill/
+-- SKILL.md           # Hauptanweisungen (erforderlich)
+-- template.md        # Template fuer Claude
+-- examples/
|   +-- sample.md      # Beispielausgabe
+-- scripts/
    +-- validate.sh    # Ausfuehrbares Skript
```

### 2.3 Speicherorte und Geltungsbereiche

| Ebene | Pfad | Gilt fuer |
|-------|------|-----------|
| Enterprise | Managed Settings | Alle Nutzer der Organisation |
| Persoenlich | `~/.claude/skills/<skill-name>/SKILL.md` | Alle eigenen Projekte |
| Projekt | `.claude/skills/<skill-name>/SKILL.md` | Nur dieses Projekt |
| Plugin | `<plugin>/skills/<skill-name>/SKILL.md` | Wo Plugin aktiviert ist |

**Prioritaet bei Namenskonflikten:** Enterprise > Persoenlich > Projekt. Plugin-Skills nutzen `plugin-name:skill-name`-Namespaces und koennen daher nicht mit anderen Ebenen kollidieren.

### 2.4 Aufruf-Methoden

**Manueller Aufruf:** `/skill-name` oder `/skill-name argument1 argument2`

**Automatischer Aufruf durch Claude:** Claude entscheidet basierend auf der Beschreibung des Skills, ob er relevant ist, und laedt ihn bei Bedarf.

### 2.5 Automatische Entdeckung

- Claude Code erkennt Skills automatisch in verschachtelten `.claude/skills/`-Verzeichnissen
- Unterstuetzt Monorepo-Setups, z.B. `packages/frontend/.claude/skills/`
- Der `--add-dir`-Flag ermoeglicht zusaetzliche Skill-Verzeichnisse

---

## 3. YAML Frontmatter -- Vollstaendige Referenz

| Feld | Erforderlich | Beschreibung |
|------|-------------|-------------|
| `name` | Nein | Anzeigename, wird zum `/slash-command`. Kleinbuchstaben, Zahlen, Bindestriche (max 64 Zeichen). Standard: Verzeichnisname. |
| `description` | Empfohlen | Was der Skill tut und wann er genutzt werden soll. Max 250 Zeichen werden in der Listing angezeigt. |
| `argument-hint` | Nein | Hinweis fuer Autovervollstaendigung, z.B. `[issue-number]` |
| `disable-model-invocation` | Nein | `true` verhindert automatische Aktivierung durch Claude. Standard: `false` |
| `user-invocable` | Nein | `false` versteckt den Skill aus dem `/`-Menue. Standard: `true` |
| `allowed-tools` | Nein | Tools, die Claude ohne Genehmigung nutzen kann. Leerzeichen-getrennt oder YAML-Liste. |
| `model` | Nein | Modell, das bei aktivem Skill verwendet wird. |
| `effort` | Nein | Aufwandsstufe: `low`, `medium`, `high`, `max` (nur Opus 4.6) |
| `context` | Nein | `fork` fuer Ausfuehrung in isoliertem Subagent-Kontext |
| `agent` | Nein | Subagent-Typ bei `context: fork` (z.B. `Explore`, `Plan`, `general-purpose`) |
| `hooks` | Nein | Lifecycle-Hooks fuer diesen Skill |
| `paths` | Nein | Glob-Patterns zur Einschraenkung der Aktivierung auf bestimmte Dateien |
| `shell` | Nein | Shell fuer Inline-Befehle: `bash` (Standard) oder `powershell` |

### String-Substitutionen

| Variable | Beschreibung |
|----------|-------------|
| `$ARGUMENTS` | Alle uebergebenen Argumente |
| `$ARGUMENTS[N]` | Bestimmtes Argument (0-basiert) |
| `$N` | Kurzform fuer `$ARGUMENTS[N]` |
| `${CLAUDE_SESSION_ID}` | Aktuelle Session-ID |
| `${CLAUDE_SKILL_DIR}` | Verzeichnis der SKILL.md-Datei |

---

## 4. Eingebaute (Bundled) Skills

Bundled Skills werden mit Claude Code ausgeliefert und sind in jeder Session verfuegbar. Im Gegensatz zu Built-in Commands (die feste Logik ausfuehren) sind Bundled Skills **prompt-basiert**: Sie geben Claude ein detailliertes Playbook und lassen ihn die Arbeit mit seinen Tools orchestrieren.

| Skill | Zweck |
|-------|-------|
| `/batch <instruction>` | Orchestriert grosse Aenderungen parallel ueber die Codebase. Recherchiert, zerlegt Arbeit in 5-30 unabhaengige Einheiten, spawnt einen Agent pro Einheit in isoliertem Git-Worktree. |
| `/claude-api` | Laedt Claude API-Referenzmaterial fuer die Projektsprache. Aktiviert sich auch automatisch bei Import von `anthropic`, `@anthropic-ai/sdk` oder `claude_agent_sdk`. |
| `/debug [description]` | Aktiviert Debug-Logging und analysiert Session-Logs zur Fehlersuche. |
| `/loop [interval] <prompt>` | Fuehrt einen Prompt wiederholt in einem Intervall aus (z.B. `/loop 5m check if deploy finished`). |
| `/simplify [focus]` | Ueberprueft kuerzlich geaenderte Dateien auf Code-Reuse, Qualitaet und Effizienz. Spawnt drei parallele Review-Agents, aggregiert Befunde und wendet Fixes an. |

---

## 5. Custom Skills erstellen

### 5.1 Schritt-fuer-Schritt-Anleitung

**Schritt 1: Verzeichnis erstellen**
```bash
mkdir -p ~/.claude/skills/mein-skill
```

**Schritt 2: SKILL.md schreiben**
```yaml
---
name: mein-skill
description: Beschreibung was der Skill tut und wann er verwendet werden soll.
---

Anweisungen fuer Claude hier...
```

**Schritt 3: Testen**
- Automatisch: Eine Anfrage stellen, die zur Beschreibung passt
- Manuell: `/mein-skill` eingeben

### 5.2 Skill-Typen

**Reference Content (Referenzwissen):**
Konventionen, Patterns, Style-Guides. Laeuft inline, Claude kann es neben dem Konversationskontext nutzen.

```yaml
---
name: api-conventions
description: API design patterns for this codebase
---

When writing API endpoints:
- Use RESTful naming conventions
- Return consistent error formats
```

**Task Content (Aufgabenanweisungen):**
Schritt-fuer-Schritt-Anweisungen fuer spezifische Aktionen. Oft mit `disable-model-invocation: true`.

```yaml
---
name: deploy
description: Deploy the application to production
context: fork
disable-model-invocation: true
---

Deploy the application:
1. Run the test suite
2. Build the application
3. Push to the deployment target
```

### 5.3 Fortgeschrittene Patterns

#### Dynamic Context Injection

Die `` !`<command>` ``-Syntax fuehrt Shell-Befehle aus, **bevor** der Skill-Inhalt an Claude gesendet wird:

```yaml
---
name: pr-summary
description: Summarize changes in a pull request
context: fork
agent: Explore
---

## Pull request context
- PR diff: !`gh pr diff`
- PR comments: !`gh pr view --comments`

## Your task
Summarize this pull request...
```

#### Subagent-Ausfuehrung

Mit `context: fork` laeuft ein Skill in Isolation. Der Skill-Inhalt wird zum Prompt des Subagents:

```yaml
---
name: deep-research
description: Research a topic thoroughly
context: fork
agent: Explore
---

Research $ARGUMENTS thoroughly:
1. Find relevant files using Glob and Grep
2. Read and analyze the code
3. Summarize findings with specific file references
```

#### Visuelle Ausgabe

Skills koennen Scripts beinhalten, die z.B. interaktive HTML-Dateien generieren (Codebase-Visualisierer, Abhaengigkeitsgraphen, Testabdeckungsberichte).

---

## 6. Trigger-Mechanismen

### Wie die automatische Aktivierung funktioniert

1. Alle Skill-Beschreibungen (Name + Description) befinden sich in Claudes `available_skills`-Liste
2. Claude entscheidet basierend auf der Beschreibung, ob ein Skill relevant ist
3. Bei Aktivierung liest Claude die SKILL.md vom Dateisystem und bringt die Anweisungen in den Kontext

### Steuerung der Aktivierung

| Frontmatter | User kann aufrufen | Claude kann aufrufen | Kontext-Ladung |
|-------------|-------------------|---------------------|----------------|
| (Standard) | Ja | Ja | Beschreibung immer im Kontext, voller Skill bei Aufruf |
| `disable-model-invocation: true` | Ja | Nein | Beschreibung nicht im Kontext |
| `user-invocable: false` | Nein | Ja | Beschreibung immer im Kontext |

### Tipps gegen Unter-Triggering

- Explizite Trigger-Phrasen in die Beschreibung aufnehmen
- Keywords verwenden, die Nutzer natuerlich sagen wuerden
- Die Beschreibung "pushy" formulieren: Was es tut + Wann es benutzt wird + Schluesselkontexte
- `paths`-Feld nutzen, um Aktivierung auf bestimmte Dateipfade zu beschraenken

### Beschreibungs-Budget

Das Budget fuer Skill-Beschreibungen skaliert dynamisch mit 1% des Context Windows (Fallback: 8.000 Zeichen). Einstellbar ueber `SLASH_COMMAND_TOOL_CHAR_BUDGET` Umgebungsvariable. Jeder Eintrag wird auf max 250 Zeichen gekuerzt.

---

## 7. Slash Commands vs Skills -- Unterschiede und Migration

### Historischer Hintergrund

Vor Claude Code Version 2.1.3 waren Slash Commands und Skills **zwei getrennte Systeme**:

- **Slash Commands** lebten in `.claude/commands/` als einzelne Markdown-Dateien
- **Skills** lebten in `.claude/skills/` als Verzeichnisse mit `SKILL.md` und optionalen Zusatzdateien

### Die Zusammenfuehrung (v2.1.3)

Ab Version 2.1.3 wurden Slash Commands in das Skill-System integriert:

- Eine Datei unter `.claude/commands/review.md` und ein Skill unter `.claude/skills/review/SKILL.md` erzeugen **beide** `/review` und funktionieren identisch
- Das System behandelt beide gleich
- Bestehende `.claude/commands/`-Dateien funktionieren weiterhin
- Skills werden empfohlen, da sie zusaetzliche Features unterstuetzen

### Unterschiede im Detail

| Merkmal | Slash Commands (alt) | Skills (neu) |
|---------|---------------------|-------------|
| Speicherort | `.claude/commands/datei.md` | `.claude/skills/name/SKILL.md` |
| Zusatzdateien | Nicht moeglich | Unterstuetzt (Templates, Scripts, etc.) |
| YAML Frontmatter | Unterstuetzt | Unterstuetzt (mit erweiterten Feldern) |
| Auto-Triggering | Nicht moeglich | Ueber Beschreibung moeglich |
| Subagent-Ausfuehrung | Nicht moeglich | `context: fork` |
| Dynamic Context Injection | Nicht moeglich | `` !`command` `` Syntax |

### Empfehlung

Neue Erweiterungen sollten immer als Skills in `.claude/skills/` erstellt werden. Bestehende Commands in `.claude/commands/` muessen nicht migriert werden, funktionieren aber weiterhin. Bei Namenskonflikt hat der Skill Vorrang.

---

## 8. Best Practices fuer Skill-Erstellung

### Allgemeine Richtlinien

1. **Ein Skill, eine Aufgabe:** Ein "mache alles"-Skill ist schlechter als kein Skill.
2. **Direktiv, nicht konversationell:** Skills sind Anweisungen, keine Gespraeche. Imperative Verben verwenden.
3. **Unter 500 Zeilen halten:** Laengere Skills fressen Context-Window. Detailliertes Referenzmaterial in Zusatzdateien auslagern.
4. **Beschreibung frontloaden:** Die wichtigste Information an den Anfang der Beschreibung.

### Beschreibungs-Formel

**Was es tut + Wann es benutzt wird + Schluesselkontexte**

Beispiel:
> "Explains code with visual diagrams and analogies. Use when explaining how code works, teaching about a codebase, or when the user asks 'how does this work?'"

### Trigger-Optimierung

- Explizite Trigger-Phrasen auflisten wirkt dem Unter-Triggering entgegen
- Spezifische Kontexte angeben, nicht nur allgemeine Beschreibungen
- `disable-model-invocation: true` fuer Skills mit Seiteneffekten

### Skill-Testing

Der offizielle `skill-creator`-Skill bietet einen strukturierten Workflow:
1. Intent erfassen
2. Interview und Recherche
3. SKILL.md schreiben
4. Testfaelle erstellen (2-3 realistische Prompts)
5. Ausfuehren und evaluieren (mit und ohne Skill)
6. Iterieren basierend auf Feedback
7. Beschreibung fuer Trigger-Genauigkeit optimieren

### Sicherheit und Berechtigungen

- `allowed-tools` einschraenken fuer minimale Berechtigungen
- `Skill`-Tool in `/permissions` verwalten
- Spezifische Skills erlauben/verbieten: `Skill(commit)`, `Skill(deploy *)`
- `disableSkillShellExecution: true` in Settings um Shell-Ausfuehrung zu deaktivieren

---

## 9. Zusammenfassung der Architektur

```
Claude Code Session
|
+-- Skill-Tool (Meta-Tool / Dispatcher)
|   |
|   +-- Bundled Skills (shipped mit Claude Code)
|   |   +-- /batch, /claude-api, /debug, /loop, /simplify
|   |
|   +-- Enterprise Skills (Managed Settings)
|   +-- Personal Skills (~/.claude/skills/)
|   +-- Project Skills (.claude/skills/)
|   +-- Plugin Skills (plugin/skills/)
|   +-- Legacy Commands (.claude/commands/)
|
+-- Trigger-System
|   +-- Beschreibungs-Matching (Level 1)
|   +-- Skill-Ladung bei Bedarf (Level 2)
|   +-- Ressourcen-Ladung bei Bedarf (Level 3)
|
+-- Ausfuehrungs-Kontext
    +-- Inline (Standard)
    +-- Fork (Subagent, isoliert)
```
