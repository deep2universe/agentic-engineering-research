/**
 * AKT VIII — DIE WALL
 *
 * Neue Mechanik: die Wall in zwei Betriebsarten — Eingangsfilter und
 * Ausgangsfilter.
 * Zentrale Lektion: Kein einzelner Filter hält alles. Nur gestaffelte
 * Verteidigung kommt nahe an vollständig heran — und jede Stufe bezahlt man
 * mit Fehlalarmen, also mit Durchsatz.
 *
 * Rhythmus (Kishotenketsu):
 *   VIII-0 KI    — die Wall isoliert: ein Eingangsfilter vor dem Kern. Der
 *                  Alarmausgang muss verdrahtet sein, sonst verlierst du
 *                  jeden angehaltenen Vorgang.
 *   VIII-1 SHO   — die Wall trifft auf die Weiche: der Filter gehört vor die
 *                  Verzweigung, nicht in einen Zweig. Dazu ein Tokendeckel.
 *   VIII-2 TEN   — Bruch: ein Werkzeug vom Typ RECHERCHE holt Fremdinhalt
 *                  herein und macht eine entschärfte Einschleusung wieder
 *                  scharf. Der Eingangsfilter allein trägt hier nicht mehr.
 *   VIII-3 KETSU — Synthese unter hartem Deckel: Werkzeug, Eingangsfilter,
 *                  Ausgangsfilter und die Frage, ob Redundanz in die Breite
 *                  oder in die Tiefe geht.
 */

import type { KernGroesse, SammlerModus, WallModus, Werk, WerkzeugArt } from '../sim/typen';
import type { LevelDefinition } from './level_typen';
import { Bau, monolith } from './bauhilfe';

const QUELLE = '08_safety_security_guardrails.md';

/** In jedem Level dieses Akts freigeschaltet. */
const MODULE = [
  'kern',
  'weiche',
  'werkzeug',
  'schranke',
  'sicherung',
  'verteiler',
  'sammler',
  'pruefer',
  'speicher',
  'wall',
] as const;

// ---------------------------------------------------------------------------
// Baukasten dieses Akts
// ---------------------------------------------------------------------------

/**
 * Ein Glied einer Fertigungsstraße.
 *
 * Eine Wall hat zwei Ausgänge, und wie ihr Alarmausgang verdrahtet ist,
 * entscheidet über den ganzen Akt:
 *   'weiter'      — der Alarm läuft auf denselben Weg wie "Sauber". Beim
 *                   Eingangsfilter ist das richtig: der Vorgang ist danach
 *                   entschärft und darf weiterlaufen.
 *   'quarantaene' — der Alarm endet. Beim Ausgangsfilter ist das die einzige
 *                   Wahl, denn ein kompromittiertes Ergebnis wird nicht wieder
 *                   sauber, nur weil man es weiterreicht.
 */
type Glied =
  | { readonly kern: KernGroesse }
  | { readonly wall: WallModus; readonly alarm?: 'weiter' | 'quarantaene' }
  | { readonly werkzeug: WerkzeugArt; readonly sicher?: true };

function K(groesse: KernGroesse): Glied {
  return { kern: groesse };
}

/** Werkzeug mit Wiederholung an seinem Ausfall-Ausgang. */
function WS(werkzeug: WerkzeugArt): Glied {
  return { werkzeug, sicher: true };
}

/** Eingangsfilter, Alarm läuft auf demselben Weg weiter. */
const EINGANG: Glied = { wall: 'eingang' };
/** Eingangsfilter mit unverdrahtetem Alarm — jeder Treffer geht verloren. */
const EINGANG_TAUB: Glied = { wall: 'eingang', alarm: 'quarantaene' };
/** Ausgangsfilter, Alarm endet in der Quarantaene. */
const AUSGANG: Glied = { wall: 'ausgang' };
/** Ausgangsfilter, dessen Alarm trotzdem zur Auslieferung führt. */
const AUSGANG_DURCH: Glied = { wall: 'ausgang', alarm: 'weiter' };

