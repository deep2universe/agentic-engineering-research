/**
 * AKT X — DAS AUGE
 *
 * Neue Mechanik: das Auge — ein Tracing-Abgriff, der einen Token kostet und
 * keinen einzigen Tick. Es setzt die beobachteten Schritte auf die gesamten
 * Schritte und deckt damit RUECKWAERTS alles ab, was ein Paket bis dorthin
 * durchlaufen hat — und nichts, was danach kommt.
 * Zentrale Lektion: Was du nicht beobachtest, kannst du nicht verantworten.
 *
 * Rhythmus (Kishotenketsu):
 *   X-0 KI    — das Auge allein an einer geraden Kette: eine Spur, ein Preis.
 *   X-1 SHO   — das Auge trifft auf die Schranke: das Tor macht aus einer Bahn
 *               zwei, und nur eine davon läuft am Auge vorbei.
 *   X-2 TEN   — Bruch: die Vorgänge werden schwer, die Nacharbeitsbahn füllt
 *               sich, und die Anlage der Vorwoche verliert ihre Spur.
 *   X-3 KETSU — Synthese: Werkzeugausfall, Ersatzbahn und ein Kostendeckel.
 *               Augen sind fast gratis — aber jeder Pfad braucht seinen eigenen.
 */

import type { KernGroesse, Werk, WerkzeugArt } from '../sim/typen';
import type { LevelDefinition } from './level_typen';
import { Bau, monolith } from './bauhilfe';

const QUELLE = '10_observability_evaluation.md';

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
  'hand',
  'auge',
] as const;

/**
 * Güteschwelle des Tors in X-1 und X-2. Bewusst eine Konstante: es ist in
 * beiden Leveln dieselbe Schranke, und nur der Auftragsstrom ändert sich.
 * Genau daran hängt der Bruch dieses Akts.
 */
const TOR_SCHWELLE = 0.58;

// ---------------------------------------------------------------------------
// Baukasten dieses Akts
// ---------------------------------------------------------------------------

/**
 * Ein Glied einer Bahn. Mehr als Kerne und Augen braucht keine Bahn dieses
 * Akts: Werkzeug, Schranke und Weiche stehen an den Verzweigungspunkten und
 * werden dort einzeln verdrahtet, damit kein Ausgang offen bleibt.
 */
type Glied = { readonly kern: KernGroesse } | { readonly auge: true };

function K(groesse: KernGroesse): Glied {
  return { kern: groesse };
}

const AUGE: Glied = { auge: true };
const KOLIBRI = K('kolibri');
const REIHER = K('reiher');
const KONDOR = K('kondor');

function setzeGlied(b: Bau, g: Glied, id: string, x: number, z: number): string {
  return 'kern' in g ? b.setze('kern', { groesse: g.kern }, id, x, z) : b.setze('auge', {}, id, x, z);
}

/**
 * Setzt eine Bahn ab Spalte `x` auf Zeile `z`, verkettet sie und hängt ihr
 * Ende an `ziel`. Zurück kommt der Kopf der Bahn — oder `ziel` selbst, wenn die
 * Bahn leer ist. Damit lassen sich Bahnen ohne Sonderfall zusammenführen.
 */
function bahn(
  b: Bau,
  glieder: readonly Glied[],
  praefix: string,
  x: number,
  z: number,
  ziel: string
): string {
  if (glieder.length === 0) return ziel;
  const ids = glieder.map((g, i) => setzeGlied(b, g, `${praefix}${i + 1}`, x + i * 2, z));
  const folge = [...ids, ziel];
  ids.forEach((id, i) => b.verbinde(id, folge[i + 1]!, 'aus'));
  return ids[0]!;
}

/** Quelle → Glieder in Reihe → Senke. Die gerade Kette ohne jede Verzweigung. */
function strasse(glieder: readonly Glied[]): Werk {
  const b = new Bau();
  const q = b.setze('quelle', {}, 'q', 0, 5);
  const s = b.setze('senke', {}, 's', 2 + glieder.length * 2, 5);
  b.verbinde(q, bahn(b, glieder, 'm', 2, 5, s));
  return b.fertig();
}

