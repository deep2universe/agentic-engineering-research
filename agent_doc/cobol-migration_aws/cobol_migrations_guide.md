# COBOL-Migrations-Guide -- Hauptdokument

> Stand: April 2026 | Zielgruppe: Senior Developer & Senior Architekten
>
> Dieser Guide ist der zentrale Einstiegspunkt fuer die Deep Research zu COBOL-Migrationen mit Fokus auf AWS-Tooling und ergaenzende Plattformen.

---

## Inhaltsverzeichnis dieser Research

Diese Deep Research umfasst sechs detaillierte Dokumente:

| Dokument | Inhalt |
|----------|--------|
| **cobol_migrations_guide.md** (dieses Dokument) | Uebergreifender Einstieg, Executive Summary, Decision Framework |
| **aws_mainframe_modernization_deep_dive.md** | Tiefer Blick in den AWS Mainframe Modernization Service (Blu Age + Rocket Software) |
| **aws_transform_deep_dive.md** | Tiefer Blick in AWS Transform (Agentic AI fuer Modernisierung) |
| **aws_migration_hub.md** | AWS Migration Hub (Tracking, Orchestrierung) und Nachfolger-Strategie |
| **cobol_to_java_aws_migrationsguide.md** | State-of-the-Art End-to-End Workflow mit AWS-Tools |
| **best_practices_und_patterns.md** | Best Practices, Architektur-Patterns, Fallstricke |
| **cobol_migration_weitere_tools.md** | Weitere Tools jenseits AWS (IBM, Google, Azure, ISVs, GenAI) |
| **_quellen.md** | Vollstaendige Quellenliste mit URLs und Zusammenfassungen |

---

## 1. Executive Summary

COBOL ist nicht tot. Schaetzungen zufolge laufen 2026 immer noch **220+ Milliarden Lines of Code** in COBOL produktiv -- in Banken, Versicherungen, Behoerden, Logistik und Industrie. Die Sprache wird taeglich genutzt, aber:

1. **COBOL-Entwickler werden knapp**: Die Generation, die diese Systeme gebaut hat, geht in Rente
2. **Mainframe-Kosten steigen**: IBM-Lizenzen (MIPS-basiert) und Hardware sind teuer
3. **Agilitaetslimit**: Mainframe-Entwicklungszyklen passen nicht zu modernen Anforderungen
4. **Compliance & Cybersecurity**: Modernisierung ist oft regulatorisch getrieben

Die **Modernisierung** dieser Systeme ist keine Option mehr -- sie ist unvermeidlich. Die Frage ist nur: **Wann, wie und mit welchen Tools?**

### 1.1 Die wichtigsten Erkenntnisse aus dieser Research

1. **AWS Transform** (Mai 2025 GA) ist der **strategische Migrationspfad** auf AWS und nutzt Agentic AI fuer Discovery, Planung, Code-Transformation und Testing.

2. **AWS Migration Hub** nimmt seit November 2025 **keine neuen Kunden mehr an**. AWS Transform ist der Nachfolger.

3. **AWS Mainframe Modernization Service (M2)** existiert weiter, aber das **Managed Runtime** ist nicht mehr fuer Neukunden verfuegbar. **Self-Managed** auf EC2 bleibt aktiv.

4. **Automated Refactoring (Blu Age)** und **Replatforming (Rocket Software)** sind die zwei Hauptpfade, oft kombiniert mit AWS Transform fuer den Refactor-Pfad.

5. **JOBOL** -- Java, das wie COBOL aussieht -- ist das wichtigste **Anti-Pattern**, das zu vermeiden ist. AWS Transform Reforge adressiert das mit LLM-basierter Optimierung.

6. **Testing macht 50-70 %** der Projektdauer aus. AWS Transform Testing Automation reduziert das, aber nicht eliminieren.

7. **Strangler Fig Pattern** ist Pflicht -- Big-Bang-Migrationen scheitern.

8. Der **Markt ist vielfaeltig**: Neben AWS gibt es starke Alternativen (IBM watsonx, Google Cloud Dual Run, Heirloom, SoftwareMining, Astadia, OpenLegacy etc.)

