# Prüfstrategie

Diese Datei beschreibt, **wie SCHWARMWERK nachweist, dass es tut, was es
verspricht** — und zwar deterministisch, in Code, ohne dass jemand hinsehen
muss.

Der Anspruch dahinter ist nicht Testabdeckung. Testabdeckung misst, wie viele
Zeilen ausgeführt wurden, und sagt über ein Lernspiel nichts aus. Der Anspruch
ist: **Jede Zusage, die das Spiel einer Spielerin gegenüber macht, ist eine
ausführbare Behauptung.** Wenn das Spiel behauptet, ein kleiner Kern reiche für
leichte Aufträge, dann ist das ein Test. Wenn es behauptet, ein Level sei auf
zwei strukturell verschiedene Arten lösbar, dann ist das ein Test.

---

## Die sechs Ebenen

### 1. Typen

```bash
npm run pruefe
```

TypeScript im strengen Modus, zusätzlich `noUncheckedIndexedAccess` und
`exactOptionalPropertyTypes`. Kein `any`, keine Zusicherungen mit `as` auf
fremde Typen. Wo eine Bibliothek eine Deklaration schuldig bleibt, steht eine
Deklarationsergänzung in `src/typen_erweiterung.d.ts` — nicht ein `as any`.

### 2. Determinismus-Wächter

`tests/einheit/determinismus.test.ts`

Der Wächter liest den **Quelltext** von `src/sim/**` und weist nach, dass dort
nichts steht, was Determinismus brechen könnte:

| Verboten | Warum |
|---|---|
| `Math.random`, `Date.now`, `performance.now`, `new Date` | Nichtdeterminismus per Definition |
| `Math.pow`, `Math.exp`, `Math.log`, `Math.sin`, … | Transzendente Funktionen sind über Plattformen hinweg nicht bitgleich; das Spiel benutzt stattdessen Ganzzahl-Nachschlagetabellen in `kurven.ts` |
| `from 'three`, `window.`, `document.`, `setTimeout` | Der Kern muss ohne Browser laufen, sonst ist er nicht in Node prüfbar |

Dazu kommen Verhaltenstests: Zwei Läufe mit derselben Saat liefern dieselbe
Prüfsumme; zwei Läufe mit verschiedener Saat nicht; die Auswertungsreihenfolge
der Module ändert nichts.

Der eigentliche Beweis läuft im Browser (Ebene 5).

### 3. Didaktischer Vertrag

`tests/einheit/didaktischer_vertrag.test.ts`

Vierzig Behauptungen über die Simulation, die zugleich die Lektionen des Spiels
sind. Beispiele:

- Ein KOLIBRI erreicht bei leichten Aufträgen dieselbe Güte wie ein KONDOR — zu
  einem Sechzehntel des Preises.
- Blinde Spezialisierung ist auf einem gemischten Strom im Erwartungswert
  **negativ**: Der Malus für die falsche Domäne ist größer als der Bonus für
  die richtige.
- Eine Parallelisierung deckelt die Latenz auf das Maximum ihrer Zweige und
  summiert die Kosten.
- Oberhalb der Kontextschwelle steigen die Kosten je Aufruf, ohne dass die Güte
  steigt.
- Liegen private Daten, nicht vertrauenswürdiger Inhalt und ein ungefilterter
  Ausgang auf **einem** Pfad, fällt die Sicherheit auf null. Kein Regler, eine
  Graph-Invariante.

Diese Datei hat beim ersten Lauf fünf echte Balancing-Fehler aufgedeckt. Sie
ist damit der wirtschaftlichste Test des Projekts.

### 4. Lösbarkeit je Akt

`tests/loesbarkeit/akt_*.test.ts`, gemeinsame Prüfung in
`tests/hilfe/level_pruefung.ts`

Für **jedes** Level wird geprüft:

1. **Jede Referenzlösung besteht.** Ein Level, dessen eigene Musterlösung
   durchfällt, ist kein schweres Level, sondern ein kaputtes.
2. **Ab Akt II gibt es mindestens zwei Referenzlösungen, von denen keine die
   andere dominiert.** Das ist die formale Fassung von „es gibt mehr als einen
   richtigen Weg". Dominiert eine Lösung die andere in allen drei Achsen, ist
   die zweite keine Alternative, sondern ein Fehler.
