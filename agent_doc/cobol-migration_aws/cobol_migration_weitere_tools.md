# COBOL-Migration: Weitere Tools und Plattformen jenseits von AWS

> Stand: April 2026 | Zielgruppe: Senior Developer & Senior Architekten

Dieser Guide ergaenzt den AWS-fokussierten Migrationsguide um eine umfassende Uebersicht der wichtigsten weiteren Tools, Plattformen und Anbieter im COBOL-Modernisierungs-Markt 2026.

---

## 1. Marktueberblick 2026

Der COBOL-Modernisierungs-Markt ist in den letzten Jahren stark gewachsen. Drei Treiber dominieren:

1. **KI-Boom**: LLMs ermoeglichen neue Ansaetze fuer Code-Verstaendnis
2. **Skill-Mangel**: COBOL-Entwickler werden knapp und teuer
3. **Cloud-Reife**: Hyperscaler bieten Mainframe-Migration als strategischen Service

### Anbieter-Kategorien

| Kategorie | Beispiele |
|-----------|-----------|
| **Hyperscaler-Services** | AWS Transform, Google Cloud Mainframe, Azure Mainframe Migration |
| **Vendor-Tools** | IBM watsonx Code Assistant for Z, Rocket Software, Heirloom |
| **ISV-Plattformen** | TSRI, SoftwareMining, Astadia, Modern Systems, mLogica |
| **API-Wrapper** | OpenLegacy |
| **Compiler-basiert** | Raincode, Heirloom Elastic COBOL |
| **GenAI-Tools** | Anthropic Claude, GitHub Copilot, ChatGPT |
| **Open Source** | GnuCOBOL, COBOL-IT |

---

## 2. IBM watsonx Code Assistant for Z

**Hersteller:** IBM
**Kategorie:** KI-gestuetzte Modernisierungs-Plattform
**Status 2026:** GA, aktiv weiterentwickelt

### 2.1 Funktionsweise

IBM watsonx Code Assistant for Z (kurz: WCA for Z) ist IBMs strategische Antwort auf den Mainframe-Modernisierungsmarkt. Es kombiniert traditionelle regelbasierte Refactoring-Tools mit den Granite-LLMs von IBM, die speziell auf COBOL-Java-Paare trainiert wurden.

**Kernansatz:** Selektive Transformation einzelner COBOL-Methoden zu Java -- nicht die Konvertierung ganzer Anwendungen. Die Idee: Java und COBOL koexistieren, mit klaren Interoperabilitaets-Schnittstellen.

### 2.2 Faehigkeiten (Stand Version 2.6+, Mitte 2025)

- **Code Explanation**: Natuerlichsprachliche Erklaerung von COBOL-Code (auch Assembler!)
- **Selective COBOL-to-Java Translation**: Methoden- oder Programm-Ebene
- **Code Generation**: Erstellung neuer COBOL-Programme mit KI-Hilfe
- **Z Understand Metadata Retrieval**: Zugriff auf Mainframe-Metadaten
- **Impact Analysis**: Abhaengigkeitsanalyse fuer Aenderungen
- **Coding Standards**: Generierter Code folgt Enterprise-Standards
- **Assembler-Support**: Erklaerung von Assembler-Logik (seit 2.6)

### 2.3 Project Bob (TechXchange 2025)

IBM kuendigte als Technical Preview die naechste Generation an: **Project Bob**, ein agentic AI Software Development System, das fuer 2026 GA geplant ist. Project Bob soll:
- Selbststaendig komplexe Modernisierungs-Workflows steuern
- Multi-Agent-Kollaboration unterstuetzen
- Tieferes Code-Verstaendnis durch System-Level-Analyse bieten

### 2.4 Vor- und Nachteile

**Vorteile:**
- Tiefe Mainframe-Integration (z/OS, DB2, CICS)
- Faehigkeit, COBOL und Java koexistieren zu lassen
- Starkes Assembler-Verstaendnis (Alleinstellungsmerkmal)
- Enge Integration mit IBM Z-Tooling
- Niedrige Migrationsschwelle: keine "all-or-nothing"-Entscheidung

