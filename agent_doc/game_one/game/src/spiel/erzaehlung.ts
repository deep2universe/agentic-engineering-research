/**
 * Erzählregie: entscheidet, WANN welcher Text erscheint.
 *
 * Die Texte selbst stehen in `src/narrativ/`. Diese Datei kennt keinen einzigen
 * Satz — sie kennt nur den Spielstand und die Regeln, nach denen sich die fünf
 * Erzählkanäle abwechseln:
 *
 *  1. **Kalter Einstieg** — einmal je Akt, beim ersten Level des Akts, VOR dem
 *     Auftrag. Er beschreibt, was zu sehen ist, und erklärt nichts.
 *  2. **MONOLITHs Angebot** — im Auftrag, direkt neben seinen Kennzahlen. Es
 *     ist bequem, es ist plausibel, und es ist falsch. Genau deshalb steht es
 *     dort, wo die Zahlen stehen.
 *  3. **Schlusssatz** — einmal je Akt, nach dem letzten bestandenen Level.
 *  4. **Fundstücke** — jederzeit, freiwillig, ohne Belohnung.
 *  5. **Rätsel** — als offene Frage im Auftrag, als Auflösung beim Aktwechsel.
 *
 * Die harte Regel: **Erzählung blockiert nie zweimal dieselbe Stelle.** Jeder
 * Akt zeigt seinen Einstieg genau einmal, auch wenn ein Level zehnmal
 * wiederholt wird. Wer ein Level noch einmal baut, will bauen, nicht lesen.
 */

import { aktText, type AktText } from '../narrativ/akt_texte';
import { FUNDSTUECKE, fundstueckeBisAkt, type Fundstueck } from '../narrativ/fundstuecke';
import { aufgeloesteRaetsel, offeneRaetsel, type Raetsel } from '../narrativ/raetsel';

/** Was die Erzählregie beim Betreten eines Levels anzeigen möchte. */
export interface Auftritt {
  /** Der kalte Einstieg dieses Akts, falls er noch nicht lief. */
  readonly einstieg: AktText | null;
  /** Rätsel, die in diesem Akt aufgelöst werden und vorher offen waren. */
  readonly aufloesungen: readonly Raetsel[];
}

export class Erzaehlung {
  private readonly gezeigteEinstiege = new Set<number>();
  private readonly gezeigteAufloesungen = new Set<string>();
  private readonly gelesen = new Set<string>();

  /**
   * Meldet den Eintritt in ein Level und liefert, was einmalig zu zeigen ist.
   *
   * Der Aufrufer entscheidet, ob er es zeigt; die Regie merkt sich in jedem
   * Fall, dass es dran war. Das ist Absicht: ein Einstieg, den jemand
   * weggeklickt hat, ist gezeigt worden.
   */
  betritt(akt: number): Auftritt {
    const einstieg = this.gezeigteEinstiege.has(akt) ? null : aktText(akt);
    this.gezeigteEinstiege.add(akt);

    const aufloesungen = aufgeloesteRaetsel(akt).filter((r) => !this.gezeigteAufloesungen.has(r.id));
    for (const r of aufloesungen) this.gezeigteAufloesungen.add(r.id);

    return { einstieg, aufloesungen };
  }

  /** Die Fragen, die in diesem Akt in der Luft hängen. Höchstens drei. */
  offeneFragen(akt: number): readonly Raetsel[] {
    return offeneRaetsel(akt).slice(0, 3);
  }

  /** MONOLITHs Angebot und der Schlusssatz zu einem Akt. */
  text(akt: number): AktText {
    return aktText(akt);
  }

  /** Alles, was in diesem Akt in der Halle liegt — für die Bestückung. */
  fundstuecke(akt: number): readonly Fundstueck[] {
    return fundstueckeBisAkt(akt);
  }

  fundstueck(id: string): Fundstueck | null {
    return FUNDSTUECKE.find((f) => f.id === id) ?? null;
  }

  markiereGelesen(id: string): void {
    this.gelesen.add(id);
  }

  istGelesen(id: string): boolean {
    return this.gelesen.has(id);
  }

  /**
   * Wie viel der Umgebungserzählung eines Akts gelesen wurde.
   *
   * Das ist ausdrücklich KEIN Fortschritt, der irgendetwas freischaltet — es
   * ist eine Zeile für Leute, die wissen wollen, ob sie etwas übersehen haben.
   */
  leseStand(akt: number): { gelesen: number; gesamt: number } {
    const alle = fundstueckeBisAkt(akt);
    let n = 0;
    for (const f of alle) if (this.gelesen.has(f.id)) n++;
    return { gelesen: n, gesamt: alle.length };
  }

  /** Für Spielstände und Tests. */
  zustand(): { einstiege: number[]; aufloesungen: string[]; gelesen: string[] } {
    return {
      einstiege: [...this.gezeigteEinstiege].sort((a, b) => a - b),
      aufloesungen: [...this.gezeigteAufloesungen].sort(),
      gelesen: [...this.gelesen].sort(),
    };
  }

  ladeZustand(z: { einstiege?: readonly number[]; aufloesungen?: readonly string[]; gelesen?: readonly string[] }): void {
    this.gezeigteEinstiege.clear();
    this.gezeigteAufloesungen.clear();
    this.gelesen.clear();
    for (const a of z.einstiege ?? []) this.gezeigteEinstiege.add(a);
    for (const r of z.aufloesungen ?? []) this.gezeigteAufloesungen.add(r);
    for (const f of z.gelesen ?? []) this.gelesen.add(f);
  }
}
