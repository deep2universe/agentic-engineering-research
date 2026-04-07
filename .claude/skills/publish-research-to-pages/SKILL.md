---
name: publish-research-to-pages
description: Use when the user wants to publish a Deep-Research-Verzeichnis aus agent_doc/ als neue Sektion in das GitHub-Pages-Wiki. Erweitert scripts/sync-wiki.sh, erstellt das Sektions-Template, aktualisiert index.md und fuehrt einen additiven Sync auf den pages-Branch durch. Trigger: "publiziere agent_doc/<dir>", "fuege <dir> zur GitHub Page hinzu", "sync <dir> ins wiki", "neue sektion fuer <dir>".
---

# Publish Research to Pages

Dieser Skill nimmt ein Verzeichnis aus `agent_doc/` und integriert es als neue Sektion in das bestehende GitHub-Pages-Wiki. Der Sync ist **immer additiv** — bestehende Inhalte werden nie geloescht.

## Input

Der User uebergibt einen Verzeichnisnamen unter `agent_doc/`, z. B. `cobol-migration_aws`. Wenn der User den vollen Pfad uebergibt, extrahiere nur den Verzeichnisnamen.

## Architektur — was du wissen musst

- **Hauptrepo:** `/Users/bliss/_ai/agentic-engineering-research`
- **Pages-Repo:** `/Users/bliss/_ai/agentic-engineering-research-pages` (eigenes Git-Repo, Branch `pages`, **nicht** `wiki`)
- **Sync-Skript:** `scripts/sync-wiki.sh` — wird vom Skill erweitert (nicht neu geschrieben)
- **Templates:** `scripts/wiki-templates/` — index.md, _config.yml, je ein `<section-slug>.md` pro Top-Level-Sektion, plus `workflow.svg`
- **SVG→PNG-Tool:** `rsvg-convert` aus librsvg (`brew install librsvg`), Breite **1200** fuer Kapitel-SVGs, **1400** fuer das `workflow.svg`-Banner
- **Bestehende Sektionen / Prefixes:** `aep` (Agentic Engineering Patterns), `tumr` (Tool Use Memory RAG), `szh` (Skills Zero to Hero), `ssf` (Skill-Systeme Frameworks), `cma` (COBOL Migration AWS)

## Konventionen (nicht abweichen)

| Aspekt | Regel |
|---|---|
| Prefix | 3-Buchstaben-Kuerzel, Kleinbuchstaben, eindeutig (grep `convert_svgs` in sync-wiki.sh fuer existierende). Aus den Hauptwoertern des Verzeichnisnamens ableiten. |
| Dest-Dateinamen | `<PREFIX>-<NN>-<Topic-Hyphenated>.md`, Quellen als `<PREFIX>-Quellen.md` |
| nav_order | 1..N sequentiell, `_quellen.md` immer als letzter Eintrag |
| Title | Deutsch, sprechend, kein Snake_case (z. B. `"01 AWS Mainframe Modernization (M2)"`) |
| Front-Matter | `parent: "<Sektions-Anzeigename>"`, doppelte Quotes wenn Sonderzeichen oder Umlaute |
| Section-Slug | kebab-case fuer das Sektions-Template (z. B. `cobol-migration-aws.md`) |
| Sprache | Deutsch in Templates, aber **ASCII-only** (`ueber` statt `ueber`, `Oekosystem` statt `Oekosystem`) — bestehende Templates folgen dieser Konvention |
| SVG-Konvertierung | `rsvg-convert -w 1200 input.svg -o output.png` — Breite 1200 ist Pflicht |

## Bash-Konventionen fuer Skript-Anpassungen

- **Bash 3.2 kompatibel** (macOS Default): keine `declare -A`, keine `mapfile`, immer Variablen quoten.
- Datei-Mappings als `while IFS=: read … done <<'EOF'`-Heredocs (siehe bestehende Bloecke).
- SED-Patterns als String-Konkatenation in `<PREFIX>_LINK_SED`-Variablen, weil Bash 3.2 keine Arrays robust mit `sed -e` kombinieren kann.
- Beim `sed -i` immer den macOS/GNU-Fallback nutzen: `sed -i '' … 2>/dev/null || sed -i …`.

## Workflow (Schritt fuer Schritt)

### 1. Pre-Flight-Analyse des Eingabe-Verzeichnisses

Gather first, decide later:

```
ls agent_doc/<dirname>/                       # MD-Dateien finden
ls agent_doc/<dirname>/svg/                   # SVG-Dateien zaehlen
grep -hnE '`[a-z_0-9]+\.md`' agent_doc/<dirname>/*.md  # Backtick-Crossrefs
grep -hnE '\]\([a-z_0-9_]+\.md\)' agent_doc/<dirname>/*.md  # Direkte MD-Links
```

Fuer jede MD-Datei (ausser `_quellen.md`) auch SVG-Referenzen pruefen (`\(svg/...\.svg\)`), damit klar ist, dass die `transform_file`-Funktion sie automatisch umschreibt.

