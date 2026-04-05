# MCP Tools vs Resources vs Prompts

## Überblick

MCP definiert drei grundlegende Primitives (Interaktionstypen), die unterschiedliche Zwecke erfüllen und von verschiedenen Akteuren gesteuert werden.

## Die drei MCP Primitives

### 1. Tools -- Aktionen ausführen

**Steuerung:** Model-controlled (das LLM entscheidet autonom)

**Zweck:** Tools sind spezifische Aktionen, die ein MCP Server einem Client zur Verfügung stellt. Sie sind wie eingebaute Funktionen oder APIs, die ein LLM während einer Konversation aufrufen kann.

**Wann verwendet:** Wenn eine Aufgabe erledigt werden muss -- Daten abrufen, Operationen auslösen, Berechnungen durchführen.

**Funktionsweise:**
1. Server registriert verfügbare Tools mit Name, Beschreibung und Input-Schema
2. LLM erkennt aus dem Kontext, welches Tool passend ist
3. LLM generiert einen Tool-Call mit strukturierten Parametern
4. Server führt das Tool aus und gibt Ergebnisse zurück

**Beispiel:**
```json
{
  "name": "get_weather",
  "description": "Ruft aktuelle Wetterdaten für eine Stadt ab",
  "inputSchema": {
    "type": "object",
    "properties": {
      "city": { "type": "string", "description": "Name der Stadt" }
    },
    "required": ["city"]
  }
}
```

### 2. Resources -- Daten bereitstellen

**Steuerung:** Application-controlled (die Host-Anwendung entscheidet)

**Zweck:** Resources sind Datenentitäten, die der Server exponiert. Sie können statisch (Konfiguration, Begrüssung) oder dynamisch (Nutzerprofile, Datenbank-Records) sein.

**Wann verwendet:** Wenn Kontextinformationen benötigt werden, die das LLM für seine Entscheidungen nutzen soll.

**Funktionsweise:**
1. Server registriert Resources mit URIs (z. B. `file:///config.json`, `db://users/123`)
2. Die Client-Anwendung (nicht das LLM!) entscheidet, welche Resources geladen werden
3. Resources werden explizit gefetched und dem LLM als Kontext bereitgestellt
4. Das LLM initiiert **keine** Aktionen zum Laden von Resources

**Unterschied zu Tools:**
- Resources sind **read-only** -- sie liefern nur Daten
- Resources werden von der **Anwendung** gesteuert, nicht vom Modell
- Resources ähneln GET-Requests, Tools ähneln POST-Requests

**Beispiel:**
```json
{
  "uri": "config://app/settings",
  "name": "Application Settings",
  "description": "Aktuelle Anwendungskonfiguration",
  "mimeType": "application/json"
}
```

### 3. Prompts -- Interaktionen leiten

**Steuerung:** User-controlled (der Nutzer wählt explizit aus)

**Zweck:** Prompts sind wiederverwendbare Templates, die AI-Interaktionen strukturieren. Sie definieren, wie das Modell Fragen stellt, Konzepte erklärt oder mit Nutzern interagiert.

**Wann verwendet:** Wenn konsistentes, vorstrukturiertes Modellverhalten gewünscht ist.

**Funktionsweise:**
1. Server stellt Prompt-Templates mit optionalen Parametern bereit
2. Nutzer wählt ein Prompt-Template explizit aus (z. B. via UI)
3. Template wird mit Parametern befüllt und erzeugt eine Liste von Messages
4. Diese Messages initiieren eine konsistente Modell-Interaktion

**Beispiel:**
```json
{
  "name": "code_review",
  "description": "Führt ein strukturiertes Code Review durch",
  "arguments": [
    {
      "name": "code",
      "description": "Der zu reviewende Code",
      "required": true
    }
  ]
}
```

## Vergleichstabelle

| Aspekt          | Tools                    | Resources                | Prompts                  |
|-----------------|--------------------------|--------------------------|--------------------------|
| **Steuerung**   | Model-controlled         | Application-controlled   | User-controlled          |
| **Zweck**       | Aktionen ausführen       | Daten bereitstellen      | Interaktionen leiten     |
| **Analogie**    | POST Request / Funktion  | GET Request / Datei      | Template / Slash-Command |
| **Initiator**   | LLM                      | Host-Anwendung           | Nutzer                   |
| **Seiteneffekte** | Ja (möglich)           | Nein (read-only)         | Nein                     |
| **Output**      | Strukturierte Ergebnisse | Daten / Kontext          | Message-Liste            |

## Weitere MCP Features

### 4. Sampling
- Ermöglicht Servern, das LLM des Clients zur Textgenerierung zu nutzen
- Server kann den Client bitten, eine Completion durchzuführen
- Nützlich für agentic Workflows, bei denen der Server selbst Reasoning benötigt

### 5. Roots
- Client stellt dem Server Dateisystem-Wurzelverzeichnisse bereit
- Definiert den Scope, in dem ein Server operieren darf
- Wichtig für Sicherheit und Isolation

### 6. Elicitation
- Server kann den Client bitten, strukturierten Input vom Nutzer anzufordern
- Ermöglicht interaktive Workflows mit Rückfragen
- Nutzer hat immer die Kontrolle über die Freigabe von Informationen

## Zusammenspiel der Primitives

```
Nutzer → wählt Prompt-Template → strukturierte Konversation
                                        │
                                        ▼
                              LLM entscheidet →  Tool-Aufrufe
                                        │
                                        ▼
                    Anwendung lädt → Resources als Kontext
```

Resources liefern den Kontext für fundierte Entscheidungen, Tools führen konkrete Aktionen aus, und Prompts sorgen für konsistente, strukturierte Interaktionen. Zusammen bilden sie das Fundament der MCP-Funktionalität für intelligente AI-Anwendungen.
