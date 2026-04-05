# Amazon Bedrock Agents - Skill/Action Group Konzepte

## Ueberblick

Amazon Bedrock Agents ist AWSs vollstaendig verwalteter Service fuer die Erstellung agentenbasierter AI-Systeme. Das zentrale Erweiterungskonzept sind "Action Groups", die die Aktionen definieren, die ein Agent ausfuehren kann.

## Action Groups

![Amazon Bedrock Agents Architektur](../skills_zero-to-hero/svg/fw_bedrock_agents.svg)

### Definition
Action Groups sind Sammlungen von Aktionen, die ein Agent fuer den Benutzer ausfuehren soll. Jede Action Group enthaelt Schemas, die die Parameter definieren, die der Agent vom Benutzer abfragen muss.

### Schema-Optionen
Entwickler haben Flexibilitaet bei der Definition von Aktionen:

1. **OpenAPI Schema:** Definition von API-Operationen mit vollstaendiger OpenAPI-Spezifikation
2. **Function Detail Schema:** Vereinfachte Variante mit Funktionsnamen, Beschreibung und Parametern

### Implementierung
- Jede Action Group kann unterschiedliche Schemas verwenden
- Aktionen werden typischerweise als AWS Lambda Functions implementiert
- Parameter-Extraktion aus dem Gespraech erfolgt automatisch durch den Agent

## Multi-Agent Collaboration (GA seit Maerz 2025)

### Architektur
- **Supervisor Agent:** Analysiert Input und koordiniert Subagents
- **Subagents:** Spezialisierte Agents mit eigenen Action Groups
- **Orchestrierungsmodi:**
  - **Supervisor Mode:** Supervisor ruft Subagents seriell oder parallel auf
  - Supervisor kann auch eigene Knowledge Bases oder Action Groups nutzen

### Einsatzszenario
Spezialisierte Agents arbeiten innerhalb ihrer Expertise-Domaenen, koordiniert durch einen uebergeordneten Supervisor Agent. Beispiel: Ein Kundenservice-System mit spezialisierten Agents fuer Bestellungen, Retouren und technischen Support.

## Weitere Komponenten

### Knowledge Bases
- Integration mit Amazon Bedrock Knowledge Bases
- RAG-basierter Zugriff auf Unternehmensdaten
- Unterstuetzt verschiedene Datenquellen (S3, Confluence, SharePoint etc.)

### Guardrails
- Amazon Bedrock Guardrails fuer Input/Output-Validierung
- Content-Filterung und Safety-Checks
- PII-Erkennung und -Maskierung

## AWS-Ecosystem-Integration

- **Lambda Functions** als Action-Backend
- **S3** fuer Datenspeicherung
- **CloudWatch** fuer Monitoring
- **IAM** fuer Zugriffssteuerung
- **Step Functions** fuer komplexe Workflows

## Staerken und Schwaechen

### Staerken
- Vollstaendig verwalteter Service (Serverless)
- Native AWS-Ecosystem-Integration
- Multi-Agent Collaboration out-of-the-box
- Enterprise-Grade Security und Compliance
- OpenAPI-Schema-Support fuer bestehende APIs
- Automatische Parameter-Extraktion

### Schwaechen
- Starke Bindung an AWS (Vendor Lock-in)
- Weniger flexibel als Open-Source-Alternativen
- Action Groups sind auf Lambda-Funktionen beschraenkt
- Kein offener Standard (kein SKILL.md-Support)
- Hoehere Kosten als Self-Hosted-Loesungen