**Nachteile:**
- Vendor Lock-in zu IBM Z (Java laeuft auf z/OS, nicht in der Cloud)
- LLM-basiert: nicht-deterministisch
- Hoehere Lizenzkosten (Enterprise-Modell)
- Nicht primaer auf Cloud-Migration ausgerichtet -- eher auf Modernisierung **innerhalb** der IBM-Welt
- Keine vollstaendige Aufloesung der Mainframe-Bindung

### 2.5 Wann sinnvoll?

- Wenn der Mainframe **bleiben** soll, aber modernisiert werden muss
- Hybride Strategien (manche Teile Cloud, andere on-premises)
- Wenn IBM-Beziehung strategisch ist
- Wenn Java auf z/OS akzeptabel ist (zIIP-Engines)

---

## 3. Google Cloud Mainframe Modernization

**Hersteller:** Google Cloud
**Kategorie:** Hyperscaler-Plattform
**Status 2026:** Aktiv, mit starkem Partner-Oekosystem

### 3.1 Komponenten

**Mainframe Assessment Tool (MAT):**
Generally Available, ermoeglicht Kunden die Analyse ihrer gesamten Mainframe-Landschaft -- Anwendungen und Daten -- als Grundlage fuer informierte Migrations-Entscheidungen.

**Google Cloud Dual Run:**
Das Schluesselfeature von Google Cloud im Mainframe-Bereich. Dual Run spielt **Live-Events** vom Produktions-Mainframe parallel auf das modernisierte Cloud-System und vergleicht die Outputs in Echtzeit. Damit wird Funktionsaequivalenz bereits **vor** dem Cutover bewiesen, nicht nur durch Testdaten.

**Gemini-basierte KI:**
Google nutzt seine Gemini-Modelle fuer Code-Verstaendnis, Dokumentation und Transformation.

### 3.2 Partner-Oekosystem

Google verfolgt eine starke Partner-Strategie:

- **mLogica LIBER\*M**: Automated Code Refactoring Suite, integriert mit Dual Run
- **Kyndryl**: Globale Implementation Services, Konvertierung COBOL → Java auf Google Distributed Cloud
- **Mechanical Orchard**: KI-basierte Migration zu Java/Python
- **Astadia**: Multi-Cloud-Migrationsanbieter mit GCP-Support

### 3.3 Vor- und Nachteile

**Vorteile:**
- **Dual Run** ist ein Alleinstellungsmerkmal -- echtes Live-Vergleichen schlaegt synthetische Tests
- Integration mit Google Distributed Cloud (GDC) fuer hybride/regulierte Szenarien
- Starkes ML/AI-Ecosystem (BigQuery, Vertex AI) fuer modernisierte Daten-Workloads
- Gute Open-Source-Naehe

**Nachteile:**
- Kleineres Partner-Oekosystem als AWS
- Weniger spezifische Tools fuer Mainframe-Subsysteme (CICS, IMS)
- Geringerer Marktanteil im Enterprise-Mainframe-Segment
- Fragmentiertere Story als AWS Transform

---

## 4. Microsoft Azure Mainframe Migration

**Hersteller:** Microsoft Azure
**Kategorie:** Hyperscaler-Plattform
**Status 2026:** Aktiv, partner-getrieben

### 4.1 Ansatz

Microsoft selbst bietet keinen integrierten Mainframe-Modernisierungsservice wie AWS Transform. Stattdessen setzt Azure auf eine **Partner-zentrierte Strategie** mit folgenden Schluesselpartnern:

### 4.2 Schluesselpartner

**Astadia (mit Azure):**
- 100 % automatisierte Code- und Datenkonvertierung
- Konvertiert DB2, IMS, VSAM, sequentielle Files zu SQL Server, Oracle, PostgreSQL
- Deployment auf Azure VMs, AKS, App Service
- End-to-End-Migration mit Services-Modell

