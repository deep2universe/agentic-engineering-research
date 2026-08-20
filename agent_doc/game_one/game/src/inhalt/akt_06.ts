/**
 * AKT VI — DIE PRÜFERIN
 *
 * Neue Mechanik: die Prüferin (Evaluator-Optimizer). Sie schätzt die Güte eines
 * Pakets mit einem Rauschen von sechs Prozentpunkten und schickt alles, was sie
 * unter ihrer Schwelle vermutet, über den Ausgang 'zurueck' in die Nacharbeit —
 * so lange, bis ihre Runden aufgebraucht sind. Das ist der einzige erlaubte
 * Kreis im Werk, der keine Sicherung braucht.
 * Zentrale Lektion: Der Evaluator irrt sich auch.
 *
 * Rhythmus (Kishotenketsu):
 *   VI-0 KI    — die Rückkopplung isoliert: unter einem Modulzähler hebt eine
 *                Schleife die Güte über das, was eine gerade Kette schafft.
 *   VI-1 SHO   — dieselbe Schleife unter dem Tokendeckel und neben der Weiche
 *                aus Akt II: jede Runde ist ein Kernaufruf, den jemand bezahlt.
 *   VI-2 TEN   — Bruch: die Vorgänge werden schwerer, die Decke sinkt unter die
 *                Schwelle von gestern. Die Prüferin merkt es nicht, schickt alles
 *                bis zum Rundenlimit zurück und sprengt den Deckel.
 *   VI-3 KETSU — Synthese: Verteiler, Weiche und Prüferin unter hartem Deckel.
 */

import type { KernGroesse, SammlerModus, Werk, WerkzeugArt } from '../sim/typen';
import type { LevelDefinition } from './level_typen';
import { Bau, leeresFundament, monolith } from './bauhilfe';

const QUELLE = '03_workflow_patterns.md#pattern-5-evaluator-optimizer';
const QUELLE_KETTE = '03_workflow_patterns.md#pattern-1-prompt-chaining';
const QUELLE_MESSEN = '10_observability_evaluation.md';
const QUELLE_PARALLEL = '03_workflow_patterns.md#pattern-3-parallelization';

// ---------------------------------------------------------------------------
// Baukasten dieses Akts
// ---------------------------------------------------------------------------

/**
 * Ein Glied einer Fertigungsstraße. Vier Formen:
 *
 *  - `{ k }`      ein Modell-Kern.
 *  - `{ w }`      ein Werkzeug. Beide Ausgänge führen auf dasselbe nächste
 *                 Glied — der Ausfall wird durchgereicht, wie in Akt III.
 *  - `{ pruef }`  eine Prüferin. 'frei' geht auf das nächste Glied, 'zurueck'
 *                 auf das Glied `zurueck` Positionen davor — das ist der Kreis,
 *                 den dieser Akt einführt.
 *  - `{ tor }`    eine Schranke. 'ok' geht auf das nächste Glied, 'fehler' in
 *                 eine eigene Nachbesserungskette, die danach dort mündet.
 *  - `{ faecher }` ein Verteiler mit gleichartigen Zweigen und einem Sammler.
 */
type Glied =
  | { readonly k: KernGroesse }
  | { readonly w: WerkzeugArt }
  | { readonly pruef: number; readonly runden: number; readonly zurueck: number }
  | { readonly tor: number; readonly reparatur: readonly Glied[] }
  | { readonly faecher: readonly KernGroesse[]; readonly modus: SammlerModus };

function K(k: KernGroesse): Glied {
  return { k };
}

/** Werkzeug ohne Ausfallbehandlung — der Ausfall wird durchgereicht. */
function W(w: WerkzeugArt): Glied {
  return { w };
}

/** Prüferin: Schwelle, Runden, und wie viele Glieder die Nacharbeit zurückgeht. */
function P(pruef: number, runden: number, zurueck = 1): Glied {
  return { pruef, runden, zurueck };
}

/** Schranke mit Nachbesserungskette am Ausgang 'fehler'. */
function TOR(tor: number, reparatur: readonly Glied[]): Glied {
  return { tor, reparatur };
}

