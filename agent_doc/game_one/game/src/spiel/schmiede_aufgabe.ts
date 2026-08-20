/**
 * Leitet die Suchaufgabe der Schmiede aus dem Level ab.
 *
 * Der entscheidende Entwurfsgedanke steckt darin, WAS hier angeboten wird und
 * was nicht:
 *
 *  - **Suchziele** sind die drei Wettbewerbsachsen des Spiels plus die Güte.
 *    Mehr gibt es nicht, und höchstens zwei davon dürfen gleichzeitig gesetzt
 *    sein. Wer auf vier Achsen gleichzeitig drückt, drückt auf keine.
 *  - **Harte Bedingungen** sind die Ziele DIESES Levels — dieselben, an denen
 *    am Ende ganz normal gemessen wird. Sie sind aber **nicht vorausgewählt**.
 *
 * Diese eine Auslassung trägt die Lektion des ganzen Akts. Das Spiel weiß, was
 * zählt. Es sagt es der Suche nicht von sich aus. Wer nur auf Kosten optimiert
 * und die Gütevorgabe nicht als Bedingung zuschaltet, bekommt eine Anlage, die
 * die Suche glänzend besteht und den Auftrag verfehlt — und sieht auf einem
 * Bildschirm, warum. Das ist Goodharts Gesetz als Spielzug statt als Zitat.
 */

import type { EvoBedingung, EvoZiel } from '../sim/evolution';
import type { SchmiedeAufgabe } from './schmiedebank';
import type { Level, Metriken, Werk } from '../sim/typen';

/** Die vier Kennzahlen, auf die eine Suche drücken darf. */
const ANGEBOTENE_ZIELE: readonly EvoZiel[] = [
  { metrik: 'kostenJeAuftrag', richtung: 'klein' },
  { metrik: 'latenzP95', richtung: 'klein' },
  { metrik: 'flaeche', richtung: 'klein' },
  { metrik: 'guete', richtung: 'gross' },
];

/** Klartext einer Kennzahl für das HUD. */
export const METRIK_NAME: Partial<Record<keyof Metriken, string>> = {
  kostenJeAuftrag: 'Token je Auftrag',
  latenzP95: 'Latenz p95',
  flaeche: 'Fläche (Module)',
  guete: 'Güte',
  durchsatz: 'Durchsatz',
  sicherheit: 'Sicherheit',
  nachvollziehbarkeit: 'Nachvollziehbarkeit',
  konformitaet: 'Konformität',
  belegquote: 'Belegquote',
  kosten: 'Token gesamt',
};

/**
 * Baut die Aufgabe aus den Zielen des Levels.
 *
 * Kür-Ziele („Meisterstück") werden ausgelassen: Sie sind zum Bestehen nicht
 * nötig, und als harte Bedingung würden sie die Suche unnötig einengen.
 */
export function schmiedeAufgabeAus(level: Level): SchmiedeAufgabe {
  const bedingungen: EvoBedingung[] = [];
  for (const z of level.ziele) {
    if (z.optional === true) continue;
    // '==' bleibt aussen vor: Eine Gleichheitsforderung als Suchbedingung
    // wäre fast immer unerfüllbar und würde die Front leeren.
    if (z.vergleich === '>=') {
      bedingungen.push({ metrik: z.metrik, vergleich: 'min', wert: z.wert, text: z.text });
    } else if (z.vergleich === '<=') {
      bedingungen.push({ metrik: z.metrik, vergleich: 'max', wert: z.wert, text: z.text });
    }
  }
  return {
    waehlbareZiele: ANGEBOTENE_ZIELE,
    waehlbareBedingungen: bedingungen,
    budget: 400,
    maxZiele: 2,
    hinweis:
      'Die Schmiede sucht nach dem Maßstab, den DU ihr gibst. Was du nicht als ' +
      'Bedingung setzt, darf sie opfern.',
  };
}

/** Steht eine Schmiede im Werk? Nur dann gibt es hier etwas zu tun. */
export function hatSchmiede(werk: Werk): boolean {
  return werk.module.some((m) => m.art === 'schmiede');
}
