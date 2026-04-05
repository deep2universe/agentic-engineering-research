# 06 — Skills planen und erstellen

## Überblick

Dieses Kapitel beschreibt die Methodik, um Skills systematisch zu planen, zu erstellen und iterativ zu verbessern. Der Schlüssel liegt in **Evaluation-Driven Development** — erst die Lücken identifizieren, dann den minimalen Skill schreiben.

---

## Phase 1: Bedarfsanalyse

### Schritt 1: Wiederkehrende Muster identifizieren

Beobachte deine Arbeit mit dem Agent:
- Welche Anweisungen gibst du **wiederholt**?
- Welches **Kontextwissen** stellst du immer wieder bereit?
- Welche **Workflows** folgen immer dem gleichen Muster?
- Wo macht der Agent **systematische Fehler**?

### Schritt 2: Skill-Kandidaten bewerten

| Kriterium | Guter Skill-Kandidat | Kein Skill nötig |
|-----------|---------------------|------------------|
| Häufigkeit | Wiederkehrend | Einmalig |
| Komplexität | Mehrere Schritte / Spezialwissen | Trivial |
| Konsistenz | Gleiches Format/Prozess erwartet | Flexibel |
| Teamrelevanz | Mehrere Personen betroffen | Nur persönlich |
| Fehleranfälligkeit | Agent macht häufig Fehler | Agent kann es gut |

### Schritt 3: Skill-Typ bestimmen

```
Ist es Wissen, das der Agent anwenden soll?
├── Ja → Reference Content Skill
│         (Konventionen, API-Docs, Domain Knowledge)
│
Ist es ein Prozess mit definierten Schritten?
├── Ja → Task Content Skill
│         (Deploy, Migration, Release)
│
Ist es eine technische Fähigkeit?
├── Ja → Capability Extension Skill
│         (Visualisierung, Validierung, Generierung)
```

---

## Phase 2: Evaluation-Driven Development

> "Create evaluations BEFORE writing extensive documentation. This ensures your Skill solves real problems rather than documenting imagined ones."
> — Anthropic, Skill Authoring Best Practices

### Schritt 1: Lücken identifizieren

Führe den Agent **ohne Skill** durch repräsentative Aufgaben. Dokumentiere:
- Wo fehlt dem Agent Kontext?
- Wo weicht der Output vom gewünschten Format ab?
- Welche Schritte überspringt er?
- Wo generiert er fehlerhaften Code?

### Schritt 2: Evaluierungen erstellen

Erstelle mindestens **3 Test-Szenarien**:

```json
{
  "skills": ["pdf-processing"],
  "query": "Extrahiere allen Text aus dieser PDF und speichere in output.txt",
  "files": ["test-files/document.pdf"],
  "expected_behavior": [
    "Liest PDF erfolgreich mit passender Bibliothek",
    "Extrahiert Text von allen Seiten ohne Auslassungen",
    "Speichert Text in output.txt in lesbarem Format"
  ]
}
```

### Schritt 3: Baseline messen

Wie performt der Agent **ohne** den Skill? Dies ist die Vergleichsbasis.

### Schritt 4: Minimalen Skill schreiben

Nur so viel Content wie nötig, um die identifizierten Lücken zu schließen.

### Schritt 5: Iterieren

Evaluierungen ausführen → mit Baseline vergleichen → verfeinern.

---

## Phase 3: Skill-Erstellung

### Der Claude-A/Claude-B Workflow

Der effektivste Skill-Entwicklungsprozess nutzt zwei Claude-Instanzen:

```
┌───────────────┐                    ┌───────────────┐
│   Claude A    │                    │   Claude B    │
│ (Skill-       │ ◄── Feedback ───  │ (Skill-       │
│  Designer)    │                    │  Nutzer)      │
│               │ ─── Skill ──────► │               │
│ Erstellt und  │                    │ Testet Skill  │
│ verfeinert    │                    │ in echten     │
│ den Skill     │                    │ Aufgaben      │
└───────────────┘                    └───────────────┘
        ▲                                    │
        │                                    │
        └──── Du (Domänenexperte) ───────────┘
              beobachtest und steuerst
```

### Schritt-für-Schritt

1. **Aufgabe ohne Skill durcharbeiten** — Arbeite mit Claude A durch ein Problem. Beobachte, welchen Kontext du bereitstellst.

2. **Wiederverwendbares Muster identifizieren** — Was von dem bereitgestellten Kontext wäre für ähnliche Aufgaben nützlich?

3. **Claude A bitten, den Skill zu erstellen** — "Erstelle einen Skill, der dieses Analyse-Pattern erfasst. Inkludiere die Tabellen-Schemas und die Filterregel für Test-Accounts."

4. **Auf Prägnanz prüfen** — "Entferne die Erklärung was Win Rate bedeutet — Claude weiß das bereits."

5. **Informationsarchitektur verbessern** — "Organisiere den Content so, dass das Tabellen-Schema in einer separaten Referenz-Datei ist."

6. **Mit Claude B testen** — Eine frische Instanz mit geladenem Skill auf ähnliche Aufgaben ansetzen.

7. **Basierend auf Beobachtung iterieren** — "Claude B hat vergessen, nach Datum zu filtern. Sollen wir einen Abschnitt über Datums-Patterns hinzufügen?"

---

## Phase 4: Naming und Description

### Naming-Konventionen

