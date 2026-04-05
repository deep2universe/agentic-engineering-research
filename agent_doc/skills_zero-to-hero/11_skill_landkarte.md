# 11 — Wissenslandkarte: Skills im Agentic Engineering

## Überblick

Diese Landkarte ist eine vollständige Referenz aller Wissenspunkte zum Thema Skills im Agentic Engineering. Sie dient als schnelles Nachschlagewerk und Orientierungshilfe.

---

## Landkarte: Hauptbereiche

```
                        SKILLS IM AGENTIC ENGINEERING
                                    │
           ┌────────────────────────┼────────────────────────┐
           │                        │                        │
    ┌──────┴──────┐          ┌──────┴──────┐          ┌──────┴──────┐
    │  GRUNDLAGEN  │          │   DESIGN    │          │   PRAXIS    │
    │              │          │             │          │             │
    ├─ Definition  │          ├─ Prinzipien │          ├─ Erstellung │
    ├─ Standard    │          ├─ Patterns   │          ├─ Testing    │
    ├─ Anatomie    │          ├─ Anti-Pat.  │          ├─ Sharing    │
    ├─ Lebenszyklus│          ├─ Composition│          ├─ Enterprise │
    └─ Ökosystem   │          └─ Security   │          └─ Tooling    │
    └──────────────┘          └─────────────┘          └─────────────┘
```

---

## Bereich 1: Grundlagen

### 1.1 Was ist ein Skill?
- **Definition**: Verzeichnis mit SKILL.md + optionalen Ressourcen
- **Zweck**: Prozedurales Wissen in wiederverwendbaren Modulen
- **Kern-Metapher**: "Onboarding-Guide für einen neuen Teammitglied"
- **Referenz**: [Kapitel 01](01_grundlagen_skills.md)

### 1.2 Agent Skills Standard
- **Herausgeber**: Anthropic (Dezember 2025), jetzt unabhängiger offener Standard
- **Website**: agentskills.io
- **Adoption**: 30+ Produkte (Claude Code, VS Code, Codex, Cursor, Junie...)
- **Kern**: SKILL.md mit YAML Frontmatter + Markdown Body
- **Pflichtfelder**: `name` (max 64 Zeichen), `description` (max 1024 Zeichen)
- **Referenz**: [Kapitel 02](02_agent_skills_standard.md)

### 1.3 Skill-Anatomie
- **SKILL.md**: Einzige Pflichtdatei, YAML Frontmatter + Markdown
- **Supporting Files**: reference.md, examples.md, scripts/, templates/
- **Content-Typen**: Instructions, Code, Resources
- **Referenz**: [Kapitel 03](03_skill_anatomie.md)

### 1.4 Skill-Lebenszyklus
1. **Discovery**: name + description werden bei Session-Start geladen (~100 Token/Skill)
2. **Activation**: SKILL.md Body wird bei Relevanz geladen (<5k Token)
3. **Execution**: Referenz-Dateien und Skripte bei Bedarf
4. **Return**: Ergebnis direkt oder via Subagent-Zusammenfassung

### 1.5 Ökosystem-Einordnung
- **Agent Skills**: Was Agents können (Prozedurales Wissen)
- **MCP**: Wie Agents auf Tools zugreifen (Tool-Protokoll)
- **A2A**: Wie Agents kommunizieren (Agent-Protokoll)
- **Referenz**: [Kapitel 08](08_skill_oekosystem.md)

---

## Bereich 2: Design-Prinzipien

### 2.1 Die 10 Kernprinzipien
| # | Prinzip | Kern |
|---|---------|------|
| 1 | **Conciseness** | Nur schreiben was der Agent nicht weiß |
| 2 | **Progressive Disclosure** | Stufenweise laden |
| 3 | **Appropriate Freedom** | Spezifität an Fragilität anpassen |
| 4 | **Single Responsibility** | Ein Skill, eine Aufgabe |
| 5 | **Descriptive Discovery** | Beschreibung = Aktivierungs-Trigger |
| 6 | **Determinism** | Skripte für reproduzierbare Operationen |
| 7 | **Explicit Error Handling** | Fehler im Skript behandeln |
| 8 | **Konsistente Terminologie** | Ein Begriff pro Konzept |
| 9 | **Cross-Model-Kompatibilität** | Mit allen Zielmodellen testen |
| 10 | **Security by Design** | Least Privilege, auditieren |

**Referenz**: [Kapitel 04](04_skill_prinzipien.md)

### 2.2 Freiheitsgrade
- **Hoch**: Text-Anweisungen, mehrere Wege ok → Code Review
- **Mittel**: Templates mit Parametern → Report-Generierung
- **Niedrig**: Exakte Skripte → DB-Migration

---

## Bereich 3: Design Patterns

