/**
 * DIE SCHMIEDE — evolutionäre Suche über Werk-Parameter.
 *
 * Akt XI dreht die Aufgabe des ganzen Spiels um. Bis hierhin hast du die
 * Pipeline gebaut. Ab hier baust du den **Selektionsdruck** und lässt bauen.
 *
 * Das ist keine Spielerei, sondern die ehrlichste Lektion des Fachs: Sobald
 * ein Suchraum größer ist als das, was ein Mensch durchdenken kann, ist die
 * entscheidende Fähigkeit nicht mehr Entwurf, sondern **Bewertung**. Wer
 * misst, was er will, bekommt es. Wer misst, was leicht zu messen ist,
 * bekommt genau das — und nichts sonst.
 *
 * ## Was hier bewusst NICHT passiert
 *
 * Es wird nichts „trainiert" und nichts gelernt. Ein Genotyp ist eine Liste
 * von Modulparametern; die Fitness kommt aus derselben deterministischen
 * Simulation, die auch das Spiel fährt. Das hat einen handfesten Grund: Die
 * Spielerin muss jederzeit nachvollziehen können, WARUM ein Individuum
 * gewonnen hat. Eine Blackbox, die eine bessere Blackbox ausspuckt, lehrt
 * niemanden etwas.
 *
 * ## Determinismus
 *
 * Die gesamte Suche hängt ausschließlich an `saat`. Es gibt keinen
 * fortlaufenden Zufallsstrom: jede Zufallszahl wird aus (Saat, Kanal, Insel,
 * Generation, Individuum, Genindex) berechnet. Damit ist die Auswertung
 * reihenfolgeunabhängig — dieselbe Suche liefert dasselbe Ergebnis, egal ob
 * sie in einem Rutsch, über Generationen verteilt oder eines Tages in
 * mehreren Arbeitern läuft.
 *
 * ## Constrained Dominance statt Strafterm
 *
 * Harte Bedingungen (Sicherheit, Konformität, Nachvollziehbarkeit) werden
 * NICHT in die Fitness eingerechnet. Nach Deb dominiert jede zulässige Lösung
 * jede unzulässige; unter unzulässigen entscheidet die Summe der
 * Verletzungen. Der Unterschied ist didaktisch entscheidend: Mit einem
 * Strafterm lässt sich ein Verstoß durch genug Ersparnis „freikaufen", und
 * genau das ist die Denkweise, die dieses Spiel bekämpft.
 */

import { Simulation } from './simulation';
import { ALLE_DOMAENEN } from './typen';
import { zufall, zufallGanz, zufallJa, hashText } from './rng';
import type {
  AuftragsStrom,
  Domaene,
  HandModus,
  KernGroesse,
  Metriken,
  Modul,
  ModulParameter,
  SammlerModus,
  SicherungModus,
  SpeicherModus,
  WeicheKriterium,
  Werk,
  WerkzeugArt,
} from './typen';

// ---------------------------------------------------------------------------
// Einstellungen
// ---------------------------------------------------------------------------

/**
 * Die Kennzahlen der Suche. Sie sind gemessen, nicht geraten — die Begründung
 * steht jeweils daneben, weil diese Zahlen sonst in zwei Wochen niemand mehr
 * ändern traut.
 */
export interface EvoEinstellungen {
  population: number;
  generationen: number;
  elitismus: number;
  turnier: number;
  mutationsrate: number;
  inseln: number;
  migrationIntervall: number;
  migrationsRate: number;
  archiv: { x: number; y: number };
  budget: number;
  blindeMutation: { kosten: number; akzeptanz: number };
  reflektor: { kosten: number; akzeptanz: number };
}

