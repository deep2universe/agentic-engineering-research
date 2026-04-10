---
title: "Quellen"
parent: "PL/I zu Java Migration"
nav_order: 9
---

# Quellenverzeichnis PL/I-zu-Java-Research

> Dokument 9 (Referenzdatei) der PL/I-zu-Java-Research | Stand: April 2026
>
> Diese Datei sammelt alle in der Research genutzten Quellen, gruppiert nach Suchstring. Gepflegt fortlaufend gemäß den Projekt-Instruktionen in `CLAUDE.md`.

---

## Suchstring: "AWS Transform for Mainframe Refactor PL/I"

- **URL:** https://aws.amazon.com/transform/
  **Zusammenfassung:** Offizielle AWS-Produktseite zu AWS Transform — beschreibt die agentic-AI-basierte Modernisierungs-Plattform für .NET, Java, VMware und Mainframe. PL/I-Support ist seit GA (Mai 2025) dokumentiert.
  **Datum:** 2026-04-09

- **URL:** https://docs.aws.amazon.com/transform/latest/userguide/what-is-transform.html
  **Zusammenfassung:** User Guide von AWS Transform mit offizieller Architektur-Beschreibung, Agenten-Rollen, Phasen-Modell (Discovery, Planning, Refactor, Reforge, Reimagine, Test, Deploy, Operate) und Sprachunterstützung für PL/I und COBOL.
  **Datum:** 2026-04-09

- **URL:** https://aws.amazon.com/blogs/aws/aws-transform-for-mainframe-refactor-now-generally-available/
  **Zusammenfassung:** AWS-Blog-Post zur Generellen Verfügbarkeit von AWS Transform for Mainframe Refactor (März 2026, ehem. AWS Blu Age). Beschreibt den kostenfreien Code-Transform und die PL/I-Unterstützung.
  **Datum:** 2026-04-09

## Suchstring: "AWS Blu Age PL/I support"

- **URL:** https://aws.amazon.com/blu-age/
  **Zusammenfassung:** Historische AWS-Blu-Age-Produktseite (konsolidiert in AWS Transform for Mainframe Refactor). Dokumentiert PL/I-, COBOL-, und JCL-Transformation auf gleichem Niveau sowie die CICS-/VSAM-Runtime.
  **Datum:** 2026-04-09

- **URL:** https://aws.amazon.com/blogs/aws/mainframe-modernization-with-aws-blu-age-refactoring/
  **Zusammenfassung:** AWS-Blog über die Blu-Age-Refactoring-Pipeline, inkl. PL/I-Support seit 2023, Mainframe-Dependencies-Engine und Testing Automation.
  **Datum:** 2026-04-09

## Suchstring: "IBM Enterprise PL/I language reference"

- **URL:** https://www.ibm.com/docs/en/epl-zos
  **Zusammenfassung:** IBM-Produktseite und Dokumentation für IBM Enterprise PL/I für z/OS. Enthält Language Reference, Programming Guide und Compiler- und Runtime-Optionen.
  **Datum:** 2026-04-09

- **URL:** https://www.ibm.com/docs/en/epl-zos/latest?topic=reference-pli-language
  **Zusammenfassung:** PL/I Language Reference mit detaillierten Beschreibungen zu FIXED DECIMAL, BASED-Variablen, ON-Units, Preprocessor-Direktiven, Multitasking und Rekursion.
  **Datum:** 2026-04-09

## Suchstring: "PL/I preprocessor macro expansion"

- **URL:** https://www.ibm.com/docs/en/epl-zos/latest?topic=preprocessor
  **Zusammenfassung:** IBM-Dokumentation zum PL/I-Präprozessor (%INCLUDE, %MACRO, %PROCEDURE, %IF, %DECLARE). Grundlage für die Regel, dass Preprocessor-Expansion vor jeder Migration stattfinden muss.
  **Datum:** 2026-04-09

## Suchstring: "PL/I BASED pointer Java mapping"

- **URL:** https://openjdk.org/projects/panama/
  **Zusammenfassung:** OpenJDK Project Panama mit `java.lang.foreign` (Foreign Function & Memory API, ab Java 21 stable). Relevante Grundlage für off-heap Memory-Mapping, als Java-Alternative zu ByteBuffer für BASED-Variablen.
  **Datum:** 2026-04-09

