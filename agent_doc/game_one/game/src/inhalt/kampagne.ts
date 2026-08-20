/**
 * Die Kampagne: zwoelf Akte zu je vier Leveln.
 *
 * Pro Akt genau EINE neue Modulart. Freischaltung des nächsten Akts nach drei
 * von vier Leveln — ein einzelnes zu schweres Pflichtlevel ist die häufigste
 * Abbruchursache in Spielen dieser Art.
 */

import type { LevelDefinition } from './level_typen';
import { AKT_1 } from './akt_01';
import { AKT_2 } from './akt_02';
import { AKT_3 } from './akt_03';
import { AKT_4 } from './akt_04';
import { AKT_5 } from './akt_05';
import { AKT_6 } from './akt_06';
import { AKT_7 } from './akt_07';

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

/** Wie viele Level eines Akts bestanden sein müssen, um weiterzukommen. */
export const NOETIG_JE_AKT = 3;

export const AKTE: readonly Akt[] = [
  {
    nummer: 1,
    titel: 'Die Kette',
    untertitel: 'Halle 3, kalt übernommen',
    neu: 'Modell-Kern (KOLIBRI, REIHER, KONDOR)',
    lektion: 'Modellgröße ist eine ökonomische Entscheidung, keine Qualitätsentscheidung.',
    level: AKT_1,
  },
  {
    nummer: 2,
    titel: 'Die Weiche',
    untertitel: 'Der Einkauf liest jetzt Rechnungen',
    neu: 'Weiche (Router)',
    lektion: 'Wer die Vorgänge sortiert, bevor er sie bezahlt, bezahlt deutlich weniger.',
    level: AKT_2,
  },
  {
    nummer: 3,
    titel: 'Das Werkzeug',
    untertitel: 'Rechnen lässt man rechnen',
    neu: 'Werkzeug (RECHENWERK, BESTAND, RECHERCHE, FREMDDIENST)',
    lektion:
      'Ein deterministisches Werkzeug schlägt jedes Modell bei Zahlen — aber jedes angeschlossene Werkzeug wird bei jedem Kernaufruf mitbezahlt.',
    level: AKT_3,
  },
  {
    nummer: 4,
    titel: 'Die Sicherung',
    untertitel: 'Was passiert, wenn etwas schiefgeht',
    neu: 'Schranke und Sicherung',
    lektion: 'Wiederholen ist kein Plan; rechtzeitig aufgeben ist einer.',
    level: AKT_4,
  },
  {
    nummer: 5,
    titel: 'Der Chor',
    untertitel: 'Viele Hände, eine Rechnung',
    neu: 'Verteiler und Sammler',
    lektion: 'Die Laufzeit eines Fan-out ist das Maximum seiner Zweige — sein Preis ist die Summe.',
    level: AKT_5,
  },
  {
    nummer: 6,
    titel: 'Die Prüferin',
    untertitel: 'Wer bewertet die Bewertung',
    neu: 'Prüferin (Evaluator-Optimizer)',
    lektion: 'Eine Prüfung, die selbst schätzt, verbessert im Mittel — und im Einzelfall manchmal gar nichts.',
    level: AKT_6,
  },
  {
    nummer: 7,
    titel: 'Der Speicher',
    untertitel: 'Alles aufheben ist keine Ordnung',
    neu: 'Speicher (verdichten, abrufen, abschotten, puffern)',
    lektion: 'Kontext ist ein Budget, kein Vorrat.',
    level: AKT_7,
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
