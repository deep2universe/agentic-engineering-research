# AWS PL/I zu Java - Feature- und Tooling-Uebersicht (Stand April 2026)

**Zielgruppe:** Senior Developer und Senior Architekten, die eine PL/I-zu-Java-Modernisierung auf AWS planen oder bewerten.

**Abgrenzung:** Dieses Dokument dokumentiert ausschliesslich die PL/I-spezifischen Aspekte des AWS-Modernisierungs-Oekosystems. Grundlegende Konzepte von AWS Transform for Mainframe, Blu Age, M2, Kiro und Amazon Q Developer werden nur so weit erlaeutert, wie es fuer das PL/I-Verstaendnis noetig ist. Fuer die vollstaendige COBOL-zu-Java-Dokumentation siehe `agent_doc/cobol-migration_aws/`.

**Hinweis zur Recherchelage:** AWS dokumentiert PL/I deutlich schwaecher als COBOL. Mehrere Detailfragen (Pointer/BASED, ON-Units, REFER, konkrete Dialekt-Matrix) sind in den oeffentlichen Quellen nicht explizit beantwortet. Diese Stellen sind im Dokument klar als "Recherchelage unklar" markiert.

---

## 1. Executive Summary: AWS-PL/I-Toolstack 2026

Der AWS-Toolstack fuer PL/I-zu-Java-Migrationen basiert auf **denselben Bausteinen wie COBOL**, hat aber in mehreren Bereichen einen deutlich geringeren Reifegrad und eine duennere Dokumentation. Die zentralen Bausteine sind:

1. **AWS Transform for Mainframe** (GA seit Mai 2025) - das agentische Dachprodukt. Unterstuetzt PL/I offiziell, nutzt intern die Blu Age Transformation Engine fuer den Refactor-Pfad.
2. **AWS Transform for Mainframe Refactor** (seit Maerz 2026 der neue Name von **AWS Blu Insights**) - die Web-Plattform fuer Analyse, Dependency-Graph, Cyclomatic Complexity, Dokumentation und Code-Transformation. Enthaelt die eigentliche PL/I-Parser- und Transformationslogik.
3. **AWS Blu Age Transformation Engine** - der Code-Generator, der COBOL oder PL/I zu Java/Spring Boot, JCL zu Groovy und BMS/MFS zu Angular transformiert. Nutzt das RecordEntity-Framework und die Data Simplifier Library auch fuer PL/I-Strukturen.
4. **AWS Blu Age Runtime** - die Java-Laufzeit mit JICS (CICS-Ersatz), Blusam (VSAM-Ersatz), Data Simplifier und Spring-Boot-Basis. Laeuft auf M2 Self-Managed Runtime (EC2, ECS, EKS; nicht mit EKS Fargate).
5. **AWS Mainframe Modernization (M2) - Rocket Software (ehem. Micro Focus) Runtime** - der Replatform-Pfad. Unterstuetzt PL/I **ohne Sprachwechsel**, laeuft das PL/I weiter (kompiliert fuer die Rocket Enterprise Server Runtime auf AWS).
6. **Amazon Q Developer / AWS Transform Web Experience** - agentischer Einstiegspunkt, kann COBOL, PL/I und Assembler analysieren und transformieren. Inhaltlich identisch mit AWS Transform for Mainframe.
7. **Kiro + AWS Transform Reimagine** - Spec-driven Forward-Engineering fuer Microservices. Nutzt Artefakte aus dem Transform-Reverse-Engineering. Kein PL/I-spezifischer Workflow; arbeitet auf extrahierten Business-Regeln und Domain-Modellen.
8. **Amazon Bedrock + Claude / AgentCore** - Plattform fuer eigene PL/I-Custom-Analysen, etwa wenn Enterprise-PL/I-Dialekte ausserhalb des offiziellen Supports abgedeckt werden muessen.

**Kernaussagen fuer Senior Architekten:**

- PL/I **ist** offizieller First-Class-Quellcode in AWS Transform for Mainframe und Blu Age, nicht nur ein Nebenziel. Die Ankuendigung der GA (Mai 2025) nennt COBOL und PL/I gleichrangig.
- Die **Blu Age-Dokumentation** fuehrt PL/I in allen zentralen Doku-Abschnitten (FAQ, Data Simplifier, RecordEntity, Architecture) auf, die Detailtiefe ist aber deutlich unter dem COBOL-Niveau.
- Der bekannte **JOBOL-Effekt** (wortwoertliche, schlecht wartbare COBOL-nach-Java Transformation) wird von Blu Age laut AWS-Blog explizit durch Model-to-Model-Transformationen vermieden - und zwar fuer **beide** Quellsprachen. Ein eigenes "JPLI-Problem" wird in der Doku nicht als Besonderheit erwaehnt.
- Fuer echten Replatform-Pfad ist **Rocket Software** (ehemals Micro Focus Enterprise Server) der einzige Anbieter auf AWS, der PL/I ohne Sprachwechsel unterstuetzt.
- **Raincode**, historisch der PL/I-Kompiler-Spezialist, ist primaer **Azure**- und .NET-zentriert. Ein offizielles AWS-Marketplace-Listing fuer einen Raincode-PL/I-Compiler wurde in der Recherche nicht gefunden. Raincode Metal ist eine Azure-VM.
- **Kostenlos:** Refactor und Replatform mit AWS Transform for Mainframe sind seit Maerz 2026 ohne LoC-Gebuehren. Pay-as-you-go gilt nur fuer die daraus entstehende Infrastruktur.