9. **GenAI** (Claude, Copilot, ChatGPT) ist ein **Augmentation-Tool**, kein Standalone-Migrationstool. LLMs sind nicht-deterministisch und brauchen Orchestrierung + Validierung.

10. **Kulturelle Aspekte** sind oft schwieriger als technische. Skill-Transition, Operations-Modell und Change Management sind erfolgsentscheidend.

---

## 2. Reading Guide -- Wo soll ich anfangen?

Je nach Rolle und Erkenntnisinteresse empfehle ich folgende Lesereihenfolge:

### Fuer den **Senior Architekten**, der eine Strategie entwickelt:
1. Dieses Dokument (Executive Summary, Decision Framework)
2. `best_practices_und_patterns.md` (besonders Sektion 1: Migrationsstrategie)
3. `cobol_migration_weitere_tools.md` (Anbieter-Vergleichsmatrix)
4. `aws_mainframe_modernization_deep_dive.md` und `aws_transform_deep_dive.md`

### Fuer den **Senior Developer**, der die Tools verstehen will:
1. `cobol_to_java_aws_migrationsguide.md` (End-to-End Workflow)
2. `aws_transform_deep_dive.md` (KI-Tools im Detail)
3. `aws_mainframe_modernization_deep_dive.md` (Runtime-Details)
4. `best_practices_und_patterns.md` (Sektion 2: Technische Best Practices)

### Fuer den **Projektleiter / Migration Manager**:
1. Dieses Dokument (Decision Framework)
2. `aws_migration_hub.md` (Wave Planning, Phasen)
3. `best_practices_und_patterns.md` (Fallstricke, Risiken)
4. `cobol_to_java_aws_migrationsguide.md` (Phasen 1-2, 7-8)

### Fuer den **CTO / Entscheider**:
1. Dieses Dokument (Executive Summary)
2. `cobol_migration_weitere_tools.md` (Anbieter-Vergleich, Empfehlungen)
3. `best_practices_und_patterns.md` (Sektion 1.4: TCO-Analyse, Sektion 4: Fallstricke)

---

## 3. Decision Framework

### 3.1 Die fundamentale Frage: Refactor, Replatform oder beides?

```
                  ┌──────────────────────────────────────┐
                  │  Wie wichtig ist langfristige        │
                  │  Cloud-Native-Modernisierung?        │
                  └──────────────────────────────────────┘
                          │              │
                  Sehr wichtig          Weniger wichtig
                          │              │
                          ▼              ▼
                  ┌────────────┐   ┌────────────┐
                  │  Wie hoch  │   │ Wie schnell │
                  │ ist die    │   │ muss die    │
                  │ Risikoto-  │   │ Migration   │
                  │ leranz?    │   │ erfolgen?   │
                  └────────────┘   └────────────┘
                   │         │      │         │
                Hoch      Niedrig  Schnell  Langsamer
                   │         │      │         │
                   ▼         ▼      ▼         ▼
              ┌─────────┐ ┌──────┐ ┌──────┐ ┌─────────┐
              │ REFACTOR│ │HYBRID│ │REPLAT│ │ HYBRID  │
              │ (AWS    │ │      │ │FORM  │ │         │
              │ Transf.)│ │      │ │      │ │         │
              └─────────┘ └──────┘ └──────┘ └─────────┘
```

### 3.2 Kosten-Nutzen-Matrix der Strategien

| Strategie | Initiale Kosten | Laufende Kosten | Risiko | Time-to-Value | Zukunftsfaehigkeit |
|-----------|-----------------|-----------------|--------|---------------|-------------------|
| **Status Quo (Retain)** | Niedrig | Sehr hoch (steigend) | Niedrig (kurzfristig) | -- | Sehr niedrig |
| **Replatform (Rocket)** | Mittel | Mittel | Niedrig | Schnell (3-9 Mo.) | Mittel |
| **Refactor (AWS Transform)** | Hoch | Niedrig | Mittel | Mittel (12-24 Mo.) | Hoch |
| **Reimagine (Microservices)** | Sehr hoch | Niedrig | Hoch | Lang (24-48 Mo.) | Sehr hoch |
| **Hybrid (Phased)** | Hoch (verteilt) | Mittel (sinkend) | Niedrig-Mittel | Schnell + Lang | Hoch |

