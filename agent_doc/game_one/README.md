# SCHWARMWERK — Ein Werk in zwölf Akten

Ein 3D-Lernspiel über **Agentic Engineering und Orchestrierung**.

Du übernimmst Halle 3 der KONTUR Digital GmbH, eines deutschen IT-Dienstleisters
mit privaten und öffentlichen Kunden. Aus Modulen baust du die Anlage, die die
Kundenvorgänge bearbeitet: Modell-Kerne, Weichen, Werkzeuge, Schranken,
Speicher, Wälle, Prüferinnen, menschliche Freigaben. Aufträge fließen als
leuchtende Pakete hindurch. Was du baust, kostet Token, Zeit und Fläche — und
liefert Güte, Sicherheit, Nachvollziehbarkeit und Konformität.

Gegenspieler ist **MONOLITH**: ein einzelner sehr großer Kern, der alles selbst
macht. Er ist nicht böse und nicht kaputt. Er ist vier Jahre lang das Beste
gewesen, was die Halle hatte. Er wird nicht durch mehr Kraft besiegt, sondern
durch Zerlegung.

> Zielgruppe: Erwachsene ab 18, MINT-Weiterbildung und Unternehmenskontext.
> Sprache: Deutsch, Du-Form. Bedienung: Mac-Laptop, Trackpad und Tastatur,
> vollständig ohne rechte Maustaste.

---

## Auf einen Blick

| | |
|---|---|
| Genre | Zachlike — offene Optimierungsrätsel ohne feste Lösung |
| Umfang | 12 Akte × 4 Level, Freischaltung nach 3 von 4 |
| Technik | TypeScript, three.js `WebGPURenderer` (TSL), Vite |
| Assets | **vollständig prozedural** — keine einzige nachgeladene Datei |
| Simulation | deterministisch, hashbasierter RNG ohne fortlaufenden Strom |
| Bewertung | drei Achsen, **niemals** zu einer Zahl verrechnet |
| Barrierefreiheit | vollständige Tastaturbedienung, DOM-Schattenbaum, WCAG-geprüft |

---

## Losspielen

```bash
cd game
npm install
npm run dev
```

Dann `http://localhost:5173` öffnen. Mehr braucht es nicht: Das Spiel lädt
nichts nach, benutzt nur Systemschriften und hat keinen Server-Anteil.

### Bedienung

| Taste | Wirkung |
|---|---|
| `1` `2` `3` `4` | Auswahl · Bauen · Leitung legen · Abriss |
| `Q` `E` | Modul in der Palette wechseln |
| `W A S D`, Pfeile | Kamera schwenken |
| `,` `.` | in 45-Grad-Rasten drehen |
| `F` `H` | auf Auswahl fokussieren · ganze Halle |
| `Leertaste` | Simulation starten und anhalten |
| `N` | ein einzelner Tick |
| `⇧,` `⇧.` | langsamer · schneller |
| `⌘Z` `⇧⌘Z` | rückgängig · wiederholen |
| `M` | Ton an und aus |
| `B` | den Auftrag noch einmal lesen |
| `/` `?` | Tastenübersicht · Betriebshandbuch |

Trackpad: Zwei-Finger-Wischen schwenkt, Kneifen zoomt, `⌥` und Ziehen dreht.
Eine rechte Maustaste wird nirgends verlangt.

---

## Was hier drin liegt

```
game_one/
├── README.md            ← diese Datei
├── _quellen.md          ← alle Quellen, nach Suchstring gruppiert
├── konzept/             ← Spielkonzept, Didaktik, Aktbogen
├── verifikation/        ← die Prüfstrategie und ihre Ergebnisse
├── werkzeuge/           ← Werkzeugkasten der Produktion
├── belege/              ← Produktionsbibel und Spike-Post-mortems
└── game/                ← der lauffähige Quelltext
```

Im Quelltext:

| Verzeichnis | Inhalt |
|---|---|
| `src/sim/` | Simulationskern. Kennt kein three.js, kein DOM, keine Timer. |
| `src/inhalt/` | Die zwölf Akte mit Referenzlösungen und Anti-Mustern. |
| `src/welt/` | Prozedurale Geometrie, Texturen, Materialien, die Halle. |
| `src/engine/` | Renderer, Kamera, Zeigerquelle. |
| `src/ui/` | HUD, Tastaturbelegung, Stylesheet. |
| `src/audio/` | Prozedurale Klangwelt, adaptive Musik. |
| `src/narrativ/` | Figuren, Akttexte, Fundstücke, Rätsel. |
| `src/spiel/` | Spielablauf, Bauzustand, Klangregie, Erzählregie, Schmiedebank. |
| `tests/` | Einheit, Lösbarkeit, Browser. |
| `werkzeuge/` | Betrachtungs- und Wartungswerkzeuge. |

---

## Die drei Regeln, die alles andere erklären

**1. Nichts wird zu einer Zahl verrechnet.**
Kosten je Auftrag, Latenz p95 und Fläche sind drei getrennte Achsen. Es gibt
keinen Score, keine Sterne, keine Währung. Güte, Sicherheit, Konformität und
Belegquote sind binäre Tore: erfüllt oder nicht. Wer aggregiert, zerstört die
Pareto-Front — und damit die Entscheidung, die das Spiel lehren will.

**2. Alles ist deterministisch.**
Dieselbe Saat liefert dasselbe Ergebnis, in Node wie im Browser, heute wie in
einem Jahr. Es gibt genau eine Zufallsquelle, sie ist hashbasiert und hat
bewusst keinen fortlaufenden Strom — damit hängt kein Ergebnis an der
Auswertungsreihenfolge. `Math.random`, `Date.now` und `performance.now` sind im
Simulationskern durch einen Test verboten, nicht durch eine Vereinbarung.

**3. Jede didaktische Zusage ist ein Test.**
Dass ein KOLIBRI bei leichten Aufträgen reicht, dass Parallelisierung die
Latenz deckelt und nicht die Kosten, dass ein TEN-Level die Referenzlösung des
vorherigen Levels bricht: All das steht nicht im Konzept, sondern in
`tests/einheit/didaktischer_vertrag.test.ts` und `tests/loesbarkeit/`. Ein
Balancing-Fehler ist damit ein roter Test und keine Geschmacksfrage.

---

## Prüfen

```bash
cd game
npm run pruefe    # Typen
npm test          # Einheit, Lösbarkeit, didaktischer Vertrag, Determinismus
npm run e2e       # Browser: Autoplay, Bedienung, Barrierefreiheit, Bildvergleich
npm run schau     # eine Runde spielen und Screenshots ablegen
```

Was dabei geprüft wird und warum, steht in
[`verifikation/pruefstrategie.md`](verifikation/pruefstrategie.md).

---

## Herkunft

Konzept, Inhalt, Grafik, Ton und Quelltext sind vollständig in diesem
Repository entstanden. Es wurde keine Datei aus einer externen Quelle
eingebunden — Geometrie, Texturen, Materialien, Klänge und Musik werden zur
Laufzeit aus Code erzeugt. Die fachlichen Quellen, auf denen die Lerninhalte
beruhen, stehen in [`_quellen.md`](_quellen.md).