---

## 2. Feature-Matrix AWS-Tooling fuer PL/I (April 2026)

| Tool / Dienst | PL/I-Support | Reifegrad PL/I | Dialekte / Einschraenkungen | Zielarchitektur |
|---|---|---|---|---|
| **AWS Transform for Mainframe (Agentic)** | Ja, offiziell seit GA Mai 2025 | Mittel-Hoch | Primaer IBM Enterprise PL/I fuer z/OS. Open PL/I / AIX / Windows nicht explizit dokumentiert. | Java/Spring Boot, Angular, Groovy |
| **AWS Transform for Mainframe Refactor** (ehemals Blu Insights) | Ja, expliziter PL1/PLI Parser | Mittel | PL/I Dialekt: IBM Enterprise PL/I. Dependency Engine erkennt `%INCLUDE`, `XINCLUDE`, `-INC`, `++INCLUDE`, `COPY`, `ENTRY`, `EXEC SQL`. PL1 Procedure-Interpretation wurde in neueren Releases verbessert. | Analyse, Dependency Graph, Cyclomatic Complexity, Doku-Generierung |
| **AWS Blu Age Transformation Engine** | Ja | Mittel | z/OS PL/I mit CICS, DB2, VSAM, IMS, BMS, MFS, Flat Files, GDG. Keine offizielle Liste **nicht**-unterstuetzter PL/I-Konstrukte. | Java 21 + Spring Boot + Angular, PostgreSQL/Aurora/Oracle/DB2 LUW |
| **AWS Blu Age Runtime (M2 Self-Managed)** | Ja (transformierter Java-Code laeuft hier) | Mittel-Hoch | Java 21, Spring Boot, JICS (CICS-Ersatz), Blusam (VSAM-Ersatz). Nicht kompatibel mit EKS+Fargate. | EC2, ECS (EC2 oder Fargate), EKS (EC2) |
| **AWS Mainframe Modernization Replatform (Rocket Software)** | Ja, fuer **ohne Sprachwechsel** | Hoch | Rocket Enterprise Server / Enterprise Developer; COBOL und PL/I. CICS, IMS TM/DB, JES2, VSAM kompatibel. | Rocket Enterprise Server auf EC2, Managed Runtime nicht mehr fuer Neukunden |
| **AWS Mainframe Modernization Managed Runtime** | Historisch ja | Abgekuendigt fuer Neukunden (Stichtag 07.11.2025) | Self-Managed als Migrationspfad | - |
| **AWS Transform for Mainframe Reimagine (Kiro)** | Indirekt (Reverse Engineering) | Niedrig-Mittel | Reimagine arbeitet auf extrahierten Artefakten (Business Rules, Domain Model, Sequenzdiagramme) - Quellsprache ist abstrahiert. Dokumentation zeigt primaer COBOL-Beispiele. | Microservices, Serverless, Event-driven |
| **Amazon Q Developer Transform (Web)** | Ja, COBOL + PL/I + Assembler | Mittel | Identisch mit AWS Transform for Mainframe; Q Developer Transform ist der Web-Einstieg. | Java 21, Spring Boot |
| **Amazon Q Developer (IDE Plugin)** | Erklaeren/Chatten moeglich, keine offiziell supportete End-to-End-Transformation fuer PL/I im IDE-Plugin | Niedrig | Generischer LLM-basierter Code-Support, nicht PL/I-spezialisiert | VS Code / JetBrains / Eclipse |
| **Amazon Bedrock + Claude + AgentCore** | Beliebig, custom | Abhaengig von eigener Implementation | 1M Token Context ermoeglicht grosse PL/I-Dateien + Copybooks. Beispiel: Toyota Motor Europe nutzt Claude Sonnet 4 + Strands fuer NCL-Doku (uebertragbar auf PL/I). | Custom Agents, Bedrock Flows |
| **AWS Transform Custom** | Nicht out-of-the-box fuer PL/I-Dialekte, aber als Plattform fuer eigene PL/I-Workflows nutzbar | Niedrig | Pricing: 0,035 USD pro Agent-Minute | Custom Transformations |
| **Raincode PL/I Compiler** | Ja, aber **nicht nativ auf AWS** | Historisch hoch, aber Plattform: Azure + .NET 6/8 | Kein JVM-Target, kein offizielles AWS-Marketplace-Listing gefunden (Recherchelage: Azure Marketplace). | .NET 6/8 auf Windows/Linux/Azure |
| **NTT DATA UniKix Replatform** | Ja, via NTT DATA Partner-Toolchain auf AWS | Mittel | Enterprise COBOL/PL/I-Kompiler-Pfad | UniKix Runtime auf AWS |
| **Astadia Automated Refactoring** | Nicht explizit PL/I; primaer COBOL->Java/C# | Niedrig bis unbekannt | PL/I-Support nicht in den verfuegbaren Quellen bestaetigt | Java, C# |
| **mLogica LIBER*M** | Nicht PL/I; Fokus Assembler->COBOL | Niedrig | PL/I nicht bestaetigt | COBOL |

Die Reifegrad-Einstufung ist redaktionell und beruht auf Dokumentations-Tiefe und Blog-Post-Abdeckung. Sie ist kein AWS-offizielles Rating.

---

## 3. AWS Transform for Mainframe: PL/I-Faehigkeiten im Detail

### 3.1 Zeitlinie und aktuelle Lage

