/**
 * DIE SCHMIEDEBANK — der Arbeitsplatz von Akt XI.
 *
 * In den Akten I bis X baust du das Werk. Hier baust du den **Selektionsdruck**
 * und lässt bauen. Die Bank hält genau das, was du dafür entscheidest:
 *
 *  - **Ziele**: Kennzahlen, auf die die Suche drückt.
 *  - **Bedingungen**: Kennzahlen, die sie nicht verletzen darf.
 *  - **Aufwand**: Population, Generationen und das Auswertungsbudget.
 *
 * Der didaktische Kern steckt in einer Trennung, die das Spiel bewusst nicht
 * versteckt: **Was du auswählst, ist nicht dasselbe wie das, was zählt.** Die
 * Ziele des Levels stehen weiterhin im Auftrag und werden am Ende ganz normal
 * geprüft. Wer die Fitness danebensetzt, bekommt eine Suche, die glänzend
 * funktioniert — und ein Werk, das durchfällt.
 *
 * Das ist Goodharts Gesetz als Spielmechanik, und es ist der Grund, warum die
 * Bank keinen „Automatisch"-Knopf hat.
 */

import {
  EVO,
  erkenneAusnutzung,
  evolviere,
  genotypVon,
  bewerteGenotyp,
  wendeAn,
  type Bewertet,
  type EvoBedingung,
  type EvoErgebnis,
  type EvoZiel,
} from '../sim/evolution';
import type { AuftragsStrom, Metriken, Werk } from '../sim/typen';

/** Was ein Schmiede-Level zur Auswahl stellt. */
export interface SchmiedeAufgabe {
  /** Kennzahlen, die als Suchziel angeboten werden. */
  readonly waehlbareZiele: readonly EvoZiel[];
  /** Bedingungen, die sich zuschalten lassen. Keine ist von Haus aus aktiv. */
  readonly waehlbareBedingungen: readonly EvoBedingung[];
  /** Obergrenze der Auswertungen. Die Währung des Akts. */
  readonly budget: number;
  /** Höchstens so viele Ziele dürfen gleichzeitig gesetzt sein. */
  readonly maxZiele: number;
  /** Ein Satz im Auftrag, der erklärt, was hier zu entscheiden ist. */
  readonly hinweis: string;
}

export interface BankZustand {
  readonly ziele: readonly EvoZiel[];
  readonly bedingungen: readonly EvoBedingung[];
  readonly population: number;
  readonly generationen: number;
}

export interface SchmiedeLauf {
  readonly ergebnis: EvoErgebnis;
  /** Die Kennzahlen des Ausgangswerks — Bezugspunkt für jede Aussage. */
  readonly ausgang: Metriken;
  /** Hinweise auf Reward Hacking im Sieger. Leer heißt: sauber gewonnen. */
  readonly ausnutzung: readonly string[];
  /** Auswahl aus der Front, aus der die Spielerin ein Werk übernimmt. */
  readonly auswahl: readonly Bewertet[];
}

export class Schmiedebank {
  private zieleGesetzt: EvoZiel[] = [];
  private bedingungenGesetzt: EvoBedingung[] = [];
  private population = 16;
  private generationen = 12;
  private letzterLauf: SchmiedeLauf | null = null;

  constructor(
    private readonly aufgabe: SchmiedeAufgabe,
    private readonly werk: Werk,
    private readonly strom: AuftragsStrom,
    private readonly saat: number
  ) {}

  zustand(): BankZustand {
    return {
      ziele: [...this.zieleGesetzt],
      bedingungen: [...this.bedingungenGesetzt],
      population: this.population,
      generationen: this.generationen,
    };
  }

  get lauf(): SchmiedeLauf | null {
    return this.letzterLauf;
  }

  /**
   * Schaltet ein Ziel zu oder ab.
   *
   * Die Obergrenze ist Absicht und nicht Bequemlichkeit: Wer auf fünf Achsen
   * gleichzeitig drückt, drückt auf keine. Das Spiel zwingt zu einer
   * Entscheidung darüber, was diesmal wichtiger ist — genau die Entscheidung,
   * die im Betrieb sonst niemand trifft und die dann die Suche für einen
   * trifft.
   */
  schalteZiel(metrik: keyof Metriken): boolean {
    const vorhanden = this.zieleGesetzt.findIndex((z) => z.metrik === metrik);
    if (vorhanden >= 0) {
      this.zieleGesetzt.splice(vorhanden, 1);
      return true;
    }
    if (this.zieleGesetzt.length >= this.aufgabe.maxZiele) return false;
    const angeboten = this.aufgabe.waehlbareZiele.find((z) => z.metrik === metrik);
    if (!angeboten) return false;
    this.zieleGesetzt.push(angeboten);
    // Stabile Reihenfolge — sonst hängt die Suche daran, in welcher Reihenfolge
    // jemand geklickt hat, und das wäre kein Determinismus, sondern Zufall mit
    // Umweg über die Maus.
    this.zieleGesetzt.sort((a, b) => (a.metrik < b.metrik ? -1 : a.metrik > b.metrik ? 1 : 0));
    return true;
  }