**Raincode COBOL Compiler:**
- Generiert 100 % thread-safe Managed Code fuer .NET / .NET Core
- Native CICS- und SQL-Unterstuetzung
- Visual Studio-Integration mit Debugger, IntelliSense
- Besonders interessant: COBOL bleibt COBOL, laeuft aber als .NET-Assembly

**Micro Focus / Rocket Software auf Azure:**
- Replatforming-Ansatz wie auch auf AWS
- Enterprise Server auf Azure VMs

### 4.3 KI-Ansatz

Microsoft hat eigene Erfahrungen mit AI Agents fuer COBOL-Migration veroeffentlicht (DevBlogs "All things Azure"). Der Ansatz nutzt:

- **Semantic Kernel** als Orchestrierungs-Framework
- **GitHub Copilot** fuer Entwickler-Assistenz
- **Azure OpenAI Service** fuer LLM-basierte Transformationen
- **Graph RAG** fuer besseres COBOL-Code-Verstaendnis

### 4.4 Vor- und Nachteile

**Vorteile:**
- Starke Integration mit .NET-Stack (Raincode)
- Visual Studio als gewohnte IDE fuer Entwickler
- Microsoft-Partner-Oekosystem im Enterprise stark
- Gute Hybrid-Cloud-Story (Azure Arc)

**Nachteile:**
- Keine eigene KI-getriebene Plattform wie AWS Transform
- Stark partner-abhaengig
- .NET als Zielplattform schraenkt Java-zentrische Teams ein
- Weniger Mainframe-Expertise-Investment als AWS

---

## 5. Heirloom Computing -- Elastic COBOL

**Hersteller:** Heirloom Computing
**Kategorie:** ISV / Compiler-basierte Migration
**Status 2026:** Aktiv, AWS Mainframe Modernization Software Competency Partner

### 5.1 Funktionsweise

Heirloom verfolgt einen einzigartigen Ansatz: **COBOL wird zur Compile-Zeit nach Java transpiliert** und laeuft dann nativ auf der JVM. Es ist kein Refactoring im klassischen Sinn -- der COBOL-Quellcode bleibt unveraendert, wird aber als Java-Bytecode ausgefuehrt.

**Elastic COBOL** ist die Compiler-, IDE-, Debugger- und Test-Suite. Sie transpiliert Enterprise-COBOL-Anwendungen in Java und deployed sie cloud-nativ.

### 5.2 Schluessel-Features

- **5x schnellere Modernisierung** als manuelle Refactoring-Ansaetze (laut Hersteller)
- **65-85 % Kostenersparnis** gegenueber Mainframe-Betrieb
- **Volle Cloud-Native-Ausfuehrung** auf JVM
- **No-disruption-Migration**: COBOL-Entwickler arbeiten weiter mit COBOL
- **Eclipse-basierte IDE** mit Debugger, Profiler
- **Cloud-Agnostisch**: laeuft auf AWS, Azure, GCP, on-premises

### 5.3 Zielszenarien

Heirloom ist besonders interessant fuer:
- Organisationen, die COBOL-Expertise erhalten wollen
- Schnelle Cloud-Migration ohne Code-Rewrite
- Hybride Strategien (Java und COBOL koexistieren)
- Brueckenloesung vor langfristigem Refactoring

### 5.4 Vor- und Nachteile

**Vorteile:**
- Sehr schnelle Migration (Wochen statt Jahre)
- Kein Refactoring-Risiko
- COBOL-Skills bleiben relevant
- Cloud-Native auf JVM
- AWS Mainframe Modernization Competency

**Nachteile:**
- COBOL bleibt COBOL -- keine Modernisierung im engeren Sinn
- Vendor Lock-in zu Heirloom
- Java-Entwickler koennen den Code trotzdem nicht warten
- Langfristige Skill-Problematik bleibt

---

## 6. SoftwareMining

**Hersteller:** SoftwareMining
**Kategorie:** Deterministische COBOL-zu-Java/C# Konvertierung
**Status 2026:** Aktiv, Fortune-500-Referenzen

