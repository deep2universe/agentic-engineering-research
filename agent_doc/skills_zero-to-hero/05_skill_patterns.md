# 05 — Design Patterns für Skills

## Überblick

Dieses Kapitel dokumentiert bewährte Design Patterns für die Skill-Erstellung. Die Patterns stammen aus der offiziellen Anthropic-Dokumentation, aus Community Best Practices und aus der Analyse erfolgreicher Skill-Implementierungen.

---

## Pattern 1: Template Pattern

### Problem
Der Output soll einem definierten Format folgen — konsistent über alle Aufrufe hinweg.

### Lösung
Ein Template bereitstellen, das der Agent ausfüllt. Den Grad der Striktheit an die Anforderung anpassen.

### Variante A: Striktes Template

**Wann**: API-Responses, Datenformate, regulatorische Dokumente

````markdown
## Report-Struktur

Verwende IMMER exakt diese Template-Struktur:

```markdown
# [Analysetitel]

## Executive Summary
[Ein-Absatz-Überblick der Kernerkenntnisse]

## Kernerkenntnisse
- Erkenntnis 1 mit unterstützenden Daten
- Erkenntnis 2 mit unterstützenden Daten

## Empfehlungen
1. Spezifische, umsetzbare Empfehlung
2. Spezifische, umsetzbare Empfehlung
```
````

### Variante B: Flexibles Template

**Wann**: Wenn Adaption je nach Kontext sinnvoll ist

````markdown
## Report-Struktur

Hier ist ein sinnvolles Standardformat. Passe es nach
eigenem Ermessen an die Analyse an:

```markdown
# [Analysetitel]

## Executive Summary
[Überblick]

## Kernerkenntnisse
[Passe Abschnitte basierend auf Ergebnissen an]

## Empfehlungen
[Auf den spezifischen Kontext zuschneiden]
```
````

---

## Pattern 2: Workflow Pattern (Checkliste)

### Problem
Komplexe, mehrstufige Operationen müssen zuverlässig und vollständig durchgeführt werden.

### Lösung
Eine kopierbare Checkliste bereitstellen, die der Agent abarbeitet und als Fortschrittsanzeige nutzt.

### Beispiel: Ohne Code

````markdown
## Research-Synthese Workflow

Kopiere diese Checkliste und tracke deinen Fortschritt:

```
Fortschritt:
- [ ] Schritt 1: Alle Quelldokumente lesen
- [ ] Schritt 2: Kernthemen identifizieren
- [ ] Schritt 3: Behauptungen gegenprüfen
- [ ] Schritt 4: Strukturierte Zusammenfassung erstellen
- [ ] Schritt 5: Zitate verifizieren
```

**Schritt 1: Alle Quelldokumente lesen**
Überprüfe jedes Dokument im `sources/`-Verzeichnis.
Notiere die Hauptargumente und Belege.

**Schritt 2: Kernthemen identifizieren**
Suche nach Mustern über Quellen hinweg.
Wo stimmen sie überein, wo widersprechen sie sich?
````

### Beispiel: Mit Code

````markdown
## PDF Formular-Ausfüllung Workflow

```
Fortschritt:
- [ ] Schritt 1: Formular analysieren (analyze_form.py)
- [ ] Schritt 2: Feld-Mapping erstellen (fields.json)
- [ ] Schritt 3: Mapping validieren (validate_fields.py)
- [ ] Schritt 4: Formular ausfüllen (fill_form.py)
- [ ] Schritt 5: Output verifizieren (verify_output.py)
```

**Schritt 1: Formular analysieren**
Ausführen: `python scripts/analyze_form.py input.pdf`

**Schritt 3: Mapping validieren**
Ausführen: `python scripts/validate_fields.py fields.json`
Fehler beheben vor dem Fortfahren.
````

---

## Pattern 3: Feedback-Loop Pattern (Validator)

### Problem
Output-Qualität muss sichergestellt werden — der Agent soll Fehler erkennen und korrigieren.

### Lösung
Run Validator → Fix Errors → Repeat

### Beispiel: Mit Skript

```markdown
## Dokument-Bearbeitungsprozess

1. Bearbeitungen an `word/document.xml` durchführen
2. **Sofort validieren**: `python ooxml/scripts/validate.py unpacked_dir/`
3. Falls Validierung fehlschlägt:
   - Fehlermeldung sorgfältig lesen
   - Probleme im XML beheben
   - Validierung erneut ausführen
4. **Erst bei bestandener Validierung fortfahren**
5. Rebuild: `python ooxml/scripts/pack.py unpacked_dir/ output.docx`
6. Output-Dokument testen
```

### Beispiel: Ohne Skript