- **Dezember 2024:** Amazon Q Developer Transform fuer Mainframe Preview auf re:Invent 2024.
- **Mai 2025:** AWS Transform for Mainframe wird **Generally Available**. Ankuendigung nennt COBOL und PL/I explizit. Verfuegbar in us-east-1 und eu-central-1.
- **November 2025:** M2 Managed Runtime wird fuer Neukunden geschlossen. Self-Managed und AWS Transform bleiben.
- **Dezember 2025:** AWS Transform for Mainframe fuehrt **Reimagine**-Pattern und **Test Generation Agents** ein.
- **Maerz 2026:** AWS Blu Insights wird offiziell umbenannt in **AWS Transform for mainframe refactor**. Code Transformation jetzt kostenlos (LoC-Pricing faellt weg). Verfuegbar in 18 AWS-Regionen. Die verpflichtende 3-Level-Zertifizierung zum Zugriff aufs Transformation Center entfaellt.

### 3.2 Agents und ihre PL/I-Relevanz

Laut AWS-Blogs und Prescriptive Guidance besteht AWS Transform for Mainframe aus mehreren spezialisierten Agents. Die folgende Auflistung zeigt, was fuer PL/I in den Quellen bestaetigt ist:

**Analysis / Assessment Agent**
- Kategorisiert Code-Dateien inklusive PL/I (`.pli`, `.pl1`, `.inc`, `.cpy`).
- Berechnet Lines of Code, Comment LoC, Effective LoC, Cyclomatic Complexity.
- Baut Dependency Graph. Die Blu Insights Dependency-Engine erkennt explizit `%INCLUDE`, `XINCLUDE`, `-INC`, `++INCLUDE`, `COPY` fuer PL/I (alles Varianten zum Einziehen von Copybooks auf `.cpy`, `.pli`, `.pl1` und `.inc` Dateien).
- Erkennt ENTRY-Deklarationen, die auf andere Programme zeigen (als Call-Dependency). Ausnahme: wenn ENTRY die VARIABLE-Option hat.
- Erkennt `EXEC SQL FROM/INSERT INTO/UPDATE` als Tabellen-Dependencies.
- Neuere Releases haben die PL1-Procedure-Interpretation verbessert, um False-Positive "Missing Program"-Warnungen zu reduzieren.

**Planning Agent / Wave Planner**
- Generiert einen Migration Wave Plan auf Basis der Domain Decomposition und Dependency-Analyse. AWS-Quellen beschreiben dies sprachagnostisch - laut Produkt-Dokumentation gilt es sowohl fuer COBOL- als auch fuer PL/I-Portfolios.
- Recherchelage unklar: Ob Wave Planning in der Praxis fuer gemischte COBOL/PL/I-Portfolios genauso genau ist wie fuer reine COBOL-Portfolios, wird in den AWS-Quellen nicht quantifiziert.

**Code Decomposition Agent**
- Zerlegt monolithische Programme in Business Domains ueber Semantic Seeds und Dependency Graph. Funktioniert laut Prescriptive Guidance auf der sprachagnostischen Graph-Ebene, nicht auf Source-Ebene.

**Refactoring / Transformation Agent**
- Fuer PL/I nutzt Transform intern die **Blu Age Transformation Engine** (siehe Abschnitt 4). Output: Java + Spring Boot. JCL wird zu Groovy.
- AWS wirbt explizit mit "transforms millions of lines of COBOL and PL/1 code into Java/Angular in minutes preserving exact business functionalities using automated tooling from AWS Blu Age".

**Documentation Agent**
- Extrahiert Business Logic, Process Flows, Dependencies aus Quellcode. Wird sprachagnostisch beschrieben, mit Erwaehnung von COBOL + PL/I + Assembler.

**Test Generation Agents (seit Dezember 2025)**
- Drei Test-Agents: Test-Plan-Generierung, Test-Data-Collection-Scripts, Test-Automation-Scripts.
- Die Dokumentation nennt keine PL/I-spezifischen Einschraenkungen; Input sind Programme und Dateien, nicht die Quellsprache.

### 3.3 Nicht explizit dokumentierte PL/I-Aspekte

Folgende Themen sind in den oeffentlich einsehbaren AWS-Quellen (Stand April 2026) nicht oder nur sehr knapp dokumentiert. Recherchelage **unklar** - nicht halluzinieren:

- **Welche PL/I-Dialekte genau supportet werden.** Die Dokumentation nennt IBM Enterprise PL/I fuer z/OS implizit ueber die z/OS-Referenz, ohne explizite Versionsangabe. **Open PL/I** (historisch Tmaxsoft OpenFrame, heute Teil verschiedener Rehost-Pfade), **IBM PL/I for AIX**, **IBM PL/I for Windows**, **Fujitsu NetCOBOL PL/I** - keine davon sind in den gefundenen AWS-Quellen explizit bestaetigt.
- **BASED Storage und Pointer-Handling** in der Blu Age Transformation. Die Data-Simplifier-Doku beschreibt byte-genaue Speicherabstraktionen ueber eine Record-Schnittstelle und nennt PL1 explizit, erwaehnt aber BASED und Pointer nicht im Detail.
- **REFER-Option** (dynamische Arraylaengen in PL/I Structures). Keine Erwaehnung in den AWS-Quellen.
- **ON-Units** (PL/I-Exception-Handling). Keine explizite Erwaehnung, wie diese nach Java gemappt werden. Vermutung (nicht belegt): Mapping auf Java try/catch bzw. auf runtime-spezifische Handler. **Nicht bestaetigt.**
- **Preprocessor / %INCLUDE-Verschachtelung** jenseits der Dependency-Erkennung (tatsaechliche Expansion vor Parsing): nicht dokumentiert.
- **Custom Transformations fuer eigene PL/I-Dialekte** via AWS Transform Custom sind technisch moeglich (0,035 USD/Agent-Minute), aber ohne offizielle PL/I-Blueprints.