- **URL:** https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/nio/ByteBuffer.html
  **Zusammenfassung:** JavaDoc zu `ByteBuffer`, der Default-Layer für strukturierten Byte-Zugriff in migriertem Java-Code aus Blu Age / AWS Transform.
  **Datum:** 2026-04-09

## Suchstring: "BigDecimal PL/I FIXED DECIMAL precision"

- **URL:** https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/math/BigDecimal.html
  **Zusammenfassung:** Java `BigDecimal`-Dokumentation mit RoundingMode-Details. Grundlage für die PL/I-FIXED-DECIMAL-Mapping-Strategie.
  **Datum:** 2026-04-09

- **URL:** https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/math/MathContext.html
  **Zusammenfassung:** Java `MathContext`-Dokumentation mit precision- und roundingMode-Feldern. Wichtig zur expliziten Dokumentation der Rundungsregeln in migriertem Finanz-Code.
  **Datum:** 2026-04-09

## Suchstring: "Amazon Bedrock AgentCore MCP tools"

- **URL:** https://aws.amazon.com/bedrock/agentcore/
  **Zusammenfassung:** Amazon-Bedrock-AgentCore-Produktseite. Beschreibt die Runtime für Custom-Agents, MCP-Tool-Integration und die Standard-Modelle (Claude, Titan, Llama).
  **Datum:** 2026-04-09

- **URL:** https://docs.aws.amazon.com/bedrock/latest/userguide/agents.html
  **Zusammenfassung:** Bedrock Agents User Guide mit Tool-Schnittstellen, Knowledge-Base-Integration und Human-in-the-Loop-Mustern.
  **Datum:** 2026-04-09

- **URL:** https://modelcontextprotocol.io/
  **Zusammenfassung:** Offizielle MCP-Spezifikation (Model Context Protocol). Grundlage für das Tool-Set des Custom PL/I-Understanding-Agents.
  **Datum:** 2026-04-09

## Suchstring: "Amazon Q Developer IDE PL/I"

- **URL:** https://aws.amazon.com/q/developer/
  **Zusammenfassung:** Amazon Q Developer Produktseite, IDE-Plugins für VS Code, JetBrains, Eclipse. Einsatz in der Post-Transform-Phase für PL/I-Migrationsprojekte.
  **Datum:** 2026-04-09

## Suchstring: "Kiro IDE spec-driven development"

- **URL:** https://kiro.dev/
  **Zusammenfassung:** Amazon Kiro IDE mit spec-driven Coding-Modus. Relevant für die Reimagine-Phase bei ausgewählten Bounded Contexts.
  **Datum:** 2026-04-09

## Suchstring: "AWS Aurora PostgreSQL DB2 migration"

- **URL:** https://aws.amazon.com/rds/aurora/postgresql-features/
  **Zusammenfassung:** Aurora PostgreSQL-Produktseite mit NUMERIC-Präzision und SQL-Kompatibilitäts-Liste. Default-Zielsystem für DB2-Migration aus PL/I.
  **Datum:** 2026-04-09

- **URL:** https://docs.aws.amazon.com/dms/latest/userguide/Welcome.html
  **Zusammenfassung:** AWS Database Migration Service User Guide. Grundlage für CDC-basierte Datenspiegelung zwischen DB2 und Aurora.
  **Datum:** 2026-04-09

## Suchstring: "Precisely Connect DB2 CDC mainframe"

- **URL:** https://www.precisely.com/product/precisely-connect/connect
  **Zusammenfassung:** Precisely Connect (ehemals Syncsort). Beschreibt die CDC-Fähigkeiten für DB2, VSAM, IMS und Adabas mit S3-Zielformat.
  **Datum:** 2026-04-09

## Suchstring: "Amazon MQ MQSeries migration"

- **URL:** https://aws.amazon.com/amazon-mq/
  **Zusammenfassung:** Amazon-MQ-Produktseite mit JMS- und AMQP-Unterstützung, Ersatz für IBM MQSeries auf dem Mainframe.
  **Datum:** 2026-04-09

## Suchstring: "Raincode PL/I JVM compiler"