```markdown
## Content-Review Prozess

1. Inhalt gemäß STYLE_GUIDE.md entwerfen
2. Gegen Checkliste prüfen:
   - Terminologie-Konsistenz
   - Beispiele folgen Standardformat
   - Alle Pflichtabschnitte vorhanden
3. Falls Probleme gefunden:
   - Jedes Problem mit Abschnitt-Referenz notieren
   - Inhalt überarbeiten
   - Checkliste erneut prüfen
4. Erst bei erfüllten Anforderungen fortfahren
5. Finalisieren und speichern
```

---

## Pattern 4: Conditional Workflow Pattern

### Problem
Verschiedene Inputs erfordern verschiedene Verarbeitungspfade.

### Lösung
Klare Entscheidungspunkte definieren, die den Agent in den richtigen Pfad leiten.

### Beispiel

```markdown
## Dokument-Modifikation

1. Bestimme den Modifikationstyp:

   **Neuen Inhalt erstellen?** → "Erstellungs-Workflow" unten
   **Bestehenden Inhalt bearbeiten?** → "Bearbeitungs-Workflow" unten

2. Erstellungs-Workflow:
   - docx-js Bibliothek verwenden
   - Dokument von Grund auf erstellen
   - In .docx exportieren

3. Bearbeitungs-Workflow:
   - Bestehendes Dokument entpacken
   - XML direkt modifizieren
   - Nach jeder Änderung validieren
   - Bei Abschluss neu packen
```

### Variante: Domain-basiertes Routing

```markdown
## BigQuery Datenanalyse

Bestimme den Datenbereich und lese die relevante Referenz:

**Finanzen**: Umsatz, ARR, Billing → Siehe [reference/finance.md]
**Sales**: Opportunities, Pipeline → Siehe [reference/sales.md]
**Produkt**: API-Nutzung, Features → Siehe [reference/product.md]
**Marketing**: Kampagnen, Attribution → Siehe [reference/marketing.md]
```

---

## Pattern 5: Examples Pattern (Input/Output-Paare)

### Problem
Die gewünschte Output-Qualität und der Stil sind schwer nur durch Beschreibung zu vermitteln.

### Lösung
Konkrete Input/Output-Beispiele bereitstellen — wie Few-Shot-Prompting, aber persistent.

### Beispiel

````markdown
## Commit-Message Format

Generiere Commit-Messages nach diesen Beispielen:

**Beispiel 1:**
Input: Benutzer-Authentifizierung mit JWT Tokens hinzugefügt
Output:
```
feat(auth): implement JWT-based authentication

Add login endpoint and token validation middleware
```

**Beispiel 2:**
Input: Bug behoben, bei dem Daten in Reports falsch angezeigt wurden
Output:
```
fix(reports): correct date formatting in timezone conversion

Use UTC timestamps consistently across report generation
```

Folge diesem Stil: type(scope): kurze Beschreibung,
dann detaillierte Erklärung.
````

---

## Pattern 6: Progressive Reference Pattern

### Problem
Ein Skill hat umfangreiche Referenzmaterialien, aber nur ein Bruchteil ist pro Aufgabe relevant.

### Lösung
SKILL.md als Navigation gestalten, die zu spezifischen Referenz-Dateien verweist.

### Beispiel

````markdown
# SKILL.md — PDF Processing

## Quick Start

```python
import pdfplumber
with pdfplumber.open("file.pdf") as pdf:
    text = pdf.pages[0].extract_text()
```

## Erweiterte Features

**Formular-Ausfüllung**: Siehe [FORMS.md](FORMS.md)
**API-Referenz**: Siehe [REFERENCE.md](REFERENCE.md)
**Beispiele**: Siehe [EXAMPLES.md](EXAMPLES.md)

## Quick Search

Finde spezifische Metriken:

```bash
grep -i "revenue" reference/finance.md
grep -i "pipeline" reference/sales.md
```
````

---

## Pattern 7: Plan-Validate-Execute Pattern

### Problem
Komplexe, destruktive oder batch-artige Operationen bergen das Risiko, Fehler erst nach der Ausführung zu entdecken.

### Lösung
Erst einen Plan als strukturierte Datei erstellen, diesen validieren, und erst dann ausführen.

### Ablauf

```
1. Analysieren  → Ist-Zustand erfassen
2. Plan erstellen → changes.json / migration.yaml
3. Plan validieren → python scripts/validate_plan.py
4. Ausführen    → Nur bei bestandener Validierung
5. Verifizieren → Ergebnis prüfen
```

### Wann verwenden

- **Batch-Operationen**: Viele Dateien gleichzeitig ändern
- **Destruktive Änderungen**: Datenbank-Migrationen, Datei-Löschungen
- **Komplexe Validierungsregeln**: Schema-Migrationen, API-Änderungen
- **High-Stakes-Operationen**: Produktions-Deployments

### Implementierungstipp

Validierungs-Skripte sollen **verbose** sein:
```
✗ "Validierung fehlgeschlagen"
✓ "Feld 'signature_date' nicht gefunden. Verfügbare Felder:
    customer_name, order_total, signature_date_signed"
```