---

## 4. AWS Blu Age Transformation Engine: PL/I-Code-Generierung im Detail

Die Blu Age Transformation Engine ist der eigentliche Code-Generator fuer den Refactor-Pfad. Sie wird von AWS Transform for Mainframe intern genutzt. Stand April 2026 laeuft der Blu Age Runtime auf Java 21 (Upgrade von Java 17 in einem Release-Schritt 2024/2025).

### 4.1 Quell- und Zielsprachen

Laut AWS Blu Age FAQ (`docs.aws.amazon.com/m2/latest/userguide/ba-faq.html`) und AWS Blogs:

- **Quellen:** COBOL, PL/I, JCL, CICS, IMS MFS, BMS, DB2, IMS DB, VSAM, Flat Files, GDG.
- **Ziele:** Java + Spring Boot (Server), Angular + JavaScript + Sass + HTML (UI; React ist **nicht** Ziel), Groovy (JCL-Ersatz), PostgreSQL / Aurora / RDS PostgreSQL / Oracle / IBM DB2 LUW / MS-SQL.

Wichtig: In der Blu Age Doku heisst es explizit, dass "most of the following explanations are based on COBOL constructs, but you can use the same API for both PL1 and RPG data layout modernization, since most of the concepts are similar". Dieses Zitat aus `ba-shared-structure.html` ist einer der wenigen konkreten Hinweise, dass PL/I konzeptionell dem COBOL-Pfad folgt.

### 4.2 RecordEntity und Data Simplifier fuer PL/I-Strukturen

- Das **RecordEntity-Framework** ist die Basisklasse aller modernisierten Datenstrukturen. Fuer COBOL `01 DATA ITEMS` werden Subklassen generiert. Laut Doku gilt dasselbe API fuer **PL/I Structures** (und RPG Data Layouts). Die generierten Klassen bilden die Baum-Hierarchie der Legacy-Struktur ab (Parent/Child ueber Elementar- und Aggregatfelder).
- Die **Data Simplifier Library** kapselt legacy memory layout: byte-genaue Record-Abstraktion (Record-Interface als Abstraktion eines fixen Byte-Arrays), Zoned und Packed Decimal, Raw- und strukturierter Zugriff. Die Doku benennt explizit COBOL, PL1 und RPG als unterstuetzte Herkunfts-Layouts.
- **Implizite Folge:** PL/I Structures werden im generierten Java nicht als einfache POJOs mit Java-Typen gemappt, sondern bleiben memory-layout-konform, damit binaere Interop, File-IO und Redefinition-Semantik erhalten bleiben.

### 4.3 Generiertes Java

- Spring Boot Server mit Tomcat, laufen in Blu Age Runtime.
- **JOBOL-Analogon:** Laut AWS Blogpost "AWS Blu Age Code Maintainability" vermeidet Blu Age den JOBOL-Effekt durch Model-to-Model-Transformationen, reusable Classes und non-procedural Patterns. Das gilt fuer beide Quellsprachen. Ein eigenes **"JPLI"**-Problem wird in keinem AWS-Dokument als Sonderfall fuer PL/I genannt. Die Recherche liefert keinen Beleg, dass Blu Age PL/I-Input anders oder schlechter transformiert als COBOL.
- **JCL** in PL/I-Jobs wird wie in COBOL-Jobs zu **Groovy-Scripts** transformiert, die in der gleichen JVM wie die Java-Programme laufen.

### 4.4 DB2 Embedded SQL in PL/I

- Die Blu Age FAQ bestaetigt DB2-Support allgemein. Das umfasst DB2 z/OS Quell-DB-Zugriff ebenso wie Migration nach Aurora/RDS PostgreSQL/Oracle/DB2 LUW.
- Es gibt einen dedizierten **DB2 z/OS zu DB2 LUW**-Migrationspfad, der Syntaxunterschiede zwischen den Dialekten behandelt - fuer Organisationen, die DB2 als Zielsystem behalten wollen.
- Fuer `EXEC SQL` in PL/I werden JDBC-basierte Aufrufe generiert. Dependency Analysis erkennt `EXEC SQL FROM/INSERT INTO/UPDATE` als Tabellen-Dependencies.
- Recherchelage unklar: Ob dynamisches SQL und Embedded-SQL-Prepare/Execute-Patterns fuer PL/I 1:1 wie fuer COBOL transformiert werden, ist in den oeffentlichen Quellen nicht explizit beschrieben.

### 4.5 CICS EXEC in PL/I

- CICS-Transaktionen werden von **JICS** (Java Information Control System) uebernommen, der Blu Age Runtime-Komponente fuer CICS-Resourcen-Definitionen.
- Laut AWS re:Post-Artikel koennen JICS-Transaktionen ueber REST-APIs aus Lambda aufgerufen werden. Das gilt grundsaetzlich sprachagnostisch, also auch fuer PL/I-transformierte Transaktionen.
- BMS und IMS MFS Screens werden zu Angular 17/18 und HTML. **React ist nicht Ziel** (Stand April 2026; Blu Age Doku bestaetigt dies).

