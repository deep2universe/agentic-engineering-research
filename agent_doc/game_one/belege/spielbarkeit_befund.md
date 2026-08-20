# Spielbarkeit — Befund und Korrektur

Aufgenommen am 20. August 2026, nachdem das Spiel lokal gestartet und für
unspielbar befunden wurde. Der Bericht hält fest, was tatsächlich kaputt war,
was nur kaputt **aussah**, und warum 1042 grüne Tests nichts davon gemeldet
haben.

## 1. Die Wurzel: geprüft wurde die Simulation, nicht das Spiel

Jeder Browsertest baute das Werk über die Testschnittstelle `window.__spiel`
zusammen und prüfte danach die Simulation:

```ts
g.ladeLevel('I-0');
const kern = g.setzeModul('kern', 6, 5, { groesse: 'reiher' });
g.verbinde('q', 'aus', kern, 'ein');
g.verbinde(kern, 'aus', 's', 'ein');
```

Damit war belegt, dass der Simulationskern rechnet. Über die Frage, ob ein
Mensch ein Modul setzen, eine Leitung ziehen und ein Level abschließen kann,
sagte kein einziger Test etwas. Genau in dieser Lücke lag der Fehler.

Verschärfend kamen zwei Dinge dazu:

**Die Bildschleife war im Testbetrieb abgeschaltet.** `main.ts` setzte
`ohneSchleife: __TEST__ && params.get('schleife') !== '1'`. Bilder entstanden
nur, wenn ein Test `frameSchritt()` aufrief. Kein Test hat je ein laufendes
Spiel gesehen.

**Die Sichtbarkeitsprüfung konnte nicht scheitern.** Sie verglich die
PNG-Dateigröße:

```ts
expect(bild.byteLength).toBeGreaterThan(20_000);
```

Ein praktisch schwarzes Bild mit HUD liegt darüber. Die Zusicherung war Zierde.

## 2. Was wirklich kaputt war

### 2.1 Level I-0 war nicht zu schaffen — der Blocker

Die Kette *Auftragseingang → Kern → Auslieferung* besteht aus zwei Leitungen.
Jede Leitung begann am angeklickten Modul. Wer die naheliegende Reihenfolge
klickte — Eingang, Kern, Auslieferung — bekam beim dritten Klick:

> Dieses Modul hat keinen freien Ausgang.

Denn der dritte Klick versuchte, eine Leitung **an der Auslieferung zu
beginnen**, und eine Auslieferung nimmt nur entgegen. Die Kette blieb offen,
das Level unbestehbar. Der einzige Ausweg war, den Kern ein zweites Mal
anzuklicken. Das stand nirgends.

Nachgestellt und bestätigt: 0 ausgeliefert, 24 verworfen, nicht bestanden.

**Korrektur:** Wo eine Leitung ankommt, geht die nächste weiter, solange das
Zielmodul einen freien Ausgang hat. Drei Klicks, wie erwartet. Läuft die Kette
auf eine Auslieferung zu, meldet die Kontextleiste „Kette geschlossen." statt
eines Fehlers — das Ende der Kette ist der Normalfall, keine Fehlbedienung.

### 2.2 Elf Befehle waren gebunden, aber nie implementiert

`ansicht_gitter`, `ansicht_spur`, `inspektor`, `zoom_ein`, `zoom_aus`,
`sim_stopp`, `sprung_verstoss` und die vier Kamera-Schwenks standen in der
Tastenbelegung und im Hilfe-Overlay. Der `switch` in `fuehreBefehlAus` hatte
für sie keinen Zweig und endete auf `default: break` — also stilles Nichts.

**Korrektur:** Gitter und Zoom sind gebaut und auf G, + und − gelegt. Für
`sprung_verstoss`, `ansicht_spur` und `inspektor` gab es keine Funktion; ihre
Bindungen sind **entfernt** statt auskommentiert. Eine Taste im Hilfe-Overlay
ist ein Versprechen.

Damit das nicht wiederkommt, endet der `switch` jetzt auf eine
Vollständigkeitsprüfung des Übersetzers:

```ts
const niemals: never = befehl;
throw new Error(`Unbehandelter Befehl: ${String(niemals)}`);
```

Ein Befehl ohne Zweig ist ab sofort ein Übersetzungsfehler.

### 2.3 Die Kontextleiste hat gelogen

Im Baumodus warb sie mit `Q / E — Modul wählen`. Q und E sind nirgends
gebunden. Im Auswahlmodus mit `2 Bauen, 3 Leitung` — die Leitung liegt auf L,
und 2 ist eine Modulziffer. Das sind genau die Tasten, die jemand als Erstes
probiert.

**Korrektur:** Die Beschriftungen kommen jetzt aus `KEYMAP` und dem Katalog.
Sie können nicht mehr auseinanderlaufen. `tests/einheit/bedienversprechen.test.ts`
prüft die Zusagen gegen die Wirklichkeit.

### 2.4 Das Spielfeld war nicht zu lesen