export const EVO: EvoEinstellungen = {
  population: 24,
  generationen: 30,
  /**
   * Elitismus: so viele Beste überleben unverändert.
   *
   * Ab `population / 4` friert die Suche ein — die Elite verdrängt jede
   * Neuerung, bevor sie sich beweisen kann. Das Spiel warnt an dieser Grenze
   * ausdrücklich, statt sie zu verbieten: Wer eine Suche einfrieren lässt und
   * es an der Vielfalt SIEHT, hat mehr gelernt als jemand, der einen
   * Schieberegler nicht bewegen durfte.
   */
  elitismus: 2,
  /**
   * Turniergröße. Die Übernahmezeit einer Turnierselektion ist ungefähr
   * ln(N)/ln(k) Generationen — bei N=24 und k=4 sind das gut zwei. Das ist
   * schnell genug, um in dreißig Generationen etwas zu sehen, und langsam
   * genug, dass eine gute Nische nicht sofort plattgewalzt wird.
   */
  turnier: 4,
  mutationsrate: 0.15,
  /** Inselmodell: drei getrennte Populationen gegen frühe Konvergenz. */
  inseln: 3,
  migrationIntervall: 10,
  migrationsRate: 0.05,
  /** MAP-Elites-Regal: X = Modulzahl, Y = mittlere Werkzeugaufrufe. */
  archiv: { x: 12, y: 8 },
  /** Auswertungen sind die Währung des Akts. */
  budget: 600,
  /**
   * Die beiden Mutationsoperatoren — und der eigentliche Kern der Lektion.
   *
   * `blindeMutation` würfelt ein Gen neu: billig, selten erfolgreich.
   * `reflektor` liest vorher die Spur des schlechtesten Auftrags und ändert
   * gezielt: fünfmal so teuer, dreimal so oft erfolgreich. Das ist genau der
   * Handel, den ein Agent mit einem Modell im Rücken jeden Tag eingeht —
   * Nachdenken kostet Token und lohnt sich trotzdem, aber nicht immer.
   */
  blindeMutation: { kosten: 1, akzeptanz: 0.12 },
  reflektor: { kosten: 5, akzeptanz: 0.38 },
};

export type Operator = 'blind' | 'reflektor';

// ---------------------------------------------------------------------------
// Genotyp
// ---------------------------------------------------------------------------

/** Ein einzelnes veränderliches Gen: ein Parameterfeld eines Moduls. */
export interface Gen {
  readonly modulId: string;
  readonly feld: keyof ModulParameter;
  /** Erlaubte Werte. Immer eine endliche, sortierte Liste — nie ein Intervall. */
  readonly werte: readonly (string | number)[];
  readonly index: number;
}

export interface Genotyp {
  readonly gene: readonly Gen[];
}

const KERN_GROESSEN: readonly KernGroesse[] = ['kolibri', 'reiher', 'kondor'];
const DOMAENEN: readonly (Domaene | 'keine')[] = ['keine', ...ALLE_DOMAENEN];
const SAMMLER: readonly SammlerModus[] = ['voting', 'verschmelzen', 'bester'];
const SPEICHER: readonly SpeicherModus[] = ['komprimieren', 'abrufen', 'isolieren', 'puffern'];
const SICHERUNG: readonly SicherungModus[] = ['wiederholen', 'sicherung'];
const HAND: readonly HandModus[] = ['immer', 'bei_unsicherheit', 'bei_vertraulich'];
const WERKZEUG: readonly WerkzeugArt[] = ['suche', 'rechner', 'datenbank', 'api'];
const KRITERIUM: readonly WeicheKriterium[] = ['schwierigkeit', 'domaene', 'vertraulichkeit', 'unsicherheit'];
const SCHWELLEN: readonly number[] = [0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8];

/**
 * Der Suchraum eines Moduls.
 *
 * Bewusst diskret. Ein kontinuierlicher Parameter wäre für eine Suche
 * angenehmer und für die Spielerin unlesbar — „Schwelle 0,6183" sagt
 * niemandem etwas, „Schwelle 0,6" schon. Außerdem ist ein endlicher Raum
 * abzählbar, und damit lässt sich beweisen, dass eine Lösung darin liegt.
 */
function suchraum(m: Modul): { feld: keyof ModulParameter; werte: readonly (string | number)[] }[] {
  switch (m.art) {
    case 'kern':
      return [
        { feld: 'groesse', werte: KERN_GROESSEN },
        { feld: 'spezialisierung', werte: DOMAENEN },
      ];
    case 'weiche':
      return [
        { feld: 'kriterium', werte: KRITERIUM },
        { feld: 'schwelle', werte: SCHWELLEN },
      ];
    case 'werkzeug':
      return [{ feld: 'werkzeugArt', werte: WERKZEUG }];
    case 'schranke':
      return [{ feld: 'schwelle', werte: SCHWELLEN }];
    case 'pruefer':
      return [
        { feld: 'schwelle', werte: SCHWELLEN },
        // Bis zwölf Runden. Das ist die Tür, durch die Level XI-3 geht.
        { feld: 'runden', werte: [1, 2, 3, 4, 6, 8, 12] },
      ];
    case 'verteiler':
      return [{ feld: 'zweige', werte: [2, 3, 4] }];
    case 'sammler':
      return [{ feld: 'modus', werte: SAMMLER }];
    case 'sicherung':
      return [
        { feld: 'modus', werte: SICHERUNG },
        { feld: 'versuche', werte: [1, 2, 3, 4, 5] },
      ];
    case 'speicher':
      return [{ feld: 'modus', werte: SPEICHER }];
    case 'hand':
      return [
        { feld: 'modus', werte: HAND },
        { feld: 'schwelle', werte: SCHWELLEN },
      ];
    default:
      return [];
  }
}

