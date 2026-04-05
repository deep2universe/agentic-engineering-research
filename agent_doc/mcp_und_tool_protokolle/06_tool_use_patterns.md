# Tool Use Patterns: Sequential, Parallel, Nested Tool Calls

## Überblick

Tool Use Patterns beschreiben, wie LLM-Agenten Tools in verschiedenen Ausführungsmodellen aufrufen. Die Wahl des Patterns beeinflusst Latenz, Zuverlässigkeit und Komplexität eines agentic Workflows.

## 1. Sequential Tool Calls (Sequenzielle Aufrufe)

### Beschreibung
Tools werden **nacheinander** ausgeführt, wobei jedes Tool auf das Ergebnis des vorherigen angewiesen ist.

### Ablauf
```
Tool A → Ergebnis A → Tool B (nutzt Ergebnis A) → Ergebnis B → Tool C ...
```

### Beispiel
```
1. search_users("Max Müller")     → user_id: 42
2. get_user_details(user_id: 42)  → email, role, etc.
3. send_email(to: email, ...)     → Bestätigung
```

### Eigenschaften
- Jeder Schritt hängt vom vorherigen ab
- **Additive Latenz**: Gesamtzeit = Summe aller Tool-Ausführungszeiten
- Wenn ein Tool fehlschlägt, bricht die gesamte Kette ab
- Timeout-Risiko: Einzelne Timeouts oder kumulative Chain-Timeouts können die Session beenden

### Best Practices
- Tool-Outputs sollten genügend Kontext für Folge-Tools liefern (IDs, Metadata, Status)
- Explizite Fehlerbehandlung zwischen den Schritten
- Timeout-Budgets pro Schritt und für die Gesamtkette planen

## 2. Parallel Tool Calls (Parallele Aufrufe)

### Beschreibung
Mehrere **unabhängige** Tools werden gleichzeitig ausgeführt. Die Ergebnisse werden gesammelt und gemeinsam verarbeitet.

### Ablauf
```
         ┌→ Tool A → Ergebnis A ─┐
Anfrage ─┼→ Tool B → Ergebnis B ─┼→ Zusammenführung → Antwort
         └→ Tool C → Ergebnis C ─┘
```

### Beispiel
```
Parallel:
  - get_weather("Berlin")
  - get_weather("München")
  - get_weather("Hamburg")
→ Zusammenfassung aller drei Wetterdaten
```

### Eigenschaften
- **Reduzierte Gesamtlatenz**: Zeit = Max(Tool A, Tool B, Tool C) statt Summe
- Nur möglich, wenn Tools **keine Abhängigkeiten** untereinander haben
- Asyncio/Concurrent-Execution auf Framework-Ebene

### Technische Umsetzung
- In MCP-kompatiblen Frameworks (z. B. Google ADK): `asyncio` für parallele Ausführung
- Bei Claude Code: Mehrere Tool Calls in einer **einzelnen** Assistant-Message für echte Parallelität
- Kritische Regel: Alle parallelen Task-Aufrufe **müssen** in einer einzigen Nachricht stehen

### Best Practices
- Nur unabhängige Tools parallel ausführen
- Ergebnisse erst zusammenführen, wenn alle vorliegen
- Fehler-Handling: Entscheiden, ob ein Fehler in einem Tool die anderen abbricht oder nicht

## 3. Nested / Iterative Tool Calls (Verschachtelte Aufrufe)

### Beschreibung
Tools rufen indirekt weitere Tools auf, oder ein Agent delegiert Aufgaben an Sub-Agenten, die eigene Tool-Aufrufe durchführen.

### Varianten

#### a) Iteratives Pattern (ReAct Loop)
```
Reasoning → Action (Tool Call) → Observation → Reasoning → Action → ...
```

Das **ReAct-Pattern** (Reasoning + Acting) ist das am weitesten verbreitete Pattern:
1. LLM analysiert die Aufgabe (**Reason**)
2. LLM wählt und ruft ein Tool auf (**Act**)
3. LLM analysiert das Ergebnis (**Observe**)
4. Zurück zu Schritt 1, bis die Aufgabe erledigt ist

#### b) Delegations-Pattern
```
Haupt-Agent → Sub-Agent A (eigene Tool-Calls)
            → Sub-Agent B (eigene Tool-Calls)
            → Zusammenführung der Ergebnisse
```

#### c) Router-Pattern
```
Router-Agent (grosses Modell)
  ├→ Spezialist A (kleines Modell + Tools)
  ├→ Spezialist B (kleines Modell + Tools)
  └→ Spezialist C (kleines Modell + Tools)
```

Ein grosses Modell übernimmt Routing und Planauswahl, während kleinere Agenten gezielte Ausführung handhaben.

### Best Practices
- Rekursionstiefe begrenzen
- Klare Abbruchbedingungen definieren
- Budget (Tokens, Aufrufe, Zeit) pro Sub-Task festlegen

## 4. Kombinierte Patterns

### Fan-Out / Fan-In
```
Sequential → Parallel → Sequential
  1. get_search_results(query)
  2. Parallel: fetch_details(result_1), fetch_details(result_2), ...
  3. summarize_all(details)
```

### Iterativ + Parallel (RAG + MCP)
```
Runde 1: RAG-Retrieval + MCP Tool Call (parallel)
         → Ergebnisse kombinieren
Runde 2: Verfeinerte RAG-Query + Weiterer Tool Call (parallel)
         → Finale Antwort
```

## 5. Vergleichstabelle

| Pattern      | Latenz           | Komplexität | Fehlertoleranz | Anwendungsfall               |
|--------------|------------------|-------------|----------------|-------------------------------|
| Sequential   | Hoch (additiv)   | Niedrig     | Niedrig (Kette) | Abhängige Schritte           |
| Parallel     | Niedrig (max)    | Mittel      | Konfigurierbar  | Unabhängige Datenabfragen    |
| Nested/ReAct | Variabel         | Hoch        | Mittel          | Komplexe Reasoning-Aufgaben  |
| Fan-Out/In   | Mittel           | Hoch        | Mittel          | Suche + Detail-Enrichment    |

## 6. Produktions-Tipps

1. **Reasoning vor Tool-Call**: LLM soll eine einzeilige Begründung und Tool-ID generieren, bevor es aufruft
2. **Observation nach Tool-Call**: LLM soll das Ergebnis kurz zusammenfassen, um Traceability zu erhöhen und Loops zu reduzieren
3. **Validation Gates**: Vor jedem Tool-Aufruf validieren -- ablehnen, reparieren oder eskalieren; keine stillen Fehler
4. **Tool Search bei vielen Tools**: Wenn das Tool-Set eine gewisse Grösse überschreitet (>15-20), zuerst ein Such-Tool aufrufen, das relevante Tools identifiziert
5. **Timeouts**: Pro-Tool-Timeout UND Session-Timeout definieren
6. **Retry-Semantik**: Idempotente Tools ermöglichen sichere Wiederholungen
