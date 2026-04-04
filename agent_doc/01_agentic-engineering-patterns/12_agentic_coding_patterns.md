# 12 — Agentic Coding Patterns (nach Simon Willison)

## Überblick

Simon Willison hat 2026 einen umfassenden Guide zu **Agentic Engineering Patterns** veröffentlicht — Coding-Praktiken und Patterns für die effektive Arbeit mit Coding Agents wie Claude Code und OpenAI Codex. Dieser Guide dokumentiert die Kernerkenntnisse.

> "Agentic Engineering is when professional software engineers use coding agents to improve and accelerate their work by amplifying their existing expertise."
> — Simon Willison

---

## Kernkonzept: Der Compound Engineering Loop

### Beschreibung
Der Compound Engineering Loop ist der zentrale Arbeitszyklus im Agentic Engineering:

```
Entwickler → Aufgabe definieren → Agent
     ↑                               │
     │                               ▼
  Feedback ← Review ← Agent führt aus, plant, testet
```

### Schlüsseleinsicht
Agentic Engineering **ersetzt nicht den Entwickler** — es verstärkt dessen vorhandene Expertise. Der Entwickler bleibt verantwortlich für:
- Aufgabendefinition und Zielsetzung
- Code Review und Qualitätssicherung
- Architektur-Entscheidungen
- Feedback und Kurskorrektur

---

## Pattern: Understanding Code

### Linear Walkthroughs
Der Agent erklärt Code-Abschnitte Zeile für Zeile in natürlicher Sprache. Besonders nützlich für:
- Einarbeitung in unbekannte Codebases
- Review komplexer Algorithmen
- Dokumentation von Legacy-Code

### Interactive Explanations
Der Agent erstellt interaktive Erklärungen, die den Nutzer durch den Code navigieren und Fragen beantworten.

### Best Practice
- "Erkläre mir diesen Code, als wäre ich ein Senior Engineer, der die Business-Logik verstehen will, nicht die Syntax."
- Fokus auf das *Warum*, nicht das *Was*

---

## Pattern: Hoard Things You Know How to Do

### Beschreibung
Alles, was du einmal manuell gelernt hast, solltest du in wiederverwendbaren Prompts und Konfigurationen festhalten — damit der Agent es in Zukunft für dich ausführen kann.

### Implementierung
- **Rules Files (CLAUDE.md, .cursorrules)**: Projekt-spezifische Anweisungen
- **Prompt-Bibliothek**: Sammlung bewährter Prompts für wiederkehrende Aufgaben
- **Template-Tasks**: Vordefinierte Aufgaben-Templates
- **Checklisten**: Qualitätschecklisten, die der Agent abarbeiten kann

### Beispiele
```markdown
# In CLAUDE.md:
- Bei API-Endpoints: Immer Input-Validierung mit Zod
- Tests: Immer Vitest verwenden, nie Jest
- Commits: Conventional Commits Format
- Error Handling: Immer mit custom Error-Klassen
```

### Warum wichtig
- Kodifiziert institutionelles Wissen
- Stellt Konsistenz sicher, auch wenn der Agent der "neue Kollege" ist
- Skaliert Expertise über das Team

---

## Pattern: Agentic Manual Testing

### Beschreibung
Der Agent wird angewiesen, den generierten Code *manuell* zu testen — nicht nur Unit Tests zu schreiben, sondern den Code tatsächlich auszuführen, die Ergebnisse zu beobachten und zu validieren.

### Mechanismen
- **Code ausführen und Output prüfen**: Agent führt Code aus, liest Output, bewertet Korrektheit
- **Screenshot-Analyse**: Agent erstellt/liest Screenshots von Web-UIs (via Browser Automation)
- **Showboat**: Tool, das den Agent anweist, sich Notizen zu machen und Ergebnisse festzuhalten
- **API-Aufrufe testen**: Agent ruft API-Endpoints auf und validiert Responses

### Best Practice
```
"Führe den Code aus, prüfe ob er funktioniert, und zeige mir den Output. 
Wenn er nicht funktioniert, analysiere den Fehler und korrigiere ihn."
```

---

## Pattern: Browser Automation für Web UIs

### Beschreibung
Coding Agents können Browser-Automatisierungs-Tools (Playwright, Puppeteer) nutzen, um Web-UIs zu testen.