3. **Jedes Anti-Muster scheitert — an der vorgesehenen Stelle.** Nicht
   irgendwie, sondern an genau der Kennzahl, an der die Lektion sitzt. Ein
   Anti-Muster, das aus Versehen am Budget scheitert statt an der Güte, lehrt
   das Falsche.
4. **Das TEN-Level bricht nachweislich die Referenzlösung des SHO-Levels.** Der
   Kishotenketsu-Rhythmus ist damit keine Absichtserklärung.

Die Budgets der Level sind **nicht geschätzt**: `tests/hilfe/bericht.ts` misst
jede Referenz und jedes Anti-Muster und druckt die Zahlen; die Budgets werden
aus diesen Messwerten abgeleitet.

### 5. Browser — der eigentliche Beweis

`tests/e2e/autoplay.spec.ts`

Ein Kopf-loser Chromium spielt die Kampagne. Geprüft wird gegen den **Zustand**,
nicht gegen Pixel:

- Jedes Level wird mit seiner Referenzlösung durchgespielt und besteht.
- **Node-Prüfsumme === Browser-Prüfsumme**, Level für Level. Das ist die
  schärfste Einzelzusicherung des Projekts: Dieselbe Simulation, zwei
  Laufzeiten, bitgleiches Ergebnis.
- Zwei frische Browserkontexte kommen bei gleicher Eingabefolge zum selben
  Ergebnis.
- Module setzen, verdrahten, abreißen, rückgängig machen und wiederherstellen
  funktioniert über die echte Bedienkette.
- Unsinnige Bauaktionen werden **mit Begründung** abgelehnt, nicht stumm.

Wichtig: Diese Tests laufen gegen den **Entwicklungsserver**, weil die
Debug-Schnittstelle im ausgelieferten Bündel absichtlich wegoptimiert ist. Dass
sie dort tatsächlich fehlt, prüft `tests/einheit/auslieferung.test.ts` gegen die
echten gebauten Dateien.

### 5b. Erzählfluss, Schmiede und das ausgelieferte Bündel

`tests/e2e/erzaehlung.spec.ts` ist der einzige Ort, an dem geprüft wird, was
eine Spielerin tatsächlich sieht, wenn sie von vorn beginnt: Akttafel vor dem
Auftrag, MONOLITHs Angebot ohne Widerrede, kalter Einstieg genau einmal je Akt,
mitwachsende Fundstücke, Lesestand über den Levelwechsel hinweg, und beim
Aktwechsel der Schlusssatz des alten Akts zwischen Ergebnis und nächstem
Einstieg. Alle anderen Browsertests umgehen die Erzählkanäle bewusst.

`tests/e2e/schmiede.spec.ts` fährt die evolutionäre Suche im echten Browser.
Die tragende Zusicherung: **Was die Werkbank anzeigt, hält die Simulation.**
Die Kennzahlen in der Auswahltabelle müssen exakt die sein, die beim
Durchlaufen herauskommen — sonst würde das Spiel bei der Lektion des Akts
selbst schummeln.

`tests/e2e/auslieferung.spec.ts` lädt das **gebaute Bündel** über einen zweiten
Server, ganz ohne Debug-Hilfe. Ein Bündel kann sauber bauen, jede statische
Prüfung bestehen und beim Laden trotzdem abstürzen; das ist die einzige Stelle,
an der so ein Fehler auffällt, bevor ihn jemand meldet.

### 6. Bedienbarkeit und Bild

`tests/e2e/bedienung.spec.ts`, `tests/e2e/bild_und_leistung.spec.ts`

- Ein Level wird **vollständig ohne Maus** durchgespielt.
- Jede belegte Taste wird gedrückt, ohne dass etwas stolpert.
- Der Fokus verlässt die Anwendung nie: Tab läuft im Kreis, und ein offener
  Dialog hält ihn bei sich.
- Der Modulgraph liegt zusätzlich als vorlesbarer DOM-Baum vor.
- `@axe-core/playwright` prüft die WCAG-Regeln der Oberfläche.
- Vier Bildvergleiche: drei Blicke in die Halle und einer auf die vollständige
  Oberfläche.
- Leistungsbudgets über **maschinenunabhängige** Zähler (Draw Calls, Dreiecke,
  Geometrien, Texturen) — niemals über Bildraten, die auf jedem Rechner anders
  ausfallen.
