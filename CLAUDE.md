# Deep Research Repo

Dieses Repository dient der agentengestützten Deep Research. Alle Ergebnisse werden strukturiert und nachvollziehbar abgelegt.

## Sprache & Stil

- Arbeitssprache ist **Deutsch** — Umlaute (ä, ö, ü, Ä, Ö, Ü, ß) sind immer korrekt zu schreiben.
- Englische Fachbegriffe (z. B. Agent, Prompt, Token, Embedding) bleiben englisch.

## Output-Struktur

- Jeglicher Output wird unter `agent_doc/<verzeichnis>/` abgelegt. Der Verzeichnisname wird vom User vorgegeben.
- Dateinamen sind ausschließlich in **snake_case** zu vergeben (z. B. `ergebnis_zusammenfassung.md`).

## Quellen-Pflicht

Alle genutzten Quellen **müssen persistiert** werden. Jeder Agent legt in seinem Ausgabeverzeichnis eine Datei `_quellen.md` an und pflegt diese fortlaufend.

### Format der `_quellen.md`

Die Quellen werden als **gruppierte Liste** geführt. Jeder Suchstring bildet eine Gruppe. Darunter stehen die gefundenen Quellen mit URL, Zusammenfassung und Datum.

```markdown
## Suchstring: "example search query"

- **URL:** https://example.com/artikel
  **Zusammenfassung:** Kurze Beschreibung des Inhalts und der Relevanz.
  **Datum:** 2026-04-04

- **URL:** https://example.com/anderer-artikel
  **Zusammenfassung:** Weitere relevante Quelle zum selben Suchstring.
  **Datum:** 2026-04-04

## Suchstring: "another search query"

- **URL:** https://example.com/weitere-quelle
  **Zusammenfassung:** Beschreibung.
  **Datum:** 2026-04-04
```
