/**
 * Levelmodell der Kampagne.
 *
 * Ein Level ist nicht nur eine Aufgabe, sondern ein didaktischer Vertrag: Es
 * bringt seine eigenen Beweise mit. `referenzen` belegen, dass es loesbar ist
 * (und auf mehr als eine Art), `antiMuster` belegen, dass die naheliegenden
 * falschen Loesungen tatsaechlich scheitern — und zwar an der Stelle, an der
 * die Lektion sitzt. `tests/loesbarkeit/` prueft beides fuer jedes Level.
 */

import type { Level, Metriken, Werk } from '../sim/typen';

/** Eine benannte, lauffaehige Loesung eines Levels. */
export interface Referenz {
  readonly name: string;
  /** Was diese Loesung architektonisch anders macht als die andere. */
  readonly ansatz: string;
  readonly werk: Werk;
}

/**
 * Eine plausible, aber falsche Loesung — die Falle, in die man tappt, wenn man
 * die Lektion des Levels nicht verstanden hat.
 */
export interface AntiMuster {
  readonly name: string;
  /** Warum jemand das baut. */
  readonly verlockung: string;
  /** Woran es scheitert — muss im Test exakt eintreten. */
  readonly scheitertAn: keyof Metriken | 'budget_kosten' | 'budget_latenz' | 'budget_module' | 'budget_dauer';
  readonly werk: Werk;
}

export interface LevelDefinition extends Level {
  /** Mindestens eine; ab Akt II mindestens zwei strukturell verschiedene. */
  readonly referenzen: readonly Referenz[];
  readonly antiMuster: readonly AntiMuster[];
  /**
   * Benchmark des Antagonisten: ein einzelner grosser Kern ohne Router, ohne
   * Werkzeug, ohne Wall, ohne Auge. Wird vor dem Bauen angezeigt.
   */
  readonly monolith?: Werk;
}

/** Position eines Levels im Kishotenketsu-Rhythmus eines Akts. */
export type Levelrolle = 'ki' | 'sho' | 'ten' | 'ketsu';

export function levelrolle(nummer: number): Levelrolle {
  const r = nummer % 4;
  return r === 0 ? 'ki' : r === 1 ? 'sho' : r === 2 ? 'ten' : 'ketsu';
}

export const ROLLEN_ERKLAERUNG: Record<Levelrolle, string> = {
  ki: 'Einfuehrung — das neue Modul isoliert, ohne Stoerfaktoren.',
  sho: 'Verbindung — das neue Modul trifft auf eine bekannte Mechanik.',
  ten: 'Bruch — die Schwaeche des Moduls macht die bisherige Loesung ungueltig.',
  ketsu: 'Synthese — alles zusammen, unter hartem Budget.',
};
