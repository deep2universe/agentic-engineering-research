/**
 * Die Kampagne: zwoelf Akte zu je vier Leveln.
 *
 * Pro Akt genau EINE neue Modulart. Freischaltung des naechsten Akts nach drei
 * von vier Leveln — ein einzelnes zu schweres Pflichtlevel ist die haeufigste
 * Abbruchursache in Spielen dieser Art.
 */

import type { LevelDefinition } from './level_typen';
import { AKT_1 } from './akt_01';

export interface Akt {
  readonly nummer: number;
  readonly titel: string;
  readonly untertitel: string;
  /** Die eine neue Mechanik dieses Akts. */
  readonly neu: string;
  /** Die zentrale Lektion in einem Satz. */
  readonly lektion: string;
  readonly level: readonly LevelDefinition[];
}

/** Wie viele Level eines Akts bestanden sein muessen, um weiterzukommen. */
export const NOETIG_JE_AKT = 3;

export const AKTE: readonly Akt[] = [
  {
    nummer: 1,
    titel: 'Die Kette',
    untertitel: 'Halle 3, kalt uebernommen',
    neu: 'Modell-Kern (KOLIBRI, REIHER, KONDOR)',
    lektion: 'Modellgroesse ist eine oekonomische Entscheidung, keine Qualitaetsentscheidung.',
    level: AKT_1,
  },
];

export const ALLE_LEVEL: readonly LevelDefinition[] = AKTE.flatMap((a) => a.level);

export function levelNach(id: string): LevelDefinition | undefined {
  return ALLE_LEVEL.find((l) => l.id === id);
}

export function aktNach(nummer: number): Akt | undefined {
  return AKTE.find((a) => a.nummer === nummer);
}

/** Nachfolger im Kampagnenverlauf. */
export function naechstesLevel(id: string): LevelDefinition | undefined {
  const i = ALLE_LEVEL.findIndex((l) => l.id === id);
  return i >= 0 ? ALLE_LEVEL[i + 1] : undefined;
}
