/**
 * AKT VI — DIE PRÜFERIN
 *
 * Neue Mechanik: die Prüferin (Evaluator-Optimizer). Sie arbeitet nichts nach,
 * sie schätzt nur die Güte eines Pakets — mit einem Rauschen von sechs
 * Prozentpunkten — und schickt über den Ausgang 'zurück' in die Nacharbeit,
 * was sie unter ihrer Schwelle vermutet, so lange, bis ihre Runden aufgebraucht
 * sind. Das ist der einzige Kreis im Werk, der ohne Sicherung erlaubt ist.
 * Zentrale Lektion: Der Evaluator irrt sich auch.
 *
 * Rhythmus (Kishotenketsu):
 *   VI-0 KI    — die Rückkopplung isoliert: unter einem Modulzähler holt eine
 *                Schleife mehr Güte heraus als dieselbe Zahl Kerne in Reihe.
 *   VI-1 SHO   — dieselbe Schleife unter dem Tokendeckel, neben der Weiche aus
 *                Akt II: jede Runde ist ein Kernaufruf, den jemand bezahlt.
 *   VI-2 TEN   — Bruch: die Vorgänge werden schwerer, die erreichbare Decke
 *                sinkt unter die Schwelle von gestern. Die Prüferin merkt es
 *                nicht, schickt jedes Paket bis zum Rundenlimit zurück und
 *                sprengt den Deckel. Die Straße aus VI-1 fällt hier durch.
 *   VI-3 KETSU — Synthese: Werkzeug, Verteiler, Weiche, Schranke und Prüferin
 *                unter hartem Tokendeckel, auf einem Strom von trivial bis
 *                grenzwertig.
 */

import type { KernGroesse, SammlerModus, Werk, WerkzeugArt } from '../sim/typen';
import type { LevelDefinition } from './level_typen';
import { Bau, leeresFundament, monolith } from './bauhilfe';

const QUELLE = '03_workflow_patterns.md#pattern-5-evaluator-optimizer';
const QUELLE_MESSEN = '10_observability_evaluation.md';
const QUELLE_PARALLEL = '03_workflow_patterns.md#pattern-3-parallelization';

// ---------------------------------------------------------------------------
// Baukasten dieses Akts
// ---------------------------------------------------------------------------

/**
 * Ein Glied einer Fertigungsstraße. Fünf Formen:
 *
 *  - `{ k }`       ein Modell-Kern.
 *  - `{ w }`       ein Werkzeug. Beide Ausgänge führen auf dasselbe nächste
 *                  Glied — der Ausfall wird durchgereicht, wie in Akt III.
 *  - `{ pruef }`   eine Prüferin. 'frei' geht auf das nächste Glied, 'zurück'
 *                  auf das Glied `zurueck` Positionen davor. Das ist der Kreis,
 *                  den dieser Akt einführt.
 *  - `{ tor }`     eine Schranke. 'ok' geht auf das nächste Glied, 'fehler' in
 *                  eine eigene Nachbesserungskette, die danach dort mündet.
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
 * → Senke. Jeder Zweig ist wieder eine Gliederkette und darf eigene Schranken,
 * Verteiler und Prüferinnen mitbringen.
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

/** Der Vorbau von VI-0: die Prüferin steht schon da, verdrahtet ist nichts. */
function fundamentMitPrueferin(): Werk {
  return {
    module: [
      { id: 'q', art: 'quelle', x: 0, z: 6, param: {} },
      { id: 'p', art: 'pruefer', x: 8, z: 6, param: { schwelle: 0.8, runden: 2 } },
      { id: 's', art: 'senke', x: 16, z: 6, param: {} },
    ],
    leitungen: [],
  };
}

/**
 * Die erste Referenzlösung aus VI-1. Sie steht hier oben, weil VI-2 sie als
 * Anti-Muster wiederverwendet: dasselbe Werk, ein schwererer Auftragsstrom —
 * und genau daran zeigt sich der Bruch dieses Akts. Die Schwelle 0,85 liegt
 * dort oberhalb dessen, was ein REIHER auf diesen Vorgängen noch erreicht.
 */
