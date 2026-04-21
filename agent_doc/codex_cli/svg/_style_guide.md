# SVG-Style-Guide für Codex-CLI-Visualisierungen

> Gemeinsamer Design-Standard für alle SVGs in `agent_doc/codex_cli/svg/`.
> Zielgruppe: Senior Developer & Senior Architekten — klar, dicht, metaphorisch.

## Technische Grundregeln

- **Format**: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 W H" ...>`.
- **Canvas**: Standard **1200×720**; bei Matrizen/Tabellen 1400×900; bei kompakten Diagrammen 1000×600.
- **Keine externen Ressourcen**: Keine `<image href="...">`-URLs, keine Webfonts. Nur inline-SVG.
- **Schriften**: `font-family="system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"`; Code-Blöcke `font-family="'JetBrains Mono', 'Fira Code', ui-monospace, monospace"`.
- **Lesbarkeit**: Mindest-Schriftgrösse 12 px; Titel 24–32 px; Labels 13–16 px.
- **Accessibility**: `<title>` und `<desc>` direkt nach dem öffnenden `<svg>`-Tag.
- **Dateinamen**: snake_case, sprechend, Muster: `<datei>_<kapitel_slug>.svg`, z.B. `installation_und_setup_02_kurz_historie.svg`.

## Farb-Palette (Dark-Modus, Default)

| Zweck | Hex |
|---|---|
| Hintergrund | `#0f172a` (slate-900) |
| Flächen / Panels | `#1e293b` (slate-800) |
| Rahmen / Gitter | `#334155` (slate-700) |
| Haupttext | `#e2e8f0` (slate-200) |
| Sekundärtext | `#94a3b8` (slate-400) |
| Primär (OpenAI/Codex-Blau) | `#6366f1` (indigo-500) / `#818cf8` (indigo-400) |
| Akzent (Cyan) | `#22d3ee` / `#06b6d4` |
| Erfolg | `#10b981` (emerald-500) |
| Warnung | `#f59e0b` (amber-500) |
| Gefahr | `#ef4444` (red-500) |
| Neutral Highlight | `#a78bfa` (violet-400) |

Für reine Matrix-/Vergleichstabellen darf alternativ **Light-Modus** genutzt werden (`#f8fafc` Hintergrund, `#0f172a` Text), wenn Dichte hoch ist.

## Bausteine

1. **Titel-Leiste**: ganz oben, bold, ~28–32 px, links-ausgerichtet; rechts kleines Monogramm „Codex CLI“ oder Kapitel-Nr.
2. **Subtitle**: ~16 px, `#94a3b8`.
3. **Legende**: rechts oder unten, farbige Quadrate + Label.
4. **Icons**: inline SVG-Paths (Schild, Schloss, Zahnrad, Sandbox, Cloud, Terminal, Tests-Häkchen, etc.). Keine Emojis.
5. **Pfeile**: `marker-end` mit Dreiecks-Marker, `stroke-width="2"`.
6. **Abgerundete Karten**: `rx="12" ry="12"`, `fill="#1e293b"`, `stroke="#334155"`.
7. **Schatten** (optional): `filter: drop-shadow(0 4px 6px rgba(0,0,0,0.4))`.

## Diagramm-Typen (je nach Kapitel)

- **Stack / Layer**: Schichten von unten nach oben (Kernel → Sandbox → Agent → Prompt).
- **Flow / Pipeline**: Knoten + Pfeile, linkes→rechts Leserichtung.
- **Matrix / Heatmap**: Grid mit farbcodierten Zellen.
- **Hexagon / Mindmap**: zentrale Kernidee + Satelliten.
- **Timeline**: horizontal mit Meilensteinen.
- **Dual-Achsen-Matrix**: 2D-Scatter (z.B. Approval vs. Sandbox).
- **Tree / Hierarchie**: Config-Precedence, Sub-Agents.
- **Mermaid-ähnliche Flow-Chart**: für Entscheidungen.

## Metaphern (pro Kontext)

- **Sicherheit** → Schild, Wachturm, Zwiebel-Schichten, Schleuse.
- **Sandbox** → Terrarium, Tresor, Klimakapsel.
- **Approvals** → Ampel, Türsteher, Brücke mit Schranke.
- **Cloud-Handoff** → Wurmloch / Funkmast / Boot → Raumschiff.
- **Workflow** → Fliessband, Staffellauf.
- **Multi-Agent** → Schachbrett, Orchester.
- **Kontext-Engineering** → Baukasten / Blueprint.
- **Prompt** → Jira-Ticket / Leuchtturm.
- **Kosten/Tokens** → Strommessgerät / Tacho.

## Einbettung in Markdown

Jedes SVG wird direkt nach dem Kapitel-Titel eingebettet:

```markdown
## 3. Installation

![Installationswege für Codex CLI: npm, brew, cargo, binary](svg/installation_und_setup_03_installation.svg)

...Rest des Kapitels…
```

Der `alt`-Text beschreibt **den Inhalt**, nicht nur das Kapitel. Das hilft Screen-Readern und bei Fehlern im Rendering.

## Checkliste vor Abgabe

- [ ] `viewBox` gesetzt, keine festen `width`/`height` in Pixel für Container.
- [ ] Keine externen Fonts/Referenzen.
- [ ] `<title>` und `<desc>` vorhanden.
- [ ] Text in SVG nutzt `dominant-baseline="middle"` und `text-anchor` korrekt.
- [ ] Genug Kontrast (WCAG AA) auch bei Ausdruck.
- [ ] Legende vorhanden, falls nötig.
- [ ] Metapher erkennbar und stützt den Inhalt.
- [ ] Dichte Information ohne Überfrachtung (Max. ~12 Konzepte pro Bild).