---

## Pattern 8: Visual Output Pattern

### Problem
Bestimmte Informationen werden durch visuelle Darstellung deutlich verständlicher.

### Lösung
Skripte bündeln, die interaktive HTML-Dateien oder visuelle Reports generieren.

### Beispiel-Struktur

```
codebase-visualizer/
├── SKILL.md
└── scripts/
    └── visualize.py    # Generiert codebase-map.html
```

### SKILL.md

````markdown
---
name: codebase-visualizer
description: Generiert eine interaktive Visualisierung der Codebase-Struktur.
  Verwenden bei Codebase-Exploration oder Projektstruktur-Analyse.
allowed-tools: Bash(python *)
---

# Codebase Visualizer

Generiere eine interaktive HTML-Baumansicht:

```bash
python ~/.claude/skills/codebase-visualizer/scripts/visualize.py .
```

Erstellt `codebase-map.html` und öffnet im Browser.
````

### Anwendungsszenarien

- Dependency Graphs
- Test Coverage Reports
- API-Dokumentation
- Datenbank-Schema-Visualisierung
- Git-History-Analyse

---

## Pattern 9: Dynamic Context Injection Pattern

### Problem
Der Skill benötigt aktuelle Daten zur Laufzeit, die erst beim Aufruf verfügbar sind.

### Lösung
Shell-Preprocessing mit `` !`command` `` — Befehle werden vor dem Senden an den Agent ausgeführt und deren Output eingefügt.

### Beispiel

````yaml
---
name: pr-summary
description: Fasst Änderungen in einem Pull Request zusammen
context: fork
agent: Explore
allowed-tools: Bash(gh *)
---

## Pull Request Kontext
- PR Diff: !`gh pr diff`
- PR Kommentare: !`gh pr view --comments`
- Geänderte Dateien: !`gh pr diff --name-only`

## Deine Aufgabe
Fasse diesen Pull Request zusammen...
````

### Multi-Line Variante

````markdown
## Umgebung
```!
node --version
npm --version
git status --short
```
````

### Wichtig
Dies ist **Preprocessing**, nicht etwas, das der Agent ausführt. Der Agent sieht nur das finale Ergebnis mit eingefügten Daten.

---

## Pattern 10: Subagent-Delegation Pattern

### Problem
Ein Skill muss aufwendige Aufgaben ausführen, die den Hauptkontext nicht belasten sollen.

### Lösung
`context: fork` nutzen, um den Skill in einem isolierten Subagent auszuführen.

### Beispiel

```yaml
---
name: deep-research
description: Recherchiert ein Thema gründlich in der Codebase
context: fork
agent: Explore
---

Recherchiere $ARGUMENTS gründlich:

1. Finde relevante Dateien mit Glob und Grep
2. Lese und analysiere den Code
3. Fasse Ergebnisse mit spezifischen Datei-Referenzen zusammen
```

### Entscheidungshilfe: Inline vs. Fork

| Aspekt | Inline (Standard) | Fork (`context: fork`) |
|--------|-------------------|----------------------|
| Konversationszugriff | Ja | Nein |
| Token-Isolation | Nein | Ja |
| Parallele Ausführung | Nein | Möglich |
| Geeignet für | Reference Content | Task-orientierte Skills |
| CLAUDE.md | Bereits geladen | Wird geladen |

---

## Pattern-Komposition

### Patterns können kombiniert werden

Beispiel: **Workflow + Feedback-Loop + Template**

```markdown
## Code-Review Skill

### Workflow

```
Fortschritt:
- [ ] Code lesen und verstehen
- [ ] Review nach Template durchführen
- [ ] Feedback validieren
- [ ] Finalen Review-Kommentar erstellen
```

### Review-Template

```markdown
## Review: [Dateiname]

### Sicherheit
[Findings]

### Performance
[Findings]

### Lesbarkeit
[Findings]
```

### Validierung

Prüfe nach jedem Review:
- Alle Abschnitte ausgefüllt?
- Konkrete Code-Referenzen enthalten?
- Umsetzbare Empfehlungen formuliert?

Falls nicht → überarbeiten und erneut prüfen.
```

---

## Pattern-Auswahlhilfe

| Anforderung | Empfohlenes Pattern |
|------------|-------------------|
| Konsistenter Output | Template Pattern |
| Mehrstufiger Prozess | Workflow Pattern |
| Qualitätssicherung | Feedback-Loop Pattern |
| Verschiedene Inputs | Conditional Workflow |
| Stil vermitteln | Examples Pattern |
| Viel Referenzmaterial | Progressive Reference |
| Risikoreiche Operationen | Plan-Validate-Execute |
| Visuelle Darstellung | Visual Output Pattern |
| Live-Daten benötigt | Dynamic Context Injection |
| Aufwendige Aufgaben | Subagent-Delegation |