### Ablauf
```
1. Agent implementiert Feature
2. Agent startet Dev Server
3. Agent öffnet Browser via Playwright
4. Agent navigiert zur relevanten Seite
5. Agent macht Screenshot und analysiert das Ergebnis
6. Agent korrigiert bei Bedarf
```

---

## Pattern: Using Git with Coding Agents

### Git Essentials für Agents
- **Häufig committen**: Kleine, atomare Commits → einfaches Rollback
- **Branches nutzen**: Jede Agent-Aufgabe auf eigenem Branch
- **History rewriten**: Agent kann `git rebase -i` für saubere Historie nutzen
- **Diff-Review**: Agent-Output immer über `git diff` reviewen

### Core Concepts
- Agent erstellt Branch → arbeitet → committet → Entwickler reviewt
- Branches als "Sandbox" für Agent-Arbeit
- Wenn das Ergebnis nicht passt: Branch löschen, neu starten (billig!)

---

## Pattern: Subagents

### Beschreibung
Komplexe Aufgaben werden an spezialisierte Sub-Agents delegiert, die in einem eigenen Context Window arbeiten.

### Typen von Subagents

#### Explore Subagent
- Spezialisiert auf Codebase-Exploration
- Schnelles Finden von Dateien, Patterns, Definitionen
- Isolierter Kontext schützt den Haupt-Agent vor Information Overload

#### Parallel Subagents
- Mehrere Subagents arbeiten gleichzeitig an verschiedenen Aspekten
- Ergebnisse werden an den Haupt-Agent zurückgemeldet
- Deutliche Zeitersparnis bei unabhängigen Aufgaben

#### Specialist Subagents
- Für spezifische Aufgaben konfigurierte Sub-Agents
- z.B. ein Sub-Agent nur für Datenbank-Migrationen, einer nur für Tests

### Best Practices
- Subagents mit klarem, eingegrenztem Auftrag starten
- Context Engineering: Nur relevante Informationen an den Subagent weitergeben
- Ergebnisse des Subagents im Haupt-Kontext zusammenfassen

---

## Pattern: Testing und QA

### Red/Green TDD
```
1. Agent schreibt fehlschlagenden Test (Red)
2. Agent implementiert Code, bis Test besteht (Green)
3. Agent refactored (bei Bedarf)
```

### First Run the Tests
- Vor jeder Änderung: Bestehende Tests laufen lassen
- Sicherstellen, dass der Baseline-Zustand grün ist
- Dann: Änderung implementieren und Tests erneut laufen lassen

### Agentic QA Workflow
```
Agent:
1. Bestehende Tests laufen lassen → alle grün? Weiter
2. Feature implementieren
3. Neue Tests schreiben
4. Alle Tests laufen lassen
5. Bei Fehlern: Analysieren und korrigieren
6. Screenshot/Output als Beweis festhalten
```

---

## Anti-Patterns (Was man vermeiden sollte)

### Inflicting Unreviewed Code on Collaborators
- **Nie** Agent-generierten Code ohne Review an Teammitglieder weiterleiten
- Jeder Commit muss vom Entwickler reviewt werden
- Agent-Code mit gleicher Sorgfalt behandeln wie Code von einem neuen Junior-Entwickler

### Blindes Vertrauen
- Agent-Outputs nicht blind akzeptieren
- Immer `git diff` reviewen
- Besonders kritisch: Sicherheits-relevanter Code, Konfigurationen, Berechtigungen

### Zu große Aufgaben
- Agents arbeiten besser mit kleineren, klar definierten Aufgaben
- Große Aufgaben in Teilschritte zerlegen
- Häufige Checkpoints mit Entwickler-Review

---

## Prompts für die Praxis

### Für Code-Verständnis
```
"Erstelle einen linearen Walkthrough dieses Moduls. Erkläre die 
Architektur-Entscheidungen und das Zusammenspiel der Komponenten."
```

### Für Implementierung
```
"Implementiere Feature X. Schreibe zuerst die Tests, dann den Code. 
Führe die Tests aus und zeige mir das Ergebnis."
```

### Für Code Review
```
"Reviewe diese Änderungen. Prüfe auf: Sicherheitslücken, Performance-
Probleme, fehlende Edge Cases, Code-Style-Konsistenz."
```

### Für Debugging
```
"Dieser Test schlägt fehl: [Fehlermeldung]. Analysiere die Ursache, 
erkläre mir das Problem, und schlage eine Lösung vor."
```