| Sache | vorher | jetzt |
|---|---|---|
| Leitung im Ruhezustand | Leuchtwert 0,012 — praktisch schwarz | 0,095 |
| Leitungsradius | 0,05 bei 1,0 Feldweite — dünner als ein Bildpunkt | 0,085 |
| Farbanteil am Gehäuse | 0,45 auf dunklem Stahl | 0,72 |
| Leuchtband | 9 % der Blendenhöhe | 25 % |
| Belichtung | 0,72 | 0,95 |
| Beschriftung | keine | Auftragseingang und Auslieferung dauerhaft, übrige beim Zeigen |

Der Auftragseingang war von einer dekorativen Hallenstütze nicht zu
unterscheiden — beim ersten Durchspielen habe ich selbst die falsche Säule für
den Eingang gehalten.

Die Namensschilder zeigen zunächst **alle** Module an; das ergab bei einem
Dutzend Modulen einen Stapel überlappender Tafeln, der schlechter war als gar
keine Beschriftung. Deshalb die jetzige Regel: ortsfeste Marken dauerhaft, der
Rest beim Zeigen oder Auswählen.

## 3. Was nur kaputt aussah

Zwei Befunde aus dem ersten Durchgang waren **falsch** und werden hier
richtiggestellt, damit niemand ihnen nachgeht:

**Der Kameraschwenk auf WASD ist nicht kaputt.** In dieser Umgebung rendert
SwiftShader — ein reiner Software-Rasterisierer ohne Grafikkarte — mit rund
0,4 Bildern je Sekunde. Eine Taste 1,2 Sekunden zu halten rückt die Kamera dann
etwa ein halbes Bild weit. Die Messung war ein Artefakt der Umgebung.

**Der Zoom fährt die Kamera nicht in die Wand.** Ein Bildschirmfoto direkt nach
fünf Zoomstufen zeigte eine Wand — aufgenommen, bevor die Kameraglättung
angekommen war. Nach dem Ausruhen: mittlere Helligkeit 64,3, 98,9 % der
Bildpunkte sichtbar, Spielfeld sauber im Bild.

**Zur Bildrate insgesamt:** Die Last skaliert fast genau mit der Bildpunktzahl
(1440×900 → 0,4 B/s; 720×450 → 1,4 B/s; ohne Nachbearbeitung 2,0 B/s), während
31 647 Dreiecke und 152 Draw Calls belanglos sind. Das ist das Profil eines
Software-Rasterisierers, nicht das eines überladenen Spiels. **Über die
Bildrate auf einer echten Grafikkarte sagt diese Messung nichts** — sie lässt
sich in diesem Container nicht ermitteln.

## 4. Die Prüfung, die es jetzt gibt

`tests/e2e/spielbarkeit.spec.ts` spielt von Hand. Regel ohne Ausnahme: Was den
Spielzustand **verändert**, geht durch `page.mouse` oder `page.keyboard`. Die
Testschnittstelle darf lesen und rechnen, niemals setzen.

Geprüft wird:

1. Level I-0 lässt sich mit Maus und Tastatur gewinnen — drei Klicks für die Kette.
2. Die Kontextleiste bewirbt nur Tasten, die es gibt.
3. Die Tastatur wirkt ohne vorherigen Klick auf die Leinwand.
4. Das Spielfeld ist hell genug: mittlere Helligkeit > 28, über 45 % der
   Bildpunkte über der Sichtbarkeitsschwelle.

`pruefeNichtSchwarz` zählt jetzt echte Bildpunkte. Das PNG wird dafür in
`hilfe.ts` selbst entpackt (`zlib` plus die fünf Zeilenfilter nach RFC 2083) —
ohne fremde Abhängigkeit.

Wichtig dabei: Gemessen wird am **Bildschirmfoto des Compositors**, nie über
`drawImage` auf die Leinwand. Ein WebGL-Kontext ohne `preserveDrawingBuffer`
gibt seinen Zeichenpuffer nach dem Compositing frei und liefert danach schwarz
zurück — auch wenn auf dem Schirm alles steht. Diese Fehlmessung hat hier
zwischenzeitlich ein funktionierendes Spiel als tot gemeldet.

## 5. Werkzeuge

Unter `werkzeuge/` liegen die Diagnosehilfen, mit denen der Befund entstanden
ist und mit denen er nachvollziehbar bleibt:

| Datei | Zweck |
|---|---|
| `handbetrieb.mjs` | startet das Spiel und bedient es von Hand |
| `befund.mjs` | Inventar von Szene, Kamera und Renderer zur Laufzeit |
| `schleife.mjs` | läuft die Bildschleife? Rechnet sie? |
| `bildrate.mjs` | Bildrate über mehrere Einstellungen |
| `tasten.mjs` | prüft jede beworbene Taste auf Wirkung |
| `schaustueck.mjs` | baut Level I-0 fertig und macht Bilder |
| `bildmass.mjs` | Bildstatistik für die Kommandozeile |

Die Testschnittstelle hat drei Auskünfte dazubekommen, alle nur lesend:
`szenenBefund()` (was steckt in der Szene und was davon liegt im Bild),
`feldZuBildschirm()` (Gitterfeld auf Bildpunkt, damit Bedienungstests echte
Klicks schicken können) und `bilder()` (Bildzähler — die einzige verlässliche
Antwort auf „läuft die Schleife noch?").
