# Multi-Agent Patterns und Orchestrierung -- Vollständiger Bericht (2026)

## 1. Einführung und Marktentwicklung

Multi-Agent-Systeme haben sich 2025/2026 vom experimentellen Konzept zum Enterprise-Standard entwickelt. Gartner verzeichnete einen Anstieg der Anfragen zu Multi-Agent-Systemen um **1.445 %** von Q1 2024 bis Q2 2025. Organisationen, die Multi-Agent-Architekturen einsetzen, erzielen laut aktuellen Benchmarks **45 % schnellere Problemlösung** und **60 % genauere Ergebnisse** im Vergleich zu Single-Agent-Systemen. Deloitte prognostiziert für 2026 den Übergang von "Human-in-the-Loop" zu "Human-on-the-Loop" Orchestrierung.

---

## 2. Orchestrierungs-Patterns

### 2.1 Supervisor Pattern (Hierarchisch/Zentralisiert)

**Beschreibung:** Ein zentraler Orchestrator-Agent empfängt alle Benutzeranfragen, zerlegt sie in Teilaufgaben, delegiert an spezialisierte Sub-Agents, überwacht den Fortschritt, validiert Ergebnisse und synthetisiert eine finale Antwort.

**Architektur:**
- Zentraler Supervisor mit globalem Überblick
- Spezialisierte Worker-Agents für einzelne Aufgaben
- Unidirektionaler Kontrollfluss (top-down)
- Supervisor wählt das leistungsfähigste Modell; Worker nutzen das günstigste geeignete Modell

**Vorteile:**
- Klarer, nachvollziehbarer Kontrollfluss
- Einfaches Debugging und Monitoring
- Zentrale Fehlerbehandlung und Konfliktlösung
- Geeignet für strukturierte Business-Workflows

**Nachteile:**
- Supervisor kann zum Bottleneck werden
- Zusätzlicher Round-Trip-Overhead durch die zentrale "Übersetzung"
- Sub-Agents können nicht direkt mit dem Benutzer kommunizieren
- Single Point of Failure

**Frameworks:** LangGraph Supervisor, Kore.ai Supervisor, Microsoft Semantic Kernel

---

### 2.2 Swarm Pattern (Dezentralisiert/Peer-to-Peer)

**Beschreibung:** Agents agieren als gleichberechtigte Peers ohne zentralen Koordinator. Jeder Agent kann mit jedem anderen kommunizieren, und die Kontrolle fließt dynamisch basierend auf dem Konversationszustand. Das System merkt sich den zuletzt aktiven Agent, sodass Folgenachrichten nahtlos bei ihm fortgesetzt werden.

**Architektur:**
- Keine zentrale Steuerungsinstanz
- Agents halten explizite Tools für Handoffs an Peers
- Direkte Agent-zu-Agent-Kommunikation
- Inspiriert von Schwarmintelligenz in der Natur

**Vorteile:**
- Direkte Agent-to-Agent Handoffs ohne Overhead
- Höhere Resilienz (kein Single Point of Failure)
- Bessere Performance bei offenen Explorationsaufgaben
- Agents können direkt mit dem Benutzer interagieren

**Nachteile:**
- Schwieriger zu debuggen und zu beobachten
- Weniger Kontrolle über den Gesamtfluss
- Herausfordernd bei strukturierten Workflows

**Frameworks:** OpenAI Swarm/Agents SDK, LangGraph Swarm

---

### 2.3 Handoff Pattern (Dynamische Delegation)

**Beschreibung:** Die zentrale Abstraktion ist der Handoff: Agents übergeben die Kontrolle explizit aneinander und tragen den Konversationskontext durch die Transition. Jeder Agent wird mit Instruktionen, einer Modellreferenz, Tools und einer Liste von Agents definiert, an die er delegieren kann.

**Architektur:**
- Agents bewerten die aktuelle Aufgabe
- Entscheidung: selbst bearbeiten oder an geeigneteren Agent übergeben
- Kontextübergabe bei jedem Handoff
- Auch bekannt als: Routing, Triage, Transfer, Dispatch, Delegation