### 6.1 Ansatz

SoftwareMining ist ein **deterministisches Tool**, das COBOL durch regelbasierte Algorithmen in Java oder C# uebersetzt. Es wird von Fortune-500-Unternehmen genutzt, um Millionen Lines of Code in **sauberen Java-Code** zu konvertieren.

**Schluesselfeature:** SoftwareMining kann komplexe Logik wie GOTO-Statements in standard Java loops und switches umstrukturieren. Damit produziert es Code, der **deutlich besser** ist als typische 1:1-Konvertierungen.

### 6.2 Vor- und Nachteile

**Vorteile:**
- Deterministisch (gleiches Input = gleiches Output)
- Hohe Code-Qualitaet, vermeidet JOBOL teilweise
- Bewaehrt im Enterprise (Fortune 500)
- Auch C# als Ziel

**Nachteile:**
- Kein KI-Ansatz (nicht so clever wie GenAI bei Edge Cases)
- Standalone-Tool, weniger Integration in Cloud-Plattformen
- Geringere Sichtbarkeit als Hyperscaler-Tools

---

## 7. TSRI (The Software Revolution, Inc.)

**Hersteller:** TSRI
**Kategorie:** Automated Code Transformation Platform
**Status 2026:** Aktiv

### 7.1 Ansatz

TSRI bietet eine **Modernization Platform**, die ueber simple Konvertierung hinausgeht. Grosse Enterprises nutzen TSRI, um komplexe ERP-Systeme von COBOL zu Cloud-basierten Java-Microservices zu migrieren -- mit dem Ziel, Wartungskosten zu senken und Skalierbarkeit zu verbessern.

### 7.2 Charakteristika

- **JANUS Studio**: Die Kerntechnologie fuer automatisierte Transformation
- **Refaktoriert in Microservices** statt in monolithischen Java-Code
- **Bewaehrt fuer komplexe ERP-Migrationen**
- Unterstuetzt zahlreiche Sprachen (COBOL, PL/I, NATURAL, JOVIAL, FORTRAN, Ada, etc.)

### 7.3 Vor- und Nachteile

**Vorteile:**
- Microservice-orientierte Zielarchitektur
- Sehr breite Sprachunterstuetzung
- Bewaehrt bei komplexen Projekten

**Nachteile:**
- Service-getriebener Anbieter -- weniger als Self-Service-Tool nutzbar
- Hoehere Projektkosten
- Geringere Marktbekanntheit als andere Anbieter

---

## 8. OpenLegacy

**Hersteller:** OpenLegacy
**Kategorie:** API-Integration / API-Wrapper
**Status 2026:** Aktiv

### 8.1 Ansatz

OpenLegacy verfolgt einen **fundamental anderen Ansatz** als die meisten anderen Anbieter. Statt COBOL zu konvertieren oder zu replatformen, **wrapped** OpenLegacy die Mainframe-Systeme mit modernen REST-APIs und Microservices.

Die Idee: Lasst den Mainframe in Ruhe -- aber macht ihn fuer moderne Anwendungen (Mobile, Web, Cloud-Apps) nutzbar.

### 8.2 Faehigkeiten

- **Verbindung zu Mainframe-Subsystemen**: CICS, IMS, MQ, sequentielle Files
- **Automatische API-Generierung**: REST-Endpoints aus CICS-Transaktionen
- **Microservice-Wrapper**: Jede API wird zu einem deploybaren Microservice
- **Multi-Cloud-Deployment**: Kubernetes, AWS, Azure, GCP, on-premises
- **API-First-Design**: Saubere Schnittstellen mit OpenAPI-Specs

### 8.3 Wann sinnvoll?

OpenLegacy ist ideal fuer:
- **Bruecken-Strategie**: Mainframe bleibt, neue Apps integrieren ueber APIs
- **Mobile/Web-Frontends** fuer bestehende Mainframe-Logik
- **Schrittweise Modernisierung**: Erst APIs, dann spaeter ggf. Migration
- **Hybride Architekturen**: Cloud-Apps + Mainframe als Backend

