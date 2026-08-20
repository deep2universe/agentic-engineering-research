# Werkzeugkasten

Die Werkzeuge der Produktion liegen unter `game/werkzeuge/`. Sie sind kein
Beiwerk: Ohne sie ließe sich das Spiel weder beurteilen noch warten.

---

## `schau.mjs` — eine Runde spielen und dabei messen

```bash
cd game
npm run schau            # Level I-1, WebGL2
npm run schau -- III-2   # ein anderes Level
npm run schau -- --webgpu
```

Startet das Spiel kopf-los, klickt sich durch Akttafel, Auftrag und Fundstück,
lädt eine Referenzlösung, lässt sie durchlaufen und legt zehn Bilder unter
`werkzeuge/bilder/` ab. Zu jedem Bild meldet es:

| Wert | Bedeutung |
|---|---|
| `mittel` | mittlere Bildhelligkeit, 0–255 |
| `hell` | Anteil Bildpunkte über der Schwarzschwelle |
| `max` | hellster Bildpunkt |

**Warum das wichtig ist:** Ein Bild zu beurteilen, indem man es ansieht, geht
solange gut, bis der Fehler wie etwas anderes aussieht. Der teuerste Fehler
dieser Produktion — ein rein rotes Bild — wurde nicht durch Hinsehen gefunden,
sondern durch kanalweise Statistik. Die Halle soll im Ruhezustand bei einer
mittleren Helligkeit von **30 bis 45** liegen; darunter verschwindet die
Architektur, darüber verlieren die leuchtenden Module ihren Kontrast.

Das Werkzeug meldet außerdem jede Konsolenausgabe des Browsers. Eine leere
Konsole ist Teil der Abnahme.

---

## `umlaute.mjs` — deutsche Rechtschreibung im Quelltext

```bash
npm run umlaute -- --pruefe   # meldet nur, ändert nichts
npm run umlaute               # setzt
```

Setzt in Kommentaren und Prosatexten korrekte Umlaute, ohne Bezeichner
anzufassen. Die Trennlinie ist einfach und trägt erstaunlich weit: **Prosa ist
lang, Schlüssel sind kurz.**

Was das Werkzeug **nicht** anfasst, jeweils mit Grund:

| Bereich | Grund |
|---|---|
| Bezeichner | ASCII-Namen sind auf jeder Tastatur, in jedem Terminal und in jeder Fehlermeldung zuverlässig. Mehrere sind zudem Schlüssel in serialisierten Strukturen — eine Umbenennung wäre eine Formatänderung, keine Rechtschreibkorrektur. |
| Backtick-Bereiche in Kommentaren | dort stehen Bezeichner und Dateinamen |
| `${…}` in Template-Literalen | der erste Anlauf hat hier reihenweise Bezeichner zerstört |
| Pfadartige Zeichenketten | der erste Anlauf hat alle Import-Pfade zerstört |
| Werte hinter `class`, `id`, `name`, `type`, `role`, `href`, `src`, `for` | `class: 'blatt fundstueck'` enthält ein Leerzeichen und sah damit nach Prosa aus. Das Ergebnis war eine CSS-Klasse `fundstück`, zu der es keine Regel gab — ohne Typfehler, ohne Testausfall, nur ein Dialog ohne Gestaltung. |
| Dateien mit dem Vermerk `umlaute:aus` | Ausstiegsluke. Der Test, der die Ersatzschreibung überwacht, braucht Positivkontrollen in Ersatzschreibung — sonst prüft er am Ende das Ergebnis des Werkzeugs, das er überwachen soll. |

Die Gegenprobe steht in `tests/einheit/sprache.test.ts` und
`tests/einheit/oberflaeche.test.ts`: Erstere findet Ersatzschreibungen in
Spieltexten, letztere hält den Vertrag zwischen HUD und Stylesheet — jede
vergebene CSS-Klasse muss eine Regel haben und reines ASCII sein.

---

## `browser.mjs` — den richtigen Chromium finden

Kein Kommandozeilenwerkzeug, sondern ein Modul, das `playwright.config.ts` und
`schau.mjs` gemeinsam benutzen. Es löst zwei Probleme, die beide teuer waren:

1. **`--enable-unsafe-swiftshader`.** Ohne dieses Flag gibt es ab Chrome 130
   überhaupt keinen WebGL-Kontext. Die Bilder wären schwarz, und alle
   Bildvergleiche bestünden stillschweigend.
2. **Das VOLLE Chromium, nicht `chrome-headless-shell`.** Beide rendern
   unterschiedlich; Basislinien aus dem einen taugen nicht für das andere. Das
   Modul löst den Pfad ausdrücklich auf das vollständige Chromium auf.

---

## `kurven_generieren.mjs` — Nachschlagetabellen statt Transzendenz

```bash
node werkzeuge/kurven_generieren.mjs
```

Erzeugt `src/sim/kurven.ts`: vier Kurven zu je 1024 Ganzzahl-Stützstellen.

Der Grund steht im Determinismus-Wächter: `Math.exp` und `Math.pow` sind über
Plattformen und Laufzeiten hinweg **nicht bitgleich**. Eine Simulation, die
Node und Browser vergleichen können soll, darf sie nicht benutzen. Eine
Tabelle mit ganzzahligen Werten ist überall dieselbe.

Die Datei ist erzeugt und wird nicht von Hand bearbeitet.

---

## `tests/hilfe/bericht.ts` — Budgets messen statt raten

Kein eigenständiges Werkzeug, sondern eine Testhilfe, die für jedes Level jede
Referenzlösung und jedes Anti-Muster durchrechnet und die Kennzahlen als
Tabelle druckt:

```bash
npx vitest run tests/loesbarkeit/bericht_05.test.ts --reporter=verbose
```

Daraus werden die Budgets abgeleitet. Ein geschätztes Budget ist entweder zu
weit — dann besteht auch das Anti-Muster — oder zu eng — dann fällt die eigene
Referenzlösung durch. Beides ist im Verlauf dieser Produktion passiert, bevor
es den Bericht gab.
