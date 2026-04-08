# PL/I zu Java Migration mit AWS -- Reading Guide

> Stand: April 2026 | Zielgruppe: Senior Developer und Senior Architekten

Diese Deep-Research-Sammlung ergaenzt die bestehende COBOL-zu-Java-Dokumentation
in `agent_doc/cobol-migration_aws/` und fokussiert sich auf die PL/I-spezifischen
Aspekte einer Mainframe-Modernisierung mit AWS-Mitteln im Jahr 2026.

## Leseempfehlung

1. `executive_summary_pl1_zu_java.md` -- Management-Kurzfassung, Kernbotschaften
2. `pl1_sprache_und_migrationsherausforderungen.md` -- Sprache, Storage, Pointer, ON-Units, Typ-Mapping
3. `aws_pl1_zu_java_feature_uebersicht.md` -- Vollstaendige AWS-Feature-Matrix fuer PL/I
4. `agentic_engineering_workflows_pl1.md` -- Custom-Agents, Claude Agent SDK, Bedrock AgentCore, Kiro
5. `mid_migration_50_prozent_rescue.md` -- Rescue-Workflows fuer gestuerzt-Projekte
6. `testabdeckung_und_testing_strategien.md` -- Testing-Kompendium mit Agentic-Ansatz
7. `markt_und_alternative_pl1_tools.md` -- Non-AWS-Tools als Kontext
8. `best_practices_pl1_to_java.md` -- PL/I-spezifische Best Practices und Fallstricke

## Was hier NICHT nochmal dokumentiert wird

Die folgenden Themen sind bereits in `agent_doc/cobol-migration_aws/` abgedeckt
und gelten fuer PL/I analog:

- AWS Mainframe Modernization Service (M2) Grundlagen
- AWS Transform Assessment/Planning/Test-Agenten-Architektur
- Blu Age Engine Grundprinzipien
- Strangler Fig Pattern, Anti-Corruption Layer, CQRS, Event-Driven Patterns
- Allgemeine Best Practices fuer Dual-Run, Golden Master, Wave Planning
- Allgemeine Tool-Landschaft (IBM watsonx, Google Cloud, Azure etc. fuer COBOL)

Verweise werden explizit gesetzt, wenn ein PL/I-Dokument auf COBOL-Basiswissen aufbaut.

## Quellen

Jede Sektion pflegt eine eigene `_quellen_*.md` Datei. Die zentrale
`_quellen.md` konsolidiert alle Quellen am Projektende.
