# Marktuebersicht PL/I-Migrationstools im Vergleich zu AWS

**Stand:** 2026-04-09
**Fokus:** PL/I-spezifische Toollandschaft (nicht COBOL — hierzu existiert `agent_doc/cobol-migration_aws/cobol_migration_weitere_tools.md`).
**Zielgruppe:** Senior Architekten, die einschaetzen muessen, wo AWS Transform im PL/I-Markt positioniert ist.

---

## 1. Markt 2026 — PL/I-spezifisch

Der PL/I-Markt ist deutlich kleiner und fragmentierter als der COBOL-Markt. Die relevante Anbieterlandschaft umfasst 2026 im Wesentlichen:

| Kategorie | Anbieter |
|---|---|
| **PL/I-Kompiler (Rehost)** | Raincode PL/I Compiler, Rocket Open PL/I, Micro Focus / OpenText PL/I |
| **Refactor PL/I → Java/C#** | mLogica LIBER*M (LIBER\*TULIP), Heirloom Computing, TSRI JANUS Studio, Astadia FastTrack |
| **LLM-/AI-gestuetzt** | IBM watsonx Code Assistant for Z (PL/I → Java), AWS Transform (strategisch, praktisch duenner dokumentiert als COBOL), Heirloom/X (h/GENAI) |
| **Nischenanbieter** | SoftwareMining (primaer COBOL, PL/I partiell), Asysco AMT (primaer Unisys/Burroughs, PL/I-Randsupport) |

**Wichtigste Beobachtung:** Waehrend bei COBOL ein halbes Dutzend LLM-basierter Tools am Markt konkurrieren, gibt es fuer PL/I nur zwei relevante AI-gestuetzte Akteure (IBM watsonx und Heirloom/X). Der Rest faehrt klassischen deterministischen Compiler- oder Refactor-Ansatz.

---

## 2. Raincode PL/I (wichtigster PL/I-Kompiler-Spezialist)