### 3.1 Grundlegende Patterns
| Pattern | Anwendung |
|---------|-----------|
| **Template** | Konsistenter Output (strikt oder flexibel) |
| **Workflow/Checkliste** | Mehrstufige Prozesse |
| **Feedback-Loop** | Validate → Fix → Repeat |
| **Conditional Workflow** | Routing nach Input-Typ |
| **Examples** | Stil durch Input/Output-Paare vermitteln |
| **Progressive Reference** | Umfangreiches Referenzmaterial |

### 3.2 Fortgeschrittene Patterns
| Pattern | Anwendung |
|---------|-----------|
| **Plan-Validate-Execute** | Risikoreiche Batch-Operationen |
| **Visual Output** | HTML/Chart-Generierung via Skripte |
| **Dynamic Context Injection** | Live-Daten via Shell-Preprocessing |
| **Subagent-Delegation** | Isolierte Task-Ausführung |
| **Multi-Agent Orchestration** | Parallele spezialisierte Agents |
| **Skill Composition** | Skills rufen andere Skills auf |
| **Verifiable Intermediate Outputs** | Maschinenprüfbare Zwischenergebnisse |
| **Context-Aware Activation** | Pfad-basierte Aktivierung |
| **Knowledge Base** | Domänenwissen strukturiert |
| **Enterprise Governance** | Zentrale Verwaltung |

**Referenz**: [Kapitel 05](05_skill_patterns.md), [Kapitel 09](09_advanced_patterns.md)

---

## Bereich 4: Skill-Erstellung

### 4.1 Methodik
1. **Bedarfsanalyse** → Wiederkehrende Muster identifizieren
2. **Evaluation-Driven Development** → Erst Evaluierungen, dann Skill
3. **Claude-A/Claude-B Workflow** → Designer + Tester
4. **Naming und Description** → Discovery optimieren
5. **Strukturierung** → Progressive Disclosure anwenden
6. **Testing** → Multi-Modell, Multi-Szenario
7. **Iteration** → Beobachten, analysieren, anpassen

**Referenz**: [Kapitel 06](06_skill_planung_erstellung.md)

### 4.2 Naming-Konventionen
- **Empfohlen**: Gerundium (`processing-pdfs`) oder Nomen (`pdf-processing`)
- **Regeln**: Lowercase, Buchstaben/Zahlen/Bindestriche, max 64 Zeichen
- **Vermeiden**: `helper`, `utils`, `tools`, reservierte Wörter

### 4.3 Description-Regeln
- Dritte Person
- Was + Wann
- Schlüsselbegriffe einschließen
- Kern-Use-Case in den ersten 250 Zeichen
- Keine XML-Tags

---

## Bereich 5: Claude Code Spezifika

### 5.1 Speicherorte
| Ebene | Pfad |
|-------|------|
| Enterprise | Managed Settings |
| Personal | `~/.claude/skills/<name>/SKILL.md` |
| Projekt | `.claude/skills/<name>/SKILL.md` |
| Plugin | `<plugin>/skills/<name>/SKILL.md` |

### 5.2 Bundled Skills
`/batch`, `/claude-api`, `/debug`, `/loop`, `/simplify`

### 5.3 Frontmatter-Felder (Vollständig)
| Feld | Typ | Beschreibung |
|------|-----|-------------|
| `name` | string | Identifikator (max 64, lowercase) |
| `description` | string | Was + Wann (max 1024) |
| `argument-hint` | string | Autocomplete-Hinweis |
| `disable-model-invocation` | bool | Nur manuell aufrufbar |
| `user-invocable` | bool | Im /-Menü sichtbar |
| `allowed-tools` | string/list | Erlaubte Tools |
| `model` | string | Modell-Override |
| `effort` | string | low/medium/high/max |
| `context` | string | `fork` für Subagent |
| `agent` | string | Subagent-Typ |
| `hooks` | object | Lifecycle-Hooks |
| `paths` | string/list | Glob-Patterns für Aktivierung |
| `shell` | string | bash/powershell |

### 5.4 String-Substitutionen
`$ARGUMENTS`, `$ARGUMENTS[N]`, `$N`, `${CLAUDE_SESSION_ID}`, `${CLAUDE_SKILL_DIR}`

### 5.5 Shell-Preprocessing
- Inline: `` !`command` ``
- Multi-line: ` ```! ... ``` `
- Deaktivierbar: `disableSkillShellExecution: true`

### 5.6 Extended Thinking
Wort **"ultrathink"** im Skill-Content aktiviert Extended Thinking.

**Referenz**: [Kapitel 07](07_claude_code_skills.md)

---

## Bereich 6: Anti-Patterns