/** Verteiler mit gleichartigen Zweigen und Sammler. */
function FAECHER(faecher: readonly KernGroesse[], modus: SammlerModus): Glied {
  return { faecher, modus };
}

/** Vergibt fortlaufend freie Spalten, damit sich nie zwei Module ein Feld teilen. */
class Feld {
  private n = 0;
  next(): number {
    return 2 + this.n++ * 2;
  }
}

/** Legt eine Gliederkette in Zeile `z` ab und verdrahtet sie bis `ziel`. */
function lege(b: Bau, f: Feld, glieder: readonly Glied[], z: number, ziel: string, praefix: string): string {
  if (glieder.length === 0) return ziel;

  // Erst alle Hauptmodule anlegen, damit die Prüferin rückwärts verdrahten kann.
  const ids = glieder.map((g, i) => {
    const x = f.next();
    const id = `${praefix}${i}`;
    if ('k' in g) return b.setze('kern', { groesse: g.k }, id, x, z);
    if ('w' in g) return b.setze('werkzeug', { werkzeugArt: g.w }, id, x, z);
    if ('pruef' in g) return b.setze('pruefer', { schwelle: g.pruef, runden: g.runden }, id, x, z);
    if ('tor' in g) return b.setze('schranke', { schwelle: g.tor }, id, x, z);
    return b.setze('verteiler', { zweige: g.faecher.length }, id, x, z);
  });

  const folge = [...ids, ziel];
  glieder.forEach((g, i) => {
    const von = ids[i]!;
    const nach = folge[i + 1]!;
    if ('k' in g) {
      b.verbinde(von, nach, 'aus');
    } else if ('w' in g) {
      b.verbinde(von, nach, 'ok');
      b.verbinde(von, nach, 'fehler');
    } else if ('pruef' in g) {
      b.verbinde(von, nach, 'frei');
      b.verbinde(von, ids[i - g.zurueck]!, 'zurueck', 'ein');
    } else if ('tor' in g) {
      const rep = lege(b, f, g.reparatur, z + 2, nach, `${praefix}${i}r`);
      b.verbinde(von, nach, 'ok');
      b.verbinde(von, rep, 'fehler');
    } else {
      const sammler = b.setze('sammler', { modus: g.modus }, `${praefix}${i}s`, f.next(), z);
      g.faecher.forEach((gr, j) => {
        const zweig = b.setze('kern', { groesse: gr }, `${praefix}${i}z${j}`, f.next(), z - 2 - j);
        b.verbinde(von, zweig, `z${j + 1}`);
        b.verbinde(zweig, sammler, 'aus');
      });
      b.verbinde(sammler, nach, 'aus');
    }
  });

  return ids[0]!;
}

/** Quelle → Glieder in Reihe → Senke. */
function strasse(glieder: readonly Glied[]): Werk {
  const b = new Bau();
  const f = new Feld();
  const q = b.setze('quelle', {}, 'q', 0, 6);
  const erst = lege(b, f, glieder, 6, 's', 'm');
  b.setze('senke', {}, 's', f.next(), 6);
  b.verbinde(q, erst);
  return b.fertig();
}

/**
 * Quelle → Vorstufe → Weiche (nach Schwierigkeit) → leichter | schwerer Zweig
 * → Senke. Jeder Zweig ist wieder eine Gliederkette.
 */
function verzweigt(
  vor: readonly Glied[],
  schwelle: number,
  leicht: readonly Glied[],
  schwer: readonly Glied[]
): Werk {
  const b = new Bau();
  const f = new Feld();
  const q = b.setze('quelle', {}, 'q', 0, 6);
  const aErst = lege(b, f, leicht, 10, 's', 'a');
  const bErst = lege(b, f, schwer, 16, 's', 'b');
  const vorErst = lege(b, f, vor, 6, 'r', 'v');
  const r = b.setze('weiche', { kriterium: 'schwierigkeit', schwelle }, 'r', f.next(), 6);
  b.setze('senke', {}, 's', f.next(), 6);
  b.verbinde(q, vorErst);
  b.verbinde(r, aErst, 'a');
  b.verbinde(r, bErst, 'b');
  return b.fertig();
}