### 4.6 PL/I %INCLUDE und Preprocessor

- Die Dependency Engine in AWS Transform for Mainframe Refactor erkennt **`%INCLUDE`**, **`XINCLUDE`**, **`-INC`**, **`++INCLUDE`** und **`COPY`**-Statements (letzteres wurde in einem neueren Release fuer PL/I hinzugefuegt).
- Zusaetzlich werden INCLUDE-Statements mit Library-Namen (z. B. `SYSLIB` oder `SFSTDS`) zwischen dem INCLUDE-Keyword und dem Copybook-Identifier korrekt verarbeitet.
- Die PL1-Procedure-Interpretation wurde verbessert, um False-Positive "Missing Program"-Warnungen zu reduzieren.

### 4.7 Dialekt-Abgrenzung

- AWS Blu Age und Blu Insights nennen grundsaetzlich **IBM z/OS PL/I** als Quelldialekt. Das deckt sinngemaess **IBM Enterprise PL/I fuer z/OS** ab.
- **Open PL/I** (urspruenglich Micro Focus / Rocket Software, im Open-PL/I-Umfeld auch Tmaxsoft OpenFrame) ist in den Blu-Age-Quellen nicht explizit als unterstuetzter Refactor-Input genannt. Rocket Software bleibt der Replatform-Pfad fuer Open PL/I und verwandte Dialekte (siehe Abschnitt 6).
- **IBM PL/I fuer AIX** und **IBM PL/I fuer Windows** werden nicht explizit in den AWS-Quellen diskutiert. Recherchelage unklar - ein vorsichtiger Architekten-Ansatz ist, kleine Pilotprojekte auf Blu Age laufen zu lassen und die Ergebnisse mit dem AWS Transform Assessment validieren zu lassen.

---

## 5. AWS M2 Runtime: Self-Managed fuer PL/I

### 5.1 Blu Age Runtime (Refactor-Target)

- Modernisierter PL/I-Code (als Java) laeuft in der **AWS Blu Age Runtime**.
- **Deployment-Optionen** (Self-Managed):
  - Amazon EC2 direkt (Java/Spring Boot auf Tomcat).
  - Docker-Container auf Amazon ECS (EC2 oder Fargate).
  - Amazon EKS (nur mit EC2-Worker-Nodes, **nicht** mit Fargate-Worker).
- Runtime-Komponenten, die auch PL/I-Workloads nutzen:
  - **JICS** als CICS-Ersatz.
  - **Blusam** als VSAM-Ersatz (inklusive KSDS, ESDS, RRDS Semantik).
  - Replacements fuer IDCAMS, IEBGENER, DFSORT und andere Utilities.
  - Groovy-Scripts fuer JCL-Batch.
- Laut AWS Blu Age FAQ wird Java 21 genutzt (Upgrade von Java 17 wurde in einem Release festgehalten).

### 5.2 Rocket Software Runtime (Replatform-Target)

- Fuer PL/I **ohne Sprachwechsel** bietet AWS den Replatform-Pfad ueber **Rocket Enterprise Server** und **Rocket Enterprise Developer** (historisch Micro Focus; 2024 uebernommen und umbenannt). 
- Rocket Enterprise Server bietet PL/I-Ausfuehrung mit CICS-, IMS-TM-, IMS-DB-, JES2- und VSAM-Kompatibilitaet.
- Rocket Enterprise Developer ist ein Eclipse-basierter IDE fuer COBOL und PL/I.
- Die AWS M2 Managed Runtime ist seit **7. November 2025** nicht mehr fuer Neukunden offen. Neukunden gehen auf **M2 Self-Managed** oder **AWS Transform for Mainframe** (fuer Refactor).
- PL/I-spezifische Runtime-Features sind in der Rocket-Runtime-Dokumentation beschrieben; sie deckt Enterprise-PL/I-Sprachsemantik einschliesslich Preprocessor, Pointer/BASED, ON-Units und Storage-Classes ab, da es sich um echte Kompilation des PL/I-Codes handelt (nicht um Transformation).

### 5.3 Wahl zwischen Refactor und Replatform fuer PL/I

Kurzorientierung fuer Senior Architekten:

| Kriterium | Refactor (Blu Age, Java) | Replatform (Rocket, PL/I bleibt) |
|---|---|---|
| Sprachwechsel | Ja, PL/I -> Java | Nein, PL/I bleibt |
| Dialekt-Toleranz | Primaer IBM z/OS PL/I | Deckt mehr Dialekt-Variation ab, da nativer PL/I-Kompiler |
| Time-to-Value | Laenger | Kuerzer |
| Cloud-Nativeness | Hoch | Mittel |
| Talent-Pool danach | Java-Entwickler | Weiterhin PL/I-Entwickler erforderlich |
| Managed-Runtime-Zukunft | AWS Transform (kostenlos), M2 Self-Managed | M2 Self-Managed (Managed nur noch fuer Bestandskunden) |

---

## 6. Raincode PLI auf AWS

**Kurzfazit: Raincode ist historisch der fuehrende PL/I-Compiler-Anbieter, aber auf AWS deutlich weniger praesent als auf Azure.**

