# 08 — Skill-Ökosystem und Frameworks

## Überblick

Skills existieren nicht isoliert — sie sind Teil eines wachsenden Ökosystems aus Standards, Protokollen, Plattformen und Frameworks. Dieses Kapitel ordnet das Ökosystem ein und zeigt die Beziehungen zwischen den Komponenten.

---

## Die drei Säulen der Agentic AI Infrastruktur

### 1. Agent Skills Standard — "Was Agents können"

**Was**: Offener Standard für prozedurales Wissen in wiederverwendbaren Modulen
**Scope**: Definition, Packaging, Distribution von Agent-Fähigkeiten
**Adoption**: 30+ Agent-Produkte (Claude Code, VS Code, Codex, Cursor, etc.)
**Website**: agentskills.io

### 2. Model Context Protocol (MCP) — "Wie Agents auf Tools zugreifen"

**Was**: Offener Standard für die Verbindung von LLMs mit externen Tools und Daten
**Scope**: Tool-Discovery, -Aufruf, -Ergebnis; Resource Access; Prompt Templates
**Adoption**: 97 Mio. monatliche SDK-Downloads, 10.000+ Server
**Governance**: Seit Dezember 2025 unter Linux Foundation (AAIF)
**Website**: modelcontextprotocol.io

### 3. Agent-to-Agent Protocol (A2A) — "Wie Agents kommunizieren"

**Was**: Googles Protokoll für Agent-zu-Agent-Kommunikation
**Scope**: Discovery, Task-Delegation, Ergebnis-Austausch zwischen Agents
**Adoption**: 150+ unterstützende Organisationen

### Zusammenspiel

```
┌─────────────────────────────────────────────────────┐
│                    Anforderung                       │
│                        │                             │
│                        ▼                             │
│              ┌──────────────────┐                    │
│              │  Agent mit Skills │ ← Agent Skills     │
│              │  (Prozedurales    │   Standard          │
│              │   Wissen)         │                    │
│              └────────┬─────────┘                    │
│                       │                              │
│              ┌────────┴─────────┐                    │
│              ▼                  ▼                     │
│    ┌──────────────┐   ┌──────────────┐              │
│    │  MCP Server  │   │ Andere Agents │ ← A2A        │
│    │  (Tools &    │   │ (Delegation   │   Protokoll   │
│    │   Daten)     │   │  & Collab.)   │              │
│    └──────────────┘   └──────────────┘              │
└─────────────────────────────────────────────────────┘
```

---

## MCP als Skill-Infrastruktur

### MCP Core Primitives und ihre Rolle für Skills

| MCP Primitive | Beschreibung | Bezug zu Skills |
|--------------|-------------|----------------|
| **Tools** | Ausführbare Funktionen | Skills können MCP Tools aufrufen |
| **Resources** | Datenquellen (Dokumente, Configs) | Skills referenzieren MCP Resources |
| **Prompts** | Wiederverwendbare Templates | Ähnlich Skills, aber MCP-nativ |

### MCP-Tool-Referenzen in Skills

Skills müssen **vollqualifizierte Tool-Namen** verwenden:

```markdown
## Datenanalyse

Verwende das BigQuery:bigquery_schema Tool für Tabellen-Schemas.
Verwende das GitHub:create_issue Tool für Issue-Erstellung.
```

Format: `ServerName:tool_name`

### MCP 2026 Roadmap-Relevanz für Skills

| Feature | Bedeutung für Skills |
|---------|---------------------|
| Tasks Primitive | Lang laufende Skill-Operationen |
| Audit Trails | Nachverfolgbarkeit von Skill-Aktionen |
| SSO-Integration | Enterprise Skill-Zugriffskontrolle |
| Configuration Portability | Skills zwischen Umgebungen übertragen |
| Event-driven Updates | Trigger-basierte Skill-Aktivierung |

---

## Skills auf verschiedenen Plattformen

### Claude Code

- **Custom Skills**: Dateisystembasiert (`.claude/skills/`)
- **Bundled Skills**: Mitgeliefert (`/batch`, `/simplify`, etc.)
- **Plugins**: Plugin-System für Skill-Distribution
- **Features**: Hot Reload, Subagent-Integration, Shell-Preprocessing

### Claude.ai

- **Pre-built Skills**: PDF, Excel, Word, PowerPoint
- **Custom Skills**: Upload als ZIP über Settings > Features
- **Scope**: Individuell pro User (nicht org-weit teilbar)
- **Pläne**: Pro, Max, Team, Enterprise

### Claude API

- **Endpoints**: `/v1/skills` für Custom Skills
- **Pre-built Skills**: Via `skill_id` (z.B. `pptx`, `xlsx`)
- **Scope**: Workspace-weit geteilt
- **Beta-Headers**: `code-execution-2025-08-25`, `skills-2025-10-02`, `files-api-2025-04-14`
- **Einschränkung**: Kein Netzwerkzugriff, keine Runtime-Package-Installation

### Claude Agent SDK

- **Custom Skills**: `.claude/skills/` Dateisystem
- **Integration**: `"Skill"` in `allowed_tools` Konfiguration
- **Sprachen**: Python, TypeScript

### VS Code (GitHub Copilot)

- **Agent Skills**: Adoptiert den Agent Skills Standard
- **Integration**: Direkt in VS Code Copilot
- **Scope**: Workspace- und User-Level

### OpenAI Codex

- **Agent Skills**: Adoptiert den Agent Skills Standard
- **Integration**: SKILL.md Format kompatibel

---

## Cross-Platform-Kompatibilität

### Was synchronisiert und was nicht