**Anwendungsfälle:**
- Kundenservice-Triage (Weiterleitung an Spezialisten)
- Mehrstufige Genehmigungsprozesse
- Eskalationsmechanismen

**Frameworks:** OpenAI Agents SDK (Kernprimitive), LangGraph

---

### 2.4 Adaptive Agent Network Pattern (Dezentrale Kollaboration)

**Beschreibung:** Von Kore.ai eingeführtes Pattern, das dezentrale Kollaboration ermöglicht. Agents organisieren sich selbst und bilden dynamische Netzwerke basierend auf den Anforderungen der aktuellen Aufgabe.

**Vorteile:**
- Hohe Skalierbarkeit
- Adaptiv an wechselnde Anforderungen
- Balance zwischen Kontrolle und Flexibilität

---

### 2.5 Mesh Pattern

**Beschreibung:** Erweiterung des Swarm-Patterns, bei dem Agents ein vollständiges Netzwerk (Mesh) bilden. Jeder Agent kann potenziell mit jedem anderen kommunizieren, und es gibt definierte Kommunikationskanäle und Protokolle.

**Unterschied zum Swarm:** Das Mesh Pattern definiert explizite Kommunikationswege und Protokolle, während das Swarm Pattern auf impliziten, emergenten Handoffs basiert.

---

## 3. Workflow-Patterns

### 3.1 Sequential (Sequenziell)

**Beschreibung:** Agents arbeiten wie ein Fließband -- jeder Agent schließt seine spezifische Aufgabe ab, bevor er die Arbeit an den nächsten Agent in einer vorbestimmten Reihenfolge übergibt.

**Eigenschaften:**
- Output eines Agents wird Input des nächsten
- Vorhersagbarer Workflow-Fortschritt
- Ideal für mehrstufige Prozesse mit klaren linearen Abhängigkeiten

**Anwendungsfälle:** Datentransformations-Pipelines, Dokumentenverarbeitung, mehrstufige Analyseprozesse

---

### 3.2 Parallel (Gleichzeitig)

**Beschreibung:** Mehrere Agents führen Aufgaben gleichzeitig aus. Der Orchestrator sammelt und reconciliert die Ergebnisse.

**Eigenschaften:**
- Reduziert die Gesamtlaufzeit erheblich
- Gesamtlatenz nähert sich dem längsten Einzelschritt (nicht der Summe)
- Erfordert Konfliktlösung wenn Outputs sich widersprechen

**Anwendungsfälle:** Parallele Datenbankabfragen, gleichzeitige Recherche aus mehreren Quellen, Multi-Perspektiven-Analyse

---

### 3.3 DAG (Directed Acyclic Graph)

**Beschreibung:** Unterstützung für azyklische Graphen ermöglicht komplexe Abhängigkeitsstrukturen jenseits linearer Pipelines. Nodes werden in einer vorhersagbaren Reihenfolge gemäß Kantenabhängigkeiten ausgeführt.

**Eigenschaften:**
- Kombiniert sequentielle und parallele Elemente
- Branching Logic und bedingte Ausführung
- Vorhersagbare Ausführungsreihenfolge
- Einfacheres Debugging als bei zyklischen Graphen

---

### 3.4 Zyklische Graphen (mit Feedback-Loops)

**Beschreibung:** Erweiterung des DAG-Patterns um Zyklen, die iterative Verfeinerung und Feedback-Schleifen ermöglichen (z.B. Review-Zyklen, Reflexions-Loops).

**Frameworks:** LangGraph unterstützt explizit sowohl DAG als auch zyklische Graphen.

---

## 4. Kommunikations-Patterns zwischen Agents

### 4.1 Agents as Tools

Ein zentraler Agent orchestriert andere Agents, indem er sie als Tools/Funktionen aufruft. Die aufgerufenen Agents haben keine Autonomie und agieren als Werkzeuge im Toolset des Hauptagenten.

