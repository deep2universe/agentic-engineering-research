# Quellen: PL/I Sprache und Migrationsherausforderungen

## Suchstring: "IBM Enterprise PL/I language reference storage classes BASED CONTROLLED"

- **URL:** https://www.ibm.com/docs/en/SSY2V3_5.3.0/lr/lrm.pdf
  **Zusammenfassung:** Offizielles Enterprise PL/I for z/OS 5.3 Language Reference (SC27-8940-02). Enthaelt detaillierte Kapitel zu Storage Control, Controlled Storage Attribute, Based Storage Attribute, Extent-Spezifikationen in BASED-Deklarationen, BASED VARYING String und Speicherallokation fuer BASED-Variablen. Primaerquelle fuer die IBM-Dialekt-Semantik.
  **Datum:** 2026-04-08

- **URL:** https://en.wikipedia.org/wiki/PL/I
  **Zusammenfassung:** Wikipedia-Uebersicht zu PL/I. Bestaetigt die vier klassischen Storage Classes STATIC, AUTOMATIC, CONTROLLED, BASED plus AREA. Geschichtliche Einordnung, Dialekt-Uebersicht, Einordnung gegen COBOL und Fortran.
  **Datum:** 2026-04-08

- **URL:** https://www.ibm.com/support/pages/enterprise-pli-zos-documentation-library
  **Zusammenfassung:** Einstiegspunkt zur IBM Enterprise PL/I Dokumentationsbibliothek mit Language Reference, Programming Guide, Compiler Options und Migration Guides.
  **Datum:** 2026-04-08

- **URL:** http://www.iron-spring.com/prog_guide.html
  **Zusammenfassung:** Iron Spring PL/I Compiler Programming Guide. Open-Source-aehnlicher PL/I-Compiler fuer Linux/OS2, nuetzlich als alternative Referenzimplementierung fuer Dialekt-Vergleiche.
  **Datum:** 2026-04-08

## Suchstring: "PL/I to Java migration challenges pointer BASED storage"

- **URL:** https://www.researchgate.net/publication/221569541_Migrating_PLI_Code_to_Java
  **Zusammenfassung:** Akademischer Paper-Bericht zum Projekt PLI2Java. Beschreibt automatisierte Transformation von PL/I (z/OS) nach Java in 8 Schritten, mit expliziter Behandlung von BASED-Storage ueber eine virtuelle Speicher-Basisstruktur. Generiert Klassen je Storage Class (AutomaticClass, StaticClass, BasedClass).
  **Datum:** 2026-04-08

- **URL:** http://shenjiasi.com/assets/oopsla25-sprout.pdf
  **Zusammenfassung:** OOPSLA 2025 Paper "Sound Static Analysis Approach to I/O API Migration". Behandelt I/O-API-Transformationen als Teil von Legacy-Migrationen; relevant fuer LOCATE-Mode-I/O-Uebersetzung.
  **Datum:** 2026-04-08

## Suchstring: "PL/I vs COBOL differences key features recursion pointers"

- **URL:** https://www.ibm.com/docs/en/zos/2.4.0?topic=pli-supported-data-types-between-cobol
  **Zusammenfassung:** IBM-Referenz zu unterstuetzten Datentyp-Mappings zwischen COBOL und PL/I. Grundlage fuer die Datentyp-Mapping-Tabelle (FIXED BINARY, FIXED DECIMAL, PICTURE usw.).
  **Datum:** 2026-04-08

- **URL:** https://www.microfocus.com/documentation/enterprise-developer/ed60/ED-VS2017/GUID-DD1ED025-974B-4AF7-9DC1-08637DEE1141.html
  **Zusammenfassung:** Micro Focus Enterprise Developer PL/I to COBOL Data Item Type Mapping Guide. Praktische Mapping-Tabelle, hilft bei der Einordnung numerischer Typen.
  **Datum:** 2026-04-08

