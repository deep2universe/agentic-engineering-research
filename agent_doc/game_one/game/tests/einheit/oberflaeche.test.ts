/**
 * Prüft die Oberfläche gegen ihr Stylesheet.
 *
 * Anlass war ein stummer Fehler: der Umlaut-Codemod hielt `class:
 * 'blatt fundstueck'` für Fließtext und machte daraus `fundstück`. Es gab
 * keinen Typfehler, keinen Testausfall und keine Konsolenmeldung — nur einen
 * Dialog ohne Gestaltung, der erst im Bildvergleich auffiel.
 *
 * Die Lehre daraus ist allgemeiner als der eine Fehler: CSS-Klassen sind ein
 * Vertrag zwischen zwei Dateien, den niemand einhält, solange ihn niemand
 * prüft. Diese Datei prüft ihn.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { BAUBAR, KATALOG } from '../../src/sim/katalog';
import { KEYMAP } from '../../src/ui/keymap';

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const hud = readFileSync(join(wurzel, 'src/ui/hud.ts'), 'utf8');
const css = readFileSync(join(wurzel, 'src/ui/stil.css'), 'utf8');

/** Alle `class: '…'`-Werte aus dem HUD, in Einzelklassen zerlegt. */
function klassenImHud(): string[] {
  const gefunden = new Set<string>();
  for (const treffer of hud.matchAll(/\bclass:\s*'([^']+)'/g)) {
    for (const k of treffer[1]!.split(/\s+/)) if (k) gefunden.add(k);
  }
  return [...gefunden].sort();
}

/** Alle `id: '…'`-Werte aus dem HUD. */
function kennungenImHud(): string[] {
  const gefunden = new Set<string>();
  for (const treffer of hud.matchAll(/\bid:\s*'([^']+)'/g)) gefunden.add(treffer[1]!);
  return [...gefunden].sort();
}

describe('Oberfläche und Stylesheet', () => {
  it('findet überhaupt Klassen im HUD', () => {
    expect(klassenImHud().length).toBeGreaterThan(8);
  });

  it('vergibt nur CSS-Klassen, die reines ASCII sind', () => {
    for (const k of klassenImHud()) {
      expect(/^[a-z0-9-]+$/.test(k), `Die Klasse "${k}" ist kein gültiger ASCII-Bezeichner`).toBe(true);
    }
    for (const k of kennungenImHud()) {
      expect(/^[a-z0-9-]+$/.test(k), `Die Kennung "${k}" ist kein gültiger ASCII-Bezeichner`).toBe(true);
    }
  });

  it('kennt zu jeder vergebenen Klasse eine Regel im Stylesheet', () => {
    const fehlend = klassenImHud().filter((k) => !new RegExp(`\\.${k}\\b`).test(css));
    expect(fehlend, `Ohne Regel im Stylesheet: ${fehlend.join(', ')}`).toEqual([]);
  });

  it('kennt zu jeder vergebenen Kennung eine Regel im Stylesheet', () => {
    const fehlend = kennungenImHud().filter((k) => !new RegExp(`#${k}\\b`).test(css));
    expect(fehlend, `Ohne Regel im Stylesheet: ${fehlend.join(', ')}`).toEqual([]);
  });

  it('setzt keine Schriftart, die nachgeladen werden müsste', () => {
    expect(css.includes('@import'), 'Das Stylesheet lädt eine externe Datei nach').toBe(false);
    expect(/url\(\s*['"]?https?:/.test(css), 'Das Stylesheet verweist auf eine externe URL').toBe(false);
  });
});

/**
 * Der Vertrag zwischen Modulpalette und Tastatur.
 *
 * Anlass war ein Fehler, den kein bestehender Test finden konnte, weil beide
 * Seiten für sich genommen richtig waren: Die Palette zeigte zu jedem Modul ein
 * Tastenkürzel, und die Tastaturbelegung war vollständig und widerspruchsfrei.
 * Nur hatte NICHT EIN EINZIGES der angezeigten Kürzel etwas mit dem Modul zu
 * tun — die Ziffern gehörten den Modi, `H` der Kameraübersicht, `T` dem
 * Spur-Overlay, `E` dem Blättern in der Palette.
 *
 * Eine Oberfläche, die eine Bedienung verspricht, die es nicht gibt, ist
 * schlimmer als eine ohne Kürzel.
 */
describe('Modulkürzel und Tastaturbelegung', () => {
  const kuerzel = BAUBAR.map((art) => ({ art, taste: KATALOG[art].taste })).filter((x) => x.taste !== '');

  it('gibt jedem baubaren Modul ein Kürzel', () => {
    expect(kuerzel).toHaveLength(BAUBAR.length);
  });

  it('vergibt kein Kürzel doppelt', () => {
    const alle = kuerzel.map((x) => x.taste.toUpperCase());
    expect(new Set(alle).size, `Doppelt vergeben: ${alle.join(' ')}`).toBe(alle.length);
  });

  it('kollidiert mit keinem Befehl der Tastaturbelegung', () => {
    /*
     * Die Prüfung vergleicht gegen `code` UND `anzeige`, weil ein Kürzel auf
     * beiden Wegen kollidieren kann: `KeyH` bindet dieselbe Taste wie das
     * Kürzel "H", und eine Ziffer bindet als `Digit3` dieselbe wie "3".
     */
    const belegt = new Set<string>();
    for (const b of KEYMAP) {
      if (b.befehlstaste === true || b.umschalt === true) continue;
      if (b.code) belegt.add(b.code.replace(/^Key|^Digit/, '').toUpperCase());
      if (b.taste) belegt.add(b.taste.toUpperCase());
    }
    const konflikte = kuerzel.filter((x) => belegt.has(x.taste.toUpperCase()));
    expect(
      konflikte,
      `Diese Modulkürzel sind anderweitig belegt: ${konflikte.map((k) => `${k.taste}=${k.art}`).join(', ')}`
    ).toEqual([]);
  });
});