### 4.2 Group Chat / Council Pattern

Mehrere Agents lösen Probleme, treffen Entscheidungen oder validieren Arbeit, indem sie an einem gemeinsamen Konversations-Thread teilnehmen. Ein Chat-Manager koordiniert den Fluss und bestimmt, welche Agents als nächstes antworten können.

**Varianten:**
- **Round Robin:** Agents sprechen der Reihe nach
- **Moderated:** Ein Moderator-Agent steuert die Diskussion
- **Free-form:** Agents entscheiden selbst, wann sie beitragen

### 4.3 Debate / Konsens Pattern

Agents führen strukturierte Debatten, tauschen Argumente aus und verbessern iterativ ihre Antworten bis ein Konsens erreicht wird. Eine MIT/Google-Brain-Studie aus 2023 zeigte, dass Multi-Agent Debate die faktische Genauigkeit messbar verbessert und Halluzinationen reduziert -- weil Agents die Reasoning-Fehler anderer Agents erkennen können, die sie bei sich selbst nicht finden würden.

### 4.4 Blackboard Pattern

Ein gemeinsames Wissens-Repository (das "Blackboard"), auf dem Agents Informationen posten und abrufen. Agents kollaborieren asynchron ohne direkte Kommunikation. In Event-Driven Architekturen wird das Blackboard als Streaming-Topic implementiert.

### 4.5 Market-Based Pattern (Marktbasiert)

Ein dezentraler Marktplatz, auf dem Agents verhandeln und konkurrieren, um Aufgaben oder Ressourcen zuzuweisen. Solver-/Bieter-Agents tauschen Antworten untereinander aus und verfeinern sie über mehrere Runden, bevor ein Aggregator-Agent die finale Antwort zusammenstellt.

---

## 5. Delegation und Routing Patterns

### 5.1 LLM-basiertes Routing

State-of-the-Art für Agent Routing. LLMs verstehen Kontext und Formulierungsvarianten besser als traditionelle Intent-Classifier und können Multi-Step-Routing zu spezialisierten Agents durchführen.

### 5.2 Orchestrator-Worker Pattern

Ein zentraler Orchestrator weist Aufgaben an Worker-Agents zu und verwaltet deren Ausführung. Ähnlich dem Master-Worker Pattern in Distributed Computing. Workers fokussieren sich auf spezifische, unabhängige Aufgaben.

### 5.3 Plan-and-Execute

Der Orchestrator erstellt zunächst einen vollständigen Plan, bevor einzelne Schritte an spezialisierte Agents delegiert werden. Für die meisten kundenorientierten Produktionssysteme gilt die Kombination aus hierarchischer Architektur und Plan-and-Execute-Optimierung als Best Practice.

### 5.4 Delegationsketten-Sicherheit

Jeder Agent-Handoff multipliziert den Zugriff. Mit nahezu 97 % der nicht-menschlichen Identitäten, die bereits übermäßige Privilegien besitzen, steigt das Risiko bei jedem Hop. Sichere Delegation erfordert explizite Zugriffskontrolle an jeder Übergabestelle.

---

## 6. Agent-Kommunikationsprotokolle

### 6.1 MCP (Model Context Protocol) -- Anthropic

- **Zweck:** Universelle Tool-Zugangsschicht; standardisierte Anbindung von AI-Modellen an Tools, Datenquellen und andere Agents
- **Architektur:** JSON-RPC 2.0 basiert
- **Stärke:** Breite Adoption als Standard für Tool-Integration
- **Schwäche:** Keine standardisierten Discovery-Mechanismen; Agents werden implizit zu Tools/Funktionen degradiert, kein echtes Peer-to-Peer

### 6.2 A2A (Agent-to-Agent Protocol) -- Google

