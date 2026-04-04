# 03 — Workflow Patterns

## Überblick

Anthropic hat fünf fundamentale Workflow-Patterns identifiziert, die als Bausteine für komplexere Agent-Systeme dienen. Diese Patterns sind *komponierbar* — sie können einzeln oder in Kombination eingesetzt werden.

---

## Pattern 1: Prompt Chaining

### Beschreibung
Sequentielle Verarbeitung, bei der jeder Schritt auf dem vorherigen aufbaut. Die Aufgabe wird in eine Kette von LLM-Calls aufgeteilt, wobei der Output eines Schritts zum Input des nächsten wird.

### Wann einsetzen
- Aufgaben mit klar definierter Sequenz: Generieren → Validieren → Verfeinern → Formatieren
- Wenn jeder Schritt eine andere Kompetenz erfordert
- Wenn Zwischenergebnisse validiert werden sollen

### Architektur
```
Input → [LLM Step 1] → Gate/Validation → [LLM Step 2] → Gate → [LLM Step 3] → Output
```

### Implementierungsdetails
- **Gates** zwischen Schritten ermöglichen Validierung und Fehlererkennung
- Jeder Schritt hat einen eigenen, spezialisierten Prompt
- Der Kontext kann zwischen Schritten gefiltert/angereichert werden
- Fehler in einem Schritt können den gesamten Chain abbrechen oder zu einem Retry führen

### Beispiel
```
1. Dokument analysieren → Zusammenfassung erstellen
2. Zusammenfassung validieren → Faktencheck
3. Validierte Zusammenfassung → Formatierung für Zielgruppe
```

### Trade-offs
- **Pro**: Einfach zu debuggen, jeder Schritt isoliert testbar
- **Contra**: Höhere Latenz durch sequentielle Verarbeitung, Fehler propagieren durch die Kette

---

## Pattern 2: Routing

### Beschreibung
Intelligente Klassifikation und Weiterleitung von Anfragen an spezialisierte Handler. Ein Router analysiert den Input und entscheidet, welcher spezialisierte Agent oder Workflow die Aufgabe bearbeiten soll.

### Wann einsetzen
- Verschiedene Input-Typen erfordern verschiedene Verarbeitungspfade
- Komplexitätsbasierte Steuerung (einfach → kleines Modell, komplex → großes Modell)
- Themenbasierte Spezialisierung

### Architektur
```
              ┌→ [Handler A: Einfache Fragen]
Input → [Router] ─┼→ [Handler B: Technische Analyse]
              └→ [Handler C: Kreative Aufgaben]
```

### Implementierungsdetails
- **LLM-basiertes Routing**: Der Router ist selbst ein LLM-Call mit Classification-Prompt
- **Rule-basiertes Routing**: Keyword-Matching, Regex, Embeddings-Similarity
- **Hybrid**: Kombination aus Rules und LLM für Grenzfälle
- **Cost-Routing**: Einfache/häufige Fragen → Haiku/kleines Modell, schwierige/seltene → Opus/großes Modell

### Beispiel: Kostenoptimierung
```
Input → [Classifier LLM]
  ├─ Einfach (80%) → Claude Haiku (günstig, schnell)
  ├─ Mittel (15%)  → Claude Sonnet (balanciert)
  └─ Komplex (5%)  → Claude Opus (leistungsstark)
```

### Trade-offs
- **Pro**: Kostenoptimierung, Spezialisierung, Skalierbarkeit
- **Contra**: Routing-Fehler können die gesamte Verarbeitung fehlleiten

---

## Pattern 3: Parallelisierung

### Beschreibung
Gleichzeitige Ausführung mehrerer unabhängiger Teilaufgaben. Tritt in zwei Varianten auf:

**Sectioning**: Die Aufgabe wird in unabhängige Teilaufgaben zerlegt, die parallel bearbeitet werden.

**Voting**: Dieselbe Aufgabe wird mehrfach parallel ausgeführt, um diverse Outputs zu erhalten.

### Wann einsetzen
- Unabhängige Teilaufgaben, die keinen gemeinsamen State teilen
- Latenz-Reduktion bei umfangreichen Aufgaben
- Erhöhung der Zuverlässigkeit durch Redundanz (Voting)

### Architektur: Sectioning
```
         ┌→ [Agent A: Aspekt 1] ──┐
Input ──→├→ [Agent B: Aspekt 2] ──┼→ [Aggregator] → Output
         └→ [Agent C: Aspekt 3] ──┘
```

### Architektur: Voting
```
         ┌→ [LLM Call 1] ──┐
Input ──→├→ [LLM Call 2] ──┼→ [Majority Vote / Best-of-N] → Output
         └→ [LLM Call 3] ──┘
```

