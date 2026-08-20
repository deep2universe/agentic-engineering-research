/**
 * Das Spiel darf keine Bedienung versprechen, die es nicht hat.
 *
 * Anlass: Die Kontextleiste warb im Baumodus mit „Q / E — Modul wählen" und im
 * Auswahlmodus mit „2 Bauen, 3 Leitung". Q und E waren nirgends gebunden, und
 * die Leitung lag auf L. Zusätzlich standen drei Befehle im Hilfe-Overlay
 * (⇧F, P, I), hinter denen keine Zeile Code stand. Wer das ausprobiert, hält
 * die Tastatur des Spiels für defekt — zu Recht.
 *
 * Diese Datei prüft die Zusagen gegen die Wirklichkeit, ohne Browser.
 */

import { describe, expect, it } from 'vitest';
import { KEYMAP, type Befehl } from '../../src/ui/keymap';
import { BAUBAR, KATALOG } from '../../src/sim/katalog';

/**
 * Die Befehle, die `Spiel.fuehreBefehlAus` behandelt.
 *
 * Bewusst als Liste gepflegt und nicht aus dem Quelltext geraten: Der
 * Übersetzer erzwingt die Vollständigkeit bereits über die
 * `never`-Zuweisung im `default`-Zweig. Hier geht es um die Gegenrichtung —
 * dass keine BINDUNG auf einen Befehl zeigt, den es nicht mehr gibt.
 */
const BEHANDELT: readonly Befehl[] = [
  'modus_auswahl', 'modus_leitung', 'modus_abriss',
  'setzen', 'abbrechen', 'loeschen', 'verbinden',
  'kamera_vor', 'kamera_zurueck', 'kamera_links', 'kamera_rechts',
  'gierung_links', 'gierung_rechts', 'zoom_ein', 'zoom_aus',
  'fokus', 'uebersicht',
  'sim_start', 'sim_einzeltick', 'sim_schneller', 'sim_langsamer',
  'ansicht_gitter',
  'rueckgaengig', 'wiederholen',
  'handbuch', 'hilfe', 'briefing', 'ton', 'schmiede',
];

describe('Bedienversprechen', () => {
  it('jede Bindung zeigt auf einen Befehl, den das Spiel behandelt', () => {
    const unbehandelt = KEYMAP.filter((b) => !BEHANDELT.includes(b.befehl));
    expect(
      unbehandelt.map((b) => `${b.anzeige} → ${b.befehl}`),
      'Diese Tasten sind gebunden, aber niemand führt sie aus'
    ).toEqual([]);
  });

  it('jeder behandelte Befehl ist auch erreichbar', () => {
    // Die Gegenrichtung: ein Befehl ohne Taste ist tot, wenn ihn nicht ein
    // Knopf auslöst. Ausgenommen sind die, die bewusst nur am Zeiger hängen.
    const nurZeiger: readonly Befehl[] = ['setzen', 'verbinden', 'loeschen'];
    const ohneTaste = BEHANDELT.filter(
      (b) => !nurZeiger.includes(b) && !KEYMAP.some((k) => k.befehl === b)
    );
    expect(ohneTaste, 'Diese Befehle haben keine Taste').toEqual([]);
  });

  it('keine zwei Bindungen belegen dieselbe Taste gleich', () => {
    const gesehen = new Map<string, Befehl>();
    const doppelt: string[] = [];
    for (const b of KEYMAP) {
      const schluessel = [b.code ?? b.taste, b.umschalt ? 'S' : '', b.befehlstaste ? 'C' : ''].join('|');
      const vorher = gesehen.get(schluessel);
      if (vorher) doppelt.push(`${schluessel}: ${vorher} und ${b.befehl}`);
      else gesehen.set(schluessel, b.befehl);
    }
    expect(doppelt).toEqual([]);
  });

  it('keine Modulziffer kollidiert mit einer Befehlstaste', () => {
    // Die Modulkuerzel werden im keydown VOR den Befehlen geprüft. Eine
    // Überschneidung würde den Befehl stillschweigend verschlucken.
    const modulTasten = new Set(BAUBAR.map((a) => KATALOG[a].taste.toUpperCase()));
    const kollision = KEYMAP.filter((b) => {
      if (b.befehlstaste || b.umschalt) return false; // Modulkuerzel gelten ohne Zusatztaste
      const t = (b.taste ?? b.code?.replace(/^(Key|Digit)/, '') ?? '').toUpperCase();
      return t.length === 1 && modulTasten.has(t);
    });
    expect(
      kollision.map((b) => `${b.anzeige} (${b.befehl})`),
      'Diese Befehlstasten werden von einem Modulkuerzel verschluckt'
    ).toEqual([]);
  });
});