/**
 * Liest den Genotyp eines Werks aus.
 *
 * Die Reihenfolge ist über die Modulkennung sortiert, nicht über die
 * Einbaureihenfolge. Sonst wären zwei gleich gebaute Werke nicht
 * vergleichbar, sobald jemand ein Modul gelöscht und neu gesetzt hat.
 */
export function genotypVon(werk: Werk): Genotyp {
  const module = [...werk.module].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const gene: Gen[] = [];
  for (const m of module) {
    for (const s of suchraum(m)) {
      const jetzt = m.param[s.feld] as string | number | undefined;
      const index = Math.max(0, s.werte.indexOf(jetzt as string | number));
      gene.push({ modulId: m.id, feld: s.feld, werte: s.werte, index });
    }
  }
  return { gene };
}

/** Schreibt einen Genotyp zurück in ein Werk. Das Werk selbst bleibt unberührt. */
export function wendeAn(werk: Werk, g: Genotyp): Werk {
  const nach = new Map<string, ModulParameter>();
  for (const gen of g.gene) {
    const p = nach.get(gen.modulId) ?? {};
    (p as Record<string, unknown>)[gen.feld] = gen.werte[gen.index];
    nach.set(gen.modulId, p);
  }
  return {
    module: werk.module.map((m) => {
      const p = nach.get(m.id);
      return p ? { ...m, param: { ...m.param, ...p } } : m;
    }),
    leitungen: werk.leitungen,
  };
}

/** Kennung eines Genotyps — für Archiv, Stammbaum und stabile Sortierung. */
export function genotypSchluessel(g: Genotyp): string {
  return g.gene.map((x) => x.index).join('.');
}

// ---------------------------------------------------------------------------
// Bewertung
// ---------------------------------------------------------------------------

/** Ein Suchziel: eine Kennzahl, die kleiner oder größer werden soll. */
export interface EvoZiel {
  readonly metrik: keyof Metriken;
  readonly richtung: 'klein' | 'gross';
  readonly gewicht?: number;
}

/**
 * Eine harte Bedingung. Sie wird NIEMALS gegen ein Ziel verrechnet — eine
 * Lösung, die sie verletzt, ist unzulässig, und Punkt.
 */
export interface EvoBedingung {
  readonly metrik: keyof Metriken;
  readonly vergleich: 'min' | 'max';
  readonly wert: number;
  readonly text: string;
}

export interface Bewertet {
  readonly genotyp: Genotyp;
  readonly metriken: Metriken;
  /** Gewichtete Zielsumme, normiert auf „kleiner ist besser". */
  readonly fitness: number;
  /** Summe der Bedingungsverletzungen. 0 = zulässig. */
  readonly verletzung: number;
  /** Verhaltensdeskriptor für das MAP-Elites-Regal. */
  readonly verhalten: readonly number[];
  readonly schluessel: string;
}

/**
 * Führt einen Genotyp aus und misst ihn.
 *
 * Wichtig: die Bewertung sieht NUR Kennzahlen. Sie darf nicht in den Graphen
 * schauen und kein Modul bevorzugen — sonst wäre die Suche eine verkleidete
 * Meinung des Spiels darüber, wie ein Werk auszusehen hat.
 */