### 8.4 Vor- und Nachteile

**Vorteile:**
- Sehr schnelle Time-to-Market
- Geringes Migrationsrisiko (Mainframe bleibt)
- Saubere API-First-Architektur
- Multi-Cloud

**Nachteile:**
- Loest die Mainframe-Bindung **nicht** auf
- Kein Cost-Reduction durch Mainframe-Decommissioning
- Erhoehte Komplexitaet (zwei Welten parallel)
- Vendor Lock-in zu OpenLegacy

---

## 9. Astadia

**Hersteller:** Astadia
**Kategorie:** End-to-End Mainframe Migration Services
**Status 2026:** Aktiv, Multi-Cloud

### 9.1 Ansatz

Astadia ist ein **services-getriebener** Anbieter, der end-to-end Migrationsprojekte fuer Mainframe-Workloads durchfuehrt. Das Unternehmen ist seit Jahrzehnten im Mainframe-Modernisierungs-Markt aktiv.

### 9.2 Faehigkeiten

- **100 % automatisierte Code- und Datenkonvertierung**
- **Automated Testing** fuer Batch und Online-Workloads
- **Voll-integrierter Workflow**: Code, Daten, Test, Cutover
- **Datenkonvertierung**: DB2, IMS, VSAM, sequentielle Files → SQL Server, Oracle, PostgreSQL
- **Multi-Cloud-Deployment**: AWS, Azure, GCP, on-premises
- **Linux/Windows/Docker** Zielplattformen
- **Services-Modell**: Astadia fuehrt das Projekt durch, nicht der Kunde selbst

### 9.3 Vor- und Nachteile

**Vorteile:**
- Sehr breite Erfahrung im Mainframe-Markt
- Multi-Cloud-Faehigkeit (nicht an einen Hyperscaler gebunden)
- End-to-End-Verantwortung des Anbieters
- Sowohl Replatforming als auch Refactoring im Portfolio

**Nachteile:**
- Hoehere Projektkosten durch Services-Modell
- Weniger Self-Service-Faehigkeiten
- Abhaengigkeit von Astadia-Consultants

---

## 10. Raincode

**Hersteller:** Raincode
**Kategorie:** COBOL-Compiler fuer .NET / .NET Core
**Status 2026:** Aktiv, primaer im Microsoft-Umfeld

### 10.1 Ansatz

Raincode hat einen einzigartigen Ansatz: Sie haben einen **COBOL-Compiler fuer .NET / .NET Core** gebaut. Das bedeutet: COBOL-Code wird zu Managed Code kompiliert, der nativ in der CLR (Common Language Runtime) laeuft.

### 10.2 Charakteristika

- **100 % thread-safe Managed Code**: keine native DLLs
- **Native CICS- und SQL-Unterstuetzung** im Compiler
- **Visual Studio-Integration** mit Debugger, IntelliSense
- **Project Management** als Teil der IDE
- **Toolkit fuer komplexe Migrationen**: Assembly-Sprachen, CICS, IMS

### 10.3 Wann sinnvoll?

- Microsoft-Stack-Organisationen (Azure, .NET, Visual Studio)
- COBOL-Entwickler sollen weiter in COBOL arbeiten, aber auf modernen Plattformen
- Hybride Anwendungen (.NET + COBOL)

### 10.4 Vor- und Nachteile

**Vorteile:**
- Bewahrt COBOL-Skills voll
- Managed Code = volle Sicherheits- und Tooling-Vorteile
- Tiefe Visual Studio-Integration

**Nachteile:**
- Festgelegt auf .NET (nicht JVM/Java)
- Vendor Lock-in zu Raincode
- Geringere Cloud-Native-Faehigkeiten als Java-Stacks

---

## 11. mLogica LIBER\*M

**Hersteller:** mLogica
**Kategorie:** Automated Mainframe Modernization Suite
**Status 2026:** Aktiv, Google-Cloud-Partner