/**
 * Quelle → Weiche → leichter | schwerer Zweig → EINE gemeinsame Prüferin →
 * Senke. Die Nacharbeit geht in den schweren Zweig zurück. Das ist die
 * "Endabnahme für das ganze Werk": sie beurteilt auch, was längst gut war.
 */
function endpruefung(
  schwelle: number,
  leicht: readonly Glied[],
  schwer: readonly Glied[],
  pruef: number,
  runden: number
): Werk {
  const b = new Bau();
  const f = new Feld();
  const q = b.setze('quelle', {}, 'q', 0, 6);
  const aErst = lege(b, f, leicht, 10, 'p', 'a');
  const bErst = lege(b, f, schwer, 16, 'p', 'b');
  const r = b.setze('weiche', { kriterium: 'schwierigkeit', schwelle }, 'r', f.next(), 6);
  const p = b.setze('pruefer', { schwelle: pruef, runden }, 'p', f.next(), 6);
  const s = b.setze('senke', {}, 's', f.next(), 6);
  b.verbinde(q, r);
  b.verbinde(r, aErst, 'a');
  b.verbinde(r, bErst, 'b');
  b.verbinde(p, s, 'frei');
  b.verbinde(p, bErst, 'zurueck', 'ein');
  return b.fertig();
}

/** Der Vorbau von VI-0: die Prüferin steht schon da, verdrahtet ist nichts. */
function fundamentMitPrueferin(): Werk {
  return {
    module: [
      { id: 'q', art: 'quelle', x: 0, z: 6, param: {} },
      { id: 'p', art: 'pruefer', x: 8, z: 6, param: { schwelle: 0.85, runden: 2 } },
      { id: 's', art: 'senke', x: 16, z: 6, param: {} },
    ],
    leitungen: [],
  };
}

/**
 * Die Referenzlösung aus VI-1. Sie steht hier oben, weil VI-2 sie als
 * Anti-Muster wiederverwendet: dasselbe Werk, ein schwererer Auftragsstrom —
 * und genau daran zeigt sich der Bruch dieses Akts.
 */
const STRASSE_AUS_VI_1: Werk = verzweigt([], 0.45, [K('kolibri'), K('kolibri')], [K('reiher'), P(0.85, 2)]);

// ---------------------------------------------------------------------------
// Die vier Level
// ---------------------------------------------------------------------------