- **URL:** https://community.broadcom.com/communities/community-home/digestviewer/viewthread?MID=729876
  **Zusammenfassung:** Broadcom-Community-Thread "Advantages of PL/I over COBOL". Praxisbericht aus TPX/Session-Management-Umfeld zu Unterschieden, insbesondere Rekursion und Pointer.
  **Datum:** 2026-04-08

## Suchstring: "Raincode PL/I compiler .NET Java modernization 2025"

- **URL:** https://www.raincode.com/pl-i/
  **Zusammenfassung:** Offizielle Raincode PL/I-Produktseite. Raincode PL/I-Compiler kompiliert Mainframe-PL/I direkt nach .NET 6+ (neueste Version .NET 10, SQL Server 2025). Wichtig fuer den "Compile-to-Platform" Migrationsansatz als Alternative zur Java-Transpilation.
  **Datum:** 2026-04-08

- **URL:** https://medium.com/@RaincodeLegacy/in-legacy-mainframe-modernization-cobol-is-not-the-problem-cee231e15758
  **Zusammenfassung:** Raincode-Medium-Artikel. Bestaetigt die Raincode-These, dass Java-Transpilation wegen Verhaltensdiskrepanzen problematisch sei; Raincode setzt daher auf .NET. Relevanter Gegenpol zur Java-Strategie.
  **Datum:** 2026-04-08

## Suchstring: "PL/I ON conditions ON-units exception handling ERROR ZERODIVIDE"

- **URL:** https://www.ibm.com/docs/SSLTBW_2.1.0/com.ibm.zos.v2r1.ceea200/pliax.htm
  **Zusammenfassung:** IBM z/OS Language Environment Dokumentation zur PL/I Condition Handling Semantik. Beschreibt Default-Handler, ERROR-Condition als Fallback, Vererbung von ON-Units entlang des Call Chains.
  **Datum:** 2026-04-08

- **URL:** https://dl.acm.org/doi/pdf/10.1145/390018.808316
  **Zusammenfassung:** ACM-Paper "Exception handling in PL/I" (klassisch, MacLaren 1977). Urspruengliche Diskussion von ON-Units und ihrem Unterschied zu modernen try/catch-Mechanismen.
  **Datum:** 2026-04-08

- **URL:** https://en.wikipedia.org/wiki/Exception_handling_(programming)
  **Zusammenfassung:** Wikipedia-Uebersichtsartikel zu Exception Handling. Setzt PL/I-ON-Units in den historischen Kontext als einen der ersten systematischen Exception-Mechanismen.
  **Datum:** 2026-04-08

## Suchstring: "PL/I preprocessor macro %INCLUDE %DECLARE build pipeline migration"

- **URL:** https://en.wikipedia.org/wiki/PL/I_preprocessor
  **Zusammenfassung:** Wikipedia-Artikel zum PL/I-Preprocessor. Definiert Teilmenge des PL/I-Kerns fuer Source-Inclusion, bedingte Kompilierung und Makro-Expansion. Praefix %, eigene %DECLARE/%INCLUDE/%IF Statements. Wichtig fuer Build-Pipeline-Implikationen.
  **Datum:** 2026-04-08

- **URL:** https://www.ibm.com/docs/en/epfz/5.3.0?topic=preprocessors-macro-preprocessor
  **Zusammenfassung:** IBM Enterprise PL/I Macro Preprocessor Referenz. Dokumentiert Mehrpass-Preprocessing, Interaktion mit SQL/CICS-Preprocessoren. Primaerquelle fuer den Integration-Build-Flow im IBM-Kontext.
  **Datum:** 2026-04-08

- **URL:** https://peeterjoot.com/2021/01/27/example-of-pl-i-macro/
  **Zusammenfassung:** Praktisches Beispiel eines PL/I-Macros von einem Ex-IBM-Compiler-Entwickler. Zeigt die typische Nutzung von %DECLARE und prozeduralem Makro-Code, nuetzlich zur Abgrenzung gegen C-Preprocessor.
  **Datum:** 2026-04-08
