# 03 — Anatomie eines Skills

## Überblick

Dieses Kapitel zerlegt einen Skill in seine Bestandteile und erklärt, wie jede Komponente funktioniert und warum sie existiert.

---

## Die SKILL.md-Datei

### Grundstruktur

```yaml
---
# === YAML Frontmatter (Metadaten) ===
name: pdf-processing
description: Extrahiert Text und Tabellen aus PDF-Dateien, füllt Formulare aus,
  führt Dokumente zusammen. Verwenden bei PDF-Aufgaben oder wenn PDFs,
  Formulare oder Dokumentenextraktion erwähnt werden.
---

# === Markdown Body (Anweisungen) ===

# PDF Processing

## Quick Start

Verwende pdfplumber für Text-Extraktion:

```python
import pdfplumber

with pdfplumber.open("file.pdf") as pdf:
    text = pdf.pages[0].extract_text()
```

## Erweiterte Features

**Formular-Ausfüllung**: Siehe [FORMS.md](FORMS.md) für vollständigen Guide
**API-Referenz**: Siehe [REFERENCE.md](REFERENCE.md) für alle Methoden
```

### Anatomie des Frontmatter

```yaml
---
name: deploy-production          # Identifikator → wird zu /deploy-production
description: >                   # Multi-Line YAML String
  Deploys der Anwendung in die Produktionsumgebung.
  Führt Tests, Build und Push durch.
  Verwenden bei Deployment-Anfragen.
disable-model-invocation: true   # Nur manuell aufrufbar
context: fork                    # Läuft in isoliertem Subagent
agent: general-purpose           # Subagent-Typ
allowed-tools: Bash(git *) Read  # Erlaubte Tools
effort: high                     # Reasoning-Intensität
---
```

---

## Verzeichnisstruktur

### Minimaler Skill

```
my-skill/
└── SKILL.md        # Einzige Pflichtdatei
```

### Standard-Skill

```
my-skill/
├── SKILL.md           # Hauptanweisungen (Pflicht)
├── reference.md       # Detaillierte API-Dokumentation
├── examples.md        # Verwendungsbeispiele
└── templates/
    └── output.md      # Output-Template
```

### Komplexer Skill mit Skripten

```
codebase-visualizer/
├── SKILL.md              # Übersicht und Navigation
├── REFERENCE.md          # Vollständige API-Referenz
├── FORMS.md              # Spezifischer Guide (Formulare)
├── examples/
│   ├── basic.md          # Grundlegende Beispiele
│   └── advanced.md       # Fortgeschrittene Beispiele
├── scripts/
│   ├── visualize.py      # Haupt-Skript
│   ├── validate.py       # Validierungs-Skript
│   └── analyze.py        # Analyse-Skript
└── templates/
    └── report.html       # HTML-Report-Template
```

### Domain-organisierter Skill

```
bigquery-analysis/
├── SKILL.md              # Übersicht und Navigation
└── reference/
    ├── finance.md        # Umsatz, Billing-Metriken
    ├── sales.md          # Opportunities, Pipeline
    ├── product.md        # API-Nutzung, Features
    └── marketing.md      # Kampagnen, Attribution
```

---

## Der Skill-Lebenszyklus

### Phase 1: Discovery (Session-Start)

```
┌─────────────────────────────────────┐
│ Agent startet Session               │
│                                     │
│ Liest YAML Frontmatter aller Skills │
│ (nur name + description)            │
│ → ~100 Token pro Skill              │
│                                     │
│ Ergebnis: Agent weiß, welche Skills │
│ existieren und wann sie relevant    │
│ sein könnten                        │
└─────────────────────────────────────┘
```

### Phase 2: Activation (Bei Relevanz)

```
┌─────────────────────────────────────┐
│ User-Anfrage matcht Beschreibung    │
│ ODER User ruft /skill-name auf     │
│                                     │
│ Agent liest SKILL.md Body           │
│ → Typisch <5.000 Token             │
│                                     │
│ Ergebnis: Agent hat vollständige    │
│ Anweisungen im Kontext             │
└─────────────────────────────────────┘
```

### Phase 3: Execution (Bei Bedarf)

```
┌─────────────────────────────────────┐
│ Agent führt Skill-Anweisungen aus   │
│                                     │
│ Bei Bedarf:                         │
│ ├── Liest Referenz-Dateien          │
│ ├── Führt Skripte aus               │
│ ├── Nutzt Templates                 │
│ └── Ruft erlaubte Tools auf         │
│                                     │
│ Ergebnis: Aufgabe erledigt          │
└─────────────────────────────────────┘
```

### Phase 4: Return (Ergebnis)

```
┌─────────────────────────────────────┐
│ Bei context: fork                   │
│ → Ergebnis wird an Hauptkontext     │
│   zurückgemeldet und zusammengefasst│
│                                     │
│ Bei inline Execution                │
│ → Ergebnis ist direkt im           │
│   Konversationskontext sichtbar     │
└─────────────────────────────────────┘
```

---

## Content-Typen und ihre Rolle

### Typ 1: Instructions (Anweisungen)