export const AKT_6: LevelDefinition[] = [
  // =========================================================================
  {
    id: 'VI-0',
    akt: 6,
    nummer: 0,
    titel: 'Die zweite Meinung',
    untertitel: 'Vier Felder, mehr nicht',
    briefing:
      'Der Bauantrag für die Erweiterung von Halle 3 liegt beim LAVV und wird dort seit acht Wochen geprüft. Bis er durch ist, bleibt dein Fundament so klein, wie es ist: drei Felder für Module, kein Feld mehr. Die Aufträge sind mittelschwer, die geforderte Güte liegt über dem, was drei Kerne in Reihe herausholen. Neu auf dem Fundament steht die Prüferin. Sie arbeitet nichts nach, sie beurteilt nur — und schickt zurück, was ihr zu dünn erscheint. Ihr Ausgang "zurueck" darf auf einen Kern zeigen, den das Paket schon passiert hat. Das ist der erste Kreis, den du bauen darfst.',
    lernziel:
      'Eine Rückkopplung holt aus wenigen Modulen mehr Güte heraus als dieselbe Anzahl Kerne in Reihe.',
    quelle: QUELLE,
    module: ['kern', 'weiche', 'werkzeug', 'schranke', 'sicherung', 'verteiler', 'sammler', 'pruefer'],
    strom: {
      anzahl: 28,
      takt: 6,
      domaenen: ['recht', 'analyse'],
      schwierigkeit: [0.3, 0.7],
      mehrdeutigkeit: [0.08, 0.28],
    },
    budget: { module: 3, dauer: 400 },
    ziele: [
      { id: 'alles', metrik: 'durchsatz', vergleich: '>=', wert: 1, text: 'Jeder Auftrag wird ausgeliefert.' },
      { id: 'guete', metrik: 'guete', vergleich: '>=', wert: 0.85, text: 'Mindestgüte 85 Prozent.' },
      {
        id: 'preis',
        metrik: 'kostenJeAuftrag',
        vergleich: '<=',
        wert: 900,
        text: 'Höchstens 900 Token je Auftrag.',
      },
    ],
    saat: 601,
    vorbau: fundamentMitPrueferin(),
    reflexion: 'Deine Schleife hat manche Vorgänge dreimal bearbeitet und andere einmal — woran hat sie das festgemacht?',
    notiz:
      'Sprachnotiz, 12. Mai, 07:05. Ich habe jahrelang Kollegen gebeten, meine Vermerke gegenzulesen. Nicht weil sie es besser konnten. Sondern weil ein zweiter Blick etwas sieht, das der erste schon kennt. Regel: Wer nur einmal hinsieht, sieht einmal.',
    referenzen: [
      {
        name: 'Ein REIHER in der Schleife',
        ansatz:
          'Nur zwei Module: ein mittlerer Kern und eine Prüferin, die ihn bei knapper Schwelle bis zu viermal antreten lässt. Kleinste Fläche, längster Weg.',
        werk: strasse([K('reiher'), P(0.8, 4)]),
      },
      {
        name: 'Zwei REIHER, dann die Schleife',
        ansatz:
          'Zwei feste Durchläufe, danach schickt die Prüferin nur den zweiten Kern erneut an — ein Modul mehr, dafür billiger und schneller.',
        werk: strasse([K('reiher'), K('reiher'), P(0.85, 2)]),
      },
    ],
    antiMuster: [
      {
        name: 'Drei REIHER in Reihe',
        verlockung: 'Drei Felder, drei Kerne. Was soll eine Prüferin können, das ein dritter Aufruf nicht kann?',
        scheitertAn: 'guete',
        werk: strasse([K('reiher'), K('reiher'), K('reiher')]),
      },
      {
        name: 'Der KONDOR am Ende',
        verlockung: 'Vorarbeiten lassen und zum Schluss das größte Modell drüberlaufen lassen — das sitzt.',
        scheitertAn: 'kostenJeAuftrag',
        werk: strasse([K('reiher'), K('kondor')]),
      },
      {
        name: 'Prüferin ohne Rückweg',
        verlockung: 'Die Prüferin ist eingebaut, beide Ausgänge sind verdrahtet. Fertig.',
        scheitertAn: 'guete',
        werk: (() => {
          const b = new Bau();
          const q = b.setze('quelle', {}, 'q', 0, 6);
          const k = b.setze('kern', { groesse: 'reiher' }, 'k', 4, 6);
          const p = b.setze('pruefer', { schwelle: 0.85, runden: 2 }, 'p', 8, 6);
          const s = b.setze('senke', {}, 's', 14, 6);
          b.kette(q, k, p);
          b.verbinde(p, s, 'frei');
          b.verbinde(p, s, 'zurueck');
          return b.fertig();
        })(),
      },
    ],
    monolith: monolith(1),
  },

  // =========================================================================
  {
    id: 'VI-1',
    akt: 6,
    nummer: 1,
    titel: 'Jede Runde wird bezahlt',
    untertitel: 'Der Einkauf liest jetzt die Rundenzahl',
    briefing:
      'Der Einkauf hat gelernt, was eine Runde ist. In der Quartalsauswertung steht eine neue Spalte: Nacharbeitsquote. Daneben ein Tokendeckel, der für den ganzen Tag gilt. Über den Eingang laufen kurze Auskünfte und schwere Prüfvorgänge gemischt — und die Prüferin unterscheidet sie nicht, sie sieht nur Güte. Wer alles durch die Schleife schickt, bezahlt für jede Auskunft drei Kernaufrufe und eine Beurteilung. Die Weiche aus Akt II sortiert vorher. Ob du sortierst oder die Runden klein hältst, ist deine Entscheidung; beides zugleich brauchst du nicht.',
    lernziel:
      'Jede Rückkopplungsrunde ist ein zusätzlicher Kernaufruf plus die Beurteilung, die ihn ausgelöst hat.',
    quelle: QUELLE,
    module: ['kern', 'weiche', 'werkzeug', 'schranke', 'sicherung', 'verteiler', 'sammler', 'pruefer'],
    strom: {
      anzahl: 30,
      takt: 5,
      domaenen: ['text', 'recht', 'analyse'],
      schwierigkeit: [0.12, 0.75],
      mehrdeutigkeit: [0.08, 0.3],
    },
    budget: { kosten: 16000, dauer: 500 },
    ziele: [
      { id: 'alles', metrik: 'durchsatz', vergleich: '>=', wert: 1, text: 'Jeder Auftrag wird ausgeliefert.' },
      { id: 'guete', metrik: 'guete', vergleich: '>=', wert: 0.8, text: 'Mindestgüte 80 Prozent.' },
      {
        id: 'meister',
        metrik: 'kostenJeAuftrag',
        vergleich: '<=',
        wert: 420,
        text: 'Meisterstück: höchstens 420 Token je Auftrag.',
        optional: true,
      },
    ],
    saat: 611,
    vorbau: leeresFundament(),
    reflexion: 'Die Weiche schätzt vorher, die Prüferin misst hinterher — welche der beiden würdest du bei mehrdeutigen Aufträgen lieber entscheiden lassen?',
    notiz:
      'Sprachnotiz, 16. Mai. Wir hatten eine Endabnahme, die jeden Vorgang zweimal zurückgab. Sie hat die Qualität gehoben, das stimmt. Sie hat auch zwei Stellen gekostet, die wir nicht mehr besetzen durften. Niemand hat je nachgerechnet, ob sich das getragen hat. Regel: Zähle die Runden, bevor jemand anders sie zählt.',
    referenzen: [
      {
        name: 'Weiche vorn, Schleife im schweren Zweig',
        ansatz:
          'Die leichten Vorgänge nehmen zwei billige Kerne, nur der schwere Zweig bekommt die Rückkopplung — mehr Module, deutlich weniger Token.',
        werk: STRASSE_AUS_VI_1,
      },
      {
        name: 'Eine Schleife für alle',
        ansatz:
          'Keine Sortierung, dafür eine Schleife mit knapp gehaltener Schwelle für jeden Vorgang — zwei Module, dafür der volle Preis für jede Auskunft.',
        werk: strasse([K('reiher'), P(0.8, 2)]),
      },
    ],
    antiMuster: [
      {
        name: 'Sechs Runden für alle',
        verlockung: 'Mehr Runden, mehr Güte. Der Deckel gilt für den Tag, nicht für den einzelnen Vorgang.',
        scheitertAn: 'budget_kosten',
        werk: strasse([K('reiher'), P(0.9, 6)]),
      },
      {
        name: 'Die Prüferin vor dem KONDOR',
        verlockung: 'Erst beurteilen lassen, dann das große Modell ansetzen — so arbeitet nur der Kondor, der es muss.',
        scheitertAn: 'budget_kosten',
        werk: strasse([K('reiher'), P(0.85, 2), K('kondor')]),
      },
      {
        name: 'Zwei KOLIBRI ohne Schleife',
        verlockung: 'Der Deckel ist das Problem, nicht die Güte. Zwei kleine Kerne sind unschlagbar billig.',
        scheitertAn: 'guete',
        werk: strasse([K('kolibri'), K('kolibri')]),
      },
    ],
    monolith: monolith(2),
  },

  // =========================================================================
  {
    id: 'VI-2',
    akt: 6,
    nummer: 2,
    titel: 'Die Decke unter der Schwelle',
    untertitel: 'TROET-Ablösung, Anlage 7',
    briefing:
      'Die Ablösung des Fachverfahrens TROET ist da. Achtzehnhundert Seiten Bestandsdokumentation von 1998, und kein Vorgang darunter ist leicht. Dein Werk von gestern läuft weiter und gibt keinen Fehler aus. Es gibt nur nichts mehr frei: die Prüferin sucht eine Güte, die auf diesen Vorgängen niemand mehr erreicht, und schickt jedes Paket zurück, bis die Runden alle sind. Sie merkt es nicht. Sie kann es nicht merken — sie kennt nur ihre Schwelle, nicht die Decke. Eine Schwelle oberhalb der Decke ist keine Qualitätsanforderung, sondern eine Rechnung ohne Gegenwert.',
    lernziel:
      'Eine Schwelle oberhalb der erreichbaren Decke verwandelt jede Rückkopplung in eine Kostenschleife ohne Ertrag.',
    quelle: QUELLE_MESSEN,
    module: ['kern', 'weiche', 'werkzeug', 'schranke', 'sicherung', 'verteiler', 'sammler', 'pruefer'],
    strom: {
      anzahl: 28,
      takt: 5,
      domaenen: ['recht', 'technik'],
      schwierigkeit: [0.5, 0.88],
      mehrdeutigkeit: [0.1, 0.32],
    },
    budget: { kosten: 22000, dauer: 600 },
    ziele: [
      { id: 'alles', metrik: 'durchsatz', vergleich: '>=', wert: 1, text: 'Jeder Auftrag wird ausgeliefert.' },
      { id: 'guete', metrik: 'guete', vergleich: '>=', wert: 0.78, text: 'Mindestgüte 78 Prozent.' },
      { id: 'zeit', metrik: 'latenzP95', vergleich: '<=', wert: 30, text: 'p95-Latenz höchstens 30 Ticks.' },
    ],
    saat: 621,
    vorbau: leeresFundament(),
    reflexion: 'Deine Prüferin hat gestern bei 85 Prozent freigegeben und heute nie — was hat sich geändert, ihre Schwelle oder deine Aufträge?',
    notiz:
      'Sprachnotiz, 21. Mai, 22:10. Wir hatten eine Qualitätsvorgabe, die vier Jahre lang gegolten hat. Sie stammte aus einem Projekt mit ganz anderen Akten. Niemand hat sie je nachgezogen, weil das Herabsetzen einer Vorgabe wie Aufgeben aussieht. Es kostete uns ein Quartal. Regel: Eine Schwelle ohne Bezug zur Decke ist eine Zahl, die dich auffrisst.',
    referenzen: [
      {
        name: 'Die gesenkte Schwelle',
        ansatz:
          'Dieselbe Schleife wie gestern, aber die Schwelle liegt unter der Decke dieser Vorgänge — die Prüferin gibt wieder frei, statt zu mahlen.',
        werk: strasse([K('reiher'), P(0.74, 2)]),
      },
      {
        name: 'Schranke vor der Prüferin',
        ansatz:
          'Zwei feste Durchläufe, dann misst eine Schranke für zwei Token; nur die Durchgefallenen sehen die Prüferin überhaupt.',
        werk: strasse([K('reiher'), K('reiher'), TOR(0.78, [K('reiher'), P(0.8, 1)])]),
      },
    ],
    antiMuster: [
      {
        name: 'Schwelle 0,95 und acht Runden',
        verlockung: 'Wenn die Güte fehlt, hängt man die Schwelle höher und gibt der Prüferin mehr Runden.',
        scheitertAn: 'budget_kosten',
        werk: strasse([K('reiher'), P(0.95, 8)]),
      },
      {
        name: 'Das Werk von gestern',
        verlockung: 'Gestern hat diese Straße den Deckel gehalten. Der Eingang ist derselbe geblieben.',
        scheitertAn: 'budget_kosten',
        werk: STRASSE_AUS_VI_1,
      },
      {
        name: 'Ein KOLIBRI in der Schleife',
        verlockung: 'Wenn jede Runde Geld kostet, nimm für die Runden den billigsten Kern.',
        scheitertAn: 'guete',
        werk: strasse([K('kolibri'), P(0.7, 3)]),
      },
    ],
    monolith: monolith(2),
  },

  // =========================================================================
  {
    id: 'VI-3',
    akt: 6,
    nummer: 3,
    titel: 'Drei Entwürfe und ein Urteil',
    untertitel: 'Mittwoch, Vergabekammer, Frist am Freitag',
    briefing:
      'Die Vergabekammer hat Fragen zu einem Verfahren, das seit zwei Jahren läuft, und will bis Freitag Antworten. Über den Eingang kommt alles gemischt: knappe Auskünfte, Kalkulationen, Prüfvermerke. Du hast jetzt alles im Kasten. Der Verteiler lässt mehrere Entwürfe nebeneinander entstehen und kostet Zeit nur einmal, die Weiche sortiert vorher, die Prüferin urteilt hinterher. Der Deckel gilt für den ganzen Tag. Drei Entwürfe für eine Auskunft sind Verschwendung, ein einziger für einen Prüfvermerk ist zu wenig — und eine Prüferin hinter allem beurteilt auch das, was längst gut war.',
    lernziel:
      'Parallelisierung, Sortierung und Rückkopplung greifen erst ineinander, wenn jede von ihnen nur den Teil des Stroms bekommt, für den sie sich lohnt.',
    quelle: QUELLE_PARALLEL,
    module: ['kern', 'weiche', 'werkzeug', 'schranke', 'sicherung', 'verteiler', 'sammler', 'pruefer'],
    strom: {
      anzahl: 32,
      takt: 4,
      domaenen: ['recht', 'finanz', 'analyse', 'text'],
      schwierigkeit: [0.08, 0.95],
      mehrdeutigkeit: [0.1, 0.35],
      anteilRechnerisch: 0.4,
    },
    budget: { kosten: 21000, dauer: 700 },
    ziele: [
      { id: 'alles', metrik: 'durchsatz', vergleich: '>=', wert: 1, text: 'Jeder Auftrag wird ausgeliefert.' },
      { id: 'guete', metrik: 'guete', vergleich: '>=', wert: 0.8, text: 'Mindestgüte 80 Prozent.' },
      {
        id: 'meister',
        metrik: 'latenzP95',
        vergleich: '<=',
        wert: 20,
        text: 'Meisterstück: p95-Latenz höchstens 20 Ticks.',
        optional: true,
      },
    ],
    saat: 631,
    vorbau: leeresFundament(),
    reflexion: 'Du hast drei Stellen gebaut, an denen ein Vorgang anders behandelt wird als sein Nachbar — welche davon würdest du zuerst wieder ausbauen?',
    notiz:
      'Sprachnotiz, 27. Mai. Am Ende meiner Zeit hatte Halle 3 vierzehn Module. Neun davon hätte ich verteidigen können. Die anderen fünf standen da, weil sie einmal jemand gebraucht hatte und niemand sie abbauen wollte. Regel: Jedes Modul, das du nicht begründen kannst, gehört dem, der es gebaut hat, und nicht dem Werk.',
    referenzen: [
      {
        name: 'Weiche, Rechenwerk und eine Schleife hinten',
        ansatz:
          'Die leichten Vorgänge nehmen einen billigen Kern, die schweren einen mittleren mit Rückkopplung — schmal, günstig, viele Module.',
        werk: verzweigt(
          [{ k: 'kolibri' }],
          0.45,
          [K('kolibri')],
          [K('reiher'), P(0.82, 2)]
        ),
      },
      {
        name: 'Drei Entwürfe, ein Urteil',
        ansatz:
          'Ein Verteiler lässt drei Kerne nebeneinander arbeiten, der Sammler nimmt den besten, die Prüferin entscheidet über die Nacharbeit — wenige Schritte, hoher Preis.',
        werk: strasse([FAECHER(['kolibri', 'kolibri', 'reiher'], 'bester'), K('reiher'), P(0.82, 1)]),
      },
    ],
    antiMuster: [
      {
        name: 'Drei Entwürfe für jeden',
        verlockung: 'Wenn drei Entwürfe für Prüfvermerke gut sind, sind sie für Auskünfte auch nicht schlecht.',
        scheitertAn: 'budget_kosten',
        werk: strasse([FAECHER(['reiher', 'reiher', 'reiher'], 'verschmelzen'), K('reiher'), P(0.85, 2)]),
      },
      {
        name: 'Prüferin hinter allem',
        verlockung: 'Eine Endabnahme für das ganze Werk ist übersichtlicher als drei kleine.',
        scheitertAn: 'budget_kosten',
        werk: endpruefung(0.45, [K('kolibri')], [K('reiher')], 0.9, 3),
      },
      {
        name: 'Ein KONDOR für alles',
        verlockung: 'Vor einer Frist nimmt man das größte Modell und spart sich die Architektur.',
        scheitertAn: 'budget_kosten',
        werk: strasse([K('kondor')]),
      },
    ],
    monolith: monolith(3),
  },
];