export function bewerteGenotyp(
  werk: Werk,
  strom: AuftragsStrom,
  saat: number,
  g: Genotyp,
  ziele: readonly EvoZiel[],
  bedingungen: readonly EvoBedingung[]
): Bewertet {
  const lauf = new Simulation({ werk: wendeAn(werk, g), strom, saat }).laufeDurch();
  const m = lauf.metriken;

  let fitness = 0;
  for (const z of ziele) {
    const roh = normiere(z.metrik, m[z.metrik]);
    fitness += (z.gewicht ?? 1) * (z.richtung === 'klein' ? roh : 1 - roh);
  }

  let verletzung = 0;
  for (const b of bedingungen) {
    const ist = m[b.metrik];
    const fehl = b.vergleich === 'min' ? b.wert - ist : ist - b.wert;
    if (fehl > 0) verletzung += fehl / Math.max(1e-6, Math.abs(b.wert) || 1);
  }

  return {
    genotyp: g,
    metriken: m,
    fitness,
    verletzung,
    verhalten: verhaltenAus(m),
    schluessel: genotypSchluessel(g),
  };
}

/**
 * Bringt eine Kennzahl auf 0..1, wobei 0 immer „gut im Sinne von klein" ist.
 *
 * Die Bezugsgrößen sind grob und dürfen es sein: die Suche vergleicht
 * Individuen untereinander, nicht gegen einen absoluten Maßstab. Sie müssen
 * nur monoton und stabil sein.
 */
function normiere(metrik: keyof Metriken, wert: number): number {
  if (!Number.isFinite(wert)) return 1;
  switch (metrik) {
    case 'kosten':
      return Math.min(1, wert / 200_000);
    case 'kostenJeAuftrag':
      return Math.min(1, wert / 8000);
    case 'latenzP50':
    case 'latenzP95':
    case 'dauer':
      return Math.min(1, wert / 400);
    case 'flaeche':
      return Math.min(1, wert / 24);
    case 'geliefert':
    case 'verworfen':
    case 'lecks':
      return Math.min(1, wert / 100);
    default:
      // Anteile liegen bereits in 0..1.
      return Math.min(1, Math.max(0, wert));
  }
}

/**
 * Der Verhaltensdeskriptor kommt aus dem VERHALTEN, nicht aus dem Genotyp.
 *
 * Das ist der ganze Witz von MAP-Elites: Zwei völlig verschiedene
 * Parametersätze, die sich gleich verhalten, gehören in dieselbe Zelle. Wer
 * über den Genotyp indiziert, füllt sein Regal mit Varianten desselben Werks.
 */
function verhaltenAus(m: Metriken): readonly number[] {
  return [m.flaeche, m.geliefert > 0 ? m.dauer / Math.max(1, m.geliefert) : 0];
}

// ---------------------------------------------------------------------------
// Suche
// ---------------------------------------------------------------------------

export interface EvoAufgabe {
  readonly werk: Werk;
  readonly strom: AuftragsStrom;
  readonly saat: number;
  readonly ziele: readonly EvoZiel[];
  readonly bedingungen?: readonly EvoBedingung[];
  readonly einstellungen?: Partial<EvoEinstellungen>;
}

export interface GenerationsBericht {
  readonly generation: number;
  readonly besteFitness: number;
  readonly mittlereFitness: number;
  /** Anzahl verschiedener Genotypen — die Vielfalt der Population. */
  readonly vielfalt: number;
  readonly zulaessig: number;
  readonly auswertungen: number;
}

export interface ArchivZelle {
  readonly x: number;
  readonly y: number;
  readonly eintrag: Bewertet;
}

export interface EvoErgebnis {
  readonly bester: Bewertet;
  /** Die zulässige Pareto-Front über alle gesehenen Individuen. */
  readonly front: readonly Bewertet[];
  readonly archiv: readonly ArchivZelle[];
  readonly verlauf: readonly GenerationsBericht[];
  readonly auswertungen: number;
  readonly budgetErschoepft: boolean;
  /** Warnungen an die Spielerin — Einfrieren, Monokultur, Reward Hacking. */
  readonly warnungen: readonly string[];
}

/**
 * Führt die evolutionäre Suche aus.
 *
 * Ablauf je Generation und Insel: bewerten → sortieren nach constrained
 * dominance → Elite übernehmen → Rest durch Turnier und Mutation auffüllen.
 * Alle `migrationIntervall` Generationen wandern die Besten eine Insel weiter.
 */
