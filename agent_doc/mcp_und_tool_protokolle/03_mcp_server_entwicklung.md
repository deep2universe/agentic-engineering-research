# MCP Server-Entwicklung

## Überblick

Ein MCP Server ist ein Programm, das die MCP-Spezifikation implementiert und einem Host (z. B. Claude Desktop, IDE) Tools, Resources und Prompts bereitstellt. Die Entwicklung ist in mehreren Programmiersprachen möglich.

## Verfügbare SDKs und Frameworks

| Sprache     | Framework / SDK         | Besonderheit                          |
|-------------|-------------------------|---------------------------------------|
| Python      | `fastmcp` (offiziell)   | Schnellster Einstieg, dekorator-basiert |
| TypeScript  | `@modelcontextprotocol/sdk` | Offizielles SDK                    |
| Java        | MCP Java SDK            | Enterprise-Integration                |
| .NET        | MCP .NET SDK            | C#-Integration                        |
| Rust        | MCP Rust SDK            | Performance-kritische Server          |
| Go          | Community SDK           | Verschiedene Implementierungen        |

## Grundstruktur eines MCP Servers (Python mit FastMCP)

### 1. Installation

```bash
pip install fastmcp
```

### 2. Minimaler Server

```python
from fastmcp import FastMCP

# Server-Instanz erstellen
mcp = FastMCP("mein-server")

# Tool definieren
@mcp.tool()
def get_weather(city: str) -> str:
    """Ruft aktuelle Wetterdaten für eine Stadt ab.
    Verwende dieses Tool, wenn der Nutzer nach Temperatur,
    Regen oder Vorhersage fragt."""
    # Implementierung hier
    return f"Wetter in {city}: 22°C, sonnig"

# Resource definieren
@mcp.resource("config://settings")
def get_settings() -> str:
    """Aktuelle Anwendungskonfiguration."""
    return '{"theme": "dark", "language": "de"}'

# Prompt definieren
@mcp.prompt()
def code_review(code: str) -> str:
    """Führt ein strukturiertes Code Review durch."""
    return f"Bitte reviewe folgenden Code:\n\n{code}"

# Server starten
if __name__ == "__main__":
    mcp.run()
```

### 3. Grundstruktur (TypeScript)

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = new McpServer({
  name: "mein-server",
  version: "1.0.0"
});

// Tool registrieren
server.tool("get_weather", {
  city: { type: "string", description: "Name der Stadt" }
}, async ({ city }) => {
  return { content: [{ type: "text", text: `Wetter in ${city}: 22°C` }] };
});

// Server mit stdio Transport starten
const transport = new StdioServerTransport();
await server.connect(transport);
```

## Tool-Definition: Best Practices

### Naming
- **snake_case** oder **camelCase** verwenden
- Kategorie und Aktion klar benennen: `database_query`, `file_write`, `git_commit`
- Der Name ist die Referenz, die das LLM beim Aufruf verwendet

### Beschreibungen
- Erklären, **was** das Tool tut UND **wann** es verwendet werden soll
- Schlecht: `"Wetterdaten abrufen"`
- Gut: `"Ruft aktuelle Wetterbedingungen für eine Stadt ab. Verwende dieses Tool, wenn der Nutzer nach Temperatur, Regen oder Vorhersage fragt."`
- Gute Beschreibungen reduzieren Fehlzuweisungen um **40-60%**

### Input Schema (JSON Schema)
```json
{
  "type": "object",
  "properties": {
    "city": {
      "type": "string",
      "description": "Name der Stadt (z. B. 'Berlin', 'München')"
    },
    "units": {
      "type": "string",
      "enum": ["celsius", "fahrenheit"],
      "description": "Temperatureinheit",
      "default": "celsius"
    }
  },
  "required": ["city"]
}
```

### Output-Format
- Strukturierte Daten zurückgeben (JSON), nicht HTML oder verbose Text
- Klare, extrahierbare Felder verwenden
- Optional: Output Schema für Validierung definieren

### Single Responsibility
- Jedes Tool soll **eine** klar abgegrenzte Aufgabe erfüllen
- Lieber mehrere spezialisierte Tools als ein "Schweizer Taschenmesser"

## Server-Registrierung bei Claude Code

### Über `.mcp.json` (Projekt-Scope)

```json
{
  "mcpServers": {
    "mein-server": {
      "command": "python",
      "args": ["/pfad/zu/server.py"],
      "env": {
        "API_KEY": "..."
      }
    }
  }
}
```

### Über CLI

```bash
claude mcp add mein-server python /pfad/zu/server.py
```

### Remote HTTP Server

```json
{
  "mcpServers": {
    "remote-server": {
      "type": "http",
      "url": "https://mein-server.example.com/mcp"
    }
  }
}
```

## Debugging und Testing

### MCP Inspector
- Offizielles Debugging-Tool
- Ermöglicht das Testen der Server-Funktionalität ohne vollständigen AI-Client
- Verifizierung der Server-Registrierung nach jeder Änderung empfohlen

### Tipps
- Nach jedem Schritt prüfen, ob Capabilities korrekt advertised werden
- Tool-Aufrufe mit bekannten Inputs testen
- Error-Handling für ungültige Parameter verifizieren

## Lernressourcen

| Ressource | Beschreibung |
|-----------|-------------|
| [Offizielle MCP Docs](https://modelcontextprotocol.io/docs/develop/build-server) | Build-Server Tutorial |
| [Microsoft MCP for Beginners](https://github.com/microsoft/mcp-for-beginners/) | 13-Lab Hands-on Curriculum |
| [Codecademy MCP Tutorial](https://www.codecademy.com/article/build-an-mcp-server) | Anfänger-Tutorial |
| [IBM MCP Server Guide](https://www.ibm.com/think/tutorials/how-to-build-an-mcp-server) | FastMCP-basiertes Tutorial |
| [OpenAI Apps SDK](https://developers.openai.com/apps-sdk/build/mcp-server) | MCP Server mit OpenAI SDK |
