# Quellen: Agentic Engineering Workflows & Mid-Migration Rescue (neu)

Diese Datei ergaenzt `_quellen_agentic_rescue.md` um neue Quellen aus April 2026.
Die hier gefuehrten Eintraege sind frische Ergebnisse zu Claude Agent SDK, Amazon Bedrock
AgentCore (GA-Erweiterungen 2026), Kiro Forward-Engineering sowie aktuellen Rescue-
Playbooks fuer stagnierte Mainframe-Migrationen.

## Suchstring: "Claude Agent SDK Python subagents MCP tool use 2026"

- **URL:** https://platform.claude.com/docs/en/agent-sdk/overview
  **Zusammenfassung:** Overview-Seite des Claude Agent SDK (Python 0.1.48, TypeScript 0.2.71, Stand Maerz 2026). Beschreibt Agent-Loop, Tool-Use, Kontext-Management als Primitive. Vier Kern-Konzepte: Tools, Hooks, MCP-Servers, Subagents.
  **Datum:** 2026-04-09

- **URL:** https://platform.claude.com/docs/en/agent-sdk/subagents
  **Zusammenfassung:** Subagents als isolierte Agent-Instanzen mit eigenem Kontext-Fenster, Tool-Restrictions und optional eigenem Modell. Definition via `agents`-Parameter, ideal fuer parallele Analyse.
  **Datum:** 2026-04-09

- **URL:** https://platform.claude.com/docs/en/agent-sdk/mcp
  **Zusammenfassung:** MCP-Integration: lokale Prozesse, HTTP-Server oder in-process MCP-Server direkt im SDK. Custom-Tools via `@tool`-Dekorator und `create_sdk_mcp_server`.
  **Datum:** 2026-04-09

- **URL:** https://platform.claude.com/docs/en/agent-sdk/python
  **Zusammenfassung:** Python-SDK-Reference: `ClaudeSDKClient`, `query`, `AssistantMessage`, `ToolUseBlock`, Hooks-Registrierung, Permission-Modes.
  **Datum:** 2026-04-09

- **URL:** https://github.com/anthropics/claude-agent-sdk-python
  **Zusammenfassung:** Offizielles Repo mit Beispielen (quick_start.py, streaming_mode.py, mcp_calculator.py). Zeigt `@tool`, `create_sdk_mcp_server`, `ClaudeAgentOptions`.
  **Datum:** 2026-04-09

- **URL:** https://pypi.org/project/claude-agent-sdk/
  **Zusammenfassung:** PyPI-Seite, Version 0.1.48. Installation `pip install claude-agent-sdk`. Min. Python 3.10.
  **Datum:** 2026-04-09

## Suchstring: "Amazon Bedrock AgentCore memory gateway observability 2026"

- **URL:** https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/observability.html
  **Zusammenfassung:** Observability-Devguide. Metrics, Spans, Logs je Ressourcentyp (Runtime, Memory, Gateway). OpenTelemetry-Integration Out-of-the-box.
  **Datum:** 2026-04-09

- **URL:** https://aws.amazon.com/blogs/aws/amazon-bedrock-agentcore-adds-quality-evaluations-and-policy-controls-for-deploying-trusted-ai-agents/
  **Zusammenfassung:** Neue GA-Module: Policy (GA seit 2026-03-03) und Evaluations (GA seit 2026-03-31). Trusted-Agents mit Policy-Guardrails und quantitativen Evals.
  **Datum:** 2026-04-09

- **URL:** https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/observability-memory-metrics.html
  **Zusammenfassung:** Memory-Observability-Metriken (read/write latencies, eviction rates), CloudWatch-Log-Group `/aws/vendedlogs/bedrock-agentcore/memory/...`.
  **Datum:** 2026-04-09

- **URL:** https://docs.aws.amazon.com/bedrock-agentcore/latest/devguide/observability-gateway-metrics.html
  **Zusammenfassung:** Gateway-Metriken: Tool-Invocations, Latenzen, Fehler. Zentrale Stelle fuer MCP-exponierte Enterprise-Tools.
  **Datum:** 2026-04-09

