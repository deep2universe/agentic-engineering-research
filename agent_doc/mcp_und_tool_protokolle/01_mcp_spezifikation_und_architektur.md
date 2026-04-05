# MCP Spezifikation und Architektur

## Überblick

Das **Model Context Protocol (MCP)** ist ein offener Standard, der die Kommunikation zwischen LLM-basierten Anwendungen und externen Datenquellen, Tools und Services standardisiert. Ursprünglich von Anthropic entwickelt, wurde MCP im Dezember 2025 an die **Agentic AI Foundation (AAIF)** unter der Linux Foundation gespendet. MCP wird oft als "USB-C Port für AI" bezeichnet -- ein universeller Stecker für Plug-and-Play-Verbindungen zwischen LLMs und externen Systemen.

**Aktuelle Spezifikationsversion:** November 2025 (2025-11-25)

## Kernarchitektur

MCP folgt einem **Client-Server-Modell** mit drei Hauptkomponenten:

### 1. Host
- Die Anwendung, in der das LLM läuft (z. B. Claude Desktop, IDE, AI-Agent)
- Initiiert die Kommunikation
- Kann mehrere MCP Clients hosten

### 2. Client
- Leichtgewichtiger Protokoll-Client, eingebettet im Host
- Hält eine **1:1-Verbindung** zu einem Server
- Verwaltet die Kommunikation und Capabilities-Verhandlung

### 3. Server
- Stellt Context, Tools und Prompts bereit
- Kann auf lokale oder entfernte Datenquellen zugreifen
- Implementiert die MCP-Spezifikation

```
┌─────────────────────────────────────┐
│              Host                    │
│  ┌──────────┐    ┌──────────┐       │
│  │ Client 1 │    │ Client 2 │  ...  │
│  └────┬─────┘    └────┬─────┘       │
└───────┼───────────────┼─────────────┘
        │               │
   ┌────▼─────┐    ┌────▼─────┐
   │ Server 1 │    │ Server 2 │
   └──────────┘    └──────────┘
```

## Schichten-Modell

### Data Layer (innere Schicht)
- Basiert auf **JSON-RPC 2.0**
- Definiert Nachrichtenstruktur und Semantik
- Umfasst Lifecycle-Management, Server-Features, Client-Features und Utility-Features

### Transport Layer (äußere Schicht)
- Definiert Kommunikationsmechanismen und Kanäle
- Abstrahiert Kommunikationsdetails vom Protokoll-Layer
- Ermöglicht dasselbe JSON-RPC-2.0-Nachrichtenformat über alle Transport-Mechanismen

## Nachrichtentypen (JSON-RPC 2.0)

### 1. Requests
- Erwarten eine Response
- Enthalten `method` und optionale `params`
- Beispiel: `initialize`, `tools/call`, `resources/read`

### 2. Responses
- Antwort auf Requests
- Enthalten entweder `result` oder `error`

### 3. Notifications
- Einweg-Nachrichten ohne erwartete Antwort
- Enthalten `method` und optionale `params`
- Beispiel: `notifications/initialized`

## Transport-Mechanismen

### stdio (Standard Input/Output)
- Kommunikation über stdin/stdout
- Ideal für lokale Integrationen und CLI-Tools
- Leichtgewichtig und synchron

### Streamable HTTP (ehemals SSE)
- Server-to-Client-Streaming via HTTP
- Client-to-Server über HTTP POST Requests
- **Empfohlen für Remote-Server** und Cloud-basierte Services
- 2026 Roadmap: Verbesserungen für Load Balancing und horizontale Skalierung

## Connection Lifecycle

### 1. Initialization
- Client sendet `initialize`-Request mit:
  - Unterstützte Protokollversion
  - Verfügbare Capabilities
  - Client-Implementierungsdetails
- Server antwortet mit:
  - Eigene unterstützte Protokollversion
  - Advertised Capabilities (Tools, Resources, Logging, Prompts)

### 2. Operation
- Austausch von Requests, Responses und Notifications
- Capability-basierte Feature-Verhandlung

### 3. Shutdown
- Kein spezifisches Shutdown-Protokoll definiert
- Signalisierung über Transport-Mechanismus
- Bei stdio: Client schliesst Input-Stream, wartet auf Server-Exit, eskaliert zu SIGTERM/SIGKILL

## Capabilities

Capabilities werden während der Initialization ausgehandelt und definieren, welche Features Client und Server unterstützen:

| Capability    | Beschreibung                                | Seite   |
|---------------|---------------------------------------------|---------|
| `tools`       | Server kann Tools bereitstellen             | Server  |
| `resources`   | Server kann Resources bereitstellen         | Server  |
| `prompts`     | Server kann Prompt-Templates bereitstellen  | Server  |
| `logging`     | Server unterstützt Logging                  | Server  |
| `sampling`    | Client kann LLM-Sampling durchführen        | Client  |
| `roots`       | Client kann Dateisystem-Roots bereitstellen | Client  |
| `elicitation` | Client kann Nutzerinput anfordern           | Client  |

## Wichtige Spezifikations-Updates

### Juni 2025
- Klarstellungen zur Autorisierung von MCP Servers
- Resource Indicators zur Verhinderung von Token-Missbrauch durch bösartige Server

### November 2025
- Asynchrone Operationen
- Statelessness-Unterstützung
- Server-Identität
- Offizielles Community-Registry für MCP-Server-Discovery
- Tasks-Primitive (experimentell)

### 2026 Roadmap (Top 4 Prioritäten)
1. **Streamable HTTP Transport** -- Skalierung für Remote-Server mit Load Balancern
2. **Tasks Primitive** -- Lifecycle-Erweiterungen (Retry-Semantik, Expiry Policies)
3. **Enterprise-Features** -- Audit Trails, SSO-Auth, Gateway-Verhalten, Config-Portabilität
4. **Registry und Discovery** -- Standardisiertes Auffinden von MCP-Servern

## Kennzahlen (Stand Ende 2025)

- Über **97 Millionen monatliche SDK-Downloads**
- Über **10.000 aktive MCP-Server**
- First-Class Client Support in: ChatGPT, Claude, Cursor, Gemini, Microsoft Copilot, VS Code u.v.m.