### Implementierungsdetails
- **Sectioning**: Aufgabe in unabhängige Chunks aufteilen, parallel verarbeiten, Ergebnisse aggregieren
- **Voting**: N-fache Ausführung mit Temperatur-Variationen, Konsens-Bildung
- **Map-Reduce**: Große Datenmengen auf viele Agents verteilen, Ergebnisse zusammenführen
- Timeout-Handling für langsame parallele Pfade

### Trade-offs
- **Pro**: Deutliche Latenz-Reduktion, höhere Zuverlässigkeit bei Voting
- **Contra**: Höhere Kosten (mehr Token), Aggregations-Logik kann komplex werden

---

## Pattern 4: Orchestrator-Worker

### Beschreibung
Ein zentraler Orchestrator-Agent zerlegt Aufgaben dynamisch, delegiert sie an Worker-Agents und synthetisiert die Ergebnisse. Der entscheidende Unterschied zur Parallelisierung: Die Teilaufgaben sind *nicht vordefiniert*, sondern werden vom Orchestrator *basierend auf dem Input* bestimmt.

### Wann einsetzen
- Komplexe Aufgaben, die flexible Zerlegung erfordern
- Aufgaben, bei denen die Teilschritte vorher nicht bekannt sind
- Wenn verschiedene Spezialisten-Agents koordiniert werden müssen

### Architektur
```
                    ┌→ [Worker A] ──┐
Input → [Orchestrator] ─┼→ [Worker B] ──┼→ [Orchestrator: Synthese] → Output
                    └→ [Worker C] ──┘
         (Plant dynamisch)        (Sammelt Ergebnisse)
```

### Implementierungsdetails
- Der Orchestrator erhält die Gesamtaufgabe und erstellt einen Plan
- Worker-Agents werden dynamisch mit spezifischen Sub-Tasks beauftragt
- Der Orchestrator überwacht den Fortschritt und passt den Plan an
- Ergebnisse werden vom Orchestrator zu einer kohärenten Antwort synthetisiert
- Der Orchestrator kann iterieren: Wenn Worker-Ergebnisse unzureichend sind, werden zusätzliche Tasks erstellt

### Beispiel: Code-Refactoring
```
Orchestrator erhält: "Refactore das Authentication-Modul"
→ Plant: 1. Aktuellen Code analysieren
         2. Abhängigkeiten identifizieren
         3. Interface-Design erstellen
         4. Implementierung in 3 Dateien aufteilen
         5. Tests aktualisieren
→ Delegiert jeden Schritt an spezialisierte Worker
→ Synthetisiert die Ergebnisse
```

### Trade-offs
- **Pro**: Hohe Flexibilität, dynamische Anpassung, Skalierbarkeit
- **Contra**: Höhere Komplexität, Orchestrator als Single Point of Failure, höhere Token-Kosten

---

## Pattern 5: Evaluator-Optimizer

### Beschreibung
Ein LLM generiert eine Antwort, ein zweites LLM evaluiert und gibt Feedback. Dieser Zyklus wiederholt sich, bis die Qualitätskriterien erfüllt sind.

### Wann einsetzen
- Aufgaben, bei denen iterative Verbesserung zu signifikant besseren Ergebnissen führt
- Wenn klare Qualitätskriterien definiert werden können
- Code-Generierung, kreatives Schreiben, Übersetzungen

### Architektur
```
Input → [Generator LLM] → Output Draft
              ↑                    │
              │                    ▼
         [Revision]      [Evaluator LLM]
              ↑                    │
              └─── Feedback ───────┘
              
         Wiederholung bis Qualität ≥ Schwellwert
```

### Implementierungsdetails
- **Generator**: Erstellt den initialen Output
- **Evaluator**: Bewertet nach definierten Kriterien (Korrektheit, Vollständigkeit, Stil)
- **Feedback-Format**: Strukturiertes Feedback mit konkreten Verbesserungsvorschlägen
- **Abbruchbedingung**: Maximale Iterationen ODER Qualitätsschwellwert erreicht
- **Verschiedene Modelle** möglich: Starkes Modell als Evaluator, effizientes als Generator

### Beispiel: Code Review Cycle
```
1. Generator: Erstellt Funktion
2. Evaluator: "Fehler in Zeile 5: Off-by-one. Keine Error-Handling."
3. Generator: Überarbeitet basierend auf Feedback
4. Evaluator: "Korrekt. Edge-Case für leeren Input fehlt."
5. Generator: Fügt Edge-Case hinzu
6. Evaluator: "Alle Kriterien erfüllt." → Done
```

### Trade-offs
- **Pro**: Höhere Qualität durch iterative Verbesserung, klare Qualitätssicherung
- **Contra**: Höhere Latenz und Kosten durch mehrere Iterationen, Risiko endloser Schleifen
