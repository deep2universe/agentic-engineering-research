---
title: "Uebersicht"
parent: Agentic Engineering Patterns
nav_order: 1
---

# Agentic Engineering: Prinzipien und Patterns

## Vollständiger Guide für Senior Developer und Senior Architekten

**Stand:** 2026-04-04

---

## Inhaltsverzeichnis

![Guide Map — Übersicht aller Kapitel](images/aep-00_guide_map.png)

| Nr. | Dokument | Inhalt |
|-----|----------|--------|
| 01 | [Grundlagen und Definitionen](AEP-01-Grundlagen) | Was ist Agentic Engineering? Kernkonzepte, Abgrenzungen |
| 02 | [Architektur-Prinzipien](AEP-02-Architektur-Prinzipien) | Fundamentale Design-Prinzipien für Agent-Systeme |
| 03 | [Workflow Patterns](AEP-03-Workflow-Patterns) | Prompt Chaining, Routing, Parallelization, Orchestrator-Worker, Evaluator-Optimizer |
| 04 | [Reasoning und Planning Patterns](AEP-04-Reasoning-Planning-Patterns) | ReAct, Chain of Thought, Tree of Thought, Reflection, Planning |
| 05 | [Multi-Agent Patterns](AEP-05-Multi-Agent-Patterns) | Orchestrierung, Kommunikation, Delegation, Swarm, Hierarchisch |
| 06 | [Tool Use und Context Engineering](AEP-06-Tool-Use-Context-Engineering) | Function Calling, MCP, Memory, RAG, Context Management |
| 07 | [Resilience und Error Handling Patterns](AEP-07-Resilience-Error-Handling) | Retry, Fallback, Circuit Breaker, Graceful Degradation |
| 08 | [Safety, Security und Guardrails](AEP-08-Safety-Security-Guardrails) | Prompt Injection Defense, Sandboxing, Input/Output Validation |
| 09 | [Human-in-the-Loop Patterns](AEP-09-Human-in-the-Loop) | Approval Workflows, Escalation, Confidence-Based Routing |
| 10 | [Observability und Evaluation](AEP-10-Observability-Evaluation) | Tracing, Monitoring, Testing, Benchmarking |
| 11 | [Praxis: Frameworks und Implementierung](AEP-11-Frameworks-Implementierung) | LangGraph, CrewAI, AutoGen, Claude Code, OpenAI Agents SDK |
| 12 | [Agentic Coding Patterns (Simon Willison)](AEP-12-Agentic-Coding-Patterns) | Patterns für die Arbeit mit Coding Agents |
| 13 | [Agent-Skill-Architektur](13_agent_skill_architektur.md) | SKILL.md-Spezifikation, Progressive Disclosure, Skill Design Patterns, Decomposition, Orchestration, Composition |

---

## Zusammenfassung

Agentic Engineering ist die Disziplin des Entwerfens, Bauens und Betreibens von KI-Agent-Systemen, die autonom Aufgaben ausführen können. Dieser Guide dokumentiert die etablierten Prinzipien und Patterns, die sich bis 2026 als Standard herauskristallisiert haben.

### Kernaussagen

![6 Kernaussagen des Agentic Engineering](images/aep-00_kernaussagen.png)

1. **Einfachheit vor Komplexität** — Die erfolgreichsten Agent-Implementierungen nutzen einfache, komponierbare Patterns statt komplexer Frameworks (Anthropic).

2. **Workflows vs. Agents** — Es gibt eine fundamentale Unterscheidung zwischen vordefinierten Workflows (deterministische Pfade) und echten Agents (LLM-gesteuerte Entscheidungen).

3. **Context Engineering ist die neue Schlüsselkompetenz** — Performance-Gewinne kommen 2026 nicht mehr aus cleveren Prompts, sondern aus dynamischer Kontextauswahl, Kompression und Memory-Management.

4. **Defense-in-Depth für Safety** — Mehrere Sicherheitsschichten sind unverzichtbar: Input-Validierung, Guardrails, Sandboxing, Output-Filterung.

5. **Observability als Grundvoraussetzung** — Nicht-deterministisches Verhalten erfordert strukturiertes Tracing über alle Agent-Schritte hinweg.

6. **Human-in-the-Loop als Design-Pattern** — Menschliche Aufsicht ist kein Notbehelf, sondern ein bewusstes Architektur-Pattern.