| Aspekt | Synchronisiert? |
|--------|----------------|
| SKILL.md Format | Ja — offener Standard |
| Frontmatter (Kern) | Ja — `name`, `description` |
| Frontmatter (erweitert) | Teilweise — plattformspezifische Felder |
| Skripte und Ressourcen | Ja — Verzeichnisstruktur ist Standard |
| Cross-Surface-Sync | Nein — manuell pro Plattform |

### Best Practice für Cross-Platform-Skills

1. **Kern-Standard einhalten**: `name`, `description`, Markdown Body
2. **Plattform-spezifische Felder** in separatem Block am Ende des Frontmatter
3. **Keine plattformspezifischen Annahmen** im Markdown Body
4. **Runtime-Constraints beachten**:
   - Claude.ai: Variierender Netzwerkzugriff
   - Claude API: Kein Netzwerk, keine Package-Installation
   - Claude Code: Voller Zugriff

---

## Framework-Integration

### Vollständige Framework-Vergleichsmatrix

| Kriterium | LangChain | CrewAI | OpenAI SDK | Claude SDK | Semantic Kernel | Bedrock |
|-----------|-----------|--------|-----------|-----------|----------------|---------|
| **Skill-Konzept** | Tools + SKILL.md | BaseTool/@tool | Function Calling | SKILL.md | Plugins | Action Groups |
| **Discovery** | Dynamisch + MCP | Statisch pro Agent | Modell-getrieben | 3-Stufen Progressive | Planner-getrieben | Schema-basiert |
| **MCP-Support** | Ja | Ja (nativ) | Nein | Ja (nativ) | Ja (nativ) | Nein |
| **SKILL.md** | Ja | Nein | Ja (Codex) | Ja (Standard) | Ja | Nein |
| **Multi-Agent** | Graph Nodes | Crew + Process | Handoffs | Tool-basiert | Agent Framework | Supervisor |
| **Open Source** | Ja | Ja | Ja | Teilweise | Ja | Nein |

> Detaillierte Framework-Analysen: siehe `agent_doc/skill_systeme_frameworks/`

### Abstraktionsebenen

| Ebene | Frameworks | Beschreibung |
|-------|-----------|-------------|
| **Low-Level** | OpenAI Agents SDK | Direktes Function Calling, minimale Abstraktion |
| **Mid-Level** | LangChain, CrewAI, Bedrock | Tool-Abstraktionen mit Typ-Sicherheit |
| **High-Level** | Claude SDK, Semantic Kernel | Prompt-basierte Skills mit Metadaten und Discovery |

### Skill-Konzepte in Major Frameworks

| Framework | Skill-Äquivalent | Architektur |
|-----------|-----------------|-------------|
| **LangChain/LangGraph** | Tools + Runnable | Gerichteter Graph mit State |
| **CrewAI** | Tools + Tasks | Role-basierte Agents mit Tasks |
| **Semantic Kernel** | Plugins/Skills | Plugin-Architektur mit Planern |
| **AutoGen/AG2** | Skills + Tools | Multi-Agent Conversation |
| **Spring AI** | Agent Skills | Spring-native Skill-Module |

### LangChain/LangGraph

```python
# LangGraph: Skills als Nodes in einem Graphen
from langgraph.graph import StateGraph

graph = StateGraph(AgentState)
graph.add_node("research", research_skill)
graph.add_node("write", writing_skill)
graph.add_node("review", review_skill)
graph.add_edge("research", "write")
graph.add_edge("write", "review")
```

### Semantic Kernel

```python
# Semantic Kernel: Skills als Plugins
kernel = Kernel()
kernel.add_plugin(CodeReviewPlugin(), "code_review")
kernel.add_plugin(DeployPlugin(), "deploy")

# Planner wählt automatisch relevante Skills
result = await kernel.invoke(planner, input="Reviewe und deploye den Code")
```

### CrewAI

```python
# CrewAI: Skills als Tools für Agents mit Rollen
from crewai import Agent, Task, Crew

reviewer = Agent(
    role="Senior Code Reviewer",
    tools=[code_analysis_tool, security_scanner],
    backstory="10 Jahre Erfahrung in Code Reviews"
)

task = Task(
    description="Reviewe die letzten Änderungen",
    agent=reviewer
)
```

---

## Skill Marketplace und Distribution

### Anthropic Skills Repository

- **GitHub**: github.com/anthropics/skills
- **Inhalt**: Offizielle Beispiel-Skills und Dokumenten-Skills (PDF, DOCX, XLSX, PPTX)
- **Lizenz**: Apache 2.0 (Beispiele), Source-Available (Dokumenten-Skills)

### Community Marketplace

- **claudemarketplace.com**: Community-kuratiert, 150+ Skills (Stand März 2026)
- **Kategorien**: Development, Creative, Enterprise, Documentation

### Plugin-System

```bash
# Plugin mit Skills installieren
/plugin marketplace add anthropics/skills

# Spezifisches Skill-Set installieren
/plugin install document-skills@anthropic-agent-skills
```

---

## Ausblick: Wohin entwickelt sich das Ökosystem?

### 2026 Trends

1. **Skill Discovery Protocols** — Automatisierte Entdeckung von Skills über Netzwerk
2. **Skill Learning** — Agents generieren selbstständig neue Skills basierend auf Erfahrung
3. **Enterprise Skill Governance** — Zentrale Verwaltung, Audit, Compliance
4. **Multi-Agent Skill Sharing** — Skills als gemeinsame Ressource in Agent-Netzwerken
5. **Skill Composition Engines** — Automatisches Kombinieren von Skills für komplexe Aufgaben