- Ein Levelwechsel gibt alles wieder frei: Geometrie-, Material- und
  Texturzähler stehen danach auf ihrem Ausgangswert.

---

### 7. Verträge zwischen zwei Dateien

`tests/einheit/oberflaeche.test.ts` prüft Zusagen, die keine einzelne Datei
verletzen kann, weil beide Seiten für sich richtig sind:

- Jede im HUD vergebene CSS-Klasse und Kennung hat eine Regel im Stylesheet und
  ist reines ASCII.
- Jedes baubare Modul hat genau ein Tastenkürzel, keines doppelt, und keines
  kollidiert mit einem Befehl der Tastaturbelegung.

Der zweite Punkt hat einen Fehler aufgedeckt, den kein bestehender Test finden
konnte: Die Palette zeigte zu jedem Modul ein Kürzel, und **nicht ein einziges**
davon war für dieses Modul belegt — die Ziffern gehörten den Modi, `H` der
Kameraübersicht, `T` dem Spur-Overlay, `E` dem Blättern in der Palette.
Tastaturbelegung und Palette waren jede für sich vollständig und
widerspruchsfrei. Der Fehler lag ausschließlich zwischen ihnen.

---

## Drei Lehren aus der Produktion

### Ein Fehler kann zwischen zwei richtigen Dateien liegen

Siehe oben. Wo zwei Seiten einander etwas versprechen — HUD und Stylesheet,
Palette und Tastatur, Werkbank und Simulation — gehört der Vertrag selbst
geprüft, nicht nur jede Seite für sich.

### Der Bildvergleich hat eine gefährliche Toleranz

Der allgemeine Schwellwert (`maxDiffPixelRatio: 0.004`) ist für eine
3D-Ansicht richtig — Kantenglättung und Rundungsunterschiede zwischen
Treiberversionen erzeugen ständig ein paar hundert abweichende Pixel.

Für die **Oberfläche** ist er falsch. Eine Textänderung („Akt 1" wurde zu
„Akt I", die Budgetzeile wurde neu gesetzt, die Kennzahlen bekamen einen
Ruhezustand) betrifft ebenfalls nur ein paar hundert Pixel — und ging deshalb
stillschweigend durch, obwohl der Test extra dafür da war. Der
Oberflächenvergleich läuft seitdem mit `maxDiffPixelRatio: 0.0002`.

Verallgemeinert: **Ein Bildvergleich mit großzügiger Toleranz prüft nur, ob das
Bild noch existiert.**

### Ein Fehler, der wie ein Beleuchtungsfehler aussah

Das erste vollständige Bild war rein rot. Zwei Tage Verdacht fielen auf
Beleuchtung, Metallwerte und Emissivkanäle. Gefunden wurde er nicht durch
Hinsehen, sondern durch **Messen**: Ein Diagnoseschalter `?post=0` und eine
kanalweise PNG-Statistik zeigten

```
mit Post-Stack:   R 12,5   G 0,0    B 0,0
ohne Post-Stack:  R 17,2   G 22,6   B 28,7
```

Ursache: GTAO liefert die Verdeckung im **Rotkanal**. Multipliziert man das
Bild mit der ganzen Textur statt mit `.r`, löscht man Grün und Blau aus.

Verallgemeinert: **Ein rotes Bild sieht aus wie ein Beleuchtungsfehler und ist
keiner.** Wer Bilder beurteilt, muss sie messen können; deshalb gibt es
`werkzeuge/schau.mjs`, und deshalb meldet es kanalweise Helligkeiten.

---

## Was NICHT geprüft wird — und warum

- **Bildrate.** Sie hängt an der Maschine. Geprüft werden die Zähler, die sie
  verursachen.
- **Spielspaß.** Nicht automatisierbar. Ersetzt wird er durch die Zusicherung,
  dass jedes Level mehr als einen nicht dominierten Lösungsweg hat — das ist
  die messbare Hälfte davon.
- **Wiederholungsläufe bei Fehlschlägen.** `retries: 0`. Bei einem
  deterministischen Spiel ist jeder Wackler ein echter
  Nichtdeterminismus-Fehler, und Wiederholungen verstecken genau die
  Fehlerklasse, die im Unternehmenseinsatz als „die Simulation liefert
  unterschiedliche Ergebnisse" zurückkommt.