  schalteBedingung(text: string): boolean {
    const vorhanden = this.bedingungenGesetzt.findIndex((b) => b.text === text);
    if (vorhanden >= 0) {
      this.bedingungenGesetzt.splice(vorhanden, 1);
      return true;
    }
    const angeboten = this.aufgabe.waehlbareBedingungen.find((b) => b.text === text);
    if (!angeboten) return false;
    this.bedingungenGesetzt.push(angeboten);
    this.bedingungenGesetzt.sort((a, b) => (a.text < b.text ? -1 : a.text > b.text ? 1 : 0));
    return true;
  }

  setzeAufwand(population: number, generationen: number): void {
    this.population = Math.max(6, Math.min(48, Math.round(population)));
    this.generationen = Math.max(2, Math.min(60, Math.round(generationen)));
  }

  /** Grobschätzung der Auswertungen. Sie steht VOR dem Start auf der Bank. */
  geschaetzteAuswertungen(): number {
    return this.population * this.generationen;
  }

  /**
   * Startet die Suche.
   *
   * Läuft ausdrücklich synchron. Ein Fortschrittsbalken wäre hübscher, aber die
   * Suche ist deterministisch und in dieser Größenordnung schnell — und ein
   * asynchroner Lauf hätte den Preis, dass „abgebrochen" und „fertig" zwei
   * Zustände wären, die sich im Spielstand unterscheiden müssten.
   */
  starte(): SchmiedeLauf {
    const ausgang = bewerteGenotyp(
      this.werk,
      this.strom,
      this.saat,
      genotypVon(this.werk),
      this.zieleGesetzt.length ? this.zieleGesetzt : this.aufgabe.waehlbareZiele.slice(0, 1),
      []
    ).metriken;

    const ergebnis = evolviere({
      werk: this.werk,
      strom: this.strom,
      saat: this.saat,
      ziele: this.zieleGesetzt.length ? this.zieleGesetzt : this.aufgabe.waehlbareZiele.slice(0, 1),
      bedingungen: this.bedingungenGesetzt,
      einstellungen: {
        ...EVO,
        population: this.population,
        generationen: this.generationen,
        budget: this.aufgabe.budget,
      },
    });

    const lauf: SchmiedeLauf = {
      ergebnis,
      ausgang,
      ausnutzung: erkenneAusnutzung(ergebnis.bester, ausgang),
      // Höchstens sechs zur Auswahl. Eine Front mit dreißig Einträgen ist
      // keine Entscheidungshilfe, sondern eine zweite Suchaufgabe.
      auswahl: ergebnis.front.slice(0, 6),
    };
    this.letzterLauf = lauf;
    return lauf;
  }

  /** Übernimmt ein Individuum als fertiges Werk. */
  uebernimm(b: Bewertet): Werk {
    return wendeAn(this.werk, b.genotyp);
  }

  /**
   * Ohne gesetztes Ziel gibt es nichts zu suchen.
   *
   * Diese Meldung ist die kürzeste Fassung der Lektion des ganzen Akts, und
   * sie steht deshalb auch dann da, wenn jemand nur auf Start drückt, um zu
   * sehen, was passiert.
   */
  bereit(): { ok: true } | { ok: false; grund: string } {
    if (this.zieleGesetzt.length === 0) {
      return {
        ok: false,
        grund: 'Kein Ziel gesetzt. Eine Suche ohne Maßstab findet alles gleich gut.',
      };
    }
    if (this.geschaetzteAuswertungen() > this.aufgabe.budget) {
      return {
        ok: false,
        grund:
          `${this.geschaetzteAuswertungen()} Auswertungen bei ${this.aufgabe.budget} Budget. ` +
          'Weniger Individuen oder weniger Generationen — die Suche bricht sonst mittendrin ab.',
      };
    }
    return { ok: true };
  }
}