- **Zweck:** Agent-Koordinationsschicht; offener Standard für Agent-zu-Agent-Kommunikation
- **Einführung:** April 2025, unterstützt von über 50 Unternehmen (Microsoft, Salesforce u.a.)
- **Architektur:** JSON-RPC über HTTPS, Peer-to-Peer
- **Discovery:** Agent Cards -- JSON-Metadaten an Well-Known URIs, die Agent-Fähigkeiten, Skills und Authentifizierungsanforderungen beschreiben
- **Stärke:** Echte Peer-to-Peer-Kommunikation zwischen autonomen Agents

### 6.3 ACP (Agent Communication Protocol) -- IBM Research

- **Zweck:** Allgemeines Kommunikationsprotokoll über RESTful HTTP
- **Architektur:** Client-Server (nicht Peer-to-Peer), MIME-typed Multipart Messages
- **Unterstützt:** Synchrone und asynchrone Interaktionen
- **Stärke:** REST-basiert mit Agent-Registries

### 6.4 ANP (Agent Network Protocol)

- **Zweck:** Dezentrales Discovery- und Kollaborationsprotokoll für offene Internet-Agent-Marktplätze
- **Architektur:** Basiert auf Decentralized Identifiers (DIDs) und JSON-LD Graphs
- **Stärke:** Dezentrale Identität und Vertrauensmodelle

### 6.5 Protokoll-Ökosystem 2026

Die Protokolle sind komplementär -- ein produktives Enterprise-System nutzt 2026 typischerweise mehrere Protokolle gleichzeitig:
- **MCP** für Tool-Zugang
- **A2A** für Agent-Koordination
- **ACP/UCP** für kommerzielle Transaktionen

---

## 7. Framework-Implementierungen

### 7.1 LangGraph (LangChain)

- **Ansatz:** Graph-basierte Workflows mit Typed State Channels
- **Patterns:** Sequential Flows, Routing, Parallelization, Supervisor, Swarm
- **Stärken:** Maximale Flexibilität, bedingte Logik, Branching, zyklische und azyklische Graphen
- **Unterstützt:** Verschachtelung von Multi-Agent-Systemen innerhalb von Graph-Nodes (hierarchische Orchestrierung)
- **Empfehlung:** Produktive Multi-Step-Pipelines mit vorhersagbarem, debugfähigem Kontrollfluss

### 7.2 CrewAI

- **Ansatz:** Rollenbasiertes Modell -- Agents verhalten sich wie Mitarbeiter mit spezifischen Verantwortlichkeiten
- **Patterns:** Teamwork-orientierte Workflows, Built-in Delegation und Memory
- **Stärken:** Intuitiver Ansatz zur Agent-Koordination, schnelles Prototyping
- **Empfehlung:** Rapid Prototyping mit rollenbasierten Agents

### 7.3 Microsoft AutoGen

- **Ansatz:** Konversations-basierte Agent-Architektur, dynamisches Role-Playing
- **Patterns:** Conversational Multi-Agent, Human-in-the-Loop, Multi-Agent Debate
- **Stärken:** Flexible, konversationsgesteuerte Workflows; Agents adaptieren Rollen kontextabhängig
- **Empfehlung:** Konversationelle Multi-Agent-Szenarien, bei denen emergentes Verhalten akzeptabel ist

### 7.4 OpenAI Agents SDK

- **Ansatz:** Minimalistisch mit vier Kernprimitiven: Agents, Handoffs, Guardrails, Tracing
- **Patterns:** Manager-Pattern (zentraler Agent dirigiert Spezialisten), dezentrale Handoffs
- **Evolution:** Produktionsreife Weiterentwicklung des experimentellen Swarm-Projekts (März 2025)
- **AgentKit (Oktober 2025):** Visueller Drag-and-Drop Canvas für Multi-Agent-Workflows ("Canva für Agents"), Node-basiertes Workflow-Design mit Versionierung und Export zu SDK-Code
- **Provider-agnostisch:** Dokumentierte Pfade für Non-OpenAI-Modelle

### 7.5 Anthropic Claude Agent SDK