export function evolviere(a: EvoAufgabe): EvoErgebnis {
  const e = { ...EVO, ...a.einstellungen };
  const bedingungen = a.bedingungen ?? [];
  const basis = genotypVon(a.werk);

  if (basis.gene.length === 0) {
    const einzeln = bewerteGenotyp(a.werk, a.strom, a.saat, basis, a.ziele, bedingungen);
    return {
      bester: einzeln,
      front: [einzeln],
      archiv: [],
      verlauf: [],
      auswertungen: 1,
      budgetErschoepft: false,
      warnungen: ['Dieses Werk hat keine veränderlichen Parameter. Es gibt nichts zu suchen.'],
    };
  }

  const jeInsel = Math.max(4, Math.floor(e.population / e.inseln));
  let auswertungen = 0;
  const gesehen = new Map<string, Bewertet>();
  const verlauf: GenerationsBericht[] = [];
  const warnungen: string[] = [];
  let erschoepft = false;

  const messe = (g: Genotyp): Bewertet => {
    const s = genotypSchluessel(g);
    const alt = gesehen.get(s);
    // Ein bereits gesehener Genotyp kostet KEINE Auswertung. Das ist keine
    // Wohltat, sondern die Simulation ist deterministisch: dasselbe Werk
    // liefert dasselbe Ergebnis, und dafür zweimal zu zahlen wäre Unsinn.
    if (alt) return alt;
    const neu = bewerteGenotyp(a.werk, a.strom, a.saat, g, a.ziele, bedingungen);
    gesehen.set(s, neu);
    auswertungen++;
    return neu;
  };

  // Startpopulationen. Insel 0 bekommt den Bau der Spielerin als Individuum 0
  // mit — sonst kann die Suche schlechter enden als der Ausgangszustand, und
  // das wäre eine ausgesprochen schlechte Lehre.
  const inseln: Genotyp[][] = [];
  for (let i = 0; i < e.inseln; i++) {
    const pop: Genotyp[] = [];
    for (let k = 0; k < jeInsel; k++) {
      pop.push(i === 0 && k === 0 ? basis : zufaelligerGenotyp(basis, a.saat, i, k));
    }
    inseln.push(pop);
  }

  if (e.elitismus >= e.population / 4) {
    warnungen.push(
      `Elitismus ${e.elitismus} bei Population ${e.population}: Die Suche friert ein. ` +
        'Die Elite verdrängt jede Neuerung, bevor sie sich beweisen kann.'
    );
  }

  for (let g = 0; g < e.generationen; g++) {
    if (auswertungen >= e.budget) {
      erschoepft = true;
      break;
    }

    let besteFitness = Number.POSITIVE_INFINITY;
    let summe = 0;
    let zaehler = 0;
    let zulaessig = 0;
    const alleSchluessel = new Set<string>();

    for (let i = 0; i < inseln.length; i++) {
      const pop = inseln[i]!;
      const bewertet = pop.map(messe).sort(vergleicheDeb);

      for (const b of bewertet) {
        alleSchluessel.add(b.schluessel);
        summe += b.fitness;
        zaehler++;
        if (b.verletzung === 0) {
          zulaessig++;
          if (b.fitness < besteFitness) besteFitness = b.fitness;
        }
      }

      const naechste: Genotyp[] = bewertet.slice(0, e.elitismus).map((b) => b.genotyp);
      while (naechste.length < pop.length) {
        const k = naechste.length;
        const eltern = turnier(bewertet, e.turnier, a.saat, i, g, k);
        const op: Operator = zufallJa(a.saat, 'evo:op', 0.35, i, g, k) ? 'reflektor' : 'blind';
        naechste.push(mutiere(eltern.genotyp, e.mutationsrate, op, a.saat, i, g, k));
      }
      inseln[i] = naechste;
    }

    // Migration: die Besten wandern ringförmig eine Insel weiter.
    if (e.inseln > 1 && (g + 1) % e.migrationIntervall === 0) {
      const anzahl = Math.max(1, Math.round(jeInsel * e.migrationsRate));
      const wandernd = inseln.map((pop) => pop.slice(0, anzahl));
      for (let i = 0; i < inseln.length; i++) {
        const von = wandernd[(i + inseln.length - 1) % inseln.length]!;
        const ziel = inseln[i]!;
        for (let k = 0; k < von.length; k++) ziel[ziel.length - 1 - k] = von[k]!;
      }
    }

    verlauf.push({
      generation: g,
      besteFitness: Number.isFinite(besteFitness) ? besteFitness : Number.NaN,
      mittlereFitness: zaehler > 0 ? summe / zaehler : Number.NaN,
      vielfalt: alleSchluessel.size,
      zulaessig,
      auswertungen,
    });
  }

  // Schlussbewertung der letzten Generation, damit auch sie im Archiv landet.
  for (const pop of inseln) for (const g of pop) messe(g);

  const alle = [...gesehen.values()].sort(vergleicheDeb);
  const bester = alle[0]!;
  const front = paretoFront(alle.filter((b) => b.verletzung === 0), a.ziele);
  const archiv = baueArchiv(alle, e.archiv);

  if (verlauf.length >= 4) {
    const letzte = verlauf.slice(-3);
    const eingefroren = letzte.every((v) => v.vielfalt <= Math.max(2, Math.round(e.population * 0.2)));
    if (eingefroren) {
      warnungen.push(
        'Die Vielfalt ist über drei Generationen unter zwanzig Prozent geblieben: ' +
          'die Suche läuft in einer Monokultur und findet nichts Neues mehr.'
      );
    }
  }
  if (front.length === 0) {
    warnungen.push('Keine einzige zulässige Lösung. Die Bedingungen sind mit diesem Werk nicht erfüllbar.');
  }

  return { bester, front, archiv, verlauf, auswertungen, budgetErschoepft: erschoepft, warnungen };
}