- **URL:** https://aws.amazon.com/bedrock/agentcore/faqs/
  **Zusammenfassung:** FAQ zu Runtime (8h Session-Windows), Framework-Agnostik (Strands, LangGraph, CrewAI, Claude Agent SDK), A2A-Support.
  **Datum:** 2026-04-09

- **URL:** https://aws.amazon.com/blogs/machine-learning/introducing-amazon-bedrock-agentcore-gateway-transforming-enterprise-ai-agent-tool-development/
  **Zusammenfassung:** Gateway als Adapter: REST/Lambda -> MCP-Tool. Zentrale Tool-Registry mit Authn/Authz via AgentCore Identity.
  **Datum:** 2026-04-09

## Suchstring: "Kiro AWS spec-driven development hooks mainframe reimagine 2026"

- **URL:** https://kiro.dev/
  **Zusammenfassung:** Kiro-Produktseite. Specs, Steering Files und Hooks als Kern. Agent-IDE mit autonomen + supervidierten Modi.
  **Datum:** 2026-04-09

- **URL:** https://docs.aws.amazon.com/transform/latest/userguide/transform-forward-engineering-tutorial.html
  **Zusammenfassung:** Forward-Engineering-Tutorial. Kiro konsumiert AWS Transform-Exports (Specs + Business Rules) fuer Reimagine.
  **Datum:** 2026-04-09

- **URL:** https://docs.aws.amazon.com/transform/latest/userguide/transform-forward-engineering-tutorial-codegen.html
  **Zusammenfassung:** Codegen-Schritte: Import, Task-Aufteilung, iterative Code-Generation, Review in Kiro.
  **Datum:** 2026-04-09

## Suchstring: "stalled mainframe migration rescue mid-project playbook 2026"

- **URL:** https://www.wednesday.is/writing-articles/mainframe-to-cloud-migration-failed
  **Zusammenfassung:** Rescue-Framework in 3 Schritten: Inventarisierung, Triage, gestaffelter Neustart. Haupt-Stall-Gruende: Vendor-Lock-In, Skill-Gap, Parallel-Run-Drift.
  **Datum:** 2026-04-09

- **URL:** https://www.wednesday.is/writing-articles/mainframe-modernization-stalled
  **Zusammenfassung:** "Hybrid-Delivery-Engine" Pattern fuer un-rescuable-Projekte. Shared KPIs, Brueckenteam, harte Wave-Re-Planung.
  **Datum:** 2026-04-09

- **URL:** https://www.zengines.ai/resource-collection/why-its-so-hard-to-leave-the-mainframe-the-real-challenges-of-legacy-system-migration
  **Zusammenfassung:** "Hidden Operators" und fragile Batch-Schedules als Haupttreiber fuer Mid-Migration-Schmerzen.
  **Datum:** 2026-04-09

## Suchstring: "multi-agent orchestration code migration analyzer transformer reviewer"

- **URL:** https://github.com/Azure-Samples/Legacy-Modernization-Agents
  **Zusammenfassung:** Microsoft-Referenz fuer Multi-Agent-Pipeline: DependencyAgent, BusinessLogicExtractorAgent, JavaConversionAgent, TestAgent. Als Blueprint uebertragbar auf PL/I.
  **Datum:** 2026-04-09

- **URL:** https://github.blog/ai-and-ml/github-copilot/how-github-copilot-and-ai-agents-are-saving-legacy-systems/
  **Zusammenfassung:** GitHub-Blog zu AI-Agenten im Legacy-Rescue: Reader / Tracer / Diagrammer / Rewriter-Pipeline.
  **Datum:** 2026-04-09

- **URL:** https://solutionshub.epam.com/blog/post/cobol-code
  **Zusammenfassung:** EPAM-Guide zu GenAI-Rule-Extraction. Auch PL/I-relevant (gleiche Techniken: Slicing, Chunking, Graph-Assist).
  **Datum:** 2026-04-09