### 3.3 Die "Right-Fit"-Strategie

In der Praxis ist die beste Strategie selten **eine** Strategie, sondern eine **Kombination**, die nach folgenden Prinzipien zusammengesetzt wird:

1. **Quick Wins zuerst**: Replatforming einfacher Workloads fuer schnelle Kostenreduktion
2. **Strategische Anwendungen refaktorieren**: Kern-Geschaeftsanwendungen erhalten Java-Refactoring
3. **Neue Funktionen Cloud-Native bauen**: Strangler Fig Pattern
4. **Legacy-Inseln behalten**: Was wenig Wert hat und stabil laeuft, kann bleiben (Retain)
5. **Was nicht mehr genutzt wird, abschalten**: Retire

---

## 4. Die AWS-Tool-Landschaft 2026 im Ueberblick

### 4.1 Empfohlene Tool-Kombination fuer Neuprojekte

```
┌─────────────────────────────────────────────────────────────┐
│              EMPFOHLENER STACK FUER 2026                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Discovery & Planning:                                       │
│    └─ AWS Transform (Assessment Agent)                       │
│                                                              │
│  Code Transformation:                                        │
│    └─ AWS Transform Refactor (Blu Age Engine)                │
│        └─ AWS Transform Reforge (LLM-Optimierung)            │
│            └─ Kiro (Reimagine, optional)                     │
│                                                              │
│  Testing:                                                    │
│    └─ AWS Transform Testing Automation                       │
│                                                              │
│  Runtime:                                                    │
│    └─ AWS Mainframe Modernization Self-Managed               │
│        ├─ Blu Age Runtime auf EC2/ECS                        │
│        └─ Optional: Rocket Software Self-Managed             │
│                                                              │
│  Datenbanken:                                                │
│    ├─ Amazon Aurora PostgreSQL (DB2-Ersatz)                  │
│    ├─ Amazon DynamoDB (VSAM/Performance)                     │
│    └─ Amazon S3 (Files, Datalakes)                           │
│                                                              │
│  CI/CD & IaC:                                                │
│    ├─ AWS CodePipeline                                       │
│    ├─ AWS CodeBuild                                          │
│    ├─ Terraform / CloudFormation / CDK                       │
│    └─ Amazon ECR (Container Images)                          │
│                                                              │
│  Operations:                                                 │
│    ├─ Amazon CloudWatch (Metrics, Logs, Alarms)              │
│    ├─ AWS X-Ray (Distributed Tracing)                        │
│    └─ AWS Systems Manager (Patching, Automation)             │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Wichtige Aenderungen in 2025/2026

1. **November 2025**: AWS Migration Hub und Refactor Spaces nehmen keine neuen Kunden mehr an
2. **Mai 2025**: AWS Transform GA als strategischer Modernisierungspfad
3. **Maerz 2026**: AWS Blu Insights wird in **AWS Transform for Mainframe Refactor** umbenannt
4. **2025**: AWS Transform Mainframe-Transformationen werden **kostenlos** (vorher $0.103/LOC)
5. **Dezember 2025**: AWS Transform Custom fuer organisationsweite Modernisierungen
6. **Re:Invent 2025**: Reimagine-Capabilities und Automated Testing in AWS Transform

---

## 5. Die wichtigsten Risiken und wie man sie minimiert

| Risiko | Wahrscheinlichkeit | Impact | Mitigation |
|--------|-------------------|--------|------------|
| **Big-Bang-Migration scheitert** | Hoch | Sehr hoch | Strangler Fig Pattern, Wave Planning |
| **Undokumentierte Business-Logik geht verloren** | Sehr hoch | Hoch | AWS Transform Business Logic Extraction, Domain Experts einbinden |
| **JOBOL** | Sehr hoch (bei Refactor) | Hoch | Reforge oder manuelle Nacharbeit, Reviews |
| **Performance-Probleme** | Hoch | Hoch | Performance-Tests vor Cutover, Profiling |
| **Daten-Inkonsistenz** | Mittel | Sehr hoch | Functional Equivalence Testing, Dual Run |
| **Skill-Mangel im Team** | Sehr hoch | Hoch | Schulungen, Pair Programming, externe Hilfe |
| **Vendor Lock-in** | Sicher | Mittel | Bewusste Entscheidung, Open Standards |
| **Compliance-Verletzung** | Mittel | Sehr hoch | Audit-Trails, regulierte Reviews |
| **Test-Aufwand unterschaetzt** | Sehr hoch | Sehr hoch | 50-70 % Projektzeit fuer Testing einplanen |
| **Operations-Modell nicht bereit** | Hoch | Hoch | DevOps/SRE-Schulung, IaC, Observability |

---

## 6. Strategische Empfehlung fuer Senior Architekten

Wenn ich als Architekt vor einer COBOL-Migration auf AWS stehe, wuerde ich folgenden Weg einschlagen:

### Schritt 1: Analyse-Phase (4-8 Wochen)
- AWS Transform Assessment auf einer Sandbox-Kopie der Codebasis
- Erstellung des Dependency Graphs und Business Logic Inventars
- Workshops mit Fachabteilungen zur Validierung
- Team-Skill-Audit und Schulungsplan

### Schritt 2: Strategie-Definition (2-4 Wochen)
- Wave Plan erstellen (3-5 Waves zu Beginn)
- Pro Wave: Refactor vs. Replatform Entscheidung
- Test-Strategie inklusive Dual Run definieren
- Operations-Modell definieren (DevOps, SRE)
- Stakeholder-Alignment

### Schritt 3: Pilot-Wave (8-12 Wochen)
- Eine kleine, nicht-kritische Anwendung waehlen
- Vollstaendiger End-to-End-Workflow durchspielen
- Lessons Learned dokumentieren
- Team-Skills aufbauen

### Schritt 4: Skalierung (12+ Monate)
- Wave fuer Wave migrieren
- Continuous Improvement der Pipeline
- Operations-Modell schrittweise aufbauen
- Schrittweise Mainframe-Decommissioning

### Schritt 5: Modernisierung (laufend)
- Reimagine kritischer Domains
- Cloud-Native-Features integrieren (Lambda, Step Functions)
- Datenstrategie modernisieren (Analytics, ML)
- Kontinuierliche Optimierung

---

## 7. Referenzen und weiterfuehrende Dokumente

Alle Quellen dieser Research sind in `_quellen.md` gepflegt. Die wichtigsten offiziellen AWS-Quellen:

- **AWS Mainframe Modernization**: aws.amazon.com/mainframe-modernization
- **AWS Transform**: aws.amazon.com/transform/mainframe
- **AWS Blu Age Documentation**: docs.aws.amazon.com/m2/latest/userguide/
- **CardDemo Reference App**: github.com/aws-samples/aws-mainframe-modernization-carddemo
- **AWS Mainframe Modernization Blog**: aws.amazon.com/blogs/migration-and-modernization/

---

## 8. Schlussbemerkung

COBOL-Migration ist eines der komplexesten und riskantesten IT-Projekte ueberhaupt. Die gute Nachricht: Mit modernen Tools wie AWS Transform, intelligenter Wave-Planung, konsequentem Testing und einem klaren Architektur-Ansatz **ist es machbar** -- und der Lohn ist ein zukunftsfaehiges, agiles, kostenoptimiertes System.

Die schlechte Nachricht: Tools sind nur ein Teil der Loesung. Die wirklich harten Probleme sind **Menschen, Prozesse und Daten** -- und die loesen keine KI und keine Plattform alleine.

**Der entscheidende Erfolgsfaktor bleibt der Mensch:** Senior Architekten und Senior Developer mit tiefem Verstaendnis sowohl der alten als auch der neuen Welt. Diese Research soll dazu beitragen, dieses Verstaendnis aufzubauen.

Viel Erfolg bei Ihrer COBOL-Migration!
