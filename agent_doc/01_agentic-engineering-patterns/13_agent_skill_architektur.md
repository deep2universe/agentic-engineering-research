# Agent-Skill-Architektur: Patterns und Prinzipien

**Stand:** 2026-04-05

---

## Inhaltsverzeichnis

1. [Was sind Agent Skills?](#1-was-sind-agent-skills)
2. [SKILL.md Spezifikation](#2-skillmd-spezifikation)
3. [Progressive Disclosure Pattern](#3-progressive-disclosure-pattern)
4. [Skill Design Patterns](#4-skill-design-patterns)
5. [Skill Decomposition Prinzipien](#5-skill-decomposition-prinzipien)
6. [Skill Orchestration Patterns](#6-skill-orchestration-patterns)
7. [Multi-Agent Skill Sharing und Composition](#7-multi-agent-skill-sharing-und-composition)
8. [Architektur-Prinzipien fuer Skills](#8-architektur-prinzipien-fuer-skills)
9. [Tool vs. Subagent vs. Skill](#9-tool-vs-subagent-vs-skill)

---

## 1. Was sind Agent Skills?

Agent Skills sind **modulare, wiederverwendbare Capabilities**, die einem KI-Agent domänenspezifisches Wissen und Handlungsfähigkeit verleihen. Im Gegensatz zu einfachen Tools (einzelne Funktionsaufrufe) kapseln Skills **prozedurales Wissen** mit:

- **Anwendbarkeitsbedingungen** (wann der Skill aktiviert wird)
- **Ausführungsrichtlinien** (wie der Skill arbeitet)
- **Abbruchkriterien** (wann der Skill fertig ist)
- **Wiederverwendbare Schnittstellen** (Input/Output-Kontrakte)

### Definition (nach SoK: Agentic Skills, arXiv 2602.20867)

> "Agentic Skills sind aufrufbare Module, die prozedurales Wissen mit expliziten Anwendbarkeitsbedingungen, Ausführungsrichtlinien, Abbruchkriterien und wiederverwendbaren Schnittstellen verpacken."

### Abgrenzung: Skill vs. Prompt vs. Tool

| Eigenschaft | Prompt | Tool | Skill |
|-------------|--------|------|-------|
| **Scope** | Einmalige Anweisung | Einzelne Funktion | Kompletter Workflow |
| **Persistenz** | Konversations-Level | System-Level | Dateisystem-basiert |
| **Wiederverwendung** | Copy-Paste | API-Aufruf | On-Demand-Loading |
| **Kontext** | Statisch | Parameterbasiert | Progressive Disclosure |
| **Komplexität** | Gering | Mittel | Hoch (mehrstufig) |

---

## 2. SKILL.md Spezifikation

### Hintergrund

Agent Skills wurde als offene Spezifikation von Anthropic eingeführt (Oktober 2025) und im Dezember 2025 als plattformübergreifender Standard veröffentlicht. Mittlerweile unterstützen mehrere Plattformen dieses Format:

- **Claude Code** — Nativ über `SKILL.md`-Dateien
- **OpenAI Codex** — Liest Skills aus `.agents/skills/`
- **GitHub Copilot** — Lädt Skills aus `.github/skills/`
- **VS Code** — Native Agent Skills-Unterstützung in Copilot
- **Spring AI** — Java/Spring-Implementierung
- **Google ADK** — SkillToolset mit `load_skill_from_dir()`

### Struktur einer SKILL.md-Datei

```yaml
---
name: expense-report-validator
description: Validiert und verarbeitet Spesenberichte gemäß Unternehmensrichtlinien
version: 1.0.0
---

# Expense Report Validator

## Wann diesen Skill verwenden
- Wenn ein Benutzer einen Spesenbericht einreicht
- Wenn Ausgaben gegen Richtlinien geprüft werden müssen

## Anweisungen
1. Lade die aktuelle Spesenrichtlinie aus `references/POLICY_FAQ.md`
2. Prüfe alle Positionen gegen die Richtlinie
3. Verwende `scripts/validate.py` für die Betragsvalidierung
4. Erstelle einen Validierungsbericht im Format aus `assets/report-template.md`

## Ausgabeformat
- Validierungsergebnis: GENEHMIGT / ABGELEHNT / KLÄRUNGSBEDARF
- Liste der Beanstandungen mit Begründung
```

### Verzeichnisstruktur

```
expense-report/
├── SKILL.md              # Pflicht — Frontmatter + Anweisungen
├── scripts/
│   └── validate.py       # Ausführbarer Code
├── references/
│   └── POLICY_FAQ.md     # Referenzdokumente (on-demand geladen)
└── assets/
    └── report-template.md # Templates und statische Ressourcen
```

---

## 3. Progressive Disclosure Pattern

Das Progressive Disclosure Pattern ist das **fundamentale Architekturmuster** für Agent Skills. Es minimiert den Kontextverbrauch durch dreistufiges Laden:

### Die drei Stufen

| Stufe | Name | Tokens | Beschreibung | Zeitpunkt |
|-------|------|--------|--------------|-----------|
| **L1** | Metadata | ~100 pro Skill | Name und Beschreibung | Beim Start jedes Aufrufs |
| **L2** | Instructions | <5.000 | Vollständiger SKILL.md-Body | Bei Task-Match (via `load_skill`) |
| **L3** | Resources | Variabel | Referenzen, Templates, Assets | Nur bei Bedarf (via `load_skill_resource`) |

### Effizienzgewinn

Ein Agent mit **10 Skills** startet jeden Aufruf mit ca. **1.000 Tokens** L1-Metadaten statt **10.000+ Tokens** in einem monolithischen System-Prompt. Das entspricht einer **~90% Reduktion** des Basis-Kontextverbrauchs.

### Funktionsweise im Google ADK

```
1. Startup:   SkillToolset lädt L1-Metadaten aller Skills
2. Matching:  Agent erkennt passenden Skill anhand L1-Beschreibung
3. Loading:   Agent ruft load_skill() auf → L2-Anweisungen werden geladen
4. Execution: Agent folgt den Anweisungen
5. Resources: Bei Bedarf ruft der Agent load_skill_resource() auf → L3
```

Auto-generierte Tools durch ADK SkillToolset:
- `list_skills` — Listet alle verfügbaren Skills (L1)
- `load_skill` — Lädt vollständige Anweisungen eines Skills (L2)
- `load_skill_resource` — Lädt spezifische Ressource eines Skills (L3)

---

## 4. Skill Design Patterns

### 4.1 Inline-Checklist-Pattern

Der einfachste Skill-Typ: Eine **hardcodierte Checkliste** direkt im SKILL.md-Body.

**Anwendung:** Einfache, deterministische Prüfabläufe.

```markdown
## Anweisungen
1. [ ] Prüfe, ob alle Pflichtfelder ausgefüllt sind
2. [ ] Validiere E-Mail-Format
3. [ ] Prüfe Berechtigungen
4. [ ] Erstelle Bestätigung
```

### 4.2 File-Based Skill Pattern

Der Skill **lädt externe Dateien** als Anweisungen und Referenzen.

**Anwendung:** Wenn Anweisungen zu umfangreich für den SKILL.md-Body sind oder sich häufig ändern.

### 4.3 External Import Pattern

Der Skill nutzt **Community-gesteuerte Skill-Repositories** als Quelle.

**Anwendung:** Standardisierte, branchenübergreifende Skills (z. B. Code Review, Security Audit).

### 4.4 Skill Factory Pattern (Self-Extending)

Der Agent **schreibt selbst neue Skills on-demand**. Wenn der Agent eine Aufgabe mehrfach ausführt, generiert er automatisch einen neuen Skill dafür.

**Anwendung:** Dynamische Erweiterung der Agent-Fähigkeiten basierend auf wiederkehrenden Aufgaben.

### 4.5 Pipeline Skill Pattern

Definiert einen **sequenziellen Workflow**, bei dem jeder Schritt abgeschlossen sein muss, bevor der nächste beginnt. Explizite Gate-Bedingungen verhindern, dass der Agent Validierungsschritte überspringt.

**Anwendung:** Mehrstufige Prozesse mit Qualitätsgates (z. B. Build → Test → Deploy).

### 4.6 Inversion Pattern

**Umkehrung der typischen Agent-Interaktion:** Statt dass der Benutzer den Dialog steuert, instruiert der Skill den Agent, **strukturierte Fragen** in definierten Phasen zu stellen, bevor Output produziert wird.

**Anwendung:** Requirements-Erhebung, Diagnose-Workflows, Interview-basierte Datenerfassung.

---

## 5. Skill Decomposition Prinzipien

### Hierarchische Task-Dekomposition

Das zentrale Prinzip von Multi-Agent-Systemen ist die **Zerlegung eines großen Ziels in kleinere Teilaufgaben**:

```
Komplexe Aufgabe
├── Sub-Task A → Agent/Skill A
│   ├── Sub-Sub-Task A1 → Worker Skill
│   └── Sub-Sub-Task A2 → Worker Skill
├── Sub-Task B → Agent/Skill B
└── Sub-Task C → Agent/Skill C
```

Ein Top-Level-Agent empfängt eine komplexe Aufgabe, zerlegt sie in handhabbare Teilaufgaben und delegiert jede an spezialisierte Subagents. Diese können ihre Aufgaben progressiv weiter zerlegen, bis sie einfach genug für Worker-Agents sind.

### Dekompositions-Kriterien

1. **Funktionale Kohäsion:** Zusammengehörige Operationen in einem Skill bündeln
2. **Klare Grenzen:** Jeder Skill hat einen definierten Input und Output
3. **Unabhängigkeit:** Skills sollten möglichst wenige Abhängigkeiten haben
4. **Granularität:** Nicht zu fein (Overhead) und nicht zu grob (fehlende Wiederverwendung)

### Drei Achsen der Skill-Organisation

Skills können entlang zweier orthogonaler Achsen organisiert werden:

1. **Representation** — Wie die Skill-Policy codiert ist:
   - Natural Language Instructions (für High-Level-Logik)
   - Code Blocks (für deterministische Schritte)
   - Embedding-basierte Retrieval-Mechanismen (für kontextuelle Anpassung)
   - Hybride Kombination aller drei

2. **Scope** — Welche Umgebung oder Aufgabendomäne der Skill abdeckt

---

## 6. Skill Orchestration Patterns

### 6.1 Sequential (Pipeline)

Skills werden in einer **vordefinierten, linearen Reihenfolge** verkettet. Output von Skill A wird Input für Skill B.

```
[Skill A] → [Skill B] → [Skill C] → Ergebnis
```

**Anwendung:** Datenverarbeitungs-Pipelines, Build-Prozesse, schrittweise Transformationen.

### 6.2 Parallel (Concurrent)

Mehrere Skills laufen **gleichzeitig** und ihre Ergebnisse werden aggregiert.

```
         ┌→ [Skill A] ─┐
Input ───┼→ [Skill B] ──┼→ Aggregation → Ergebnis
         └→ [Skill C] ─┘
```

Zwei Varianten (nach Anthropic):
- **Sectioning:** Aufgabe wird in unabhängige Teilaufgaben zerlegt
- **Voting:** Dieselbe Aufgabe wird mehrfach ausgeführt für diverse Outputs

### 6.3 Conditional (Routing)

Ein **Router** klassifiziert den Input und leitet ihn an den passenden Skill weiter.

```
         ┌→ Typ A → [Skill A]
Input → Router ─┼→ Typ B → [Skill B]
         └→ Typ C → [Skill C]
```

**Anwendung:** Klassifikationsbasierte Verarbeitung, Separierung von Zuständigkeiten.

### 6.4 Loop (Iterative Refinement)

Ein Skill wird **wiederholt ausgeführt**, bis ein Qualitätskriterium erfüllt ist.

```
Input → [Generator Skill] → [Evaluator Skill] ─→ Ergebnis
              ↑                     │ (nicht gut genug)
              └─────────────────────┘
```

Dies entspricht dem **Evaluator-Optimizer Pattern** von Anthropic.

### 6.5 Orchestrator-Worker

Ein zentraler **Orchestrator-Skill** zerlegt Aufgaben dynamisch und delegiert an Worker-Skills.

```
         ┌→ [Worker Skill A] ─┐
Orchestrator ─┼→ [Worker Skill B] ──┼→ Orchestrator → Synthese
         └→ [Worker Skill C] ─┘
```

**Anwendung:** Komplexe Aufgaben, bei denen die Zerlegung nicht vorab bekannt ist.

### 6.6 Hierarchisch

**Mehrstufige Orchestrierung** mit verschachtelten Orchestratoren.

```
Top-Level-Orchestrator
├── Mid-Level-Orchestrator A
│   ├── Worker Skill A1
│   └── Worker Skill A2
└── Mid-Level-Orchestrator B
    ├── Worker Skill B1
    └── Worker Skill B2
```

---

## 7. Multi-Agent Skill Sharing und Composition

### Skill Sharing Patterns

#### 7.1 Shared Skill Repository

Mehrere Agents greifen auf ein **gemeinsames Skill-Verzeichnis** zu.

```
/shared-skills/
├── code-review/SKILL.md
├── security-audit/SKILL.md
└── documentation/SKILL.md

Agent A ──┐
Agent B ──┼── liest aus → /shared-skills/
Agent C ──┘
```

#### 7.2 Skill Marketplace/Registry

Skills werden in einem **zentralen Register** veröffentlicht und versioniert. Agents können Skills dynamisch entdecken und laden.

Beispiel: `skills.sh` — eine Plattform für öffentlich geteilte Agent Skills.

#### 7.3 Organization-Wide Skills

Skills werden **organisationsweit** geteilt:
- Claude Code: Über Organization-Settings
- Copilot: Über `.github/skills/` in Repositories
- Codex: Über `.agents/skills/` Verzeichnisse

### Composition Patterns

#### 7.4 Skill Chaining

Skills werden **komponiert**, indem der Output eines Skills als Input für den nächsten dient.

#### 7.5 Skill Nesting

Ein Skill kann **andere Skills aufrufen** als Teil seiner Ausführung.

#### 7.6 Skill Aggregation

Mehrere Skills liefern **parallele Inputs**, und der Agent synthetisiert die Empfehlungen.

### Multi-Agent Architekturen (nach LangChain)

| Pattern | Beschreibung | Skill-Implikation |
|---------|-------------|-------------------|
| **Supervisor** | Zentraler Agent koordiniert Subagents | Supervisor verwaltet Skill-Zuweisung |
| **Network** | Agents kommunizieren many-to-many | Skills werden dynamisch geteilt |
| **Hierarchical** | Verschachtelte Supervisor-Schichten | Skills auf verschiedenen Hierarchie-Ebenen |
| **Handoffs** | Aktiver Agent wechselt dynamisch | Skills werden mit dem aktiven Agent transferiert |

---

## 8. Architektur-Prinzipien fuer Skills

### 8.1 Single Responsibility Principle

Jeder Skill hat **eine einzige, klar definierte Verantwortung**.

- **Schlecht:** `manage_data` (zu breit)
- **Gut:** `search_database`, `insert_record`, `update_record` (fokussiert)

Für Agents wird dies über die **Agentic Job Description (AJD)** formalisiert: Jeder Agent/Skill hat eine explizite Jobbeschreibung, die seine Zuständigkeit definiert.

### 8.2 Composability

Skills sind **zusammensetzbar** wie Bausteine:

- **Explizite Schnittstellen:** Jeder Skill hat klar dokumentierte Input/Output-Schemas
- **Plug-and-Play:** Skills funktionieren als austauschbare Module
- **Mix-and-Match:** Skills können frei kombiniert werden
- **Bibliothek-Ansatz:** Organisation baut eine Bibliothek von Intelligence-Modulen auf

### 8.3 Idempotency

Skills sollten **idempotent** sein — mehrfaches Ausführen produziert dasselbe Ergebnis.

- **Problematisch:** `increment_counter` (zweimaliger Aufruf verändert den Zustand fehlerhaft)
- **Idempotent:** `set_counter_to_value` (zweimaliger Aufruf produziert denselben Zustand)

### 8.4 Weitere Prinzipien

| Prinzip | Beschreibung |
|---------|-------------|
| **Explizite Grenzen** | Klare Verantwortungsbereiche verhindern Fehlerausbreitung |
| **Diagnosefähigkeit** | Fehler sind auf spezifische Skills zurückführbar |
| **Upgrade-Sicherheit** | Skills können unabhängig aktualisiert werden |
| **Kontexteffizienz** | Minimaler Token-Verbrauch durch Progressive Disclosure |
| **Testbarkeit** | Jeder Skill ist unabhängig testbar |
| **Versionierung** | Skills sind versioniert und rückwärtskompatibel |

---

## 9. Tool vs. Subagent vs. Skill

### Entscheidungsmatrix

Die Wahl zwischen Tool, Subagent und Skill hängt von der **Kontrollebene** ab:

| Dimension | Tool | Skill | Subagent |
|-----------|------|-------|----------|
| **Kontrolle** | Maximal (deterministisch) | Hoch (geführt) | Gering (autonom) |
| **Flexibilität** | Gering | Mittel | Hoch |
| **Kontextkosten** | Niedrig | Mittel (Progressive Disclosure) | Hoch |
| **Fehlerrisiko** | Gering | Mittel | Hoch |
| **Komplexität** | Einzelne Funktion | Mehrstufiger Workflow | Vollständiger Agent |

### Entscheidungshilfe

- **Tool verwenden,** wenn die Aufgabe eine einzelne, atomare Operation ist
- **Skill verwenden,** wenn die Aufgabe einen definierten Workflow mit mehreren Schritten erfordert
- **Subagent verwenden,** wenn die Aufgabe autonome Entscheidungsfindung und Flexibilität benötigt

### Drei Design-Entscheidungen für Agentic Systems

Laut Forschung bestimmen drei sich gegenseitig verstärkende Design-Entscheidungen das Verhalten agenischer Systeme:

1. **Dekomposition** — Wie wird Funktionalität aufgeteilt?
2. **Kommunikation und Constraints** — Wie kommunizieren die Teile und wie werden sie eingeschränkt?
3. **Runtime Supervision** — Wie werden die Teile zur Laufzeit überwacht?

---

## Zusammenfassung

Agent Skills haben sich 2025/2026 als **zentrales Architekturmuster** in der Agentic-Engineering-Landschaft etabliert. Die SKILL.md-Spezifikation bietet einen plattformübergreifenden Standard, während Progressive Disclosure den Kontextverbrauch um ~90% reduziert. Die sechs Orchestration Patterns (Sequential, Parallel, Conditional, Loop, Orchestrator-Worker, Hierarchical) decken alle gängigen Workflow-Anforderungen ab. Für die Praxis gelten die Prinzipien Single Responsibility, Composability und Idempotency als Grundpfeiler robusten Skill-Designs.