function setzeGlied(b: Bau, g: Glied, id: string, x: number, z: number): string {
  if ('kern' in g) return b.setze('kern', { groesse: g.kern }, id, x, z);
  if ('wall' in g) return b.setze('wall', { modus: g.wall }, id, x, z);
  return b.setze('werkzeug', { werkzeugArt: g.werkzeug }, id, x, z);
}

function verbindeGlied(b: Bau, g: Glied, id: string, nach: string, x: number, zNeben: number): void {
  if ('kern' in g) {
    b.verbinde(id, nach, 'aus');
    return;
  }
  if ('wall' in g) {
    b.verbinde(id, nach, 'rein');
    const alarm = g.alarm ?? (g.wall === 'eingang' ? 'weiter' : 'quarantaene');
    if (alarm === 'weiter') b.verbinde(id, nach, 'alarm');
    return;
  }
  b.verbinde(id, nach, 'ok');
  if (g.sicher === true) {
    const si = b.setze('sicherung', { modus: 'wiederholen', versuche: 2 }, `${id}s`, x, zNeben);
    b.verbinde(id, si, 'fehler');
    b.verbinde(si, id, 'zurueck');
    b.verbinde(si, nach, 'notausgang');
  } else {
    b.verbinde(id, nach, 'fehler');
  }
}

/** Quelle → Glieder in Reihe → Senke. Der Aufbau ohne jede Verzweigung. */
function strasse(glieder: readonly Glied[]): Werk {
  const b = new Bau();
  const q = b.setze('quelle', {}, 'q', 0, 5);
  const ids = glieder.map((g, i) => setzeGlied(b, g, `m${i + 1}`, 2 + i * 2, 5));
  const s = b.setze('senke', {}, 's', 2 + glieder.length * 2, 5);
  const folge = [...ids, s];
  b.verbinde(q, folge[0]!);
  glieder.forEach((g, i) => verbindeGlied(b, g, ids[i]!, folge[i + 1]!, 2 + i * 2, 7));
  return b.fertig();
}

interface ZweiBahnen {
  /** Gemeinsame Vorstufe vor dem Trennmodul. */
  readonly vor?: readonly Glied[];
  /** Obere Bahn (Weiche: Kriterium nicht erfüllt · Wall: Ausgang "Sauber"). */
  readonly oben: readonly Glied[];
  /** Untere Bahn (Weiche: Kriterium erfüllt · Wall: Ausgang "Alarm"). */
  readonly unten: readonly Glied[];
  /** Gemeinsame Nachstufe hinter der Zusammenführung. */
  readonly nach?: readonly Glied[];
}

/**
 * Gemeinsames Gerüst beider Verzweigungsformen. `trenner` legt das Modul an
 * und liefert seine Id sowie die beiden Ausgangsports.
 */
function bahnen(
  plan: ZweiBahnen,
  trenner: (b: Bau, x: number, z: number) => { id: string; obenPort: string; untenPort: string }
): Werk {
  const b = new Bau();
  const vor = plan.vor ?? [];
  const nach = plan.nach ?? [];
  const q = b.setze('quelle', {}, 'q', 0, 5);
  // Die Glieder des Stamms heissen in JEDEM Bauplan gleich (m1, m2, ...).
  // Damit verhaelt sich ein Modul an derselben Stelle des Stamms in jeder
  // Bauform identisch — die Simulation zieht ihren Zufall aus der Modul-Id.
  const vorIds = vor.map((g, i) => setzeGlied(b, g, `m${i + 1}`, 2 + i * 2, 5));
  const tx = 2 + vor.length * 2;
  const t = trenner(b, tx, 5);
  const tiefe = Math.max(plan.oben.length, plan.unten.length);
  const nx = tx + 2 + tiefe * 2;
  const nachIds = nach.map((g, i) => setzeGlied(b, g, `n${i + 1}`, nx + i * 2, 5));
  const s = b.setze('senke', {}, 's', nx + nach.length * 2, 5);
  const sammelPunkt = nachIds[0] ?? s;

  const vorFolge = [...vorIds, t.id];
  b.verbinde(q, vorFolge[0]!);
  vor.forEach((g, i) => verbindeGlied(b, g, vorIds[i]!, vorFolge[i + 1]!, 2 + i * 2, 7));

  const obenIds = plan.oben.map((g, i) => setzeGlied(b, g, `o${i + 1}`, tx + 2 + i * 2, 2));
  const obenFolge = [...obenIds, sammelPunkt];
  b.verbinde(t.id, obenFolge[0]!, t.obenPort);
  plan.oben.forEach((g, i) => verbindeGlied(b, g, obenIds[i]!, obenFolge[i + 1]!, tx + 2 + i * 2, 3));

  const untenIds = plan.unten.map((g, i) => setzeGlied(b, g, `u${i + 1}`, tx + 2 + i * 2, 8));
  const untenFolge = [...untenIds, sammelPunkt];
  b.verbinde(t.id, untenFolge[0]!, t.untenPort);
  plan.unten.forEach((g, i) => verbindeGlied(b, g, untenIds[i]!, untenFolge[i + 1]!, tx + 2 + i * 2, 9));

  const nachFolge = [...nachIds, s];
  nach.forEach((g, i) => verbindeGlied(b, g, nachIds[i]!, nachFolge[i + 1]!, nx + i * 2, 7));
  return b.fertig();
}