### 6.1 Design Anti-Patterns
| Anti-Pattern | Problem |
|-------------|---------|
| Monolith-Skill | Zu groß, zu vage |
| Über-Erklärung | Token-Verschwendung |
| Tiefe Verschachtelung | Unvollständiges Lesen |
| Voodoo Constants | Nicht anpassbar |
| Fehler-Delegation | Unzuverlässig |
| Zu viele Optionen | Inkonsistenz |
| Windows-Pfade | Cross-Platform-Bruch |
| Zeitabhängig | Veraltet schnell |
| Inkonsistente Begriffe | Verwirrung |
| Fehlende Keywords | Nicht-Aktivierung |
| Task ohne Fork | Token im Hauptkontext |
| Keine Evaluation | Eingebildetes Problem |

### 6.2 Security Anti-Patterns
| Anti-Pattern | Risiko |
|-------------|--------|
| Unbekannte Quellen | Bösartige Anweisungen |
| Externe URLs | Prompt Injection |
| Breite Permissions | Tool-Missbrauch |
| Sensible Daten | Datenleck |

**Referenz**: [Kapitel 10](10_anti_patterns.md)

---

## Bereich 7: Plattform-Verfügbarkeit

| Feature | Claude Code | Claude.ai | Claude API | Agent SDK |
|---------|------------|-----------|-----------|----------|
| Custom Skills | ✓ | ✓ (ZIP) | ✓ (API) | ✓ |
| Pre-built Skills | — | ✓ | ✓ | — |
| Bundled Skills | ✓ | — | — | — |
| Plugins | ✓ | — | — | — |
| Hot Reload | ✓ | — | — | — |
| Subagents | ✓ | — | — | ✓ |
| Shell-Preprocessing | ✓ | — | — | — |
| Netzwerkzugriff | Voll | Variabel | Kein | Voll |

---

## Bereich 8: Agentic Engineering Kontext

### 8.1 Flow Engineering
- Kontrollfluss-Design > Prompt-Optimierung
- Skills = Bausteine im Flow
- State Transitions, Decision Boundaries um LLM-Calls

### 8.2 Workflow Patterns (Anthropic)
1. **Prompt Chaining** — Sequentielle Verarbeitung
2. **Routing** — Input-basierte Weiterleitung
3. **Parallelisierung** — Gleichzeitige Bearbeitung
4. **Orchestrator-Worker** — Dynamische Aufgabenzerlegung
5. **Evaluator-Optimizer** — Iterative Verbesserung

### 8.3 Context Engineering
1. **Writing Context** — Zwischenergebnisse speichern
2. **Selecting Context** — Nur Relevantes laden
3. **Compressing Context** — Auf Wesentliches reduzieren
4. **Isolating Context** — Subagents mit eigenem Kontext

### 8.4 Compound Engineering Loop
```
Entwickler → Aufgabe → Agent (nutzt Skills) → Output → Review → Feedback
```

---

## Bereich 9: Marktdaten und Zukunftstrends

### Marktzahlen (Stand Q1 2026)
| Metrik | Wert |
|--------|------|
| Enterprise Agentic AI Markt | 7,51 Mrd. USD (CAGR 27,3%) |
| AI-Agent-Markt gesamt | 7,84 Mrd. USD → 52,62 Mrd. USD bis 2030 |
| Enterprise-Apps mit AI Agents (Gartner) | 40% bis Ende 2026 |
| Skills auf Community-Hubs | 96.000+ (SkillsMP) |
| MCP-Server | 17.000+ |
| Produktionsreife Agentic AI | Nur 14% der Unternehmen |
| Bösartige Skills identifiziert | 341 |

### Zukunftstrends
| Trend | Status |
|-------|--------|
| Agent Skills Standard — Cross-Platform | Etabliert (30+ Produkte) |
| MCP unter Linux Foundation | Etabliert |
| Skill Marketplaces | Entstehend (96.000+ Skills) |
| Enterprise Skill Governance | Entstehend |
| Skill Learning / Auto-Generierung | Forschung |
| Multi-Agent Skill Sharing | Entstehend |
| Skill Discovery Protocols | Forschung |
| Skill Composition Engines | Entstehend |
| Agentic Engineering als Disziplin | Etabliert (ICSE 2026 Workshop) |

---

## Quick Reference: Skill in 5 Minuten

```bash
# 1. Verzeichnis
mkdir -p .claude/skills/my-skill

# 2. SKILL.md
cat > .claude/skills/my-skill/SKILL.md << 'EOF'
---
name: my-skill
description: Beschreibung was der Skill tut und wann er verwendet wird
---

## Anweisungen

[Was der Agent tun soll]

## Beispiele

[Konkrete Beispiele]
EOF

# 3. Testen
# Automatisch: Anfrage stellen die zur Beschreibung passt
# Direkt: /my-skill
```