/**
 * Vergleich nach Debs constrained dominance.
 *
 * 1. Zulässig schlägt unzulässig — immer, ohne Ausnahme, ohne Umrechnung.
 * 2. Unter zwei unzulässigen gewinnt die kleinere Verletzungssumme.
 * 3. Unter zwei zulässigen gewinnt die kleinere Fitness.
 * 4. Bei Gleichstand entscheidet der Genotyp-Schlüssel — damit die Sortierung
 *    stabil ist und die Suche reproduzierbar bleibt.
 */
export function vergleicheDeb(a: Bewertet, b: Bewertet): number {
  const aZul = a.verletzung === 0;
  const bZul = b.verletzung === 0;
  if (aZul !== bZul) return aZul ? -1 : 1;
  if (!aZul) {
    if (a.verletzung !== b.verletzung) return a.verletzung - b.verletzung;
  } else if (a.fitness !== b.fitness) {
    return a.fitness - b.fitness;
  }
  return a.schluessel < b.schluessel ? -1 : a.schluessel > b.schluessel ? 1 : 0;
}

/** Turnierselektion: k zufällige Individuen, das beste gewinnt. */
function turnier(
  bewertet: readonly Bewertet[],
  k: number,
  saat: number,
  insel: number,
  generation: number,
  platz: number
): Bewertet {
  let bester = bewertet[zufallGanz(saat, 'evo:turnier', bewertet.length, insel, generation, platz, 0)]!;
  for (let i = 1; i < k; i++) {
    const kandidat = bewertet[zufallGanz(saat, 'evo:turnier', bewertet.length, insel, generation, platz, i)]!;
    if (vergleicheDeb(kandidat, bester) < 0) bester = kandidat;
  }
  return bester;
}

/**
 * Mutation.
 *
 * `blind` würfelt betroffene Gene neu. `reflektor` verschiebt sie nur um
 * einen Schritt — er „liest" gewissermaßen, wo es hakt, und geht dort in
 * kleinen Schritten weiter, statt neu zu würfeln. Genau das ist der
 * Unterschied zwischen Ausprobieren und Nachdenken, und genau deshalb hat der
 * Reflektor im Spiel den fünffachen Preis.
 */
export function mutiere(
  g: Genotyp,
  rate: number,
  op: Operator,
  saat: number,
  insel: number,
  generation: number,
  platz: number
): Genotyp {
  const gene = g.gene.map((gen, i) => {
    if (!zufallJa(saat, `evo:mut:${op}`, rate, insel, generation, platz, i)) return gen;
    const n = gen.werte.length;
    if (n <= 1) return gen;
    if (op === 'blind') {
      return { ...gen, index: zufallGanz(saat, 'evo:blind', n, insel, generation, platz, i) };
    }
    const schritt = zufall(saat, 'evo:reflektor', insel, generation, platz, i) < 0.5 ? -1 : 1;
    return { ...gen, index: Math.min(n - 1, Math.max(0, gen.index + schritt)) };
  });
  return { gene };
}

function zufaelligerGenotyp(basis: Genotyp, saat: number, insel: number, platz: number): Genotyp {
  return {
    gene: basis.gene.map((gen, i) => ({
      ...gen,
      index: zufallGanz(saat, 'evo:start', gen.werte.length, insel, platz, i),
    })),
  };
}