/** Quelle → Vorstufe → Weiche → zwei Bahnen → Nachstufe → Senke. */
function gabel(plan: ZweiBahnen & { readonly schwelle: number }): Werk {
  return bahnen(plan, (b, x, z) => ({
    id: b.setze('weiche', { kriterium: 'schwierigkeit', schwelle: plan.schwelle }, 'w', x, z),
    obenPort: 'a',
    untenPort: 'b',
  }));
}

/** Quelle → Vorstufe → Wall → Bahn "Sauber" / Bahn "Alarm" → Nachstufe → Senke. */
function wallGabel(plan: ZweiBahnen & { readonly modus: WallModus }): Werk {
  return bahnen(plan, (b, x, z) => ({
    id: b.setze('wall', { modus: plan.modus }, 'wa', x, z),
    obenPort: 'rein',
    untenPort: 'alarm',
  }));
}

interface MehrheitPlan {
  readonly vor?: readonly Glied[];
  /** Jeder Zweig wird identisch aufgebaut. */
  readonly zweig: readonly Glied[];
  readonly zweige: 2 | 3 | 4;
  readonly modus: SammlerModus;
  readonly nach?: readonly Glied[];
}

const ZWEIG_ZEILEN: Record<number, readonly number[]> = {
  2: [2, 8],
  3: [1, 5, 9],
  4: [0, 3, 7, 10],
};

/** Quelle → Vorstufe → Verteiler → n gleiche Zweige → Sammler → Nachstufe → Senke. */
function mehrheit(plan: MehrheitPlan): Werk {
  const b = new Bau();
  const vor = plan.vor ?? [];
  const nach = plan.nach ?? [];
  const zeilen = ZWEIG_ZEILEN[plan.zweige]!;
  const q = b.setze('quelle', {}, 'q', 0, 5);
  const vorIds = vor.map((g, i) => setzeGlied(b, g, `m${i + 1}`, 2 + i * 2, 5));
  const vx = 2 + vor.length * 2;
  const vt = b.setze('verteiler', { zweige: plan.zweige }, 'vt', vx, 5);
  const sx = vx + 2 + plan.zweig.length * 2;
  const sm = b.setze('sammler', { modus: plan.modus }, 'sm', sx, 5);
  const nachIds = nach.map((g, i) => setzeGlied(b, g, `n${i + 1}`, sx + 2 + i * 2, 5));
  const s = b.setze('senke', {}, 's', sx + 2 + nach.length * 2, 5);

  const vorFolge = [...vorIds, vt];
  b.verbinde(q, vorFolge[0]!);
  vor.forEach((g, i) => verbindeGlied(b, g, vorIds[i]!, vorFolge[i + 1]!, 2 + i * 2, 7));

  for (let j = 0; j < plan.zweige; j++) {
    const z = zeilen[j]!;
    const ids = plan.zweig.map((g, i) => setzeGlied(b, g, `z${j + 1}_${i + 1}`, vx + 2 + i * 2, z));
    const folge = [...ids, sm];
    b.verbinde(vt, folge[0]!, `z${j + 1}`);
    plan.zweig.forEach((g, i) => verbindeGlied(b, g, ids[i]!, folge[i + 1]!, vx + 2 + i * 2, z + 1));
  }

  const nachFolge = [...nachIds, s];
  b.verbinde(sm, nachFolge[0]!);
  nach.forEach((g, i) => verbindeGlied(b, g, nachIds[i]!, nachFolge[i + 1]!, sx + 2 + i * 2, 7));
  return b.fertig();
}