- Der **Raincode PL/I Compiler** kompiliert IBM-Mainframe-PL/I in **100% managed code fuer .NET 6 / .NET 8**. Er ist **kein JVM-Compiler**.
- Die empfohlene Deployment-Plattform ist **Raincode Metal**, eine **Azure-basierte** VM mit der kompletten Raincode-Suite (COBOL, PL/I, ASM370, QIX als CICS-Emulator, Raincode Batch fuer JCL, Raincode Insight als Enterprise Code Analyzer).
- **Raincode 360** ist auf dem **Microsoft Azure Marketplace** gelistet. In der Recherche wurde **kein offizielles AWS-Marketplace-Listing** fuer einen Raincode-PL/I-Compiler als AMI oder SaaS-Offering gefunden.
- **Raincode Crossbow** ist der Installations-Pfad fuer Raincode-Compiler auf Linux (mit .NET 6/8 Target). Linux-Binaries koennen grundsaetzlich auf AWS EC2 laufen, AWS unterstuetzt aber keine offizielle Integration mit AWS Mainframe Modernization Service.
- **Integration mit AWS Mainframe Modernization:** Keine der offiziellen M2- oder AWS-Transform-Quellen nennt Raincode als integrierten Partner. Rocket Software und NTT DATA UniKix sind die dominierenden Replatform-Partner fuer PL/I auf AWS.
- **Architekten-Ratschlag:** Wenn Raincode aus Lizenz- oder Supportgruenden Pflicht ist, bleibt Azure (Raincode Metal) oder eine eigene EC2-Instanz mit manuell installiertem Raincode auf .NET-Runtime. Keine native M2-Integration vorhanden. Recherchelage unklar: ob ein Partner-Delivery-Modell (Raincode + AWS-Consulting-Partner) moeglich ist, bleibt auf Projektbasis zu klaeren.

---

## 7. Amazon Q Developer: PL/I-Support

- **Q Developer Transform Web Experience** (urspruenglich in der Preview im Dezember 2024 angekuendigt) ist der Einstiegspunkt in das, was seit GA Mai 2025 **AWS Transform for Mainframe** heisst. Q Developer Transform und AWS Transform for Mainframe sind **inhaltlich identisch** fuer Mainframe-Workloads. Q Developer ist das User-Facing-Product, AWS Transform for Mainframe die service-seitige Identitaet.
- **Unterstuetzte Sprachen im Transform-Workflow:** COBOL, **PL/I**, Assembler.
- **Analysis:** Dependency Graph, Code-Kategorisierung (JCL, BMS, COBOL-Programme, Copybooks). PL/I-Code wird dabei konsistent mitbehandelt - die Dokumentation nennt kein Feature-Gap gegenueber COBOL.
- **Doku-Generierung:** Automatische Beschreibung von Business Logic, Flows, Integrations und Dependencies aus dem Legacy-Code. Sprachagnostisch.
- **Refactor:** COBOL und JCL werden zu Java und Groovy. Fuer PL/I wird intern die Blu Age Transformation Engine genutzt.
- **Q Developer IDE Plugin (VS Code, JetBrains, Eclipse):** Kein dedizierter PL/I-Transformations-Workflow im IDE. Chat-basiertes Erklaeren und Verbessern von PL/I-Code ist durch das allgemeine LLM-Verhalten moeglich, ist aber kein offizieller Feature-Claim. Recherchelage unklar fuer die Qualitaet im Vergleich zu COBOL, wo es belegte Beispiele gibt.

---

## 8. Amazon Bedrock / Claude Custom Agents fuer PL/I

Fuer Faelle, in denen AWS Transform for Mainframe nicht passt (exotische Dialekte, spezielle Compliance-Anforderungen, unvollstaendige Quell-Code-Extraktion), kommt **Amazon Bedrock + Claude + AgentCore** als Bauplattform infrage.

- **Claude Opus 4.x und Sonnet 4.x auf Amazon Bedrock** sind fuer grosse PL/I-Dateien geeignet. Der 1M-Token-Kontext (Opus 4.5) erlaubt die Analyse mehrerer gekoppelter PL/I-Programme inklusive Copybooks in einem Call.
- **Claude Agent SDK** laeuft auf Bedrock und unterstuetzt Skills, Subagents und MCP-Server. Skill-basierte Architekturen fuer PL/I-Analyse, PL/I-zu-Java-Transformation oder PL/I-Test-Case-Extraktion sind realisierbar.
- **Referenzfall:** Toyota Motor Europe nutzt Claude Sonnet 4 auf Bedrock zusammen mit dem Strands Agents SDK, um Legacy-NCL-Code automatisiert zu dokumentieren. Dieses Pattern ist direkt uebertragbar auf PL/I-Portfolios, wenn die offizielle Blu-Age-Doku-Generierung nicht ausreicht.
- **Amazon Bedrock AgentCore** bietet die Plattform fuer Tool-Use, Memory, Knowledge Bases. Fuer PL/I kann ein Knowledge Base mit PL/I-Copybooks, Datenbeschreibungen und Business-Regeln gefuellt werden, auf dem der Agent arbeitet.
- **AWS Transform Custom** (GA Dezember 2025) ist ein offizieller Weg, eigene Transformationen fuer Code, APIs und Frameworks zu bauen - mit dem **0,035 USD pro Agent-Minute**-Pricing. Fuer PL/I gibt es keine offiziellen Blueprints, aber die Plattform ist sprachagnostisch. Realistisches Einsatzszenario: spezifischer PL/I-Dialekt, fuer den die Built-In Blu Age-Engine Luecken hat.

