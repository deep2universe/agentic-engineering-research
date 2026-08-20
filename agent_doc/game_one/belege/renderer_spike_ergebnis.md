# Renderer-Spike — Ergebnis

**Datum:** 2026-08-19 · **Frage:** Laeuft `WebGPURenderer` + TSL + `RenderPipeline` headless ueber das WebGL2-Fallback-Backend und liefert ein nicht-schwarzes Bild?

**Antwort: Ja, vollstaendig.** Die Grundsatzentscheidung E-01 der Produktions-Bibel ist damit bestaetigt.

## Messreihe (Chromium headless, SwiftShader, 1280x720)

| Stufe | Aufbau | Backend | Mittl. Helligkeit | Helle Pixel | Draw Calls |
|---|---|---|---|---|---|
| 0 | `renderer.render()` nackt | webgl2 | 60.9 | 78 % | 28 |
| 1 | `RenderPipeline`, `pass(scene, camera)` | webgl2 | 60.9 | 78 % | 28 |
| 2 | + Bloom (global) | webgl2 | 77.6 | 99 % | 40 |
| 3 | + MRT-Emissive-Kanal, selektiver Bloom | webgl2 | 133.1 | 100 % | 40 |
| 4 | + GTAO ueber Normal/Tiefe-PrePass | webgl2 | 126.2 | 100 % | 55 |
| 5 | + SMAA (Vollausbau) | webgl2 | 125.5 | 100 % | 60 |

## Gewonnene Erkenntnisse (verbindlich fuer die Produktion)

1. **`pipeline.render()`, niemals `renderAsync()`** — letzteres ist in r185 deprecated und meldet das per Konsolenwarnung. Voraussetzung ist `await renderer.init()` vor dem Aufbau des Post-Graphen.
2. **Der In-Browser-Helligkeitstest ueber `ctx.drawImage(canvas, …)` ist wertlos** — der Drawing Buffer ist nach dem Compositing geleert und liefert falsch-negative Schwarzbilder. Die Helligkeitspruefung gehoert in den Runner, gegen den echten Screenshot.
3. **MRT-Emissive braucht `vec4(emissive, output.a)`**, nicht `emissive` allein; sonst melden Treiber `GL_INVALID_OPERATION: Active draw buffers with missing fragment shader outputs`.
4. **GTAO braucht einen eigenen PrePass** mit `mrt({ output: packNormalToRGB(normalView), velocity })` — die Normalen des Haupt-Passes stehen nach einem eigenen `setMRT` nicht mehr zur Verfuegung.
5. **Emissive-Werte muessen klein sein.** Stufe 5 ist mit `emissiveNode = color(...).mul(1.2)` und `bloom(..., 1.8, …)` vollstaendig ueberstrahlt. Produktionsband: Emissive 0.05–0.35, Bloom-Staerke 0.8–1.6, AgX-Exposure 1.0–1.2.
6. **Playwright-Browser-Download ist in dieser Umgebung proxy-blockiert.** Loesung: `executablePath` auf das vorinstallierte volle Chromium (`werkzeuge/browser.mjs`), niemals `chrome-headless-shell`.
7. **`--enable-unsafe-swiftshader` ist zwingend** — ohne dieses Flag gibt es ab Chrome 130 gar keinen WebGL-Kontext.

---

## Nachtrag: der teuerste Fehler der Produktion

Nach dem Zusammenbau war das gesamte Bild rot. Die Suche lief zunaechst in die
falsche Richtung (Beleuchtung, Metallwerte, MRT-Emissive-Kanal). Entschieden hat
erst eine harte Messung: derselbe Blick einmal mit und einmal ohne Post-Stack
(`?post=0`), und statt einer Sichtpruefung die Kanalmittelwerte des PNG.

```
mit Post-Stack:   R 12.5  G 0.0  B 0.0
ohne Post-Stack:  R 17.2  G 22.6  B 28.7
```

Gruen und Blau exakt null — das ist kein Farbstich, das ist eine Ausloeschung.

**Ursache:** `farbe.mul(aoPass.getTextureNode())`. Die GTAO-Node liefert die
Verdeckung im ROTKANAL; Gruen und Blau sind null. Multipliziert man das Bild mit
der ganzen Textur statt nur mit `.r`, loescht man zwei Kanaele aus.

```ts
// falsch — loescht Gruen und Blau
bild = farbe.mul(aoPass.getTextureNode());
// richtig
bild = farbe.mul(aoPass.getTextureNode().r);
```

**Lehre fuer die Verifikation:** Eine Sichtpruefung haette das nie eingegrenzt —
ein rotes Bild sieht nach "Beleuchtung" aus. Erst die Kanalmittelwerte und der
A/B-Vergleich gegen einen abschaltbaren Post-Stack haben es in einem Schritt
gezeigt. Beides ist seither fest eingebaut: `?post=0` als Diagnoseschalter und
die Kanalanalyse in `werkzeuge/schau.mjs`.