interface TorPlan {
  /** Gemeinsame Vorstufe vor dem Tor. */
  readonly vor: readonly Glied[];
  /** Güteschwelle des Tors. */
  readonly schwelle: number;
  /** Bahn hinter "Bestanden". */
  readonly frei: readonly Glied[];
  /** Bahn hinter "Durchgefallen". */
  readonly nacharbeit: readonly Glied[];
  /**
   * Die Nacharbeitsbahn mündet in die Freigabebahn statt direkt in die
   * Auslieferung. Damit laufen beide Bahnen durch dieselben Glieder, und ein
   * einziges Auge am Zusammenfluss deckt sie beide ab.
   */
  readonly zurueckAufDieBahn?: true;
}

/**
 * Quelle → Vorstufe → Schranke → zwei Bahnen → Senke.
 *
 * Das Tor ist die billigste Qualitätssicherung des Werks und zugleich seine
 * unauffälligste Verzweigung: es macht aus einer Bahn zwei, und wer nur die
 * bestandene beobachtet, hat die halbe Wahrheit in der Akte.
 */
function torhalle(plan: TorPlan): Werk {
  const b = new Bau();
  const q = b.setze('quelle', {}, 'q', 0, 5);
  const tx = 2 + plan.vor.length * 2;
  const t = b.setze('schranke', { schwelle: plan.schwelle }, 't', tx, 5);
  const tiefe = Math.max(plan.frei.length, plan.nacharbeit.length);
  const s = b.setze('senke', {}, 's', tx + 4 + tiefe * 2, 5);

  b.verbinde(q, bahn(b, plan.vor, 'v', 2, 5, t));

  const freiKopf = bahn(b, plan.frei, 'f', tx + 2, 3, s);
  b.verbinde(t, freiKopf, 'ok');

  const nachZiel = plan.zurueckAufDieBahn ? freiKopf : s;
  b.verbinde(t, bahn(b, plan.nacharbeit, 'n', tx + 2, 7, nachZiel), 'fehler');
  return b.fertig();
}

interface GabelPlan {
  /** Gemeinsame Vorstufe vor der Weiche. */
  readonly vor: readonly Glied[];
  /** Schwelle der Weiche auf der geschätzten Schwierigkeit. */
  readonly schwelle: number;
  /** Bahn A: unterhalb der Schwelle, also die leichten Vorgänge. */
  readonly leicht: readonly Glied[];
  /** Bahn B: oberhalb der Schwelle, also die schweren Vorgänge. */
  readonly schwer: readonly Glied[];
  /** Gemeinsame Schlussstrecke, in die beide Bahnen münden. */
  readonly gemeinsam?: readonly Glied[];
}

/** Quelle → Vorstufe → Weiche → zwei Bahnen → optionale Schlussstrecke → Senke. */
function gabelhalle(plan: GabelPlan): Werk {
  const b = new Bau();
  const q = b.setze('quelle', {}, 'q', 0, 5);
  const wx = 2 + plan.vor.length * 2;
  const w = b.setze('weiche', { kriterium: 'schwierigkeit', schwelle: plan.schwelle }, 'w', wx, 5);
  const tiefe = Math.max(plan.leicht.length, plan.schwer.length);
  const gx = wx + 2 + tiefe * 2;
  const gemeinsam = plan.gemeinsam ?? [];
  const s = b.setze('senke', {}, 's', gx + gemeinsam.length * 2, 5);

  b.verbinde(q, bahn(b, plan.vor, 'v', 2, 5, w));
  const schluss = bahn(b, gemeinsam, 'g', gx, 5, s);
  b.verbinde(w, bahn(b, plan.leicht, 'a', wx + 2, 2, schluss), 'a');
  b.verbinde(w, bahn(b, plan.schwer, 'b', wx + 2, 8, schluss), 'b');
  return b.fertig();
}