---

## 9. Pricing und Verfuegbarkeit (Stand April 2026)

| Komponente | Preis (April 2026) | Hinweis |
|---|---|---|
| **AWS Transform for Mainframe** (Refactor Agent, Analyse, Doku, Planning, Test) | Kostenlos | AWS Transform Mainframe Agent ist seit GA Mai 2025 kostenlos; seit Maerz 2026 ebenso der refactor-Pfad. |
| **AWS Blu Age Transformation Engine** (via Transform) | Kostenlos | Frueheres LoC-Pricing in Blu Insights ist mit der Umbenennung im Maerz 2026 weggefallen. |
| **M2 Self-Managed Runtime** | EC2/ECS/EKS Standardkosten | Der M2-Dienst selbst ist kostenlos; bezahlt wird die Infrastruktur. |
| **M2 Managed Runtime** | Geschlossen fuer Neukunden ab 07.11.2025 | Bestandskunden koennen weiter nutzen. Neukunden gehen auf Self-Managed oder AWS Transform. |
| **Rocket Enterprise Server Lizenz** | Bring Your Own License / ueber Rocket Software | PL/I Replatform-Pfad auf M2 benoetigt separate Rocket-Lizenzierung. |
| **AWS Transform Custom** | 0,035 USD pro Agent-Minute | Agent-Minuten zaehlen nur aktive Arbeit, nicht lokale Builds. Beispiele: ~20 min fuer 3k LoC SDK-Upgrade; ~72 min fuer 17k LoC Java-Language-Upgrade. |
| **Amazon Bedrock (Claude Opus/Sonnet)** | Token-basiert nach Bedrock-Pricing | Abhaengig vom gewaehlten Modell und Region. |
| **Raincode PL/I Compiler** | Separat lizenziert durch Raincode | Nicht auf AWS Marketplace gelistet (Recherchelage). |

**Verfuegbarkeit AWS Transform for Mainframe Refactor:** 18 AWS-Regionen seit Maerz 2026 (vorher nur us-east-1 und eu-central-1 im AWS-Transform-Backbone).

---

## 10. Partner-Oekosystem AWS + PL/I

### 10.1 Elite Launch Partner fuer AWS Transform for Mainframe

AWS benennt folgende **Elite Launch Partner** (Stand 2025/2026):

- **Accenture**
- **Capgemini**
- **Cognizant**
- **DXC Technology**
- **HCLTech**
- **Infosys**
- **Kyndryl** (mit dedizierten eigenen Advisory- und Implementation-Services fuer AWS Transform; Projektionen: Timelines um ca. 1/3 verkuerzt)
- **Nomura Research Institute (NRI)**
- **Pega Systems**

Keine dieser Ankuendigungen nennt PL/I explizit als Spezialisierung, der Scope umfasst COBOL **und** PL/I gleichermassen.

### 10.2 Replatform-Partner mit PL/I-Scope

- **Rocket Software** (ehem. Micro Focus Enterprise Server / Developer) - primaere Quelle fuer PL/I-Replatform auf AWS.
- **NTT DATA UniKix** - Enterprise COBOL/PL/I-Compiler-Pfad mit eigenem Replatform-Angebot auf AWS Mainframe Modernization.

### 10.3 Automated Refactoring Partner

- **Astadia** - Automated Refactoring nach Java und C#. PL/I-Support ist in den oeffentlichen Astadia-Blogs **nicht explizit bestaetigt**; primaer COBOL. Recherchelage unklar fuer echte PL/I-Produktionsfaehigkeit.
- **mLogica** - Fokus auf **Assembler**-nach-COBOL (offizielle AWS-Partnerschaft). Kein offizielles PL/I-Angebot auf AWS.
- **EPAM, TSRI, SoftwareMining** etc. - historisch PL/I-Kompetenz; AWS-offizielle Positionierung speziell fuer PL/I in der Recherche nicht prominent.

### 10.4 Raincode

- **Kein Elite-Launch-Partner** fuer AWS Transform for Mainframe. Primaer Microsoft-Azure-orientierter .NET-Anbieter.
- Historisch fuehrend bei PL/I-Kompilerbau, aber nicht in der AWS-Elite-Liste fuer Mainframe-Modernization gelistet.

---

## 11. Bekannte Limitationen (Stand April 2026)

Diese Liste stellt die in der Recherche identifizierten Einschraenkungen zusammen. Sie ist **nicht vollstaendig** und ersetzt kein formales Assessment.

