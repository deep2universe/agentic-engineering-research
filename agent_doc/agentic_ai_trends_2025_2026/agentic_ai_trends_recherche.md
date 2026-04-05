# Agentic AI und Skills: Trends und Entwicklungen 2025/2026

> Recherche-Datum: 2026-04-05
> Alle Quellen sind in `_quellen.md` dokumentiert.

---

## 1. State of Agentic AI 2025/2026 - Wo steht die Industrie?

### Marktentwicklung und Adoption

- Der Enterprise Agentic AI Markt hat 2026 ein Volumen von **7,51 Mrd. USD** erreicht, mit einer jaehrlichen Wachstumsrate (CAGR) von **27,3%**.
- Der gesamte AI-Agent-Markt wird auf **7,84 Mrd. USD (2025)** geschaetzt und soll bis 2030 auf **52,62 Mrd. USD** anwachsen (CAGR: 46,3%).
- **Gartner** prognostiziert, dass **40% der Enterprise-Anwendungen** bis Ende 2026 AI Agents einbetten werden (gegenueber weniger als 5% in 2025).
- **Microsoft** bezeichnet 2026 als "Year of the Agent" -- fast **70% der Business-Fuehrungskraefte** erwarten, dass autonome AI Agents die Geschaeftsablaeufe transformieren.

### Reifegradluecke

- Nur **14%** der Unternehmen haben Agentic-AI-Loesungen, die produktionsbereit sind.
- Lediglich **11%** nutzen Agentic-AI-Systeme aktiv in der Produktion.
- **93%** der Engineering-Fuehrungskraefte erwarten substanzielle Produktivitaetsgewinne, aber nur **3%** berichten von transformativer Wirkung.
- **Gartner** sagt voraus, dass **ueber 40% der Agentic-AI-Projekte bis 2027 scheitern** werden, wenn keine angemessenen Kontrollen etabliert werden.

### Paradigmenwechsel: Von Generativ zu Agentisch

- Die Industrie durchlaeuft eine "Microservices-Revolution" im Agentic-AI-Bereich: Einzelne Allzweck-Agents werden durch **orchestrierte Teams spezialisierter Agents** ersetzt.
- Gartner registrierte einen **1.445% Anstieg** bei Anfragen zu Multi-Agent-Systemen von Q1 2024 bis Q2 2025.
- Die Verlagerung geht von individueller AI-Nutzung hin zu **team- und workflowbasierter Orchestrierung**.