interface PruefpfadPlan {
  /** Welches Werkzeug am Eingang die Belege holt. */
  readonly werkzeugArt: WerkzeugArt;
  /** Wiederholungen einer Sicherung am Werkzeugausfall; ohne Angabe keine. */
  readonly versuche?: number;
  /** Hauptbahn hinter dem gelieferten Beleg. */
  readonly haupt: readonly Glied[];
  /** Ersatzbahn hinter dem Werkzeugausfall. */
  readonly ersatz: readonly Glied[];
  /** Die Ersatzbahn mündet in die Hauptbahn statt direkt in die Auslieferung. */
  readonly ersatzZurueck?: true;
}

/**
 * Der Prüfpfad des Abnahmelaufs: ein Werkzeug am Eingang, dahinter eine
 * Hauptbahn — und eine Ersatzbahn für den Fall, dass der Fachdienst schweigt.
 * Der Ausfall ist selten, aber er ist ein vollwertiger Weg durch das Werk.
 */
function pruefpfad(plan: PruefpfadPlan): Werk {
  const b = new Bau();
  const q = b.setze('quelle', {}, 'q', 0, 5);
  const w = b.setze('werkzeug', { werkzeugArt: plan.werkzeugArt }, 'w', 2, 5);
  const tiefe = Math.max(plan.haupt.length, plan.ersatz.length);
  const s = b.setze('senke', {}, 's', 6 + tiefe * 2, 5);
  b.verbinde(q, w);

  const hauptKopf = bahn(b, plan.haupt, 'h', 4, 5, s);
  b.verbinde(w, hauptKopf, 'ok');

  const ersatzZiel = plan.ersatzZurueck ? hauptKopf : s;
  const ersatzKopf = bahn(b, plan.ersatz, 'e', 4, 9, ersatzZiel);

  if (plan.versuche === undefined) {
    b.verbinde(w, ersatzKopf, 'fehler');
  } else {
    const si = b.setze('sicherung', { modus: 'wiederholen', versuche: plan.versuche }, 'si', 2, 9);
    b.verbinde(w, si, 'fehler');
    b.verbinde(si, w, 'zurueck');
    b.verbinde(si, ersatzKopf, 'notausgang');
  }
  return b.fertig();
}

// ---------------------------------------------------------------------------
// Die vier Level
// ---------------------------------------------------------------------------