### 11.1 Charakteristika

LIBER\*M ist eine umfassende Modernisierungs-Suite, die besonders im Google-Cloud-Umfeld stark ist. Die Kombination mit **Google Cloud Dual Run** ergibt eine durchgaengige Loesung: LIBER\*M konvertiert den Code, Dual Run validiert die funktionale Aequivalenz.

### 11.2 Faehigkeiten

- Automated Code Refactoring fuer COBOL, PL/I, NATURAL, ADABAS, Assembler
- Dependency-Analyse und Visualisierung
- Daten-Migration (DB2, IMS, VSAM → Cloud-Datenbanken)
- Cloud-Native Zielarchitekturen
- Hybrides Modell (Tools + Services)

---

## 12. Modern Systems

**Hersteller:** Modern Systems (Teil der Modern Systems-Gruppe)
**Kategorie:** COBOL-zu-Java/C# Migration

Modern Systems ist ein etablierter Anbieter im Mainframe-Modernisierungs-Markt mit Fokus auf automatisierte Code-Migration. Der Ansatz aehnelt anderen Refactoring-Tools (Blu Age, TSRI), mit besonderem Fokus auf:

- Automatisierte COBOL-zu-Java/C#-Konvertierung
- Datenbank-Migration
- Test-Automatisierung
- Services-Modell fuer Implementierung

---

## 13. CloudFrame

**Hersteller:** CloudFrame
**Kategorie:** COBOL-zu-Java Refactoring

CloudFrame ist ein weiterer spezialisierter Anbieter im Refactoring-Markt mit Fokus auf:

- **Direkte COBOL-zu-Java-Konvertierung** ohne Zwischenebene
- **Cloud-Deployment** als primaeres Ziel
- **Spring Boot-basierte Zielarchitektur**

---

## 14. AveriSource

**Hersteller:** AveriSource
**Kategorie:** Code Analysis & Modernization
**Status 2026:** AWS Mainframe Modernization Software Competency seit November 2025

AveriSource hat im November 2025 die AWS Mainframe Modernization Software Competency erhalten. Das Tool bietet:

- Tiefgehende Code-Analyse fuer Mainframe-Codebases
- Visualisierung von Abhaengigkeiten
- Modernisierungs-Empfehlungen
- Integration mit AWS-Services

---

## 15. Generative AI Tools im COBOL-Umfeld

### 15.1 Anthropic Claude

Anthropic Claude (besonders Claude Code mit dem Agentic-Ansatz) wird zunehmend fuer COBOL-Modernisierungsaufgaben eingesetzt. Anthropic selbst hat einen Blog-Post veroeffentlicht: "How AI helps break the cost barrier to COBOL modernization".

**Staerken:**
- **Code-Verstaendnis**: Sehr gute Faehigkeit, COBOL-Code zu erklaeren
- **Multi-File-Refactoring**: Agentic-Workflows ueber viele Dateien
- **Dependency-Mapping**: Automatische Analyse von Abhaengigkeiten
- **Inkrementelle Modernisierung**: Validierbare kleine Schritte
- **Tool Use**: Integration mit Build-Tools, Test-Runner, Git

**Schwaechen:**
- Kein deterministischer Output (LLM-basiert)
- Begrenztes Kontext-Fenster (auch bei 1M Tokens limitiert fuer sehr grosse Codebases)
- Erfordert orchestrierende Pipeline (Graph RAG, Chunking)

### 15.2 GitHub Copilot

GitHub Copilot beschleunigt Coding-Aufgaben, aber bietet **keine deterministische Translation** und **keine Traceability**, die fuer regulierte Branchen noetig ist. Copilot ist daher eher ein **Helfer** als ein Migrationswerkzeug.

**Einsatzgebiete:**
- Boilerplate-Generierung
- Code-Vervollstaendigung im Java-Code
- Kommentar-Generierung
- Test-Erstellung

### 15.3 ChatGPT / OpenAI