1. **Dialekt-Matrix unklar:** AWS dokumentiert den "Enterprise PL/I fuer z/OS"-Scope nur implizit ueber die z/OS-Referenz. Open PL/I, IBM PL/I fuer AIX, PL/I fuer Windows und weitere Dialekte sind in AWS-Quellen nicht explizit als unterstuetzt genannt.
2. **BASED Storage und Pointer-Mapping:** Keine detaillierte oeffentliche Doku, wie die Blu Age Engine PL/I-Pointer, BASED-Variablen, ALLOCATE/FREE und Storage-Classes (AUTOMATIC, STATIC, CONTROLLED, BASED, DEFINED) nach Java abbildet. Recherchelage unklar.
3. **ON-Units:** Keine explizite Mapping-Beschreibung fuer PL/I ON-CONDITION Handling nach Java-Exceptions. Recherchelage unklar.
4. **REFER-Option:** Dynamische Array-Laengen via REFER nicht in der Doku adressiert.
5. **Angular statt React:** UI-Modernisierung aus BMS/MFS nur zu Angular, React nicht Ziel (betrifft auch PL/I-Bildschirme via MFS).
6. **JSON/XML-Handling** in PL/I Enterprise Versionen: nicht explizit dokumentiert. Recherchelage unklar.
7. **Keine oeffentlichen PL/I-Sample-Anwendungen:** Im aws-samples-Repository gibt es kein PL/I-Pendant zu CardDemo. Referenzkunden und Beispielprojekte sind groesstenteils COBOL-basiert.
8. **Kein PL/I-spezifisches Re:Invent-Session-Catalog-Highlight** in den re:Invent-2025-Quellen. Generelle Mainframe-Sessions decken PL/I implizit ab.
9. **Raincode auf AWS:** Keine offizielle Integration in AWS Transform oder M2; keine AWS-Marketplace-Listung gefunden.
10. **Doku-Tiefe:** Die Dokumentation nennt PL/I fast immer nur als zweites Element im Satz "COBOL and PL/I". Tiefe Erlaeuterung gibt es in 90% der Faelle nur fuer COBOL.
11. **Test Generation Agent:** In den AWS-Quellen nicht explizit fuer PL/I validiert; Dokumentation ist sprachagnostisch formuliert. Recherchelage unklar.
12. **Reimagine Kiro Pattern:** Die Tutorials und Demos zeigen COBOL/JCL als Beispiel. PL/I wird nicht als dediziertes Beispiel in den Reimagine-Tutorials gezeigt, sollte aber ueber denselben Weg (Export der Transform-Artefakte, dann Kiro) funktionieren.

---

## 12. Unterschiede zur COBOL-Migration auf AWS

Fuer Leser, die die bestehende COBOL-zu-Java-Dokumentation kennen, die zentralen Abweichungen:

| Aspekt | COBOL auf AWS | PL/I auf AWS |
|---|---|---|
| Dokumentations-Tiefe | Sehr hoch, viele Blog-Posts, Prescriptive Guidance, Samples | Deutlich duenner, wenige PL/I-spezifische Absaetze |
| aws-samples | CardDemo, sample-mainframe-transformation-e2e | Kein PL/I-Pendant |
| Dialekte | IBM Enterprise COBOL, Micro Focus/Rocket COBOL, NTT DATA UniKix, ACUCOBOL (teilweise) | Primaer IBM Enterprise PL/I z/OS; Open PL/I und andere Dialekte: Recherchelage unklar |
| Q Developer IDE Plugin Workflow | Dokumentiert, inkl. CardDemo-Patterns | Nicht dediziert dokumentiert |
| JOBOL-Thematik | Bewusste Diskussion, Blu Age addressiert es explizit | Kein bekannter "JPLI"-Sonderfall - dieselbe Model-to-Model-Architektur |
| Test Generation Agent | Dokumentiert mit Beispielen | Sprachagnostisch, aber keine PL/I-spezifischen Beispiele |
| Reimagine/Kiro | Beispielcode, Tutorials | Kein eigenes PL/I-Tutorial, aber technisch gleicher Pfad |
| Replatform-Alternative | Rocket, NTT DATA UniKix, Astadia (partiell) | Primaer Rocket und NTT DATA UniKix |
| Dritt-Anbieter fuer Compile-to-.NET | Nicht dominant | **Raincode** ist etabliert, aber Azure-zentriert, nicht AWS |
| Assessment Output-Qualitaet | Sehr stabil | Laut AWS generell stabil, Detailqualitaet fuer PL/I-spezifische Konstrukte in oeffentlichen Quellen nicht quantifiziert |

**Empfehlung fuer Senior Architekten:**

1. Jede PL/I-Migration auf AWS sollte mit einer **Proof-of-Concept-Assessment-Phase** in AWS Transform for Mainframe beginnen. Dort wird sichtbar, wie gut die Dependency-Analyse auf dem konkreten PL/I-Codebase arbeitet (inkl. Copybook-Aufloesung, ENTRY-Referenzen, EXEC SQL).
2. Fuer Faelle mit ungewoehnlichen Dialekten oder schwer zu transformierenden Konstrukten (komplexe BASED-Storage, exotische Preprocessor-Nutzung, ON-Units mit komplexem Semantik): Einen kleinen Pilot bauen und das **Rocket-Replatform** als Fallback in der Tasche haben.
3. Falls spezielle Custom-Analysen noetig sind (z. B. Business-Rule-Extraction, die ueber Blu Age hinausgeht): **Amazon Bedrock + Claude + AgentCore** als Plattform nutzen. Vorbild: Toyota Motor Europe / NCL-Doku.
4. Partner-Wahl: **Kyndryl, Accenture, Capgemini, NTT DATA** sind die Anbieter mit belegter PL/I-Erfahrung im AWS-Transform-Oekosystem. Bei besonders komplexen PL/I-Portfolios kann auch Rocket Professional Services eingebunden werden.
5. Nicht vergessen: Die **BMS/MFS-zu-Angular**-Transformation ist im Blu Age Stack fest verdrahtet. Wenn das Zielsystem React oder eine andere UI nutzen soll, ist manuelle Nacharbeit oder der Reimagine-Pfad (Kiro) noetig.

---

## Anhang: Verwendete Quellen

Die vollstaendige gruppierte Quellenliste ist in `_quellen_aws_pl1.md` im selben Verzeichnis.