**Quellen:** [IBM Tech Trends 2026](https://www.ibm.com/think/news/ai-tech-trends-predictions-2026), [Deloitte Tech Trends 2026](https://www.deloitte.com/us/en/insights/topics/technology-management/tech-trends/2026/agentic-ai-strategy.html), [Google Cloud AI Agent Trends 2026](https://cloud.google.com/resources/content/ai-agent-trends-2026), [MIT Sloan Review](https://sloanreview.mit.edu/article/five-trends-in-ai-and-data-science-for-2026/)

---

## 2. Aktuelle Forschung zu Agent Skills und Capabilities

### Der SKILL.md-Standard

- Im **Dezember 2025** veroeffentlichte Anthropic die **Agent Skills Spezifikation** als offenen Standard.
- OpenAI uebernahm das Format sofort fuer **Codex CLI** und ChatGPT.
- Das Oekosystem explodierte innerhalb weniger Wochen: **96.000+ Skills** auf SkillsMP, **5.700+** auf ClawHub, **17.000+ MCP-Server** auf MCP.so.

### Progressive Disclosure als Architekturinnovation

Die zentrale architektonische Innovation von Agent Skills ist **Progressive Disclosure** -- eine dreistufige Ladestrategie:
1. **Startup**: Nur Name und Beschreibung werden geladen (~50 Tokens pro Skill)
2. **Trigger**: Der vollstaendige SKILL.md-Body wird geladen (~500-5.000 Tokens)
3. **Execution**: Referenzen, Scripts und weitere Ressourcen werden bei Bedarf geladen

### Skill Engineering als neue Disziplin

- **Skill Engineering** entwickelt sich 2026 zu einer eigenstaendigen Disziplin -- der Uebergang von einmaligen Prompt-Instruktionen zu **persistenten, ordnerbasierten Expertise-Paketen**.
- Kernkompetenzen umfassen: Prompt Engineering, Planung und Reasoning, Tool Use und API-Orchestrierung, Memory und Knowledge Management sowie Autonomie-Kontrollmechanismen.

### Sicherheitsbedenken

- Bis **Februar 2026** wurden **341 boesartige Skills** auf Community-Hubs identifiziert (Datenexfiltration, Credential-Diebstahl).
- **7,1% der Skills** auf ClawHub leaken API Keys durch hardcodierte Credentials.
- Ein CData-Audit von 2.600+ MCP-Servern ergab: **82% anfaellig fuer Path Traversal**, **67% fuer Code Injection**.

**Quellen:** [Agent Skills - Claude API Docs](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/overview), [The New Stack - Agent Skills Standard](https://thenewstack.io/agent-skills-anthropics-next-bid-to-define-ai-standards/), [SKILL.md-Standard erklaert](https://medium.com/@loccarrre/the-agent-skills-standard-how-a-simple-skill-md-file-turns-ai-agents-into-on-demand-specialists-172af1d9737d)

---

## 3. Neue Frameworks und Tools fuer Agentic Engineering

### Paradigmenwechsel: Von Vibe Coding zu Agentic Engineering

- Anfang 2026 erklaerte die Tech-Industrie Vibe Coding fuer ueberholt und fuehrte **Agentic Engineering** als strukturiertes Paradigma ein.
- **Andrej Karpathy** praegte diesen Wandel massgeblich mit.
- Im neuen Entwicklungszustand schreiben Menschen **weniger als 1% des Codes direkt** -- stattdessen orchestrieren sie mehrere spezialisierte AI Agents.

### Wichtige Frameworks und Plattformen (Stand 2026)

| Framework/Tool | Beschreibung |
|---|---|
| **Spring AI Agent Skills** | Modulare, wiederverwendbare Agent Skills in Spring-Anwendungen |
| **Google ADK (Agent Development Kit)** | Googles Framework fuer Agent-Entwicklung mit integriertem A2A-Support |
| **Gemma 4** | Googles Edge-Modell mit State-of-the-Art Agentic Skills |
| **Model Context Protocol (MCP)** | Anthropics Standard fuer Tool-Integration (de facto Standard) |
| **Agent2Agent Protocol (A2A)** | Googles Protokoll fuer Agent-Interoperabilitaet |
| **AgentSkills.io** | Offene Spezifikation und Community fuer Agent Skills |

### Cost-Optimierung: Plan-and-Execute Pattern

Das **Plan-and-Execute-Pattern** -- bei dem ein leistungsstarkes Modell die Strategie erstellt und guenstigere Modelle sie ausfuehren -- kann die Kosten um **90%** senken gegenueber der durchgehenden Nutzung von Frontier-Modellen.

### Akademische Verankerung

- **AGENT 2026** -- International Workshop on Agentic Engineering bei der ICSE 2026 Konferenz zeigt die akademische Anerkennung des Feldes.

**Quellen:** [CIO - Agentic Engineering 2026](https://www.cio.com/article/4134741/how-agentic-ai-will-reshape-engineering-workflows-in-2026.html), [Karpathys Shift zu Agentic Engineering](https://buttondown.com/verified/archive/the-end-of-vibe-coding-andrej-karpathys-shift-to/), [Spring AI Agent Skills](https://spring.io/blog/2026/01/13/spring-ai-generic-agent-skills/), [Google ADK mit A2A](https://google.github.io/adk-docs/a2a/)

---

## 4. Enterprise Adoption von AI Agents und Skills

### Adoptionsstatus Q1 2026

- **35%** der Organisationen berichten von breiter AI-Agent-Nutzung.
- **27%** experimentieren in begrenztem Umfang.
- **17%** haben Agents unternehmensweit ausgerollt.
- **81%** der Teams sind ueber die Planungsphase hinaus, aber nur **14,4%** haben volle Security-Freigabe.

### Zentrale Herausforderungen

1. **Governance-Luecke**: Nur jedes fuenfte Unternehmen hat ein ausgereiftes Governance-Modell fuer autonome AI Agents.
2. **Agent Sprawl**: Teams bauen unabhaengig voneinander Agents mit unterschiedlichen Tools und Stacks -- eine der groessten Governance-Herausforderungen 2026.
3. **Infrastruktur und Kosten**: IDC prognostiziert eine **1.000-fache Steigerung** der Inference-Anforderungen bis 2027.
4. **Sicherheitsrisiken**: **88%** der Organisationen bestaetigen oder vermuten Sicherheitsvorfaelle in 2026. Nur **22%** behandeln Agents als eigenstaendige Identitaeten.
5. **Pilot-to-Production-Gap**: Viele Piloten, wenige skalierte Deployments.

### Governance als Enabler

Der Paradigmenwechsel 2026: Governance wird nicht mehr als Compliance-Overhead betrachtet, sondern als **Enabler** -- ausgereifte Governance-Frameworks erhoehen das organisatorische Vertrauen, Agents in hoeherwertigen Szenarien einzusetzen.

**Quellen:** [Deloitte State of AI Enterprise 2026](https://www.deloitte.com/us/en/what-we-do/capabilities/applied-artificial-intelligence/content/state-of-ai-in-the-enterprise.html), [State of AI Agent Security 2026](https://www.gravitee.io/blog/state-of-ai-agent-security-2026-report-when-adoption-outpaces-control), [Gartner/IDC Adoption Data](https://joget.com/ai-agent-adoption-in-2026-what-the-analysts-data-shows/)

---

## 5. Skill Marketplaces und Skill Sharing Ecosystems

### Fuehrende Marketplaces

| Marketplace | Skill-Anzahl | Besonderheiten |
|---|---|---|
| **SkillsMP** | 66.500+ | Fuehrender Marketplace fuer Claude Code und Codex |
| **ClawHub** | 5.700+ | Community-Hub (Sicherheitsbedenken: 7,1% leaken API Keys) |
| **SkillDepot** | 3.800+ | Framework-agnostisch, 90/10 Revenue Split fuer Creators |
| **LobeHub Skills** | k.A. | Marketplace fuer Claude, Codex und ChatGPT Skills |
| **SkillsLLM** | k.A. | Spezialisierter AI Skills Marketplace |
| **MCP.so** | 17.000+ MCP-Server | Umfassendstes MCP-Server-Verzeichnis |

### Kompatibilitaet und Standards

- Alle Skills nutzen den offenen **SKILL.md-Standard**, kompatibel mit Claude Code, OpenAI Codex CLI und weiteren Tools.
- Agent Skills werden von **16+ Tools** unterstuetzt: Claude Code, Cursor, OpenAI Codex, Gemini CLI, JetBrains Junie, GitHub Copilot, VS Code, OpenHands, OpenCode, Amp, Goose (Block), Firebender, Letta, Mux (Coder), Autohand u.a.

### Die Skill Economy 2026

- Der Uebergang von **ephemeren Chat-Instruktionen** zu **persistenten, ordnerbasierten Expertise-Paketen** definiert die Skill Economy.
- Skill-Creators koennen ueber Plattformen wie SkillDepot (90/10 Revenue Split) Skills monetarisieren.
- **Sicherheit als Bottleneck**: Die wachsende Skill Economy kaempft mit Qualitaets- und Sicherheitsstandards.

**Quellen:** [SkillsMP](https://skillsmp.com/), [SkillDepot](https://earezki.com/ai-news/2026-04-02-building-the-app-store-for-ai-agent-skills/), [Skill Economy 2026](https://stormy.ai/blog/2026-skill-economy-claude-mcp-marketing-skills)

---

## 6. Agent-to-Agent Communication und Skill Discovery

### Agent2Agent (A2A) Protocol

- Von **Google im April 2025** eingefuehrt, jetzt unter der **Linux Foundation** als Open-Source-Projekt.
- Aktuell bei **Release Version 0.3** -- stabilere Schnittstelle fuer Enterprise-Adoption.
- Unterstuetzt **multimodale Kommunikation** inklusive Audio- und Video-Streaming.
- Agents bewerben ihre Faehigkeiten ueber **"Agent Cards"** im JSON-Format.
- Gestartet mit **50+ Technologiepartnern**: Atlassian, Box, Cohere, Intuit, Langchain, MongoDB, PayPal, Salesforce, SAP, ServiceNow, UKG, Workday u.a.

### Zusammenspiel MCP + A2A

| Protokoll | Zweck | Analogie |
|---|---|---|
| **MCP** | Agent-zu-Tool-Kommunikation | USB-Standard fuer Peripheriegeraete |
| **A2A** | Agent-zu-Agent-Kommunikation | Netzwerkprotokoll zwischen Systemen |

### Skill Discovery Mechanismus

- Bei der Initialisierung scannt **SkillsTool** konfigurierte Skills-Verzeichnisse und parst das YAML-Frontmatter aus jeder SKILL.md-Datei.
- Agents koennen relevante Skills **automatisch identifizieren und laden** ohne manuellen Eingriff.
- Die Discovery basiert auf dem dreistufigen **Progressive-Disclosure-Modell**.

**Quellen:** [Google A2A Announcement](https://developers.googleblog.com/en/a2a-a-new-era-of-agent-interoperability/), [A2A Protocol](https://a2a-protocol.org/latest/), [IBM A2A Erklaerung](https://www.ibm.com/think/topics/agent2agent-protocol)

---

## 7. Autonomous Coding Agents - Skills und Capabilities

### Vergleich der fuehrenden Coding Agents 2026

| Agent | Typ | Staerke | Preis | "Most Loved" |
|---|---|---|---|---|
| **Claude Code** | Terminal-native Agent | Tiefes Codebase-Verstaendnis, autonome Multi-File-Aenderungen, lange Agentic Sessions | Nutzungsbasiert | **46%** |
| **Cursor** | Standalone AI IDE | Inline-Assistenz, Autocomplete, interaktives Editing | $20/Monat | **19%** |
| **GitHub Copilot** | Multi-IDE Extension | Repetitive, musterbasierte Codierung, Boilerplate | $10/Monat | **9%** |
| **Devin** | Vollautonomer Agent | End-to-End Softwareentwicklung, arbeitet unabhaengig | Enterprise-Preis | k.A. |
| **Windsurf** | AI IDE (jetzt Cognition) | IDE-Integration + autonome Faehigkeiten (nach Devin-Uebernahme) | k.A. | k.A. |

### Kernergebnisse

- **85% der Entwickler** nutzen Ende 2025 regelmaessig AI-Tools zum Codieren.
- Entwickler nutzen AI in ca. **60% ihrer Arbeit**, koennen aber nur **0-20% der Aufgaben vollstaendig delegieren**.
- Der haeufigste Profi-Stack: **Cursor fuer taegliches Editing + Claude Code fuer komplexe Aufgaben**.

### Cognition uebernimmt Windsurf

- **Juli 2025**: Cognition (Hersteller von Devin) uebernimmt Windsurf.
- Die Roadmap sieht vor, **Devin in Windsurfs IDE zu integrieren** -- Planung, Delegation an AI Agents und Pull-Request-Review in einer Oberflaeche.
- Teams koennen **mehrere Devins gleichzeitig** auf verschiedenen Engineering-Aufgaben laufen lassen.

### Die "Supervisor Class"

- Fortune beschreibt die Entstehung einer **"Supervisor Class"** von Entwicklern, die nicht mehr primaer Code schreiben, sondern Skills und Orchestrierungs-Layer aufbauen.
- Der Kernwert hat sich verschoben: von **Syntax-Kenntnissen** zu **High-Level Judgement**, Architektur und Code-Review.

**Quellen:** [Faros AI Coding Agents Review](https://www.faros.ai/blog/best-ai-coding-agents-2026), [Fortune - Supervisor Class](https://fortune.com/2026/03/31/fortune-com-2026-03-26-ai-agents-vibe-coding-developer-skills-supervisor-class/), [Anthropic Agentic Coding Report](https://resources.anthropic.com/hubfs/2026%20Agentic%20Coding%20Trends%20Report.pdf), [Cognition acquires Windsurf](https://techcrunch.com/2025/07/14/cognition-maker-of-the-ai-coding-agent-devin-acquires-windsurf/)

---

## 8. Zukunftstrends: Skill Learning, Skill Generation, Meta-Skills

### Meta-Skills und selbstgenerierende Systeme

- **Skill Writer** ist ein Meta-Skill, der Agents beim Erstellen neuer Skills unterstuetzt -- ein "AI-Tutor", der das SKILL.md-Format und Best Practices kennt.
- **Meta-Kognition** als Zukunftsvision: Systeme, die ihre eigenen Denkprozesse ueberwachen, ihre Leistung bewerten und erfolgreiche Strategien permanent kodifizieren.
- Durch Behandlung des agentskills.io-Standards als **mutierbaren, agent-authored Memory** entstehen selbstheilende Systeme.

### Skill Engineering Roadmap

Die Evolution des Skill-Konzepts:
1. **2024**: Einmalige Prompts und Chat-Instruktionen
2. **2025**: MCP und Tool-Integration; SKILL.md-Standard-Einfuehrung
3. **2026**: Persistente Skill-Pakete, Marketplaces, Skill Economy
4. **Naechste Phase**: Autonomes Skill Learning, Skill Generation durch Agents, Meta-Skill-Oekosysteme

### Domainspezifische Trends

- **Kleinere, domainspezifische Modelle** werden praeziser als grosse Generalisten -- multimodal und leichter fuer spezifische Domaenen anpassbar.
- **Edge Deployment**: Google bringt mit Gemma 4 State-of-the-Art Agentic Skills auf Edge-Geraete.
- **Plan-and-Execute-Architektur**: Ein leistungsstarkes Modell plant, guenstigere Modelle fuehren aus (90% Kostenreduktion).

### Orchestrierte Super-Agent-Oekosysteme

- 2026 markiert den Beginn von **orchestrierten Super-Agent-Oekosystemen**, die durch robuste Kontrollsysteme gesteuert werden.
- Die "Puppeteer"-Architektur: Ein Orchestrator koordiniert spezialisierte Agents, die jeweils fuer bestimmte Faehigkeiten feinabgestimmt sind.
- IDC prognostiziert eine **1.000-fache Steigerung der Inference-Anforderungen** bis 2027.

**Quellen:** [Meta-Cognitive Agent Skills](https://medium.com/google-cloud/designing-meta-cognitive-agent-skills-ce9db69821d9), [Skill Engineering 2026](https://pub.towardsai.net/skill-engineering-in-2026-how-to-build-ai-agent-skills-that-actually-work-26429abc6054), [Google Gemma 4 Agentic Skills](https://developers.googleblog.com/bring-state-of-the-art-agentic-skills-to-the-edge-with-gemma-4/)

---

## Zusammenfassung: Die wichtigsten Erkenntnisse

| Bereich | Kernaussage |
|---|---|
| **Markt** | 7,5 Mrd. USD in 2026; 40% der Enterprise-Apps mit eingebetteten Agents bis Ende 2026 |
| **Standards** | SKILL.md (Anthropic) + MCP + A2A (Google) bilden das Fundament |
| **Oekosystem** | 96.000+ Skills auf SkillsMP; 16+ kompatible Tools |
| **Coding Agents** | Claude Code fuehrt mit 46% "Most Loved"; Cursor + Claude Code als Profi-Stack |
| **Adoption** | 81% ueber Planungsphase hinaus, aber nur 14,4% mit Security-Freigabe |
| **Sicherheit** | 88% der Organisationen mit Sicherheitsvorfaellen; 82% der MCP-Server verwundbar |
| **Zukunft** | Meta-Skills, selbstgenerierende Skill-Systeme, orchestrierte Super-Agent-Oekosysteme |
| **Paradigma** | Von Vibe Coding zu Agentic Engineering; von Syntax-Wissen zu Architektur-Kompetenz |
