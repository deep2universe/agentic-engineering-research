/**
 * Klangregie: übersetzt Spielgeschehen in Klang.
 *
 * Sie sitzt bewusst zwischen Spiel und Klangwerk, statt beides zu vermischen.
 * Das Klangwerk weiß nichts über Aufträge und Module; das Spiel weiß nichts
 * über Hüllkurven und Busse. Dazwischen steht diese Datei und beantwortet genau
 * eine Frage: *Wie klingt das, was gerade passiert?*
 *
 * Zwei Regeln:
 *
 *  1. **Der Ton startet erst nach einer Nutzergeste.** Jeder Browser verlangt
 *     das, und ein Spiel, das beim Laden Krach macht, wäre ohnehin schlecht
 *     erzogen. Bis dahin bleibt alles still, ohne dass irgendwo ein Fehler
 *     auftritt.
 *  2. **Stille ist der Normalzustand.** Es klingt, was eine Rückmeldung
 *     braucht — nicht jeder Tick. Bei hoher Simulationsgeschwindigkeit fallen
 *     die Einzelklänge weg und nur die Musik trägt die Aktivität.
 */

import { Klangwerk, type Achse, type Klang } from '../audio/klangwerk';
import type { Metriken, SimEreignis } from '../sim/typen';

/** Ab dieser Tempostufe werden Einzelereignisse nicht mehr vertont. */
const TEMPO_STILLE = 12;

export class Klangregie {
  private readonly werk: Klangwerk;
  private gestartet = false;
  private istStumm = false;
  /** Zuletzt vertonter Tick je Klangart — gegen Klangsalat bei vielen Paketen. */
  private readonly zuletzt = new Map<Klang, number>();

  constructor(einstellungen?: { musik?: number; klaenge?: number }) {
    this.werk = new Klangwerk(einstellungen);
  }

  /**
   * Startet die Klangwelt. Muss aus einer Nutzergeste heraus aufgerufen werden.
   * Mehrfachaufrufe sind harmlos; Fehler werden geschluckt, weil ein stummes
   * Spiel besser ist als ein abgestürztes.
   */
  async starte(): Promise<boolean> {
    if (this.gestartet) return true;
    try {
      await this.werk.starte();
      this.gestartet = true;
      return true;
    } catch {
      return false;
    }
  }

  get laeuft(): boolean {
    return this.gestartet && this.werk.laeuft && !this.istStumm;
  }

  get stumm(): boolean {
    return this.istStumm;
  }

  setzeStumm(an: boolean): void {
    this.istStumm = an;
    this.werk.setzeLautstaerke(an ? 0 : 0.7, an ? 0 : 0.85);
  }

  spiele(klang: Klang, staerke = 1): void {
    if (!this.laeuft) return;
    this.werk.spiele(klang, staerke);
  }

  /** Klang an einem Weltort — gedämpft und gepannt nach Entfernung zur Kamera. */
  spieleAmOrt(klang: Klang, ort: { x: number; y: number; z: number }, staerke = 1): void {
    if (!this.laeuft) return;
    this.werk.spieleAmOrt(klang, ort, staerke);
  }

  /** Hörerposition an die Kamera koppeln, damit Klänge aus der Halle kommen. */
  richteHoerer(pos: { x: number; y: number; z: number }, blick: { x: number; y: number; z: number }): void {
    if (!this.laeuft) return;
    this.werk.hoererAn(pos, blick);
  }

  /**
   * Vertont die Ereignisse eines Ticks.
   *
   * Ein Lauf erzeugt schnell Hunderte Ereignisse. Vertont wird deshalb je Art
   * höchstens eines pro Tick — das reicht vollkommen, um zu HÖREN, dass etwas
   * ausgeliefert wurde oder ein Alarm anliegt, ohne dass es prasselt.
   */
  vertoneEreignisse(ereignisse: readonly SimEreignis[], abTick: number, tempo: number): void {
    if (!this.laeuft || tempo >= TEMPO_STILLE) return;
    for (const e of ereignisse) {
      if (e.tick < abTick) continue;
      const klang = this.klangZu(e);
      if (klang === null) continue;
      if (this.zuletzt.get(klang) === e.tick) continue;
      this.zuletzt.set(klang, e.tick);
      this.werk.spiele(klang, e.art === 'alarm' ? 1 : 0.65);
    }
  }

  private klangZu(e: SimEreignis): Klang | null {
    switch (e.art) {
      case 'eintritt':
        return 'paket_eintritt';
      case 'auslieferung':
        return 'paket_auslieferung';
      case 'verworfen':
        return 'paket_verworfen';
      case 'alarm':
        return 'alarm';
      case 'schleife':
        return 'schleife';
      default:
        return null;
    }
  }

  /**
   * Führt die fünf Musikachsen aus dem Spielzustand nach.
   *
   * Das ist der eigentliche Zweck adaptiver Musik: Sie soll das SAGEN, was die
   * Zahlen sagen, nur schneller. Wer eine Sicherheitslücke im Werk hat, hört es
   * an der Gefahrenachse, bevor er die Kennzahl liest.
   */
  fuehreNach(zustand: {
    phase: 'briefing' | 'bauen' | 'simulation' | 'auswertung';
    metriken: Metriken | null;
    fortschritt: number;
    bestanden: boolean | null;
  }): void {
    if (!this.laeuft) return;
    const m = zustand.metriken;
    const setze = (a: Achse, v: number): void => this.werk.setzeAchse(a, Math.max(0, Math.min(1, v)));

    switch (zustand.phase) {
      case 'briefing':
        setze('ruhe', 1);
        setze('aktivitaet', 0);
        setze('spannung', 0.15);
        setze('gefahr', 0);
        setze('erfolg', 0);
        break;
      case 'bauen':
        setze('ruhe', 0.75);
        setze('aktivitaet', 0.15);
        setze('spannung', 0.25 + zustand.fortschritt * 0.2);
        setze('gefahr', 0);
        setze('erfolg', 0);
        break;
      case 'simulation':
        setze('ruhe', 0.15);
        setze('aktivitaet', 0.55 + (m ? Math.min(0.45, m.geliefert / 40) : 0));
        setze('spannung', 0.5 + zustand.fortschritt * 0.35);
        // Gefahr steigt mit Lecks und mit verworfenen Aufträgen.
        setze('gefahr', m ? Math.min(1, m.lecks * 0.34 + (1 - m.sicherheit) * 0.6 + m.verworfen * 0.03) : 0);
        setze('erfolg', m ? m.guete * 0.4 : 0);
        break;
      case 'auswertung':
        setze('ruhe', 0.6);
        setze('aktivitaet', 0.1);
        setze('spannung', 0.1);
        setze('gefahr', zustand.bestanden === false ? 0.4 : 0);
        setze('erfolg', zustand.bestanden === true ? 1 : 0);
        break;
    }
  }

  pausiere(): void {
    if (this.gestartet) this.werk.pausiere();
  }

  fortsetzen(): void {
    if (this.gestartet) this.werk.fortsetzen();
  }

  entsorge(): void {
    this.zuletzt.clear();
    this.werk.entsorge();
    this.gestartet = false;
  }
}