export const AKT_10: LevelDefinition[] = [
  // =========================================================================
  {
    id: 'X-0',
    akt: 10,
    nummer: 0,
    titel: 'Der blinde Fleck',
    untertitel: 'Konrad Rauhut, externer Auditor, Tag eins',
    briefing:
      'Am Besprechungstisch in Halle 3 sitzt seit heute früh ein Mann mit einem Ringordner und fragt nach Vorgang vierzehn: Welche Schritte hat er durchlaufen, in welcher Reihenfolge, zu welchem Preis? Deine Anlage weiß das alles. Sie sagt es nur niemandem. Auf der Palette am Tor steht dafür ein neues Bauteil, das AUGE. Es kostet einen einzigen Token, es kostet keinen Tick, und es schreibt die Spur aller Schritte mit, die ein Paket bis zu ihm gegangen ist. Aller Schritte davor. Keines danach. Setz es an die Stelle, an der das etwas bedeutet — und bleib dabei unter dem Preis je Vorgang, den der Einkauf seit März gelb markiert.',
    lernziel:
      'Ein Auge deckt rückwirkend alle Schritte ab, die ein Paket bis dorthin gegangen ist, und keinen einzigen danach.',
    quelle: QUELLE,
    module: [...MODULE],
    strom: {
      anzahl: 24,
      takt: 3,
      domaenen: ['technik', 'text', 'analyse'],
      schwierigkeit: [0.15, 0.45],
      mehrdeutigkeit: [0.05, 0.25],
    },
    budget: { dauer: 600 },
    ziele: [
      { id: 'alles', metrik: 'durchsatz', vergleich: '>=', wert: 1, text: 'Jeder Vorgang wird ausgeliefert.' },
      {
        id: 'spur',
        metrik: 'nachvollziehbarkeit',
        vergleich: '==',
        wert: 1,
        text: 'Jeder ausgelieferte Vorgang ist lückenlos nachvollziehbar.',
      },
      { id: 'guete', metrik: 'guete', vergleich: '>=', wert: 0.6, text: 'Mindestgüte 60 Prozent.' },
      {
        id: 'preis',
        metrik: 'kostenJeAuftrag',
        vergleich: '<=',
        wert: 200,
        text: 'Höchstens 200 Token je Vorgang.',
      },
    ],
    saat: 1001,
    vorbau: strasse([REIHER, REIHER]),
    reflexion: 'Dein Auge steht am Ende der Kette. Was genau hätte in der Akte gestanden, wenn du es an den Anfang gestellt hättest?',
    notiz:
      'Sprachnotiz, 3. August, 07:15. Der Auditor ist höflich und stellt nur eine Frage, immer dieselbe: Woher wissen Sie das? Zwölf Jahre lang habe ich darauf mit meinem Gedächtnis geantwortet. Das trägt bis zur ersten Krankmeldung. Regel: Eine Spur ist kein Bericht, sondern ein Bauteil.',
    referenzen: [
      {
        name: 'Zwei KOLIBRI, dann das Auge',
        ansatz:
          'Zwei billige Aufrufe holen die Güte, das Auge am Ende schreibt beide mit — der niedrigste Preis je Vorgang, dafür ein Modul mehr.',
        werk: strasse([KOLIBRI, KOLIBRI, AUGE]),
      },
      {
        name: 'Ein REIHER, dann das Auge',
        ansatz:
          'Ein einziger mittlerer Aufruf statt der Kette: die kleinste Anlage der Halle, dafür fast der doppelte Preis je Vorgang.',
        werk: strasse([REIHER, AUGE]),
      },
    ],
    antiMuster: [
      {
        // Baugleich mit der ersten Referenz, nur ohne das Auge. Damit isoliert
        // dieses Anti-Muster exakt eine Variable.
        name: 'Ohne Auge',
        verlockung: 'Die Anlage läuft, die Güte stimmt, der Preis stimmt. Ein Ringordner ist noch kein Grund für einen Umbau.',
        scheitertAn: 'nachvollziehbarkeit',
        werk: strasse([KOLIBRI, KOLIBRI]),
      },
      {
        name: 'Auge am Eingang',
        verlockung: 'Wer die Spur ganz vorn abgreift, hat den Vorgang von Anfang an dokumentiert.',
        scheitertAn: 'nachvollziehbarkeit',
        werk: strasse([AUGE, KOLIBRI, KOLIBRI]),
      },
      {
        name: 'Die alte Anlage plus Auge',
        verlockung: 'Hinten ein Auge anhängen und sonst nichts anfassen — der kleinste Eingriff, den der Ringordner verlangt.',
        scheitertAn: 'kostenJeAuftrag',
        werk: strasse([REIHER, REIHER, AUGE]),
      },
      {
        name: 'Auge hinter dem KONDOR',
        verlockung: 'Wenn der Auditor schon zusieht, soll er erstklassige Arbeit sehen, und zwar lückenlos dokumentiert.',
        scheitertAn: 'kostenJeAuftrag',
        werk: strasse([KONDOR, AUGE]),
      },
    ],
    monolith: monolith(2),
  },

  // =========================================================================
  {
    id: 'X-1',
    akt: 10,
    nummer: 1,
    titel: 'Die zweite Bahn',
    untertitel: 'Prüfliste 3, Zeile 7: Vollständigkeit',
    briefing:
      'Rauhut hat die Spuren gelesen und einen Haken gesetzt. Darunter steht Zeile sieben: Vollständigkeit. Vor der Auslieferung hängt seit Jahren ein Tor, das jeden Vorgang unter der Güteschwelle in die Nacharbeit schickt. Das Tor kostet zwei Token und ist die billigste Qualitätssicherung der Halle — und zugleich die unauffälligste Verzweigung, die du je gebaut hast. Aus einer Bahn werden zwei, beide enden beim Kunden, und der Ringordner interessiert sich für beide. Für dieses Los hat der Einkauf zusätzlich einen Tokendeckel gesetzt; was darüber liegt, trägt die Halle.',
    lernziel:
      'Jede Verzweigung erzeugt einen zweiten Weg zur Auslieferung, und ein Auge sieht immer nur den Weg, auf dem es steht.',
    quelle: QUELLE,
    module: [...MODULE],
    strom: {
      anzahl: 30,
      takt: 3,
      domaenen: ['recht', 'technik', 'finanz'],
      schwierigkeit: [0.2, 0.5],
      mehrdeutigkeit: [0.05, 0.3],
    },
    budget: { kosten: 20000, dauer: 700 },
    ziele: [
      { id: 'alles', metrik: 'durchsatz', vergleich: '>=', wert: 1, text: 'Jeder Vorgang wird ausgeliefert.' },
      {
        id: 'spur',
        metrik: 'nachvollziehbarkeit',
        vergleich: '>=',
        wert: 0.95,
        text: 'Mindestens 95 Prozent der Bearbeitungsschritte sind belegt.',
      },
      { id: 'guete', metrik: 'guete', vergleich: '>=', wert: 0.72, text: 'Mindestgüte 72 Prozent.' },
      {
        id: 'meister',
        metrik: 'nachvollziehbarkeit',
        vergleich: '==',
        wert: 1,
        text: 'Meisterstück: keine einzige Lücke in der Akte.',
        optional: true,
      },
    ],
    saat: 1011,
    vorbau: torhalle({ vor: [REIHER, REIHER], schwelle: TOR_SCHWELLE, frei: [], nacharbeit: [REIHER] }),
    reflexion: 'Das Tor hat heute einen einzigen Vorgang in die Nacharbeit geschickt. Was wird aus deiner Quote, wenn es morgen jeden fünften schickt?',
    notiz:
      'Sprachnotiz, 6. August. Wir haben das Tor 2019 eingebaut, weil Nacharbeit billiger ist als eine Reklamation. Niemand hat je gefragt, wohin die nachgearbeiteten Vorgänge danach gehen. Sie gehen zum Kunden, genau wie die anderen. Regel: Jede Bahn, die zur Auslieferung führt, ist eine Hauptbahn.',
    referenzen: [
      {
        name: 'Auge auf der Freigabebahn',
        ansatz:
          'Zwei Kerne, ein Tor, das Auge hinter der bestandenen Prüfung — der günstigste und schnellste Weg, dafür fünf Module und eine Nacharbeitsbahn, die niemand mitschreibt.',
        werk: torhalle({ vor: [REIHER, REIHER], schwelle: TOR_SCHWELLE, frei: [AUGE], nacharbeit: [REIHER] }),
      },
      {
        name: 'Ein KONDOR, dann das Auge',
        ansatz:
          'Kein Tor, keine zweite Bahn: ein großer Kern und ein Auge dahinter — zwei Module und eine lückenlose Akte, dicht am Tokendeckel.',
        werk: strasse([KONDOR, AUGE]),
      },
    ],
    antiMuster: [
      {
        name: 'Auge vor dem Tor',
        verlockung: 'Ein Abgriff vor der Prüfung deckt beide Bahnen gleichzeitig ab — man muss ihn nur früh genug setzen.',
        scheitertAn: 'nachvollziehbarkeit',
        werk: torhalle({ vor: [REIHER, REIHER, AUGE], schwelle: TOR_SCHWELLE, frei: [], nacharbeit: [REIHER] }),
      },
      {
        name: 'Nur die Nacharbeit beobachtet',
        verlockung: 'Interessant ist doch, was schiefgegangen ist. Die bestandenen Vorgänge erklären sich von selbst.',
        scheitertAn: 'nachvollziehbarkeit',
        werk: torhalle({ vor: [REIHER, REIHER], schwelle: TOR_SCHWELLE, frei: [], nacharbeit: [REIHER, AUGE] }),
      },
      {
        name: 'Tor ausgebaut, KONDOR verdoppelt',
        verlockung: 'Ohne Verzweigung gibt es keine blinde Bahn. Zwei große Kerne liefern die Güte gleich mit.',
        scheitertAn: 'budget_kosten',
        werk: strasse([KONDOR, KONDOR, AUGE]),
      },
    ],
    monolith: monolith(2),
  },

  // =========================================================================
  {
    id: 'X-2',
    akt: 10,
    nummer: 2,
    titel: 'Der Andrang in der Nacharbeit',
    untertitel: 'Los 4: Altbestand TROET, Jahrgang 1998',
    briefing:
      'Das Landesamt hat Los vier freigegeben: Altbestand aus dem Fachverfahren TROET, in Teilen älter als deine Ausbildung. Die Vorgänge sind erheblich schwerer als alles, was Halle 3 diese Woche gesehen hat; die Güteanforderung wurde dafür gesenkt, die Prüfliste nicht. Der Tokendeckel ist zugleich enger geworden. Deine Anlage vom Montag steht noch genau so da und liefert weiter — nur schickt das Tor jetzt nicht mehr jeden dreissigsten in die Nacharbeit, sondern jeden fünften. Rauhut hat Zeile sieben aufgeschlagen und wartet. Ein Auge sieht immer nur den Weg, auf dem es steht.',
    lernziel:
      'Eine Beobachtungslücke auf einem seltenen Zweig bleibt genau so lange unsichtbar, bis dieser Zweig nicht mehr selten ist.',
    quelle: QUELLE,
    module: [...MODULE],
    strom: {
      anzahl: 30,
      takt: 3,
      domaenen: ['recht', 'technik', 'analyse'],
      schwierigkeit: [0.25, 0.85],
      mehrdeutigkeit: [0.1, 0.4],
    },
    budget: { kosten: 15500, dauer: 800 },
    ziele: [
      { id: 'alles', metrik: 'durchsatz', vergleich: '>=', wert: 1, text: 'Jeder Vorgang wird ausgeliefert.' },
      {
        id: 'spur',
        metrik: 'nachvollziehbarkeit',
        vergleich: '>=',
        wert: 0.95,
        text: 'Mindestens 95 Prozent der Bearbeitungsschritte sind belegt.',
      },
      { id: 'guete', metrik: 'guete', vergleich: '>=', wert: 0.66, text: 'Mindestgüte 66 Prozent.' },
      {
        id: 'meister',
        metrik: 'guete',
        vergleich: '>=',
        wert: 0.75,
        text: 'Meisterstück: 75 Prozent Güte, ohne den Tokendeckel zu reissen.',
        optional: true,
      },
    ],
    saat: 1021,
    vorbau: torhalle({ vor: [REIHER, REIHER], schwelle: TOR_SCHWELLE, frei: [AUGE], nacharbeit: [REIHER] }),
    reflexion: 'Dieselbe Anlage, dieselbe Verdrahtung, eine Quote im freien Fall. Was hat sich verändert — dein Werk oder deine Annahme über den Auftragsstrom?',
    notiz:
      'Sprachnotiz, 10. August. Los vier ist der Grund, warum ich Lücken nicht mehr nach Häufigkeit sortiere. Der seltene Zweig ist nicht der harmlose Zweig. Er ist der, für den sich niemand zuständig fühlt, und irgendwann kommt ein Los, das fast nur aus ihm besteht. Regel: Beobachte den Zweig, nicht die Statistik des Zweigs.',
    referenzen: [
      {
        name: 'Nacharbeit zurück auf die Bahn',
        ansatz:
          'Dieselben fünf Module wie am Montag, eine Leitung anders: die Nacharbeit mündet vor dem Auge wieder ein — der günstigste und schnellste Weg zur lückenlosen Akte.',
        werk: torhalle({
          vor: [REIHER, REIHER],
          schwelle: TOR_SCHWELLE,
          frei: [AUGE],
          nacharbeit: [REIHER],
          zurueckAufDieBahn: true,
        }),
      },
      {
        name: 'Ein Auge am Zusammenfluss',
        ansatz:
          'Kein Tor, sondern eine Weiche: leicht und schwer laufen getrennt und münden in ein gemeinsames Auge — vier Module, dafür teurer und träger.',
        werk: gabelhalle({
          vor: [],
          schwelle: 0.45,
          leicht: [REIHER],
          schwer: [KONDOR],
          gemeinsam: [AUGE],
        }),
      },
    ],
    antiMuster: [
      {
        name: 'Die Anlage vom Montag',
        verlockung: 'Sie hat vergangene Woche jede Zeile der Prüfliste gehalten. Ein anderes Los ist kein Grund für einen Umbau.',
        scheitertAn: 'nachvollziehbarkeit',
        werk: torhalle({ vor: [REIHER, REIHER], schwelle: TOR_SCHWELLE, frei: [AUGE], nacharbeit: [REIHER] }),
      },
      {
        name: 'Nur die schwere Bahn beobachtet',
        verlockung: 'Die schweren Vorgänge sind die riskanten. Wer die dokumentiert, hat das Wesentliche in der Akte.',
        scheitertAn: 'nachvollziehbarkeit',
        werk: gabelhalle({
          vor: [],
          schwelle: 0.5,
          leicht: [KOLIBRI, KOLIBRI],
          schwer: [KONDOR, AUGE],
        }),
      },
      {
        name: 'Auge vor der Weiche',
        verlockung: 'Ein Abgriff im gemeinsamen Stück deckt alles ab, was danach kommt — die Bahnen teilen sich ja erst dahinter.',
        scheitertAn: 'nachvollziehbarkeit',
        werk: gabelhalle({
          vor: [REIHER, AUGE],
          schwelle: 0.5,
          leicht: [KOLIBRI],
          schwer: [KONDOR],
        }),
      },
      {
        name: 'KONDOR für alles',
        verlockung: 'Ohne Tor und ohne Weiche gibt es keine zweite Bahn, und ein großer Kern schafft auch den Altbestand.',
        scheitertAn: 'budget_kosten',
        werk: strasse([KONDOR, AUGE]),
      },
    ],
    monolith: monolith(2),
  },

  // =========================================================================
  {
    id: 'X-3',
    akt: 10,
    nummer: 3,
    titel: 'Die Aktenlage',
    untertitel: 'Abnahme, Freitag, Ringordner offen',
    briefing:
      'Letzter Tag der Prüfung. Das Landesamt schickt dreissig Vorgänge, von denen fast jeder zweite ohne Beleg aus einem Fachdienst nicht zu lösen ist. Der Fachdienst ist eine Fremdschnittstelle: er antwortet fast immer, und fast immer ist nicht immer. Für jeden Vorgang, der deshalb eine Ersatzbahn nimmt, will Zeile sieben dieselbe Spur sehen wie für alle anderen. Der Tokendeckel steht, das Fundament ist knapp, und jedes Auge kostet dich einen Token und einen Platz. Rauhut hat den Ringordner aufgeschlagen liegen lassen und ist Kaffee holen gegangen.',
    lernziel:
      'Nachvollziehbarkeit ist eine Eigenschaft aller Pfade eines Werks, nicht nur des Pfades, den du dir beim Bauen vorgestellt hast.',
    quelle: QUELLE,
    module: [...MODULE],
    strom: {
      anzahl: 30,
      takt: 3,
      domaenen: ['recht', 'finanz', 'analyse'],
      schwierigkeit: [0.25, 0.7],
      mehrdeutigkeit: [0.1, 0.4],
      anteilBelegpflichtig: 0.45,
    },
    budget: { kosten: 15500, dauer: 900 },
    ziele: [
      { id: 'alles', metrik: 'durchsatz', vergleich: '>=', wert: 1, text: 'Jeder Vorgang wird ausgeliefert.' },
      {
        id: 'spur',
        metrik: 'nachvollziehbarkeit',
        vergleich: '>=',
        wert: 0.95,
        text: 'Mindestens 95 Prozent der Bearbeitungsschritte sind belegt.',
      },
      { id: 'guete', metrik: 'guete', vergleich: '>=', wert: 0.75, text: 'Mindestgüte 75 Prozent.' },
      {
        id: 'meister',
        metrik: 'flaeche',
        vergleich: '<=',
        wert: 5,
        text: 'Meisterstück: die Akte stimmt mit höchstens fünf Modulen.',
        optional: true,
      },
    ],
    saat: 1031,
    vorbau: pruefpfad({ werkzeugArt: 'api', haupt: [REIHER, REIHER], ersatz: [REIHER] }),
    reflexion: 'Der Fachdienst fällt in wenigen Prozent der Fälle aus. Warum kennt die Prüfliste für genau diese Prozente keine Toleranz?',
    notiz:
      'Sprachnotiz, 14. August, kurz nach der Abnahme. Rauhut hat nicht nach der Güte gefragt und nicht nach dem Preis. Er hat sich einen Vorgang herausgesucht, bei dem der Fachdienst geschwiegen hat, und wissen wollen, was danach passiert ist. Das war die ganze Prüfung. Regel: Geprüft wird nicht der Regelfall, sondern der Ausfall.',
    referenzen: [
      {
        name: 'Alles auf eine Spur',
        ansatz:
          'Eine Sicherung fängt den Ausfall ab und schickt den Vorgang zurück auf die Hauptbahn: fünf Module, ein einziges Auge, volle Belegquote — bezahlt mit Wartezeit für die Wiederholungen.',
        werk: pruefpfad({
          werkzeugArt: 'api',
          versuche: 2,
          haupt: [REIHER, REIHER, AUGE],
          ersatz: [],
          ersatzZurueck: true,
        }),
      },
      {
        name: 'Zwei Bahnen, zwei Augen',
        ansatz:
          'Kein Wiederholen: die Ersatzbahn bekommt einen eigenen Kern und ihren eigenen Abgriff — billiger und deutlich schneller, dafür ein Modul mehr und eine Lücke in der Belegquote.',
        werk: pruefpfad({
          werkzeugArt: 'api',
          haupt: [REIHER, REIHER, AUGE],
          ersatz: [REIHER, AUGE],
        }),
      },
    ],
    antiMuster: [
      {
        name: 'Auge nur auf der Hauptbahn',
        verlockung: 'Der Fachdienst fällt selten aus. Für so etwas baut man keine zweite Beobachtung und belegt keinen zweiten Platz.',
        scheitertAn: 'nachvollziehbarkeit',
        werk: pruefpfad({
          werkzeugArt: 'api',
          haupt: [REIHER, REIHER, AUGE],
          ersatz: [REIHER],
        }),
      },
      {
        name: 'Auge direkt hinter dem Fachdienst',
        verlockung: 'Der Abgriff steht vor der Verzweigung und sieht damit jeden Vorgang, der überhaupt hereinkommt.',
        scheitertAn: 'nachvollziehbarkeit',
        werk: pruefpfad({
          werkzeugArt: 'api',
          haupt: [AUGE, REIHER, REIHER],
          ersatz: [],
          ersatzZurueck: true,
        }),
      },
      {
        name: 'Recherche statt Fachdienst',
        verlockung: 'Die Recherche fällt seltener aus und belegt breiter. Wer sie einbaut, hat die Ersatzbahn beinahe abgeschafft.',
        scheitertAn: 'budget_kosten',
        werk: pruefpfad({
          werkzeugArt: 'suche',
          versuche: 2,
          haupt: [REIHER, REIHER, AUGE],
          ersatz: [],
          ersatzZurueck: true,
        }),
      },
      {
        name: 'Ohne Fachdienst, dafür KONDOR',
        verlockung: 'Ein großer Kern weiß genug. Wer kein Werkzeug anschliesst, hat auch keine Ersatzbahn zu beobachten.',
        scheitertAn: 'guete',
        werk: strasse([KONDOR, AUGE]),
      },
    ],
    monolith: monolith(3),
  },
];