const STRASSE_AUS_VI_1: Werk = verzweigt(
  [],
  0.4,
  [K('kolibri'), K('reiher')],
  [K('reiher'), P(0.85, 2)]
);

/** In diesem Akt ist der ganze Kasten bis zur Prüferin freigeschaltet. */
const MODULE = [
  'kern',
  'weiche',
  'werkzeug',
  'schranke',
  'sicherung',
  'verteiler',
  'sammler',
  'pruefer',
] as const;

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
    untertitel: 'Drei Felder, mehr gibt der Bauantrag nicht her',
    briefing:
      'Der Antrag auf Erweiterung von Halle 3 liegt seit acht Wochen beim LAVV. Bis er beschieden ist, bleibt dein Fundament, wie es ist: drei Felder für Module, kein Feld mehr. Die Vorgänge sind mittelschwer, und die geforderte Güte liegt über dem, was drei Kerne in Reihe herausholen. Neu auf dem Fundament steht die Prüferin. Sie arbeitet nichts nach, sie beurteilt nur — und schickt über ihren zweiten Ausgang zurück, was ihr zu dünn erscheint. Dieser Ausgang darf auf einen Kern zeigen, den das Paket schon passiert hat. Es ist der erste Kreis, den du bauen darfst, und er kostet neunzig Token je Urteil.',
    lernziel:
      'Eine Rückkopplung holt aus wenigen Modulen mehr Güte heraus als dieselbe Anzahl Kerne in Reihe.',
    quelle: QUELLE,
    module: [...MODULE],
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
    reflexion:
      'Manche Vorgänge hat deine Schleife dreimal bearbeitet und andere einmal — woran hat sie das festgemacht?',
    notiz:
      'Sprachnotiz, 12. Mai, 07:05. Ich habe jahrelang Kollegen gebeten, meine Vermerke gegenzulesen. Nicht weil sie es besser konnten. Sondern weil ein zweiter Blick etwas sieht, das der erste schon zu kennen glaubt. Regel: Wer nur einmal hinsieht, sieht einmal.',
    referenzen: [
      {
        name: 'Ein REIHER in der Schleife',
        ansatz:
          'Nur zwei Module: ein mittlerer Kern und eine Prüferin mit knapper Schwelle, die ihn bis zu fünfmal antreten lässt. Kleinste Fläche, längster Weg.',
        werk: strasse([K('reiher'), P(0.8, 4)]),
      },
      {
        name: 'Zwei REIHER, dann die Schleife',
        ansatz:
          'Zwei feste Durchläufe, danach schickt die Prüferin nur den zweiten Kern erneut an — ein Modul mehr, dafür halb so viel Wartezeit.',
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
        name: 'Der KONDOR zum Schluss',
        verlockung: 'Billig vorarbeiten lassen und am Ende das größte Modell drüberlaufen lassen — das sitzt.',
        scheitertAn: 'kostenJeAuftrag',
        werk: strasse([K('reiher'), K('kondor')]),
      },
      {
        // Beide Ausgänge sind verdrahtet, der Graph ist gültig — und die
        // Prüferin ist trotzdem nur ein teurer Durchlauferhitzer.
        name: 'Prüferin ohne Rückweg',
        verlockung: 'Die Prüferin ist eingebaut und beide Ausgänge sind verdrahtet. Damit ist sie doch angeschlossen.',
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
    untertitel: 'Der Einkauf liest jetzt die Nacharbeitsquote',
    briefing:
      'Der Einkauf hat gelernt, was eine Runde ist. In der Quartalsauswertung steht eine neue Spalte, und daneben ein Tokendeckel, der für den ganzen Tag gilt, nicht für den einzelnen Vorgang. Über den Eingang laufen kurze Auskünfte und schwere Prüfvorgänge gemischt. Die Prüferin unterscheidet sie nicht: sie sieht Güte, sonst nichts, und eine dünne Auskunft schickt sie ebenso zurück wie einen halbfertigen Vermerk. Du kannst vorher sortieren, wie in Akt II, oder du hältst die Runden klein und bezahlst dafür jeden Vorgang gleich. Beides zusammen brauchst du nicht.',
    lernziel:
      'Jede Rückkopplungsrunde kostet einen Kernaufruf plus die Beurteilung, die ihn ausgelöst hat.',
    quelle: QUELLE,
    module: [...MODULE],
    strom: {
      anzahl: 30,
      takt: 5,
      domaenen: ['text', 'recht', 'analyse'],
      schwierigkeit: [0.12, 0.75],
      mehrdeutigkeit: [0.08, 0.3],
    },
    budget: { kosten: 23000, dauer: 500 },
    ziele: [
      { id: 'alles', metrik: 'durchsatz', vergleich: '>=', wert: 1, text: 'Jeder Auftrag wird ausgeliefert.' },
      { id: 'guete', metrik: 'guete', vergleich: '>=', wert: 0.81, text: 'Mindestgüte 81 Prozent.' },
      {
        id: 'meister',
        metrik: 'kostenJeAuftrag',
        vergleich: '<=',
        wert: 480,
        text: 'Meisterstück: höchstens 480 Token je Auftrag.',
        optional: true,
      },
    ],
    saat: 611,
    vorbau: leeresFundament(),
    reflexion:
      'Die Weiche schätzt vorher, die Prüferin misst hinterher — welcher der beiden würdest du einen mehrdeutigen Auftrag lieber vorlegen?',
    notiz:
      'Sprachnotiz, 16. Mai. Wir hatten eine Endabnahme, die jeden Vorgang zweimal zurückgab. Sie hat die Qualität gehoben, das stimmt. Sie hat auch zwei Stellen gekostet, die wir danach nicht mehr besetzen durften. Nachgerechnet hat es nie jemand. Regel: Zähle die Runden, bevor der Einkauf sie zählt.',
    referenzen: [
      {
        name: 'Weiche vorn, Schleife im schweren Zweig',
        ansatz:
          'Die leichten Vorgänge nehmen einen kleinen und einen mittleren Kern, nur der schwere Zweig bekommt die Rückkopplung — fünf Module, dafür ein Drittel weniger Token je Auftrag.',
        werk: STRASSE_AUS_VI_1,
      },
      {
        name: 'Eine Schleife für alle',
        ansatz:
          'Keine Sortierung, dafür eine Schleife mit knapp gehaltener Schwelle für jeden Vorgang — zwei Module, dafür der volle Preis auch für jede Auskunft.',
        werk: strasse([K('reiher'), P(0.8, 2)]),
      },
    ],
    antiMuster: [
      {
        name: 'Sechs Runden für alle',
        verlockung: 'Mehr Runden, mehr Güte. Der Deckel gilt für den Tag, da ist Luft.',
        scheitertAn: 'budget_kosten',
        werk: strasse([K('reiher'), P(0.9, 6)]),
      },
      {
        name: 'Die Prüferin vor dem KONDOR',
        verlockung: 'Erst beurteilen lassen, dann das große Modell ansetzen — so arbeitet der KONDOR nur, wo er muss.',
        scheitertAn: 'budget_kosten',
        werk: strasse([K('reiher'), P(0.85, 2), K('kondor')]),
      },
      {
        name: 'Erst klein, dann zweimal nach',
        verlockung: 'Eine gerade Kette braucht kein Urteil und kostet keine Runde. Drei Kerne müssen reichen.',
        scheitertAn: 'guete',
        werk: strasse([K('kolibri'), K('reiher'), K('reiher')]),
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
      'Die Ablösung des Fachverfahrens TROET ist da: achtzehnhundert Seiten Bestandsdokumentation von 1998, und kein Vorgang darunter ist leicht. Dein Werk von gestern läuft weiter und meldet keinen Fehler. Es gibt nur nichts mehr frei. Die Prüferin sucht eine Güte, die auf diesen Vorgängen niemand mehr erreicht, und schickt jedes Paket zurück, bis die Runden alle sind. Sie merkt es nicht, sie kann es nicht merken: sie kennt ihre Schwelle, aber nicht die Decke. Entweder du legst die Schwelle unter das, was hier erreichbar ist, oder du hebst die Decke — mit einem größeren Kern für die Vorgänge, die ihn wirklich brauchen.',
    lernziel:
      'Eine Schwelle oberhalb der erreichbaren Decke macht aus jeder Rückkopplung eine Kostenschleife ohne Ertrag.',
    quelle: QUELLE_MESSEN,
    module: [...MODULE],
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
    reflexion:
      'Deine Prüferin hat gestern bei fünfundachtzig Prozent freigegeben und heute nie — was hat sich geändert, ihre Schwelle oder deine Vorgänge?',
    notiz:
      'Sprachnotiz, 21. Mai, 22:10. Wir hatten eine Qualitätsvorgabe, die vier Jahre lang galt. Sie stammte aus einem Projekt mit ganz anderen Akten. Niemand hat sie nachgezogen, weil das Absenken einer Vorgabe wie Aufgeben aussieht. Es hat uns ein Quartal gekostet. Regel: Eine Schwelle ohne Bezug zur Decke frisst dich auf.',
    referenzen: [
      {
        name: 'Die gesenkte Schwelle',
        ansatz:
          'Die Schwelle liegt jetzt unter der Decke dieser Vorgänge, dafür drei Runden; die schwersten gehen an der Schleife vorbei zum KONDOR. Vier Module, längerer Weg.',
        werk: verzweigt([], 0.7, [K('reiher'), P(0.72, 3)], [K('kondor')]),
      },
      {
        name: 'Zweimal vorarbeiten, einmal nachfassen',
        ansatz:
          'Zwei feste Durchläufe heben die Güte so weit, dass die Prüferin mit zwei Runden auskommt — ein Modul mehr, dafür ein Sechstel weniger Token und die halbe Wartezeit.',
        werk: verzweigt([], 0.7, [K('reiher'), K('reiher'), P(0.68, 2)], [K('kondor')]),
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
        // Baugleich mit der ersten Referenzlösung aus VI-1. Genau daran zeigt
        // sich der Bruch: dieselbe Architektur, ein schwererer Eingang.
        name: 'Das Werk von gestern',
        verlockung: 'Diese Straße hat gestern den Deckel gehalten. Der Eingang ist derselbe geblieben.',
        scheitertAn: 'budget_kosten',
        werk: STRASSE_AUS_VI_1,
      },
      {
        name: 'Der KONDOR für alle',
        verlockung: 'Wenn die Decke zu niedrig ist, hebt man sie eben. Für jeden Vorgang, ohne Umstände.',
        scheitertAn: 'budget_kosten',
        werk: strasse([K('reiher'), K('kondor')]),
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
      'Die Vergabekammer hat Fragen zu einem Verfahren, das seit zwei Jahren läuft, und will bis Freitag Antworten. Über den Eingang kommt alles: dreizeilige Auskünfte, Abrechnungen, und Prüfvermerke, an denen sich auch ein KONDOR die Zähne ausbeißt. Zwei Fünftel der Vorgänge sind rechnerisch und bleiben ohne Rechenwerk bei sechzig Prozent gedeckelt. Du hast jetzt den ganzen Kasten: der Verteiler lässt Entwürfe nebeneinander entstehen, die Weiche sortiert vorher, die Schranke misst, die Prüferin urteilt. Der Tokendeckel gilt für den ganzen Tag. Drei Entwürfe für eine Auskunft sind Verschwendung, ein einziger Durchlauf für einen Prüfvermerk ist zu wenig.',
    lernziel:
      'Parallelisierung, Sortierung und Rückkopplung tragen erst zusammen, wenn jede von ihnen nur den Teil des Stroms bekommt, für den sie sich rechnet.',
    quelle: QUELLE_PARALLEL,
    module: [...MODULE],
    strom: {
      anzahl: 32,
      takt: 4,
      domaenen: ['recht', 'finanz', 'analyse', 'text'],
      schwierigkeit: [0.08, 0.95],
      mehrdeutigkeit: [0.1, 0.35],
      anteilRechnerisch: 0.4,
    },
    budget: { kosten: 30500, dauer: 500 },
    ziele: [
      { id: 'alles', metrik: 'durchsatz', vergleich: '>=', wert: 1, text: 'Jeder Auftrag wird ausgeliefert.' },
      { id: 'guete', metrik: 'guete', vergleich: '>=', wert: 0.82, text: 'Mindestgüte 82 Prozent.' },
      {
        id: 'preis',
        metrik: 'kostenJeAuftrag',
        vergleich: '<=',
        wert: 950,
        text: 'Höchstens 950 Token je Auftrag.',
      },
      {
        id: 'meister',
        metrik: 'latenzP95',
        vergleich: '<=',
        wert: 14,
        text: 'Meisterstück: p95-Latenz höchstens 14 Ticks.',
        optional: true,
      },
    ],
    saat: 631,
    vorbau: leeresFundament(),
    reflexion:
      'Du hast drei Stellen gebaut, an denen ein Vorgang anders behandelt wird als sein Nachbar — welche davon würdest du zuerst wieder ausbauen?',
    notiz:
      'Sprachnotiz, 27. Mai. Am Ende meiner Zeit hatte Halle 3 vierzehn Module. Neun davon hätte ich verteidigen können. Die anderen fünf standen da, weil sie einmal jemand gebraucht hatte und niemand sie abbauen wollte. Regel: Ein Modul, das du nicht begründen kannst, gehört dem, der es gebaut hat, und nicht dem Werk.',
    referenzen: [
      {
        name: 'Zwei Entwürfe links, ein KONDOR rechts',
        ansatz:
          'Der leichte Zweig lässt zwei billige Entwürfe nebeneinander laufen und nimmt den besseren, die Prüferin fasst dort nach; im schweren Zweig entscheidet eine Schranke, wer den KONDOR sieht. Zehn Module, dafür günstig und kurz.',
        werk: verzweigt(
          [W('rechner')],
          0.4,
          [FAECHER(['kolibri', 'kolibri'], 'bester'), P(0.75, 2)],
          [K('reiher'), TOR(0.7, [K('kondor')])]
        ),
      },
      {
        name: 'Eine Straße, zwei Urteile',
        ansatz:
          'Keine Weiche, kein Verteiler: ein mittlerer Kern für alle, die Prüferin holt eine Runde nach, und erst die Schranke danach entscheidet über den KONDOR. Halb so viele Module, dafür teurer und langsamer.',
        werk: strasse([W('rechner'), K('reiher'), P(0.75, 1), TOR(0.68, [K('kondor')])]),
      },
    ],
    antiMuster: [
      {
        name: 'Drei Entwürfe für jeden',
        verlockung: 'Wenn zwei Entwürfe im leichten Zweig helfen, helfen drei im ganzen Werk erst recht.',
        scheitertAn: 'budget_kosten',
        werk: strasse([
          W('rechner'),
          FAECHER(['kolibri', 'kolibri', 'reiher'], 'bester'),
          P(0.7, 1),
          TOR(0.72, [K('kondor')]),
        ]),
      },
      {
        name: 'Der KONDOR hinter dem REIHER',
        verlockung: 'Vor einer Frist nimmt man das größte Modell und spart sich die Architektur.',
        scheitertAn: 'budget_kosten',
        werk: strasse([W('rechner'), K('reiher'), K('kondor')]),
      },
      {
        name: 'Drei REIHER für jeden',
        verlockung: 'Eine gerade Kette ist übersichtlich, und drei mittlere Kerne haben bisher immer gereicht.',
        scheitertAn: 'guete',
        werk: strasse([W('rechner'), K('reiher'), K('reiher'), K('reiher')]),
      },
      {
        // Baugleich mit der ersten Referenzlösung, nur ohne das Rechenwerk.
        name: 'Ohne Rechenwerk',
        verlockung: 'Fünf Token für ein Werkzeug, das nur rechnet — das spart man sich vor einer Frist.',
        scheitertAn: 'guete',
        werk: verzweigt(
          [],
          0.4,
          [FAECHER(['kolibri', 'kolibri'], 'bester'), P(0.75, 2)],
          [K('reiher'), TOR(0.7, [K('kondor')])]
        ),
      },
    ],
    monolith: monolith(3),
  },
];
