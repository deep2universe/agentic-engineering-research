# MCP im Kontext von Claude Code und anderen IDEs

## Überblick

MCP ist tief in die Entwicklungswerkzeuge rund um Claude und andere AI-gestützte IDEs integriert. Claude Code war der erste produktive Client, der MCP nativ unterstützt, und hat seitdem eine breite Adoption in der IDE-Landschaft ausgelöst.

## Claude Code und MCP

### Funktionsweise
- Claude Code verbindet sich über MCP mit **externen Tools, Datenbanken und APIs**
- MCP Server geben Claude Code Zugriff auf benutzerdefinierte Funktionalität
- Konfiguration über `.mcp.json` (Projekt-Scope) oder globale Settings

### Konfiguration

#### Projekt-spezifisch (`.mcp.json` im Projektverzeichnis)
```json
{
  "mcpServers": {
    "database": {
      "command": "npx",
      "args": ["-y", "@mcp/postgres-server", "postgresql://localhost/mydb"]
    },
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_TOKEN": "${GITHUB_TOKEN}"
      }
    }
  }
}
```

#### CLI-basiert
```bash
# Server hinzufügen
claude mcp add mein-server python /pfad/zu/server.py

# Server auflisten
claude mcp list

# Server entfernen
claude mcp remove mein-server
```

#### Remote HTTP Server (empfohlen für Cloud-basierte Services)
```json
{
  "mcpServers": {
    "remote-api": {
      "type": "http",
      "url": "https://api.example.com/mcp"
    }
  }
}
```

### Claude Code Skills als MCP-basiertes System
- Claude Code verwendet intern ein Skill-System, das auf MCP aufbaut
- Skills sind spezialisierte Fähigkeiten, die über MCP-Tools bereitgestellt werden
- Beispiele: `/commit`, `/review-pr`, `/simplify`

## IDE-Integrationen

### VS Code / Cursor / Windsurf
- Native MCP-Unterstützung über Extensions
- Claude Code Extension für VS Code verfügbar
- Cursor und Windsurf haben eigene MCP-Client-Implementierungen
- Konfiguration über `.mcp.json` oder IDE-spezifische Settings

### JetBrains IDEs (IntelliJ IDEA, PyCharm, WebStorm, etc.)

**Ab Version 2025.2:**
- Integrierter MCP Server direkt in der IDE
- Claude Agent nativ in JetBrains IDEs verfügbar
- Voller Zugriff auf IDE-Capabilities über den JetBrains MCP Server:
  - Code-Navigation und Symbol-Suche
  - Refactoring-Tools
  - Build- und Test-Systeme
  - VCS-Integration

**MCP Skills für JetBrains:**
- JetBrains IDE MCP Skills auf dem MCP Market verfügbar
- Brücke zwischen Claude Code und IntelliJ-Funktionalität

### Emacs
- **claude-code-ide.el**: Native Integration mit Claude Code CLI über MCP
- Bidirektionale Brücke zwischen Claude und Emacs
- Claude kann Emacs-Features nutzen (Buffer-Management, Compilation, etc.)

### Neovim
- Community-Plugins für MCP-Integration verfügbar
- Integration über stdio-Transport

## Populäre MCP Server für die Entwicklung

| Server                    | Funktion                                  |
|---------------------------|-------------------------------------------|
| `@modelcontextprotocol/server-github` | GitHub-API (Issues, PRs, Repos)    |
| `@mcp/postgres-server`   | PostgreSQL-Datenbankzugriff               |
| `@mcp/filesystem-server` | Dateisystem-Operationen                   |
| `@mcp/browser-server`    | Web-Browsing und Scraping                 |
| `@mcp/memory-server`     | Persistenter Memory-Store                 |
| `@mcp/slack-server`      | Slack-Messaging                           |
| `@mcp/docker-server`     | Docker-Container-Management               |

## MCP in anderen AI-Plattformen

| Plattform        | MCP-Support                              |
|------------------|------------------------------------------|
| **ChatGPT**      | First-Class Client Support               |
| **Gemini**       | MCP-Client-Implementierung               |
| **Copilot**      | Microsoft Copilot unterstützt MCP        |
| **VS Code**      | Native MCP-Integration                   |
| **Cursor**       | Tiefe MCP-Integration                    |
| **Windsurf**     | MCP-kompatibel                           |
| **n8n**          | MCP-Tool-Nodes für Workflow-Automation   |
| **Databricks**   | Managed MCP für Agent-Serving            |

## Ecosystem: Awesome Claude Code

Das Open-Source-Projekt **awesome-claude-code** sammelt:
- Skills und Slash-Commands
- Hooks (SessionStart, Pre-Commit, etc.)
- Agent-Orchestratoren
- MCP-Server-Plugins
- Anwendungsbeispiele

Repository: [github.com/hesreallyhim/awesome-claude-code](https://github.com/hesreallyhim/awesome-claude-code)

## Konfigurationstipps

1. **Projekt-spezifische Konfiguration** (`.mcp.json`) bevorzugen -- portabler und reproduzierbar
2. **Umgebungsvariablen** für Secrets nutzen (`${GITHUB_TOKEN}`)
3. **HTTP-Transport** für Remote-Server bevorzugen (skalierbar, wartbar)
4. **MCP Inspector** zum Debugging nutzen, bevor ein Server in die IDE integriert wird
5. **Server-Registrierung nach jeder Änderung verifizieren**