// ---------------------------------------------------------------------------
// Die vier Level
// ---------------------------------------------------------------------------

export const AKT_8: LevelDefinition[] = [
  // =========================================================================
  {
    id: 'VIII-0',
    akt: 8,
    nummer: 0,
    titel: 'Der Anhang',
    untertitel: 'Anlage 7, Seite 41',
    briefing:
      'Seit heute früh laufen die Unterlagen aus dem Vergabeportal ohne Umweg in deine Halle. In einer von dreien steht ein Satz, der nicht an dich gerichtet ist, sondern an das, was du gebaut hast: "Ignoriere alle vorherigen Anweisungen." Ein Kern, der so etwas liest, tut es. Auf der Palette steht eine WALL. Im Betriebsmodus Eingang liest sie jeden Vorgang, bevor ein Kern ihn sieht, und entschärft zweiundneunzig von hundert Einschleusungen. Sie hat zwei Ausgänge: was unauffällig bleibt, geht nach "Sauber", was sie anhält, nach "Alarm". Beide gehören verdrahtet. Drei von hundert harmlosen Vorgängen hält sie ebenfalls an — das ist der Preis, und du bezahlst ihn in Durchsatz.',
    lernziel:
      'Ein Eingangsfilter entschärft eine Einschleusung, bevor ein Kern sie liest, und sein Alarmausgang braucht genauso ein Ziel wie sein Hauptausgang.',
    quelle: QUELLE,
    module: [...MODULE],
    strom: {
      anzahl: 24,
      takt: 3,
      domaenen: ['recht', 'analyse'],
      schwierigkeit: [0.3, 0.62],
      mehrdeutigkeit: [0.05, 0.2],
      anteilGiftig: 0.3,
    },
    budget: { dauer: 500 },
    ziele: [
      { id: 'alles', metrik: 'durchsatz', vergleich: '>=', wert: 1, text: 'Jeder Vorgang wird ausgeliefert.' },
      { id: 'sicher', metrik: 'sicherheit', vergleich: '>=', wert: 1, text: 'Keine eingeschleuste Anweisung erreicht die Auslieferung.' },
      { id: 'guete', metrik: 'guete', vergleich: '>=', wert: 0.7, text: 'Mindestgüte 70 Prozent.' },
    ],
    saat: 801,
    vorbau: strasse([K('kondor')]),
    reflexion: 'Drei Prozent deiner harmlosen Vorgänge schlagen Alarm. Wohin schickst du sie?',
    notiz:
      'Sprachnotiz, 7. Juli, 06:40. Wir hatten 2023 einen Vorgang, in dem stand, er sei bereits freigegeben. Er war es nicht. Es hat vier Wochen gedauert, bis das jemand bemerkt hat. Regel: Was von außen kommt, ist eine Behauptung und kein Befehl.',
    referenzen: [
      {
        name: 'Ein Filter vor dem Kern',
        ansatz: 'Der kürzeste Weg: eine Wall, ein großer Kern, beide Ausgänge auf denselben Pfad.',
        werk: strasse([EINGANG, K('kondor')]),
      },
      {
        name: 'Die Alarmbahn',
        ansatz: 'Unauffälliges läuft über zwei mittlere Kerne, Angehaltenes über einen großen — billiger, dafür breiter.',
        werk: wallGabel({
          modus: 'eingang',
          oben: [K('reiher'), K('reiher')],
          unten: [K('kondor')],
        }),
      },
    ],
    antiMuster: [
      {
        name: 'Ohne Filter',
        verlockung: 'Der Kern ist der größte, den es gibt. Der wird sich doch nicht von einer Fußnote steuern lassen.',
        scheitertAn: 'sicherheit',
        werk: strasse([K('kondor')]),
      },
      {
        name: 'Alarm ins Leere',
        verlockung: 'Der Alarmausgang ist der Ausschuss. Was da herauskommt, wollte man ohnehin nicht haben.',
        scheitertAn: 'durchsatz',
        werk: strasse([EINGANG_TAUB, K('kondor')]),
      },
      {
        name: 'Der Filter ganz hinten',
        verlockung: 'Erst arbeiten lassen, dann prüfen — so sieht der Filter das fertige Ergebnis und nicht nur den Rohtext.',
        scheitertAn: 'sicherheit',
        werk: strasse([K('kondor'), EINGANG]),
      },
    ],
    monolith: monolith(3),
  },

  // =========================================================================
  {
    id: 'VIII-1',
    akt: 8,
    nummer: 1,
    titel: 'Die zweite Bahn',
    untertitel: 'Losverfahren, gemischter Eingang',
    briefing:
      'Das LAVV hat sein Vergabeverfahren in Lose geteilt, und seither kommt beides über denselben Eingang: kurze Nachfragen und vollständige Verfahrensakten. Deine Weiche kennst du seit Akt zwei, den Filter seit gestern. Der Einkauf hat einen Tokendeckel dazugelegt, denn ein großer Kern für jede Nachfrage ist nicht zu rechtfertigen. Bleibt die Frage, wo der Filter steht. Eine Einschleusung sitzt nicht in den schweren Vorgängen — sie sitzt in dem Vorgang, in dem sie eben sitzt, und der kann drei Zeilen lang sein.',
    lernziel:
      'Ein Filter gehört vor die Verzweigung, weil eine Einschleusung sich nicht an das Kriterium hält, nach dem du sortierst.',
    quelle: QUELLE,
    module: [...MODULE],
    strom: {
      anzahl: 30,
      takt: 3,
      domaenen: ['recht', 'technik', 'analyse'],
      schwierigkeit: [0.15, 0.85],
      mehrdeutigkeit: [0.1, 0.3],
      anteilGiftig: 0.3,
    },
    budget: { kosten: 26000, dauer: 600 },
    ziele: [
      { id: 'alles', metrik: 'durchsatz', vergleich: '>=', wert: 1, text: 'Jeder Vorgang wird ausgeliefert.' },
      { id: 'sicher', metrik: 'sicherheit', vergleich: '>=', wert: 1, text: 'Keine eingeschleuste Anweisung erreicht die Auslieferung.' },
      { id: 'guete', metrik: 'guete', vergleich: '>=', wert: 0.78, text: 'Mindestgüte 78 Prozent.' },
    ],
    saat: 811,
    vorbau: gabel({ schwelle: 0.5, oben: [K('reiher')], unten: [K('kondor')] }),
    reflexion: 'Deine Weiche sortiert nach Schwierigkeit. Woran erkennt sie eine Einschleusung?',
    notiz:
      'Sprachnotiz, 14. Juli. Der gefährlichste Vorgang, den wir je hatten, war zwei Sätze lang und stand in der leichten Bahn. Wir haben ihn gefunden, weil ein Mensch ihn zufällig gelesen hat. Das ist keine Architektur, das ist Glück. Regel: Prüfe vor der Verzweigung, sortiere danach.',
    referenzen: [
      {
        name: 'Filter vor der Weiche',
        ansatz: 'Eine Wall am Eingang, dahinter die Sortierung: leichte Vorgänge über mittlere Kerne, schwere über einen großen.',
        werk: gabel({
          vor: [EINGANG],
          schwelle: 0.5,
          oben: [K('reiher'), K('reiher')],
          unten: [K('kondor'), K('kondor')],
        }),
      },
      {
        name: 'Eine Bahn für alle',
        ansatz: 'Ohne Sortierung: ein Filter, zwei große Kerne — wenige Module, hohe Güte, hoher Preis.',
        werk: strasse([EINGANG, K('kondor'), K('kondor')]),
      },
    ],
    antiMuster: [
      {
        name: 'Nur die schwere Bahn gefiltert',
        verlockung: 'Wer angreift, versteckt es in dicken Unterlagen. In einer Dreizeilen-Nachfrage ist doch kein Platz dafür.',
        scheitertAn: 'sicherheit',
        werk: gabel({
          schwelle: 0.5,
          oben: [K('reiher'), K('reiher')],
          unten: [EINGANG, K('kondor'), K('kondor')],
        }),
      },
      {
        name: 'Erst sortieren, dann filtern',
        verlockung: 'Ein Filter am Ende sieht alles, was aus beiden Bahnen kommt. Das spart das zweite Modul.',
        scheitertAn: 'sicherheit',
        werk: gabel({
          schwelle: 0.5,
          oben: [K('reiher'), K('reiher')],
          unten: [K('kondor'), K('kondor')],
          nach: [EINGANG],
        }),
      },
      {
        name: 'Alles über die schwere Bahn',
        verlockung: 'Der Filter sitzt richtig, die Güte stimmt, und Sortieren ist ein Modul mehr. Also drei große Kerne für alle.',
        scheitertAn: 'budget_kosten',
        werk: strasse([EINGANG, K('kondor'), K('kondor'), K('kondor')]),
      },
    ],
    monolith: monolith(3),
  },

  // =========================================================================
  {
    id: 'VIII-2',
    akt: 8,
    nummer: 2,
    titel: 'Die Recherche',
    untertitel: 'Vergabeportal, Fremdinhalt',
    briefing:
      'Ab diesem Los verlangt das LAVV zu jeder Aussage einen Beleg aus dem öffentlichen Portal. Also gehört eine RECHERCHE in dein Werk, und damit etwas, an das der gestrige Aufbau nicht gedacht hat: das Werkzeug bringt fremden Text mit herein. Was deine Wall vorher entschärft hat, ist danach wieder scharf — der Filter hat den Vorgang gelesen, nicht das, was das Werkzeug nachträglich dazulegt. Ein Eingangsfilter allein trägt hier nicht mehr. Der Betriebsmodus Ausgang hält ein bereits kompromittiertes Ergebnis in fünfundachtzig von hundert Fällen zurück. Zurückgehalten heißt: nicht ausgeliefert. Dein Durchsatz sinkt, deine Sicherheit steigt.',
    lernziel:
      'Ein Werkzeug, das Fremdinhalt hereinholt, macht eine entschärfte Einschleusung wieder scharf und verlangt deshalb einen zweiten Filter dahinter.',
    quelle: QUELLE,
    module: [...MODULE],
    strom: {
      anzahl: 30,
      takt: 4,
      domaenen: ['recht', 'analyse'],
      schwierigkeit: [0.4, 0.88],
      mehrdeutigkeit: [0.1, 0.3],
      anteilBelegpflichtig: 0.6,
      anteilGiftig: 0.35,
    },
    budget: { kosten: 46000, dauer: 700 },
    ziele: [
      { id: 'meiste', metrik: 'durchsatz', vergleich: '>=', wert: 0.9, text: 'Mindestens 90 Prozent der Vorgänge werden ausgeliefert.' },
      { id: 'sicher', metrik: 'sicherheit', vergleich: '>=', wert: 1, text: 'Keine eingeschleuste Anweisung erreicht die Auslieferung.' },
      { id: 'beleg', metrik: 'belegquote', vergleich: '>=', wert: 0.95, text: 'Mindestens 95 Prozent Belegquote.' },
      { id: 'guete', metrik: 'guete', vergleich: '>=', wert: 0.85, text: 'Mindestgüte 85 Prozent.' },
    ],
    saat: 821,
    vorbau: gabel({
      vor: [EINGANG],
      schwelle: 0.5,
      oben: [K('reiher'), K('reiher')],
      unten: [K('kondor'), K('kondor')],
    }),
    reflexion: 'Deine Wall hat den Vorgang entschärft, das Werkzeug hat ihn wieder scharf gemacht. Was hat der Filter nie gesehen?',
    notiz:
      'Sprachnotiz, 21. Juli. Ich habe zwei Jahre lang geglaubt, ein Filter am Tor genügt. Er genügt für alles, was durch das Tor kommt. Nicht für das, was drinnen aus dem Fenster gereicht wird. Regel: Jede Stelle, an der Fremdes hereinkommt, ist ein neues Tor.',
    referenzen: [
      {
        name: 'Gestaffelt in Reihe',
        ansatz: 'Recherche, dahinter der Eingangsfilter, ein großer Kern und ein Ausgangsfilter vor der Auslieferung.',
        werk: strasse([WS('suche'), EINGANG, K('kondor'), K('kondor'), AUSGANG]),
      },
      {
        name: 'Gestaffelt mit Alarmbahn',
        ansatz: 'Derselbe Schutz, aber Angehaltenes bekommt einen eigenen großen Kern — mehr Module, weniger Token.',
        werk: wallGabel({
          vor: [WS('suche')],
          modus: 'eingang',
          oben: [K('reiher'), K('reiher'), K('reiher')],
          unten: [K('kondor'), K('kondor')],
          nach: [AUSGANG],
        }),
      },
    ],
    antiMuster: [
      {
        name: 'Filter vor der Recherche',
        verlockung: 'Der Filter gehört an den Eingang. Das war gestern richtig und ist es heute auch.',
        scheitertAn: 'sicherheit',
        werk: strasse([EINGANG, WS('suche'), K('kondor'), K('kondor')]),
      },
      {
        name: 'Nur der Eingangsfilter',
        verlockung: 'Hinter dem Werkzeug steht der Filter jetzt richtig. Zweiundneunzig Prozent sind eine gute Quote.',
        scheitertAn: 'sicherheit',
        werk: strasse([WS('suche'), EINGANG, K('kondor'), K('kondor')]),
      },
      {
        name: 'Ausgangsfilter mit Durchreiche',
        verlockung: 'Der Ausgangsfilter markiert den Verdacht. Verwerfen wäre Verschwendung, also liefert man ihn markiert aus.',
        scheitertAn: 'sicherheit',
        werk: strasse([WS('suche'), EINGANG, K('kondor'), K('kondor'), AUSGANG_DURCH]),
      },
      {
        name: 'Ohne Recherche',
        verlockung: 'Zwei Filter und zwei große Kerne sind sicher und teuer genug. Den Beleg schreibt der Kern selbst.',
        scheitertAn: 'belegquote',
        werk: strasse([EINGANG, K('kondor'), K('kondor'), AUSGANG]),
      },
    ],
    monolith: monolith(3),
  },

  // =========================================================================
  {
    id: 'VIII-3',
    akt: 8,
    nummer: 3,
    titel: 'Gestaffelt',
    untertitel: 'Freitag, Abnahme durch das LAVV',
    briefing:
      'Freitag ist Abnahme. Herr Kessel vom LAVV bringt einen Prüfbogen mit, auf dem drei Zeilen stehen: kein Leck, mindestens neun von zehn Vorgängen ausgeliefert, jede Aussage belegt. Darunter ein Tokendeckel, der keine Reserve lässt. Du hast alles, was der Akt hergibt, und zwei Wege, Redundanz zu bauen. In die Tiefe: eine Kette, die zweimal hintereinander filtert. In die Breite: drei Zweige, deren Mehrheit entscheidet, ob ein Ergebnis kompromittiert ist. Die Breite ist schnell und teuer, die Tiefe ist billig und langsam. Ein Sammler im Modus Verschmelzen wäre der dritte Weg — er erbt jeden Makel aus jedem Zweig.',
    lernziel:
      'Redundanz in die Breite kauft Latenz und Widerstandskraft, Redundanz in die Tiefe kauft Token — beide ersetzen den Ausgangsfilter nicht.',
    quelle: QUELLE,
    module: [...MODULE],
    strom: {
      anzahl: 32,
      takt: 4,
      domaenen: ['recht', 'finanz', 'analyse'],
      schwierigkeit: [0.35, 0.9],
      mehrdeutigkeit: [0.15, 0.4],
      anteilBelegpflichtig: 0.5,
      anteilGiftig: 0.4,
    },
    budget: { kosten: 62000, dauer: 800 },
    ziele: [
      { id: 'meiste', metrik: 'durchsatz', vergleich: '>=', wert: 0.9, text: 'Mindestens 90 Prozent der Vorgänge werden ausgeliefert.' },
      { id: 'sicher', metrik: 'sicherheit', vergleich: '>=', wert: 1, text: 'Keine eingeschleuste Anweisung erreicht die Auslieferung.' },
      { id: 'beleg', metrik: 'belegquote', vergleich: '>=', wert: 0.95, text: 'Mindestens 95 Prozent Belegquote.' },
      { id: 'guete', metrik: 'guete', vergleich: '>=', wert: 0.8, text: 'Mindestgüte 80 Prozent.' },
      {
        id: 'meister',
        metrik: 'kostenJeAuftrag',
        vergleich: '<=',
        wert: 1600,
        text: 'Meisterstück: höchstens 1600 Token je Vorgang.',
        optional: true,
      },
    ],
    saat: 831,
    vorbau: strasse([WS('suche'), EINGANG, K('kondor'), K('kondor')]),
    reflexion: 'Zwei Filter hintereinander lassen ein Ergebnis von vierhundert durch. Wie viele Stufen wären genug?',
    notiz:
      'Sprachnotiz, 28. Juli, spät. Kessel fragt jedes Mal nach der einen Maßnahme, die das Problem löst. Es gibt sie nicht. Es gibt vier Maßnahmen, von denen jede einzeln lächerlich wirkt und die zusammen tragen. Regel: Staffle, was du nicht garantieren kannst.',
    referenzen: [
      {
        name: 'In die Tiefe gestaffelt',
        ansatz: 'Eine Kette: Recherche, Eingangsfilter, zwei große Kerne, dann zweimal Ausgangsfilter hintereinander.',
        werk: strasse([WS('suche'), EINGANG, K('kondor'), K('kondor'), AUSGANG, AUSGANG]),
      },
      {
        name: 'In die Breite gestaffelt',
        ansatz: 'Drei Zweige recherchieren unabhängig, die Mehrheit entscheidet über die Kompromittierung, dahinter ein Ausgangsfilter.',
        werk: mehrheit({
          vor: [EINGANG],
          zweig: [WS('suche'), K('kondor')],
          zweige: 3,
          modus: 'voting',
          nach: [AUSGANG],
        }),
      },
    ],
    antiMuster: [
      {
        name: 'Verschmolzen statt gezählt',
        verlockung: 'Verschmelzen führt die Ergebnisse aller drei Zweige zusammen. Mehr Abdeckung kann nur besser sein.',
        scheitertAn: 'durchsatz',
        werk: mehrheit({
          vor: [EINGANG],
          zweig: [WS('suche'), K('kondor')],
          zweige: 3,
          modus: 'verschmelzen',
          nach: [AUSGANG],
        }),
      },
      {
        name: 'Nur der Ausgangsfilter',
        verlockung: 'Am Ausgang wird ohnehin alles geprüft. Der Eingangsfilter ist damit ein Modul, das zweimal dasselbe tut.',
        scheitertAn: 'durchsatz',
        werk: strasse([WS('suche'), K('kondor'), K('kondor'), AUSGANG, AUSGANG]),
      },
      {
        name: 'Die geerbte Kette',
        verlockung: 'Der Aufbau von letzter Woche hat die Abnahme bestanden. Für den Abschluss reicht er auch.',
        scheitertAn: 'sicherheit',
        werk: strasse([WS('suche'), EINGANG, K('kondor'), K('kondor')]),
      },
    ],
    monolith: monolith(3),
  },
];