**Was**: Markdown-Text mit Workflow-Beschreibungen, Regeln, Konventionen
**Wann geladen**: Level 1 (Beschreibung) immer, Level 2 (Body) bei Aktivierung
**Token-Kosten**: Direkte Kosten im Context Window
**Stärke**: Flexibel, der Agent kann adaptieren

```markdown
## Code-Review Prozess

1. Analysiere die Code-Struktur und Organisation
2. Prüfe auf potenzielle Bugs oder Edge Cases
3. Schlage Verbesserungen für Lesbarkeit vor
4. Überprüfe Einhaltung der Projektkonventionen
```

### Typ 2: Code (Ausführbare Skripte)

**Was**: Python, Shell, JavaScript etc. — Skripte die Claude ausführt
**Wann geladen**: Nur bei Ausführung via Bash
**Token-Kosten**: Nur der Output verbraucht Token, nicht der Code
**Stärke**: Deterministisch, zuverlässig, token-effizient

```python
# scripts/validate.py — wird ausgeführt, nicht in Kontext geladen
def validate_form(json_path):
    with open(json_path) as f:
        data = json.load(f)
    errors = []
    for field in data:
        if not field.get("value"):
            errors.append(f"Feld '{field['name']}' hat keinen Wert")
    return errors
```

### Typ 3: Resources (Referenzmaterial)

**Was**: Datenbank-Schemas, API-Docs, Templates, Beispieldaten
**Wann geladen**: Nur bei expliziter Referenzierung
**Token-Kosten**: Nur wenn tatsächlich gelesen
**Stärke**: Keine Kontext-Strafe für gebündeltes Material

```text
reference/
├── schema.sql       # Datenbank-Schema
├── api_spec.yaml    # OpenAPI-Spezifikation
└── sample_data.json # Beispieldaten
```

### Token-Effizienz nach Typ

| Level | Wann geladen | Token-Kosten | Inhalt |
|-------|-------------|-------------|--------|
| **Level 1: Metadaten** | Immer (bei Start) | ~100 Token/Skill | `name` + `description` aus YAML |
| **Level 2: Anweisungen** | Bei Skill-Aktivierung | <5k Token | SKILL.md Body |
| **Level 3+: Ressourcen** | Bei Bedarf | Effektiv unbegrenzt | Gebündelte Dateien, via Bash gelesen/ausgeführt |

---

## Invocation-Modell

### Wer kann einen Skill aufrufen?

| Frontmatter | User kann aufrufen | Agent kann aufrufen | Kontextladung |
|-------------|-------------------|--------------------|--------------| 
| (Standard) | Ja | Ja | Beschreibung immer, Body bei Invocation |
| `disable-model-invocation: true` | Ja | Nein | Beschreibung nicht im Kontext |
| `user-invocable: false` | Nein | Ja | Beschreibung immer im Kontext |

### Entscheidungshilfe

```
Soll der User den Skill manuell aufrufen?
├── Ja → Soll der Agent ihn auch automatisch nutzen?
│         ├── Ja → Standard (keine Flags)
│         └── Nein → disable-model-invocation: true
└── Nein → Ist es Hintergrundwissen für den Agent?
            └── Ja → user-invocable: false
```

**Faustregel:**
- **Side Effects** (Deploy, Commit, Slack-Nachricht) → `disable-model-invocation: true`
- **Hintergrundwissen** (Legacy-System-Kontext) → `user-invocable: false`
- **Allgemein nützlich** (Code-Erklärung, Review) → Standard

---

## Execution-Kontexte

### Inline Execution (Standard)

Der Skill wird im Hauptkontext der Konversation ausgeführt. Er hat Zugriff auf:
- Konversationshistorie
- Alle im Kontext geladenen Informationen
- Session-State

**Geeignet für**: Reference Content, Konventionen, Wissens-Skills

### Fork Execution (`context: fork`)

Der Skill wird in einem isolierten Subagent-Kontext ausgeführt:
- Kein Zugriff auf Konversationshistorie
- Eigenes Context Window
- Ergebnis wird zusammengefasst zurückgegeben
- CLAUDE.md wird geladen

**Geeignet für**: Task-Skills mit klaren Anweisungen, parallele Ausführung

```yaml
---
name: deep-research
description: Recherchiert ein Thema gründlich
context: fork
agent: Explore
---

Recherchiere $ARGUMENTS gründlich:
1. Finde relevante Dateien mit Glob und Grep
2. Lese und analysiere den Code
3. Fasse Ergebnisse mit spezifischen Datei-Referenzen zusammen
```

---

## Zusammenfassung

Ein Skill ist mehr als nur eine Markdown-Datei — er ist ein durchdachtes System aus:

1. **Metadaten** für Discovery und Routing
2. **Anweisungen** für prozedurales Wissen
3. **Ressourcen** für Referenzmaterial
4. **Skripten** für deterministische Operationen
5. **Konfiguration** für Execution-Kontext und Berechtigungen

Das Zusammenspiel dieser Komponenten über den Lebenszyklus (Discovery → Activation → Execution → Return) ermöglicht token-effiziente, modulare und wiederverwendbare Agent-Capabilities.