- **Ansatz:** Fünfschichtige Architektur: MCP, Skills, Agent, Subagents, Agent Teams
- **Subagents:** Parallele unabhängige Worker mit isolierten Kontextfenstern; senden nur relevante Informationen an den Orchestrator zurück
- **Agent Teams:** Vollständig unabhängige Claude-Instanzen, die direkt miteinander kommunizieren (nicht nur zurück an den Caller)
- **Best Practice:** 2-5 Teammates mit 5-6 Tasks pro Teammate als produktionsgetesteter Sweet Spot
- **Hooks:** Lifecycle-Callbacks (vor dem Denken, nach Tool-Auswahl, vor Tool-Ausführung, bei Abschluss)
- **Status:** Python v0.1.48, TypeScript v0.2.71 (Stand März 2026)

### 7.6 Google ADK (Agent Development Kit)

- **Einführung:** April 2025
- **Integration:** Nativer Support für A2A-Protokoll

### 7.7 AWS Strands Agents

- **Multi-Agent Collaboration Patterns mit Amazon Nova
- **Patterns:** Supervisor, Peer-to-Peer, Hierarchisch

---

## 8. Production Best Practices

### 8.1 Modellauswahl pro Schicht

- **Orchestrator:** Leistungsfähigstes Modell für Dekomposition und Konfliktlösung
- **Worker/Spezialisten:** Günstigstes Modell, das die spezifische Aufgabe bewältigen kann

### 8.2 Umgang mit Nicht-Determinismus

LLMs sind inhärent nicht-deterministisch. Selbst kleine 1%-Fehlerchancen potenzieren sich über Multi-Step-Tasks: Ein 10-stufiger agentischer Prozess mit 99% Erfolgsrate pro Schritt hat nur ~90,4% Gesamterfolgswahrscheinlichkeit.

### 8.3 Hierarchisch mit Plan-and-Execute

Für die meisten kundenorientierten Produktionssysteme ist die Antwort: **hierarchisch mit Plan-and-Execute-Optimierung**. Der Orchestrator übernimmt die Dekomposition und Konfliktlösung.

### 8.4 Multi-Agent Debate für Qualität

Multi-Agent Debate verbessert nachweislich die faktische Genauigkeit und reduziert Halluzinationen. Self-Correction bei LLMs ist schwach -- Modelle tendieren dazu zu rationalisieren statt zu revidieren. Ein zweiter Agent kann Fehler erkennen, die der erste Agent bei sich selbst nicht findet.

### 8.5 Sicherheit von Delegationsketten

Jeder Agent-Handoff multipliziert Zugriffsrechte. Sichere Delegation erfordert:
- Explizite Zugriffskontrolle an jeder Übergabestelle
- Minimal-Privilege-Prinzip für nicht-menschliche Identitäten
- Audit-Trails über alle Handoffs

---

## 9. Zusammenfassung der Pattern-Landschaft

| Pattern | Typ | Kontrolle | Skalierung | Debugging | Einsatzgebiet |
|---|---|---|---|---|---|
| Supervisor | Orchestrierung | Zentral | Mittel | Einfach | Strukturierte Business-Workflows |
| Swarm | Orchestrierung | Dezentral | Hoch | Schwierig | Offene Exploration |
| Handoff | Delegation | Dynamisch | Hoch | Mittel | Kundenservice, Triage |
| Sequential | Workflow | Linear | Niedrig | Einfach | Pipelines |
| Parallel | Workflow | Parallel | Hoch | Mittel | Unabhängige Tasks |
| DAG | Workflow | Graph | Hoch | Mittel | Komplexe Abhängigkeiten |
| Group Chat | Kommunikation | Moderiert | Mittel | Mittel | Entscheidungsfindung |
| Debate | Kommunikation | Demokratisch | Niedrig | Mittel | Qualitätssicherung |
| Blackboard | Kommunikation | Asynchron | Hoch | Mittel | Wissensaggregation |
| Market-Based | Kommunikation | Dezentral | Hoch | Schwierig | Ressourcenallokation |

---

*Bericht erstellt am: 2026-04-04*
*Basierend auf Recherche zu Multi-Agent Patterns und Orchestrierung Stand April 2026.*