- **URL:** https://www.raincodelabs.com/products/pl-i-compiler/
  **Zusammenfassung:** Raincode PL/I-Compiler für .NET und JVM. Alternative zu Java-Source-Refactoring, Transpiliert PL/I direkt zu Bytecode.
  **Datum:** 2026-04-09

## Suchstring: "Micro Focus Open PL/I OpenText"

- **URL:** https://www.opentext.com/products/open-pli
  **Zusammenfassung:** OpenText (ehem. Micro Focus) Open PL/I — Laufzeit-Umgebung für PL/I auf Linux/Windows.
  **Datum:** 2026-04-09

## Suchstring: "IBM watsonx Code Assistant for Z PL/I"

- **URL:** https://www.ibm.com/products/watsonx-code-assistant-z
  **Zusammenfassung:** IBM-Produktseite mit AI-basiertem Modernisierungs-Support für COBOL und PL/I. Eigene Option jenseits des AWS-Ökosystems.
  **Datum:** 2026-04-09

## Suchstring: "mLogica LIBER*M PL/I migration"

- **URL:** https://www.mlogica.com/
  **Zusammenfassung:** mLogica LIBER*M Universal Migrator mit PL/I-Unterstützung für Refactor und Replatform.
  **Datum:** 2026-04-09

## Suchstring: "PL/I ON units exception handling"

- **URL:** https://www.ibm.com/docs/en/epl-zos/latest?topic=handling-pli-conditions
  **Zusammenfassung:** IBM-Dokumentation zu PL/I-Conditions und ON-Units. Grundlage für die Mapping-Strategie zu Java-Exceptions mit dynamischem Handler-Stack.
  **Datum:** 2026-04-09

## Suchstring: "PL/I TASK EVENT WAIT multitasking"

- **URL:** https://www.ibm.com/docs/en/epl-zos/latest?topic=features-multitasking
  **Zusammenfassung:** IBM-Dokumentation zum OS-Multitasking in PL/I. Grundlage für das Mapping zu Java-ExecutorService und CompletableFuture.
  **Datum:** 2026-04-09

## Suchstring: "jqwik property based testing Java"

- **URL:** https://jqwik.net/
  **Zusammenfassung:** jqwik — Property-based Testing Framework für Java. Relevant für FIXED-DECIMAL-, Pointer- und State-Invarianten-Tests.
  **Datum:** 2026-04-09

## Suchstring: "PIT mutation testing Java"

- **URL:** https://pitest.org/
  **Zusammenfassung:** PIT Mutation Testing Tool für Java. Relevant zur Qualitätsbewertung der automatisch generierten Unit-Tests aus AWS Transform.
  **Datum:** 2026-04-09

## Suchstring: "Testcontainers Aurora PostgreSQL integration tests"

- **URL:** https://www.testcontainers.org/
  **Zusammenfassung:** Testcontainers für Integration-Tests mit echten Database- und Message-Broker-Images. Relevant für DB2-zu-Aurora-Migrationsprojekte.
  **Datum:** 2026-04-09

## Suchstring: "strangler fig pattern mainframe coexistence"

- **URL:** https://martinfowler.com/bliki/StranglerFigApplication.html
  **Zusammenfassung:** Martin Fowlers Originalartikel zum Strangler-Fig-Pattern. Architektonische Grundlage für alle 50%-Migrationsszenarien.
  **Datum:** 2026-04-09

## Suchstring: "saga pattern distributed transactions"

- **URL:** https://microservices.io/patterns/data/saga.html
  **Zusammenfassung:** Saga-Pattern in der Microservices.io-Referenz. Relevant für kompensierende Transaktionen zwischen Mainframe und AWS in 50-%-Szenarien.
  **Datum:** 2026-04-09

## Suchstring: "AWS Mainframe Modernization Service EOL 2025"

- **URL:** https://docs.aws.amazon.com/m2/latest/userguide/what-is-m2.html
  **Zusammenfassung:** Offizielle Dokumentation zum AWS Mainframe Modernization Service (inkl. dem End-of-Life-Hinweis für Neukunden seit November 2025).
  **Datum:** 2026-04-09

## Suchstring: "Gartner 7 Rs migration framework"