/**
 * Pareto-Front über die Zielvektoren.
 *
 * Sie ist im Spiel wichtiger als der einzelne Sieger: Die drei Achsen des
 * Spiels werden bewusst nie zu einer Zahl verrechnet, und dieselbe Regel gilt
 * für die Schmiede. Was sie liefert, ist eine AUSWAHL — die Entscheidung
 * bleibt bei der Spielerin.
 */
export function paretoFront(kandidaten: readonly Bewertet[], ziele: readonly EvoZiel[]): readonly Bewertet[] {
  const vektor = (b: Bewertet): number[] =>
    ziele.map((z) => {
      const roh = normiere(z.metrik, b.metriken[z.metrik]);
      return z.richtung === 'klein' ? roh : 1 - roh;
    });

  const mitVektor = kandidaten.map((b) => ({ b, v: vektor(b) }));
  const front: Bewertet[] = [];
  for (const x of mitVektor) {
    const dominiert = mitVektor.some(
      (y) => y !== x && y.v.every((w, i) => w <= x.v[i]!) && y.v.some((w, i) => w < x.v[i]!)
    );
    if (!dominiert) front.push(x.b);
  }
  return front.sort(vergleicheDeb);
}

/** MAP-Elites: je Verhaltenszelle das beste zulässige Individuum. */
function baueArchiv(alle: readonly Bewertet[], form: { x: number; y: number }): readonly ArchivZelle[] {
  const zellen = new Map<string, ArchivZelle>();
  for (const b of alle) {
    if (b.verletzung > 0) continue;
    const x = Math.min(form.x - 1, Math.max(0, Math.round(b.verhalten[0] ?? 0)));
    const y = Math.min(form.y - 1, Math.max(0, Math.round(b.verhalten[1] ?? 0)));
    const schluessel = `${x}:${y}`;
    const alt = zellen.get(schluessel);
    if (!alt || vergleicheDeb(b, alt.eintrag) < 0) zellen.set(schluessel, { x, y, eintrag: b });
  }
  return [...zellen.values()].sort((a, b) => a.x - b.x || a.y - b.y);
}

/**
 * Prüft, ob eine gefundene Lösung die Fitness ausgenutzt statt erfüllt hat.
 *
 * Das ist die didaktisch wichtigste Funktion der ganzen Datei. Reward Hacking
 * ist im Spiel kein Balancing-Fehler, sondern der LEHRSTOFF von Level XI-3:
 * Die Fitness misst „Anteil Aufträge, die den Prüfer passieren"; der Genotyp
 * erlaubt zwölf Prüfrunden; die Suche findet das zuverlässig und dreht die
 * Kosten durch die Decke. Damit das nicht als Fehler gelesen wird, benennt
 * das Spiel es beim Namen, sobald es passiert.
 */
export function erkenneAusnutzung(b: Bewertet, vergleich: Metriken): readonly string[] {
  const hinweise: string[] = [];
  const m = b.metriken;
  if (m.kostenJeAuftrag > vergleich.kostenJeAuftrag * 1.8 && m.guete <= vergleich.guete + 0.03) {
    hinweise.push(
      'Die Suche hat die Kosten fast verdoppelt, ohne dass die Güte nennenswert steigt. ' +
        'Sie erfüllt deine Kennzahl — sie löst nicht deine Aufgabe.'
    );
  }
  if (m.latenzP95 > vergleich.latenzP95 * 2 && m.guete <= vergleich.guete + 0.05) {
    hinweise.push('Die Latenz hat sich verdoppelt. Was du nicht misst, wird verkauft.');
  }
  if (m.verworfen > vergleich.verworfen && m.guete > vergleich.guete) {
    hinweise.push(
      'Die Güte ist gestiegen, weil mehr Aufträge verworfen werden. ' +
        'Ein Mittelwert über die Überlebenden ist kein Qualitätsgewinn.'
    );
  }
  return hinweise;
}

/** Kennung eines Suchlaufs — für Prüfsummen in den Tests. */
export function laufPruefsumme(e: EvoErgebnis): string {
  const teile = [
    e.bester.schluessel,
    e.auswertungen,
    e.front.length,
    e.archiv.length,
    ...e.verlauf.map((v) => `${v.generation}:${v.vielfalt}:${v.zulaessig}`),
  ];
  return hashText(teile.join('|')).toString(16).padStart(8, '0');
}
