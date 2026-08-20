/**
 * Testaufbau: deterministischer Zufall für alle Tests.
 *
 * Die erste Fassung machte `Math.random` zu einem Fehler. Das war gut gemeint
 * und in der Praxis unbrauchbar: three.js ruft bei JEDEM `new Texture()`,
 * `new Material()` und `new Object3D()` intern `generateUUID()` auf, und das
 * würfelt. Damit war die gesamte Renderschicht untestbar, und jedes Team baute
 * sich einen eigenen Notbehelf — ein sicheres Zeichen, dass die Regel am
 * falschen Ort saß.
 *
 * Die richtige Trennung verläuft anders:
 *
 *  - `src/sim/**` darf `Math.random` NICHT benutzen. Das ist eine Aussage über
 *    den QUELLTEXT und wird von `determinismus.test.ts` per Textsuche geprüft.
 *    Das ist strenger als eine Laufzeitfalle, weil es auch Pfade erwischt, die
 *    im Test nie ausgeführt werden.
 *  - Alles andere darf würfeln, muss dabei aber reproduzierbar bleiben. Deshalb
 *    wird `Math.random` hier durch einen festen Strom ersetzt, der in jeder
 *    Testdatei identisch startet.
 *
 * Ergebnis: Tests sind reproduzierbar, three ist benutzbar, und die eigentliche
 * Regel wird strenger durchgesetzt als vorher.
 */

const SAAT = 0x5c47a111;

function mische(x: number): number {
  let h = x | 0;
  h = Math.imul(h ^ (h >>> 16), 0x21f0aaad);
  h = Math.imul(h ^ (h >>> 15), 0x735a2d97);
  h = h ^ (h >>> 15);
  return h >>> 0;
}

let zustand = SAAT;
let aufrufe = 0;

const echtesRandom = Math.random;

Math.random = (): number => {
  aufrufe++;
  zustand = (zustand + 0x9e3779b9) >>> 0;
  return mische(zustand) / 0x100000000;
};

/** Zurücksetzen zwischen zwei Prüfungen, wenn ein Test es ausdrücklich braucht. */
(globalThis as unknown as { __zufallZuruecksetzen: () => void }).__zufallZuruecksetzen = () => {
  zustand = SAAT;
  aufrufe = 0;
};

/** Wie oft wurde seit dem letzten Zurücksetzen gewürfelt? Für Leck-Prüfungen. */
(globalThis as unknown as { __zufallAufrufe: () => number }).__zufallAufrufe = () => aufrufe;

/** Der echte Zufall, falls ihn ein Werkzeug wirklich braucht (z. B. fast-check). */
(globalThis as unknown as { __echtesRandom: () => number }).__echtesRandom = echtesRandom;