Pruefe ausserdem:
- `command -v rsvg-convert` muss erfolgreich sein
- `cd ~/_ai/agentic-engineering-research-pages && git rev-parse --abbrev-ref HEAD` ergibt `pages`
- Prefix darf nicht in `convert_svgs` von `scripts/sync-wiki.sh` schon vorkommen

### 2. Entscheidungen treffen (mit User abstimmen, wenn unsicher)

- **Prefix** (3 Buchstaben, lowercase, eindeutig)
- **Section-Anzeigename** (deutsch, fuer `parent:` und `index.md`)
- **Section-Slug** (kebab-case fuer das Template)
- **Top-Level nav_order** (das erste freie nach den existierenden — aktuell 6 belegt von cobol-migration-aws, also 7 fuer die naechste Sektion)
- **Datei-Mapping**: jede Quell-MD bekommt einen Dest-Namen, nav_order und einen Titel. Quellen-Datei zuletzt.

Lege diese Entscheidungen schriftlich vor dem Editieren fest (z. B. als kurze Liste in der Antwort an den User).

### 3. scripts/sync-wiki.sh erweitern

**3a — Pfad-Variable** (in der `--- Pfade ---`-Sektion neben den anderen `*_SRC`):

```bash
<PREFIX_UPPER>_SRC="${MAIN_REPO_DIR}/agent_doc/<dirname>"
```

**3b — SVG-Konvertierung** (in der `convert_svgs`-Aufrufliste):

```bash
convert_svgs "$<PREFIX_UPPER>_SRC" "<prefix>"
```

**3c — Transformations-Block** einfuegen vor `# Templates kopieren`. Vorlage:

```bash
# ============================================================================
# <PREFIX_UPPER>-Dateien transformieren (<Section-Anzeigename>)
# ============================================================================
echo ""
echo "=== <PREFIX_UPPER>-Dateien transformieren ==="

# Backtick-Referenzen -> Standard-Markdown-Links (nur wenn solche vorhanden)
<PREFIX_UPPER>_LINK_SED=""
<PREFIX_UPPER>_LINK_SED="$<PREFIX_UPPER>_LINK_SED -e s|\`<srcfile>\\.md\`|[<srcfile>](<DEST_NAME>)|g"
# ... eine Zeile pro Quell-Datei, plus _quellen.md

while IFS=: read -r src_file dest_name nav_order title; do
    [[ -z "$src_file" ]] && continue

    front_matter="---
title: \"${title}\"
parent: \"<Section-Anzeigename>\"
nav_order: ${nav_order}
---"

    transform_file "${<PREFIX_UPPER>_SRC}/${src_file}" "${PAGES_DIR}/${dest_name}.md" "<prefix>" "$front_matter"

    # Backtick-Referenzen umschreiben
    sed -i '' $<PREFIX_UPPER>_LINK_SED "${PAGES_DIR}/${dest_name}.md" 2>/dev/null || \
    sed -i    $<PREFIX_UPPER>_LINK_SED "${PAGES_DIR}/${dest_name}.md"

    echo "  ${src_file} -> ${dest_name}.md"
done <<'<PREFIX_UPPER>_EOF'
src_file_1.md:<DEST_NAME_1>:1:<Title 1>
src_file_2.md:<DEST_NAME_2>:2:<Title 2>
...
_quellen.md:<PREFIX_UPPER>-Quellen:N:Quellen
<PREFIX_UPPER>_EOF
```

Falls die Quelldateien **direkte Markdown-Links** statt Backtick-Refs verwenden (`](other.md)`), dann statt der Backtick-SED-Zeilen das AEP-Muster nutzen:
```bash
<PREFIX_UPPER>_LINK_SED="$<PREFIX_UPPER>_LINK_SED -e s|](other_file\\.md)|](<DEST_NAME>)|g"
```
Wenn weder Backticks noch direkte Refs existieren, kann der LINK_SED leer bleiben (dann den `sed -i`-Aufruf weglassen).

**3d — Template-Copy-Zeile** im `# Templates kopieren`-Block:

```bash
cp "$TEMPLATES/<section-slug>.md"          "$PAGES_DIR/<section-slug>.md"
```

**3e — Commit-Message** erweitern:

```bash
git commit -m "Sync von agent_doc/ — AEP, TUMR, SZH, SSF, CMA, <PREFIX_UPPER> ($(date +%Y-%m-%d))"
```

### 4. Sektions-Template erstellen

Neue Datei `scripts/wiki-templates/<section-slug>.md`:

```markdown
---
title: "<Section-Anzeigename>"
nav_order: <next free top-level number, 7+>
has_children: true
---

# <Section-Anzeigename>

<2-3 Saetze deutsche Beschreibung des Themas, ASCII-only, Stand-Angabe in Klammern>
```

### 5. index.md aktualisieren (`scripts/wiki-templates/index.md`)

**5a — Quellenzahl neu berechnen** und im Intro-Text aktualisieren:

```bash
cat agent_doc/*/quellen.md 2>/dev/null \
  agent_doc/01_agentic-engineering-patterns/_quellen.md \
  agent_doc/skills_zero-to-hero/_quellen.md \
  agent_doc/skill_systeme_frameworks/_quellen.md \
  agent_doc/tool_use_memory_rag_patterns/_quellen.md \
  agent_doc/cobol-migration_aws/_quellen.md \
  agent_doc/<dirname>/_quellen.md \
  | grep -oE 'URL:\*\* [^ ]+' | sort -u | wc -l
```

Auf glatte 50er abrunden (z. B. 412 → "ueber 400 Quellen") und im Intro updaten.

**5b — Neuen Sektions-Block** unter den existierenden Sektionen, vor dem `*Quellcode:*`-Footer einfuegen:

```markdown
---

## <Section-Anzeigename>

<Kurzbeschreibung, ein Satz, ASCII-only>

| Nr. | Kapitel | Inhalt |
|-----|---------|--------|
| 00 | [<Title 1>](<DEST_NAME_1>) | <Kurzbeschreibung> |
| 01 | [<Title 2>](<DEST_NAME_2>) | <Kurzbeschreibung> |
| -- | [Quellen](<PREFIX_UPPER>-Quellen) | Alle Recherche-Quellen |
```

### 6. Dry-Run

```bash
bash scripts/sync-wiki.sh --dry-run
```

Verifiziere:
- Block `=== <PREFIX_UPPER>-Dateien transformieren ===` taucht in der Ausgabe auf
- Alle Dest-Dateien werden gelistet
- PNG-Anzahl ist gestiegen um die Anzahl der SVGs
- Spot-Check einer generierten Datei: Front-Matter korrekt, `images/<prefix>-...png`-Refs vorhanden, Backtick-Refs umgeschrieben
- `git -C ~/_ai/agentic-engineering-research-pages status --short` zeigt nur **untracked** neue Dateien plus modifizierte `index.md` / `_config.yml`. **Keine** geloeschten Dateien (`D ...`) — das waere ein Fehler.

Wenn etwas fehlschlaegt: das Skript korrigieren, **nicht** den Pages-Output manuell aufraeumen.

### 7. Echter Sync (commit + push)

```bash
bash scripts/sync-wiki.sh
```

Das Skript macht selbst `git add -A`, `git commit -m "Sync von agent_doc/ — ..."`, `git push` auf den `pages`-Branch. Output verifizieren: Es muss `GitHub Pages erfolgreich aktualisiert.` stehen.

## Constraints (NIEMALS verletzen)

- **Niemals** Dateien im Pages-Repo loeschen — der Sync ist additiv. Wenn `git status` ein `D` zeigt, ist der Skript-Block falsch.
- **Niemals** den `pages`-Branch durch `wiki` oder `main` ersetzen.
- **Niemals** rsvg-convert durch andere Tools (ImageMagick, Inkscape, Cairo direkt) ersetzen — die Pixel-Ausgabe muss mit den existierenden PNGs konsistent sein.
- **Niemals** SVG-Breite kleiner als 1200 setzen.
- **Niemals** Bash-4-Features nutzen (`declare -A`, `mapfile`, `${var^^}`, `[[ -v ... ]]`).
- **Niemals** Templates direkt im Pages-Repo editieren — immer `scripts/wiki-templates/` aendern und das Skript synchronisiert.
- **Niemals** den Sync-Block VOR den existierenden Sektions-Bloecken einfuegen — immer **vor `# Templates kopieren`**, nach dem letzten existierenden Sektions-Block.

## Verifikations-Checklist (am Ende)

- [ ] `scripts/sync-wiki.sh` enthaelt neuen `<PREFIX_UPPER>_SRC`, `convert_svgs ... "<prefix>"`, Transform-Block, Template-Copy-Zeile, Commit-Message angepasst
- [ ] `scripts/wiki-templates/<section-slug>.md` existiert mit Front-Matter und Beschreibung
- [ ] `scripts/wiki-templates/index.md` enthaelt neue Sektions-Tabelle und aktualisierte Quellenzahl
- [ ] Dry-Run lief ohne Fehler
- [ ] Echter Sync hat gepusht (Output: "GitHub Pages erfolgreich aktualisiert.")
- [ ] `git -C ~/_ai/agentic-engineering-research-pages log -1 --oneline` zeigt den neuen Commit auf `pages`
- [ ] Keine Dateien wurden im Pages-Repo geloescht
- [ ] User wird mit Zusammenfassung ueber die neue Sektion und den Commit-Hash informiert

## Hinweis fuer den Skill-Ausfuehrenden

Verwende waehrend der Ausfuehrung TaskCreate/TaskUpdate fuer die Schritte 1-7 als Fortschritts-Tracker. Setze jeden Schritt vor Beginn auf `in_progress` und nach Abschluss auf `completed`. Wenn ein Schritt fehlschlaegt, bleibt er `in_progress` und du erstellst einen Folge-Task fuer den Fix.