- **Ansatz:** Kompiler (kein Refactor, kein LLM). Uebersetzt PL/I nativ nach **.NET 6/8 Managed Code** (C# IL).
- **Zielplattform:** Windows / Linux / Container. Explizit Visual-Studio-integriert.
- **Cloud-Fokus:** **Azure** (Microsoft Architecture Center listet Raincode als Referenzarchitektur fuer Mainframe-Rehost). **Kein AWS-Marketplace-Listing**, keine AWS-Referenzarchitektur.
- **Zielsprache:** **.NET/C#, nicht JVM/Java.** Wichtiger strategischer Unterschied zu AWS Transform fuer PL/I.
- **Besonderheiten 2026:** Visual Studio 2022/2026 Support, verbesserter JCL-Debugger, Entfernung .NET Framework und .NET 6. Integration mit Raincode COBOL- und ASM370-Kompiler.
- **Positionierung:** Tiefste PL/I-Dialektabdeckung am Markt, aber fuer AWS-Kunden funktional **ungeeignet als strategischer Java-Pfad**.

---

## 3. Rocket Software — Open PL/I

- **Ansatz:** Legacy-PL/I-Kompiler, Bestandteil des **Rocket Enterprise Server** (ehemals Liant/micro focus-nah).
- **Cloud:** AWS-Partner fuer Replatform-Szenarien; laeuft in AWS EC2/ECS im Rahmen des Rocket-Stacks.
- **Zielsprache:** Bleibt PL/I — es ist ein **Rehost-Kompiler**, keine Transformation nach Java.
- **Positionierung:** Ideal fuer Kunden, die kurzfristig "Lift-and-Shift" von Mainframe-PL/I wollen und die Sprache behalten. **Nicht vergleichbar mit Java-Transformationstools**, aber oft Vorstufe oder Koexistenz mit solchen.
- **AWS-Relevanz:** Rocket ist gelistet in AWS Marketplace und wird in AWS-Mainframe-Modernization-Patterns als Kompiler-Runtime empfohlen (neben Micro Focus/OpenText).

---

## 4. IBM watsonx Code Assistant for Z (wCA4Z) — AI-Pfad fuer PL/I

- **Ansatz:** LLM-gestuetzt, **Granite-Modelle**, "selective transformation": PL/I wird nur dort nach Java uebersetzt, wo fachlicher Nutzen entsteht; kritischer PL/I-Kern bleibt auf z/OS.
- **PL/I-Support:** Offizieller COBOL-, JCL-, **PL/I**- und REXX-Support. Seit Release 2.8.20 (Anfang 2026) unterstuetzt der Chat explizit die Transformation COBOL/PL/I → Java.
- **Features:** Deep Analysis der PL/I-Application-Landscape, Code-Explanation, Auto-Refactoring.
- **Project Bob:** IBMs Next-Gen-System (Technical Preview 2025, GA-Roadmap 2026) wird wCA4Z ersetzen; Mainframe-Capabilities wandern in Project Bob.
- **Cloud-Bindung:** Sehr stark **z/OS-zentriert**. Zielumgebung ist haeufig IBM Cloud, IBM zSystems, oder IBM LinuxONE. Nicht auf AWS ausgerichtet.
- **Positionierung:** **Direkter strategischer Konkurrent** zu AWS Transform im PL/I-Markt, jedoch nur fuer Kunden, die im IBM-Oekosystem bleiben oder mindestens IBM-freundlich sind. Hoechste PL/I-Reife im AI-Bereich.

---

## 5. mLogica LIBER*M (LIBER*TULIP) — AWS-naher Vollautomat

- **Ansatz:** AI/ML-gestuetztes Refactoring. Sub-Produkt **LIBER\*TULIP** fokussiert auf 4GL/PL/I → Java/C#/C++.
- **PL/I-Pfad:** mLogica refactored PL/I, Easytrieve, Assembler, Telon zu COBOL, Java oder C#. Fuer Kunden, die PL/I → **Java** wollen, ist LIBER*M einer der wenigen produktionsreifen Vollautomaten.
- **AWS-Integration:** **AWS Marketplace gelistet**. mLogica hat **AWS Migration & Modernization ISV Competency**. Die Suite ist klarer AWS-Partner, unterstuetzt aber auch Azure/GCP.
- **Partnerschaft:** Coforge ist Delivery-Partner fuer grosse LIBER*M-Projekte.
- **Besonderheit:** Einer der wenigen Anbieter mit PL/I **und** Assembler **und** Easytrieve-Konvertierung — hoher Nutzen bei heterogenem Bestand.
- **Positionierung:** Stark als **Toolset, das AWS Transform fuer PL/I ergaenzen oder ersetzen kann**, wenn AWS Transform im PL/I-Szenario zu duenn ist.

---

## 6. Heirloom Computing — Heirloom & Heirloom/X

- **Ansatz:** Transpiler/Compiler-basiert, erzeugt **funktional aequivalentes Java** aus COBOL **und PL/I**. Neu 2026: **Heirloom/X** restrukturiert in **idiomatisches Java** statt "Mainframe-Java".
- **PL/I-Support:** Offiziell unterstuetzt ("tens of millions of lines of COBOL and PL1 code into Java source code").
- **GenAI:** **h/GENAI** (Heirloom GenAI) fuer Post-Migration-Refactoring, Einsatz von LLMs zur Modernisierung des transpilierten Codes.
- **Cloud-Fokus:** **Any-cloud + IBM Z/LinuxONE**. Laeuft auf AWS, Azure, GCP, OCI, IBM Cloud, on-premise.
- **AWS-Naehe:** AWS Marketplace-Listings vorhanden; gilt als eines der reifsten PL/I-nach-Java-Tools im AWS-Oekosystem.
- **Positionierung:** **Stark als Alternative zu AWS Transform fuer PL/I → Java**, besonders bei sehr grossen Codebases (10M+ LOC) mit Fokus auf deterministische Korrektheit.

---

## 7. TSRI JANUS Studio

- **Ansatz:** **IOM (Intermediate Object Model)** — parst Quellcode in Zwischendarstellung, generiert daraus Zielcode. Voll-automatisiert (laut TSRI 99.9 %).
- **PL/I-Support:** Unterstuetzt COBOL, JCL, PL/1 → **Java oder C#**, darueber hinaus Ada, Assembly, PowerBuilder, insgesamt 35+ Ausgangssprachen.
- **Track Record:** 130+ Modernisierungsprojekte, darunter Assembly → Java fuer IRS Tax Processing, COBOL → Java fuer US Air Force SBSS.
- **AWS-Naehe:** **Janus AI Studio Professional Services** auf AWS Marketplace gelistet; TSRI referenziert AWS Best Practices explizit.
- **Positionierung:** **Full-automation-orientiert**; gut fuer Kunden mit sehr heterogenem Legacy-Bestand, die nicht pro Sprache eigene Toolkette haben wollen. Direkte Alternative zu AWS Transform, wenn mehr als nur PL/I modernisiert wird.

---

## 8. SoftwareMining

- **Ansatz:** Automated Refactoring, primaer **COBOL** → Java.
- **PL/I-Status:** **Teilweise** unterstuetzt, aber kein Kern-Use-Case. SoftwareMining positioniert sich nicht als PL/I-Spezialist.
- **Positionierung:** Nur relevant, wenn der Kunde bereits SoftwareMining fuer COBOL einsetzt und PL/I-Reste in derselben Toolkette behandeln moechte. **Keine eigenstaendige PL/I-Strategie**.

---

## 9. Astadia FastTrack / Migration Factory

- **Ansatz:** **Astadia FastTrack Factory** — Tool- und Service-Kombination, 100 % automatisiertes Refactoring.
- **PL/I-Support:** Automatische Transformation nach Java oder C#.
- **Cloud:** **Primaer Azure-Partner** (auf Microsoft Marketplace gelistet), aber ebenfalls **AWS Mainframe Migration Competency** erreicht. Astadia unterstuetzt beide Hyperscaler mit demselben Werkzeugstack.
- **Zielarchitektur:** Cloud-native (EKS/AKS), cloud-first Datenbanken (Aurora, Azure SQL).
- **Positionierung:** **Duale Cloud-Strategie**; gut fuer Kunden, die sich Cloud-Optionalitaet offenhalten wollen. Service-heavy (Factory-Modell), weniger "Tool-kauf".

---

## 10. Vergleichsmatrix

| Tool | Zielsprache | Ansatz | Cloud-Fokus | PL/I-Reife | AWS-Marketplace |
|---|---|---|---|---|---|
| **AWS Transform (PL/I)** | Java | LLM + deterministisch | AWS | mittel (neuer als COBOL-Pfad) | nativ AWS |
| **Raincode PL/I** | **.NET/C#** | Kompiler | **Azure** | sehr hoch | nein |
| **Rocket Open PL/I** | PL/I (Rehost) | Kompiler | AWS/Azure/on-prem | sehr hoch | ja |
| **IBM wCA4Z / Project Bob** | Java (selektiv) | LLM (Granite) | **IBM Z / IBM Cloud** | sehr hoch | nein |
| **mLogica LIBER*M / TULIP** | Java, C#, C++ | AI-Refactor | **AWS** (ISV Competency) | hoch | **ja** |
| **Heirloom / Heirloom/X** | Java (idiomatisch) | Transpiler + GenAI | Any-cloud | sehr hoch | ja |
| **TSRI JANUS** | Java, C# | IOM-Refactor | Any-cloud | hoch | ja (Services) |
| **SoftwareMining** | Java | Refactor | Any-cloud | niedrig | teilweise |
| **Astadia FastTrack** | Java, C# | Factory/Refactor | **Azure primaer + AWS** | hoch | nein (Azure: ja) |

*Legende:* Reife-Einschaetzung basiert auf Produktionsreferenzen, Dialektabdeckung und Breite der PL/I-Features (structured types, area/based storage, multitasking, LINK/FETCH).

---

## 11. AWS-Positionierung im PL/I-Markt

AWS Transform for Mainframe adressiert PL/I strategisch — es ist in der offiziellen Feature-Matrix (vgl. `aws_pl1_zu_java_feature_uebersicht.md`) als unterstuetzte Quellsprache gefuehrt. Die praktische Realitaet 2026:

1. **Dokumentarisch duenner als COBOL.** Die AWS-Blogs, Case Studies und Whitepaper sind bei PL/I deutlich sparsamer. Wo 50 COBOL-Success-Stories existieren, gibt es fuer PL/I eine Handvoll.
2. **Partner-Oekosystem kompensiert.** AWS arbeitet aktiv mit **mLogica, Heirloom, TSRI, Astadia** als Partner zusammen, die PL/I im AWS-Marketplace anbieten. AWS ueberlaesst den PL/I-Long-Tail weitgehend diesen Partnern.
3. **LLM-Reife bei PL/I in AWS Transform geringer.** AWS Transforms Java-Generierung fuer PL/I ist juenger, weniger Training-Footprint als COBOL. Fuer kritische PL/I-Kerne empfehlen AWS-Field-Teams oft **Heirloom oder mLogica** als Primaer-Engine.
4. **Strategisches Signal.** AWS positioniert sich im PL/I-Markt als **Plattform mit Partner-Layer**, nicht als "One-Tool-fits-all". Der direkte Konkurrent mit eigener LLM-Tiefe fuer PL/I bleibt **IBM watsonx Code Assistant for Z / Project Bob** — allerdings an IBM Z gebunden.
5. **Im Vergleich zu COBOL**: Bei COBOL ist AWS Transform marktfuehrend eigenstaendig. Bei PL/I ist AWS **nicht** marktfuehrend, sondern gleichwertig mit mLogica und Heirloom.

**Fazit fuer Architekten:** AWS ist im PL/I-Markt strategisch vollwertig positioniert, aber fuer grosse oder komplexe PL/I-Workloads lohnt sich die Pruefung, ob ein Partner-Tool (Heirloom, mLogica) als Primaer-Engine mit AWS Transform als Ergaenzung die bessere Architektur ist.

---

## 12. Wann NICHT AWS Transform fuer PL/I waehlen?

| Szenario | Empfehlung | Begruendung |
|---|---|---|
| **Azure-Lock vorgegeben** | Raincode oder Astadia FastTrack | Raincode ist Azure-Referenzarchitektur, AWS Transform ist AWS-only. |
| **Ziel ist .NET/C#, nicht Java** | Raincode, TSRI JANUS (C#-Target) | AWS Transform zielt primaer auf Java. |
| **Kunde hat starke IBM-Partnerschaft / bleibt auf IBM Z** | IBM watsonx Code Assistant for Z / Project Bob | Deep Integration in z/OS, Granite-LLM kennt PL/I-Dialekte sehr gut. |
| **PL/I-Dialekt ausserhalb IBM z/OS Enterprise PL/I** (z.B. Unisys, ICL, DEC PL/I, IBM iSeries PL/I) | mLogica LIBER*M, TSRI JANUS | Breitere Dialektabdeckung; AWS Transform fokussiert z/OS PL/I. |
| **Sehr grosse Assembler-Anteile parallel zu PL/I** | mLogica LIBER*M | Deckt Assembler, Easytrieve, Telon mit derselben Toolchain. |
| **Raincode-Kompatibilitaetspflicht** (bereits laufende Raincode-Migration) | Raincode weiterverwenden | Kein Toolwechsel mitten im Projekt. |
| **Lift-and-Shift mit PL/I-Erhalt** | Rocket Open PL/I oder OpenText/Micro Focus | Rehost, keine Transformation, geringstes Risiko. |
| **Fokus auf idiomatisches Java statt "Mainframe-Java"** | Heirloom/X (h/GENAI) oder AWS Transform + manuelle Nachbearbeitung | Heirloom/X ist explizit auf idiomatisches Java optimiert. |
| **Extrem grosse Codebases > 20 Mio. LOC PL/I** | Heirloom (Transpiler-Geschwindigkeit) | Deterministischer Compiler schneller als LLM-Pipeline. |
| **Regulierte Industrie mit Beweispflicht der Equivalenz** | Heirloom oder Rocket | Compiler-basierter Ansatz liefert formal bessere Equivalenz-Argumentation als LLM-basiert. |

---

## Konsolidierte Einschaetzung

Fuer die Mehrheit der AWS-Kunden mit **z/OS-PL/I-Bestand und Java-Zielarchitektur** ist AWS Transform for Mainframe ein sinnvoller Default — insbesondere, wenn die PL/I-Codebasis moderat (< 5 Mio. LOC) ist und keine Sonderdialekte involviert sind.

Fuer **grosse, komplexe oder heterogene PL/I-Bestaende** sollte die Architekturentscheidung eher lauten: **Primaer-Engine = Heirloom oder mLogica, orchestriert ueber AWS** — AWS Transform wird dann als **ergaenzender LLM-Layer fuer Review, Test und Doku** genutzt, nicht als Haupt-Transformator.

Der einzige strategisch gleichwertige **End-to-End-Konkurrent** im PL/I-LLM-Bereich bleibt **IBM Project Bob** (Nachfolger von wCA4Z) — und dieser ist an IBM Z/IBM Cloud gebunden und damit fuer reine AWS-Zielarchitekturen keine Option.