ChatGPT ist nuetzlich fuer Suggestions, aber **kann keine konsistente Control-Flow-Konvertierung** bei COBOL-zu-Java sicherstellen. Ein wertvolles Tool fuer Entwickler im Lernmodus, aber nicht fuer produktive Migration.

### 15.4 Wichtige Limitierungen aller LLM-basierten Tools

**Variabilitaet:** Generative Tools wie ChatGPT, Code Llama, Copilot und watsonx Code Assistant arbeiten **probabilistisch**. Gleicher COBOL-Input ergibt unterschiedliche Java-Outputs. Fuer mission-kritische COBOL-Modernisierung in regulierten Umgebungen bedeutet das einen **erhoehten Test- und Governance-Aufwand**.

**Reasoning-Limitierung:** LLMs reproduzieren Muster aus Trainingsdaten, fuehren aber **kein echtes System-Level-Reasoning** durch. Sie sind **nicht** als alleinige Loesung fuer engineering-grade Modernisierung geeignet.

**Best Practice 2026:**
LLMs sollten **kombiniert** mit deterministischen Frameworks, Orchestrierung und menschlicher Validierung eingesetzt werden -- nicht als Standalone-Loesung. Aktuelle Ansaetze nutzen:

- **Graph RAG**: COBOL-Code wird in eine Graph-Datenbank eingelesen, um den Kontext fuer LLMs zu strukturieren
- **Chunking-Strategien**: Sinnvolle Aufteilung grosser Codebases
- **Multi-Agent-Orchestrierung** (Semantic Kernel, LangChain)
- **Human-in-the-Loop-Validierung** an kritischen Schritten

---

## 16. Open Source Tools

### 16.1 GnuCOBOL

GnuCOBOL ist ein Open-Source-COBOL-Compiler, der COBOL nach C transpiliert und dann mit gcc kompiliert. Er wird hauptsaechlich fuer:

- **Migration kleinerer COBOL-Anwendungen** (kein Mainframe-Erbe)
- **Schulungs- und Lernzwecke**
- **Brueckenloesungen** ohne Vendor-Bindung

**Limitierungen:**
- Kein direkter Mainframe-Subsystem-Support (CICS, IMS)
- Eingeschraenkte Enterprise-Features
- Community-Support, kein Enterprise-Support

### 16.2 COBOL-IT

COBOL-IT war ein Open-Source-COBOL-Compiler, der mittlerweile von Rocket Software uebernommen wurde. Er bildet einen Teil der Rocket-Strategie.

---

## 17. Anbieter-Vergleichsmatrix

| Anbieter | Kategorie | Zielsprache | KI-Anteil | Determinismus | Cloud-Fokus | Vendor Lock-in |
|----------|-----------|-------------|-----------|---------------|-------------|----------------|
| **AWS Transform** | Hyperscaler | Java | Hoch | Mittel (Reforge LLM) | AWS | Hoch |
| **IBM watsonx Z** | Vendor | Java | Hoch | Niedrig (LLM) | IBM Z | Sehr hoch |
| **Google Cloud + mLogica** | Hyperscaler+ISV | Java/Python | Mittel | Hoch (mLogica) | GCP | Mittel-Hoch |
| **Azure + Astadia** | Hyperscaler+Partner | Java/C# | Niedrig | Hoch | Azure | Mittel |
| **Heirloom** | ISV | COBOL-on-JVM | Niedrig | Hoch | Multi | Hoch |
| **SoftwareMining** | ISV | Java/C# | Niedrig | Sehr hoch | Multi | Niedrig |
| **TSRI** | ISV | Java | Niedrig | Hoch | Multi | Mittel |
| **OpenLegacy** | ISV | API-Wrapper | Niedrig | n/a | Multi | Mittel |
| **Astadia** | Services | Java/C# | Niedrig | Hoch | Multi | Niedrig (Service) |
| **Raincode** | ISV | COBOL-on-.NET | Niedrig | Hoch | Multi | Hoch |
| **mLogica LIBER\*M** | ISV | Java | Mittel | Hoch | Multi | Mittel |
| **CloudFrame** | ISV | Java | Niedrig | Hoch | Cloud | Mittel |
| **AveriSource** | ISV | Java | Mittel | Hoch | AWS | Mittel |