**Empfohlen: Gerundium-Form** (Verb + -ing)
```
✓ processing-pdfs
✓ analyzing-spreadsheets
✓ managing-databases
✓ testing-code
✓ writing-documentation
```

**Akzeptabel: Nomen oder Aktions-orientiert**
```
✓ pdf-processing
✓ process-pdfs
```

**Vermeiden:**
```
✗ helper, utils, tools         (zu vage)
✗ documents, data, files       (zu generisch)
✗ anthropic-helper             (reserviertes Wort)
```

### Description-Checkliste

- [ ] In dritter Person geschrieben
- [ ] Enthält was der Skill tut
- [ ] Enthält wann er verwendet werden soll
- [ ] Schlüsselbegriffe für Aktivierung enthalten
- [ ] Kern-Use-Case in den ersten 250 Zeichen
- [ ] Keine XML-Tags

---

## Phase 5: Strukturierung

### Entscheidungsbaum

```
Skill-Inhalt < 100 Zeilen?
├── Ja → Alles in SKILL.md
│
├── Nein → Inhalt < 500 Zeilen?
│          ├── Ja → SKILL.md + wenige Referenz-Dateien
│          │
│          └── Nein → Progressive Reference Pattern
│                     SKILL.md als Navigations-Hub
│                     Referenzen in separaten Dateien
│                     Domain-basierte Organisation
│
Gibt es ausführbare Operationen?
├── Ja → Skripte in scripts/ bündeln
│
Gibt es Output-Formate?
├── Ja → Templates in templates/ bündeln
```

### Referenzdateien strukturieren

Für Dateien > 100 Zeilen: **Inhaltsverzeichnis** am Anfang:

```markdown
# API Reference

## Contents
- Authentifizierung und Setup
- Kern-Methoden (Create, Read, Update, Delete)
- Erweiterte Features (Batch, Webhooks)
- Error Handling Patterns
- Code-Beispiele

## Authentifizierung und Setup
...
```

---

## Phase 6: Testen

### Test-Dimensionen

| Dimension | Was testen |
|-----------|-----------|
| **Discovery** | Wird der Skill bei relevanten Anfragen aktiviert? |
| **Accuracy** | Befolgt der Agent die Anweisungen korrekt? |
| **Completeness** | Werden alle Schritte durchgeführt? |
| **Model-Kompatibilität** | Funktioniert mit Haiku, Sonnet UND Opus? |
| **Edge Cases** | Wie verhält sich der Skill bei unerwarteten Inputs? |
| **False Positives** | Wird der Skill aktiviert, wenn er NICHT relevant ist? |

### Test-Workflow

```
1. Discovery-Test
   "Erkläre mir diesen Code" → Aktiviert explain-code?

2. Direkter Invocation-Test
   "/explain-code src/auth/login.ts" → Korrekte Ausführung?

3. Negativ-Test
   "Schreibe eine Funktion" → Aktiviert NICHT explain-code?

4. Cross-Model-Test
   Gleiche Tests mit Haiku, Sonnet, Opus
```

### Beobachtungspunkte

Beim Testen auf folgendes achten:
- **Unerwartete Explorationspfade** — Liest der Agent Dateien in unerwarteter Reihenfolge?
- **Verpasste Verbindungen** — Folgt er Referenzen zu wichtigen Dateien?
- **Übernutzung** — Liest er dieselbe Datei wiederholt? → Content nach SKILL.md verschieben
- **Ignorierter Content** — Greift er nie auf eine Datei zu? → Unnötig oder schlecht signalisiert

---

## Phase 7: Iteration und Teamfeedback

### Iterationszyklus

```
Beobachten → Analysieren → Anpassen → Testen → Wiederholen

1. Skill in echten Workflows verwenden (nicht Test-Szenarien!)
2. Verhalten des Agents beobachten
3. Beobachtungen an Claude A zurückgeben
4. Claude A's Vorschläge reviewen
5. Änderungen anwenden und erneut testen
```

### Team-Feedback sammeln

- Wird der Skill aktiviert, wenn erwartet?
- Sind die Anweisungen klar?
- Was fehlt?
- Welche Blind Spots hat die eigene Nutzung?

---

## Checkliste: Vor dem Teilen

### Kern-Qualität
- [ ] Description ist spezifisch und enthält Schlüsselbegriffe
- [ ] Description enthält Was und Wann
- [ ] SKILL.md Body unter 500 Zeilen
- [ ] Zusätzliche Details in separaten Dateien
- [ ] Keine zeitabhängigen Informationen
- [ ] Konsistente Terminologie
- [ ] Beispiele sind konkret, nicht abstrakt
- [ ] Datei-Referenzen maximal eine Ebene tief
- [ ] Progressive Disclosure angemessen eingesetzt
- [ ] Workflows mit klaren Schritten

### Code und Skripte
- [ ] Skripte behandeln Fehler, statt sie zu delegieren
- [ ] Keine "Voodoo Constants"
- [ ] Benötigte Pakete in Anweisungen aufgelistet
- [ ] Skripte dokumentiert
- [ ] Keine Windows-Pfade (nur Forward-Slashes)
- [ ] Validierungs-/Verifikationsschritte für kritische Operationen
- [ ] Feedback-Loops für qualitätskritische Aufgaben

### Testing
- [ ] Mindestens 3 Evaluierungen erstellt
- [ ] Mit Haiku, Sonnet und Opus getestet
- [ ] Mit echten Nutzungsszenarien getestet
- [ ] Team-Feedback eingeholt (falls zutreffend)
