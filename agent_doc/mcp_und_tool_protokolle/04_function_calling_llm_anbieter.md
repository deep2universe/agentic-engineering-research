# Function Calling / Tool Use bei verschiedenen LLM-Anbietern

## Überblick

Function Calling (auch Tool Use genannt) ist die Fähigkeit eines LLM, strukturierte Ausgaben zu generieren, die beschreiben, welche externe Funktion aufgerufen werden soll und mit welchen Argumenten. Das Modell führt die Funktion **nicht selbst aus** -- es erzeugt nur die strukturierte Anweisung, die von der Anwendung ausgeführt wird.

## Grundprinzip (anbieterübergreifend)

```
1. Anwendung definiert verfügbare Tools (Name, Beschreibung, Parameter-Schema)
2. Nutzer stellt eine Anfrage
3. LLM analysiert Anfrage und wählt passendes Tool
4. LLM generiert strukturierten Tool-Call (Name + Argumente)
5. Anwendung führt die Funktion aus
6. Ergebnis wird dem LLM zurückgegeben
7. LLM formuliert finale Antwort
```

## Vergleich der Anbieter

### OpenAI (GPT-4o, GPT-4.1, o3, o4-mini)

**Bezeichnung:** "Function Calling" / "Tool Calls"

**Tool-Definition:**
```json
{
  "type": "function",
  "function": {
    "name": "get_weather",
    "description": "Get weather for a city",
    "parameters": {
      "type": "object",
      "properties": {
        "city": { "type": "string" }
      },
      "required": ["city"]
    }
  }
}
```

**Response-Format:** `tool_calls` Array im Response-Objekt

**Besonderheiten:**
- Höchste Genauigkeit bei Function-Calling-Benchmarks
- `strict: true` für Structured Outputs (garantiert Schema-Konformität)
- Parallele Tool Calls nativ unterstützt
- Minimale Halluzinationsrate

### Anthropic (Claude 4 Opus/Sonnet)

**Bezeichnung:** "Tool Use"

**Tool-Definition:**
```json
{
  "name": "get_weather",
  "description": "Get weather for a city",
  "input_schema": {
    "type": "object",
    "properties": {
      "city": { "type": "string" }
    },
    "required": ["city"]
  }
}
```

**Response-Format:** Content-Block mit `"type": "tool_use"`

**Besonderheiten:**
- `input_schema` statt `parameters`
- **Interleaved Thinking** -- Reasoning während der Tool-Nutzung
- Parallele Tool-Aufrufe unterstützt
- Extended Thinking für komplexe Multi-Step-Probleme
- Nativer MCP-Support (Claude ist der Ursprung von MCP)

### Google (Gemini 2.5)

**Bezeichnung:** "Function Calling"

**Response-Format:** `functionCall` Objekt

**Besonderheiten:**
- `function_declarations` in der API
- Gute Performance bei Function-Calling-Benchmarks
- Native Integration mit Google-Ökosystem
- A2A-Protokoll (Agent-to-Agent) als Ergänzung zu MCP

### Weitere Anbieter

| Anbieter       | Modelle              | Besonderheit                        |
|----------------|----------------------|-------------------------------------|
| **Mistral**    | Mistral Large        | Native Function Calling             |
| **Cohere**     | Command R+           | Multi-Step Tool Use                 |
| **Meta**       | Llama 3/4            | Open-Source, Custom Tool Use        |
| **DeepSeek**   | DeepSeek-V3          | Kostengünstig, gute Tool-Fähigkeit |

## Herausforderung: Fragmentierung

Die Implementierungen unterscheiden sich in:
- **Request-Struktur** der Tool-Definitionen
- **Response-Parsing** der Tool-Calls
- **Execution-Loop** für Multi-Turn-Interaktionen
- **Fehlerbehandlung** und Retry-Logik

**Lösung:** Aggregation Gateways oder Abstraktionsschichten, die das OpenAI-SDK-Format als einheitliche Schnittstelle verwenden (z. B. LiteLLM, Portkey).

## MCP als Vereinheitlichung

MCP löst die Fragmentierung auf der **Server-Seite**: Ein MCP Server funktioniert mit jedem Client, der MCP unterstützt -- unabhängig vom LLM-Anbieter. Die Tool-Definition erfolgt einmalig im MCP-Format, und der Client übersetzt in das jeweilige anbieter-spezifische Format.

```
                    ┌──────────────┐
                    │  MCP Server  │ ← Einmalige Tool-Definition
                    └──────┬───────┘
                           │ MCP Protokoll
            ┌──────────────┼──────────────┐
            │              │              │
    ┌───────▼──────┐ ┌────▼──────┐ ┌─────▼─────┐
    │ Claude Client│ │ GPT Client│ │Gemini Cli.│
    │ (tool_use)   │ │(tool_calls)│ │(funcCall) │
    └──────────────┘ └───────────┘ └───────────┘
```

## Evolution des Function Calling (2023-2026)

| Phase | Zeitraum | Entwicklung |
|-------|----------|-------------|
| 1     | 2023     | Einfaches Function Calling (OpenAI führend) |
| 2     | 2024     | Parallel Tool Calls, Multi-Turn, mehr Anbieter |
| 3     | 2025     | MCP als Standard, Structured Outputs, Interleaved Thinking |
| 4     | 2026     | Asynchrone Tools, Tasks, Enterprise-Features, Convergenz |

## Best Practices (anbieterübergreifend)

1. **Klare Tool-Beschreibungen** -- Erkläre Zweck UND Anwendungsfall
2. **Minimale Parameter** -- Nur notwendige Inputs als `required`
3. **Validierung** -- Input-Validierung vor Ausführung
4. **Idempotenz** -- Tools sollten bei Retry keine Seiteneffekte vervielfachen
5. **Reasoning vor Tool-Call** -- LLM soll begründen, warum es ein Tool wählt
6. **Observation nach Tool-Call** -- LLM soll das Ergebnis kurz zusammenfassen