---

## 18. Empfehlungen fuer Senior Architekten

### 18.1 Tool-Auswahl-Matrix

**Wenn Cloud-Native-Migration Pflicht ist:**
- AWS-Strategie? → AWS Transform
- Multi-Cloud-Strategie? → Astadia, mLogica, TSRI
- Google-fokussiert? → Google Cloud + mLogica + Dual Run
- Microsoft-fokussiert? → Azure + Astadia / Raincode

**Wenn Mainframe bleibt, aber modernisiert werden soll:**
- IBM Z bleibt? → IBM watsonx Code Assistant for Z
- API-Wrapping ausreichend? → OpenLegacy

**Wenn COBOL-Skills erhalten werden sollen:**
- JVM-Plattform? → Heirloom Computing
- .NET-Plattform? → Raincode

**Wenn schnelle Time-to-Market kritisch ist:**
- Bridging-Loesung? → OpenLegacy
- Schnelles Replatforming? → Heirloom oder Rocket Software

**Wenn deterministische, audit-faehige Konvertierung Pflicht ist:**
- SoftwareMining (deterministisch)
- TSRI JANUS Studio
- Raincode (.NET)
- AWS Blu Age (deterministisch im Refactor-Schritt, nicht im Reforge)

### 18.2 Risikohinweise

1. **Vendor Lock-in pruefen**: Alle Tools schaffen Abhaengigkeiten -- ein Wechsel ist meist schwer
2. **Code-Ownership**: Wer besitzt den generierten Code? Lizenz lesen!
3. **Audit-Trail**: Bei regulierten Branchen muss die Transformation reproduzierbar sein
4. **Long-term Support**: Tool-Lebenszyklus pruefen (Heirloom, SoftwareMining bestehen seit Jahrzehnten)
5. **Partner-Oekosystem**: Lokale Implementation Partner vor Ort?

### 18.3 Hybride Strategien

In der Praxis nutzen grosse Migrationen oft **mehrere Tools parallel**:

- **Discovery**: AWS Transform Assessment + IBM Application Discovery
- **Refactoring**: Blu Age fuer Standard-Code + manuelle Refaktorisierung fuer kritische Pfade
- **Testing**: Google Cloud Dual Run-Konzept (auch ausserhalb GCP umsetzbar)
- **API-Bridge**: OpenLegacy fuer schnelle Frontend-Modernisierung
- **AI-Augmentation**: Claude Code / Copilot fuer Entwickler-Produktivitaet

---

## 19. Zusammenfassung

Der COBOL-Modernisierungs-Markt ist 2026 reicher und vielfaeltiger als je zuvor. Die wichtigsten Erkenntnisse fuer Senior Architekten:

1. **Hyperscaler sind in Front**: AWS Transform, Google Cloud Dual Run und das Azure-Partner-Modell dominieren den Diskurs
2. **IBM bleibt relevant**: watsonx Code Assistant for Z fuer Kunden, die im IBM-Oekosystem bleiben
3. **Spezialisten haben ihre Nische**: Heirloom (JVM), Raincode (.NET), OpenLegacy (API-Wrapping), SoftwareMining (Determinismus)
4. **GenAI ist ergaenzend, nicht ersetzend**: LLMs sind wertvoll als Augmentation, aber nicht als alleinige Loesung
5. **Multi-Tool-Strategien sind die Norm**: Grosse Migrationen kombinieren mehrere Tools fuer unterschiedliche Aufgaben

Die richtige Tool-Wahl haengt von der **Zielarchitektur**, dem **Risikoprofil**, dem **Budget**, dem **Zeitrahmen** und der **strategischen Cloud-Ausrichtung** des Unternehmens ab. Ein One-Size-Fits-All gibt es nicht.