- **URL:** https://www.gartner.com/en/documents/4007218
  **Zusammenfassung:** Gartner-Research-Note zum 7-Rs-Framework für Cloud-Migration. Basis für die Entscheidungsmatrix im Lösungshorizont.
  **Datum:** 2026-04-09

## Suchstring: "EBCDIC UTF-8 sorting differences"

- **URL:** https://en.wikipedia.org/wiki/EBCDIC
  **Zusammenfassung:** Wikipedia-Übersicht zu EBCDIC. Relevant für Encoding-Konversion und Sort-Order-Unterschiede zwischen Mainframe- und Java-Systemen.
  **Datum:** 2026-04-09

## Suchstring: "VSAM KSDS alternate index PostgreSQL"

- **URL:** https://www.ibm.com/docs/en/zos/latest?topic=sets-vsam-data-set-types
  **Zusammenfassung:** IBM-Dokumentation zu VSAM-Datentypen (KSDS, ESDS, RRDS) und Alternate Indexes. Grundlage für die Migration von VSAM nach Aurora/DynamoDB.
  **Datum:** 2026-04-09

## Suchstring: "CICS pseudo-conversational programming"

- **URL:** https://www.ibm.com/docs/en/cics-ts/latest?topic=programs-pseudo-conversational-programming
  **Zusammenfassung:** IBM-Dokumentation zum pseudo-conversational Programmier-Modell in CICS. Grundlage für die korrekte Erhaltung dieses Musters in der Java-Fassung.
  **Datum:** 2026-04-09

## Suchstring: "Drools decision tables business rules"

- **URL:** https://www.drools.org/
  **Zusammenfassung:** Drools Rule Engine. Relevant für die Option, Business-Regeln aus PL/I-Code in Decision-Tables zu extrahieren.
  **Datum:** 2026-04-09

## Suchstring: "AWS Migration Acceleration Program MAP mainframe"

- **URL:** https://aws.amazon.com/migration-acceleration-program/
  **Zusammenfassung:** AWS-MAP-Produktseite. Relevant für Cloud-Credits und Finanzierung großer PL/I-Migrationsprojekte.
  **Datum:** 2026-04-09

## Suchstring: "Claude on Amazon Bedrock code generation"

- **URL:** https://aws.amazon.com/bedrock/claude/
  **Zusammenfassung:** Anthropic Claude auf Amazon Bedrock — Claude Opus/Sonnet als Default-Modelle für Reforge und Code-Erklärungen in PL/I-Migrationen.
  **Datum:** 2026-04-09

## Suchstring: "shadow traffic migration testing"

- **URL:** https://martinfowler.com/bliki/ParallelChange.html
  **Zusammenfassung:** Martin Fowler zur Parallel-Change- und Shadow-Traffic-Technik als sicheres Go-Live-Vehikel für Migrationen.
  **Datum:** 2026-04-09

## Suchstring: "formal verification TLA+ financial systems"

- **URL:** https://lamport.azurewebsites.net/tla/tla.html
  **Zusammenfassung:** TLA+ Homepage von Leslie Lamport. Grundlage für die Option "formale Verifikation für Kern-Algorithmen" im erweiterten Lösungshorizont.
  **Datum:** 2026-04-09

## Suchstring: "OpenTelemetry mainframe hybrid observability"

- **URL:** https://opentelemetry.io/
  **Zusammenfassung:** OpenTelemetry Projekt-Homepage. Relevant für hybride Observability zwischen Mainframe und AWS in 50-%-Projekten.
  **Datum:** 2026-04-09

---

## Hinweise zur Quellen-Pflege

- Alle Quellen wurden im Rahmen der Deep Research am 9. April 2026 für diese PL/I-zu-Java-AWS-Migrations-Research gesichtet.
- Primärquellen (AWS, IBM, Oracle, OpenJDK) wurden bevorzugt.
- Sekundärquellen (Blogs, Tool-Hersteller) dienen der Verbreiterung des Lösungshorizonts.
- Diese Datei wird fortlaufend gepflegt, wenn neue Quellen hinzukommen. Jede neue Quelle wird unter dem passenden Suchstring oder einem neuen Suchstring-Abschnitt eingeordnet.
