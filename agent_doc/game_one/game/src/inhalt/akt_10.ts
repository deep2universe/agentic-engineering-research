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
 *   X-2 TEN   — Bruch: die Aufträge werden schwer, die Nacharbeitsbahn füllt
 *               sich, und die Anlage der Vorwoche verliert ihre Spur.
 *   X-3 KETSU — Synthese: Werkzeugausfall, Nacharbeit und ein Kostendeckel.
 *               Augen sind fast gratis — aber jeder Pfad braucht seinen eigenen.
 */

import type { KernGroesse, SpeicherModus, Werk, WerkzeugArt } from '../sim/typen';
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

// ---------------------------------------------------------------------------
// Baukasten dieses Akts
// ---------------------------------------------------------------------------

/**
 * Ein Glied einer Bahn. Vier Arten reichen für diesen Akt; ihre Ausgänge sind
 * an genau einer Stelle verdrahtet, damit kein Level versehentlich einen Port
 * offen lässt und Pakete verliert.
 */
type Glied =
  | { readonly kern: KernGroesse }
  | { readonly werkzeug: WerkzeugArt }
  | { readonly speicher: SpeicherModus }
  | { readonly auge: true };

function K(groesse: KernGroesse): Glied {
  return { kern: groesse };
}

function WZ(art: WerkzeugArt): Glied {
  return { werkzeug: art };
}

function SP(modus: SpeicherModus): Glied {
  return { speicher: modus };
}

/**
 * Güteschwelle des Tors in X-1 und X-2. Bewusst eine Konstante: dieselbe
 * Schranke steht in beiden Leveln, und nur der Auftragsstrom ändert sich.
 */
const TOR_SCHWELLE = 0.58;

const AUGE: Glied = { auge: true };
const KOLIBRI = K('kolibri');
const REIHER = K('reiher');
const KONDOR = K('kondor');

function setzeGlied(b: Bau, g: Glied, id: string, x: number, z: number): string {
  if ('kern' in g) return b.setze('kern', { groesse: g.kern }, id, x, z);
  if ('werkzeug' in g) return b.setze('werkzeug', { werkzeugArt: g.werkzeug }, id, x, z);
  if ('speicher' in g) return b.setze('speicher', { modus: g.speicher }, id, x, z);
  return b.setze('auge', {}, id, x, z);
}

/**
 * Verdrahtet die Ausgänge eines Glieds auf denselben Nachfolger.
 *
 * Ein Werkzeug in der Bahn schickt auch seinen Ausfall weiter: das Paket ist
 * dann eben unbelegt, aber es geht nicht verloren. Wer den Ausfall gesondert
 * behandeln will, baut ihn ausserhalb dieser Hilfe — genau das tut X-3.
 */
function verbindeGlied(b: Bau, g: Glied, id: string, nach: string): void {
  if ('werkzeug' in g) {
    b.verbinde(id, nach, 'ok');
    b.verbinde(id, nach, 'fehler');
    return;
  }
  b.verbinde(id, nach, 'aus');
}

/** Setzt eine Bahn ab Spalte `x` auf Zeile `z` und hängt sie an `ziel`. */
function bahn(b: Bau, glieder: readonly Glied[], praefix: string, x: number, z: number, ziel: string): string {
  if (glieder.length === 0) return ziel;
  const ids = glieder.map((g, i) => setzeGlied(b, g, `${praefix}${i + 1}`, x + i * 2, z));
  const folge = [...ids, ziel];
  glieder.forEach((g, i) => verbindeGlied(b, g, ids[i]!, folge[i + 1]!));
  return ids[0]!;
}

/** Quelle → Glieder in Reihe → Senke. Die gerade Kette ohne jede Verzweigung. */
function strasse(glieder: readonly Glied[]): Werk {
  const b = new Bau();
  const q = b.setze('quelle', {}, 'q', 0, 5);
  const s = b.setze('senke', {}, 's', 2 + glieder.length * 2, 5);
  const kopf = bahn(b, glieder, 'm', 2, 5, s);
  b.verbinde(q, kopf);
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
   * Auslieferung. Damit laufen beide Bahnen durch dieselben Glieder — und ein
   * einziges Auge am Zusammenfluss deckt sie beide ab.
   */
  readonly zurueckAufDieBahn?: true;
}

/**
 * Quelle → Vorstufe → Schranke → zwei Bahnen → Senke.
 *
 * Das Tor ist die billigste Qualitätssicherung des Werks und zugleich die
 * unauffälligste Verzweigung: es macht aus einer Bahn zwei, und wer nur die
 * bestandene beobachtet, hat die Hälfte der Wahrheit.
 */
function torhalle(plan: TorPlan): Werk {
  const b = new Bau();
  const q = b.setze('quelle', {}, 'q', 0, 5);
  const tx = 2 + plan.vor.length * 2;
  const t = b.setze('schranke', { schwelle: plan.schwelle }, 't', tx, 5);
  const tiefe = Math.max(plan.frei.length, plan.nacharbeit.length);
  const s = b.setze('senke', {}, 's', tx + 4 + tiefe * 2, 5);

  const vorKopf = bahn(b, plan.vor, 'v', 2, 5, t);
  b.verbinde(q, vorKopf);

  const freiKopf = bahn(b, plan.frei, 'f', tx + 2, 3, s);
  b.verbinde(t, freiKopf, 'ok');

  const nachZiel = plan.zurueckAufDieBahn ? freiKopf : s;
  const nachKopf = bahn(b, plan.nacharbeit, 'n', tx + 2, 7, nachZiel);
  b.verbinde(t, nachKopf, 'fehler');
  return b.fertig();
}

interface GabelPlan {
  /** Gemeinsame Vorstufe vor der Weiche. */
  readonly vor: readonly Glied[];
  /** Schwelle der Weiche auf der geschätzten Schwierigkeit. */
  readonly schwelle: number;
  /** Bahn A: unterhalb der Schwelle, also die leichten Aufträge. */
  readonly leicht: readonly Glied[];
  /** Bahn B: oberhalb der Schwelle, also die schweren Aufträge. */
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

  const vorKopf = bahn(b, plan.vor, 'v', 2, 5, w);
  b.verbinde(q, vorKopf);

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
 * Hauptbahn — und eine Ersatzbahn für den Fall, dass der Bestand schweigt.
 * Der Ausfall ist selten, aber er ist ein eigener Weg durch das Werk.
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
      'Am Besprechungstisch in Halle 3 sitzt seit heute früh ein Mann mit einem Ringordner und fragt nach Vorgang vierzehn: Welche Schritte hat er durchlaufen, in welcher Reihenfolge, zu welchem Preis? Deine Anlage weiß es. Sie sagt es nur niemandem. Auf der Palette am Tor steht dafür ein neues Bauteil, das AUGE. Es kostet einen einzigen Token, es kostet keinen Tick, und es schreibt die Spur aller Schritte mit, die ein Paket bis zu ihm durchlaufen hat. Aller Schritte davor. Keines danach. Bau es an die Stelle, an der das etwas bedeutet — und halte dabei den Preis je Vorgang, den der Einkauf seit März gelb markiert.',
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
        wert: 400,
        text: 'Höchstens 400 Token je Vorgang.',
      },
    ],
    saat: 1001,
    vorbau: strasse([REIHER, REIHER]),
    reflexion: 'Dein Auge steht am Ende der Kette. Was genau hätte in der Akte gestanden, wenn du es an den Anfang gestellt hättest?',
    notiz:
      'Sprachnotiz, 3. August, 07:15. Der Auditor ist höflich und stellt nur eine Frage, immer dieselbe: Woher wissen Sie das? Zwölf Jahre lang habe ich darauf mit meinem Gedächtnis geantwortet. Das reicht bis zur ersten Krankmeldung. Regel: Eine Spur ist kein Bericht, sondern ein Bauteil.',
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
          'Ein einziger mittlerer Aufruf statt der Kette: die kleinste Anlage im Werk, dafür der höhere Preis je Vorgang.',
        werk: strasse([REIHER, AUGE]),
      },
    ],
    antiMuster: [
      {
        name: 'Ohne Auge',
        verlockung: 'Die Anlage läuft, die Güte stimmt, der Preis stimmt. Ein Ringordner ist noch kein Grund für einen Umbau.',
        scheitertAn: 'nachvollziehbarkeit',
        werk: strasse([REIHER, REIHER]),
      },
      {
        name: 'Auge am Eingang',
        verlockung: 'Wer die Spur ganz vorn abgreift, hat den Vorgang von Anfang an dokumentiert.',
        scheitertAn: 'nachvollziehbarkeit',
        werk: strasse([AUGE, REIHER, REIHER]),
      },
      {
        name: 'Auge hinter dem KONDOR',
        verlockung: 'Wenn der Auditor schon zusieht, soll er wenigstens erstklassige Arbeit lückenlos dokumentiert sehen.',
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
      'Rauhut hat die Spuren gelesen und einen Haken gesetzt. Darunter steht Zeile sieben: Vollständigkeit. Vor der Auslieferung hängt seit Wochen ein Tor, das jeden Vorgang unter der Güteschwelle in die Nacharbeit schickt. Das Tor kostet zwei Token und ist die billigste Qualitätssicherung der Halle — es ist zugleich die unauffälligste Verzweigung, die du je gebaut hast. Aus einer Bahn werden zwei, und der Ringordner interessiert sich für beide. Der Einkauf hat für diesen Auftrag einen Tokendeckel gesetzt; alles darüber geht auf die Halle.',
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
    budget: { kosten: 22000, dauer: 700 },
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
    ],
    saat: 1011,
    vorbau: torhalle({ vor: [REIHER, REIHER], schwelle: TOR_SCHWELLE, frei: [], nacharbeit: [REIHER] }),
    reflexion: 'Das Tor hat heute nur wenige Vorgänge in die Nacharbeit geschickt. Was passiert mit deiner Quote, wenn es morgen jeden dritten schickt?',
    notiz:
      'Sprachnotiz, 6. August. Wir haben das Tor 2019 eingebaut, weil Nacharbeit billiger ist als eine Reklamation. Niemand hat je gefragt, wohin die nachgearbeiteten Vorgänge gehen. Sie gehen zum Kunden, genau wie die anderen. Regel: Jede Bahn, die zur Auslieferung führt, ist eine Hauptbahn.',
    referenzen: [
      {
        name: 'Auge auf der Freigabebahn',
        ansatz:
          'Zwei Kerne, ein Tor, das Auge hinter der bestandenen Prüfung — günstig je Vorgang, dafür fünf Module und eine Nacharbeitsbahn, die niemand mitschreibt.',
        werk: torhalle({ vor: [REIHER, REIHER], schwelle: TOR_SCHWELLE, frei: [AUGE], nacharbeit: [REIHER] }),
      },
      {
        name: 'Ein KONDOR, dann das Auge',
        ansatz:
          'Kein Tor, keine zweite Bahn: ein einziger großer Kern und ein Auge dahinter — zwei Module und eine lückenlose Spur zum höchsten Preis je Vorgang.',
        werk: strasse([KONDOR, AUGE]),
      },
    ],
    antiMuster: [
      {
        name: 'Auge vor dem Tor',
        verlockung: 'Ein Auge vor der Prüfung deckt beide Bahnen gleichzeitig ab — man muss es nur früh genug setzen.',
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
      { name: 'PROBE s0.56', verlockung: 'x', scheitertAn: 'guete', werk: torhalle({ vor: [REIHER, REIHER], schwelle: 0.56, frei: [AUGE], nacharbeit: [REIHER] }) },
      { name: 'PROBE s0.58', verlockung: 'x', scheitertAn: 'guete', werk: torhalle({ vor: [REIHER, REIHER], schwelle: 0.58, frei: [AUGE], nacharbeit: [REIHER] }) },
      { name: 'PROBE s0.60', verlockung: 'x', scheitertAn: 'guete', werk: torhalle({ vor: [REIHER, REIHER], schwelle: 0.6, frei: [AUGE], nacharbeit: [REIHER] }) },
      { name: 'PROBE s0.64', verlockung: 'x', scheitertAn: 'guete', werk: torhalle({ vor: [REIHER, REIHER], schwelle: 0.64, frei: [AUGE], nacharbeit: [REIHER] }) },
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
      'Das Landesamt hat Los vier freigegeben: Altbestand aus dem Fachverfahren TROET, in Teilen älter als deine Ausbildung. Die Vorgänge sind erheblich schwerer als alles, was Halle 3 diese Woche gesehen hat, und der Tokendeckel ist enger geworden. Deine Anlage vom Montag steht noch genau so da. Sie liefert weiter, sie hält sogar die Güte — nur schickt das Tor jetzt nicht mehr jeden zwanzigsten in die Nacharbeit, sondern beinahe jeden dritten. Rauhut hat Zeile sieben aufgeschlagen und wartet. Ein Auge sieht immer nur den Weg, auf dem es steht.',
    lernziel:
      'Eine Beobachtungslücke auf einem seltenen Zweig bleibt so lange unsichtbar, bis dieser Zweig nicht mehr selten ist.',
    quelle: QUELLE,
    module: [...MODULE],
    strom: {
      anzahl: 30,
      takt: 3,
      domaenen: ['recht', 'technik', 'analyse'],
      schwierigkeit: [0.25, 0.85],
      mehrdeutigkeit: [0.1, 0.4],
    },
    budget: { kosten: 14500, dauer: 800 },
    ziele: [
      { id: 'alles', metrik: 'durchsatz', vergleich: '>=', wert: 1, text: 'Jeder Vorgang wird ausgeliefert.' },
      {
        id: 'spur',
        metrik: 'nachvollziehbarkeit',
        vergleich: '>=',
        wert: 0.95,
        text: 'Mindestens 95 Prozent der Bearbeitungsschritte sind belegt.',
      },
      { id: 'guete', metrik: 'guete', vergleich: '>=', wert: 0.7, text: 'Mindestgüte 70 Prozent.' },
    ],
    saat: 1021,
    vorbau: torhalle({ vor: [REIHER, REIHER], schwelle: TOR_SCHWELLE, frei: [AUGE], nacharbeit: [REIHER] }),
    reflexion: 'Dieselbe Anlage, dieselbe Verdrahtung, eine Quote im freien Fall. Was hat sich verändert — dein Werk oder deine Annahme über den Auftragsstrom?',
    notiz:
      'Sprachnotiz, 10. August. Los vier ist der Grund, warum ich Lücken nicht mehr nach Häufigkeit sortiere. Der seltene Zweig ist nicht der harmlose Zweig, er ist der, für den sich niemand zuständig fühlt. Und irgendwann kommt ein Los, das nur aus ihm besteht. Regel: Beobachte den Zweig, nicht die Statistik des Zweigs.',
    referenzen: [
      {
        name: 'Zwei Augen hinter der Weiche',
        ansatz:
          'Eine Weiche trennt leicht von schwer, jede Bahn bekommt ihren eigenen Abgriff — der niedrigste Preis je Vorgang zum Preis von sechs Modulen.',
        werk: gabelhalle({
          vor: [],
          schwelle: 0.5,
          leicht: [KOLIBRI, KOLIBRI, AUGE],
          schwer: [KONDOR, AUGE],
        }),
      },
      {
        name: 'Ein Auge am Zusammenfluss',
        ansatz:
          'Dieselbe Weiche, aber beide Bahnen münden in ein gemeinsames Auge: vier Module und eine lückenlose Spur, dafür der teurere Kern auf der leichten Bahn.',
        werk: gabelhalle({
          vor: [],
          schwelle: 0.5,
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
        verlockung: 'Ohne Weiche gibt es keine zweite Bahn, und ein großer Kern schafft auch den Altbestand.',
        scheitertAn: 'budget_kosten',
        werk: strasse([KONDOR, AUGE]),
      },
      { name: 'PROBE r/k gem s0.35', verlockung: 'x', scheitertAn: 'guete', werk: gabelhalle({ vor: [], schwelle: 0.35, leicht: [REIHER], schwer: [KONDOR], gemeinsam: [AUGE] }) },
      { name: 'PROBE r/k gem s0.3', verlockung: 'x', scheitertAn: 'guete', werk: gabelhalle({ vor: [], schwelle: 0.3, leicht: [REIHER], schwer: [KONDOR], gemeinsam: [AUGE] }) },
      { name: 'PROBE k/k gem s0.4', verlockung: 'x', scheitertAn: 'guete', werk: gabelhalle({ vor: [], schwelle: 0.4, leicht: [KOLIBRI], schwer: [KONDOR], gemeinsam: [AUGE] }) },
      { name: 'PROBE r/k gem s0.45', verlockung: 'x', scheitertAn: 'guete', werk: gabelhalle({ vor: [], schwelle: 0.45, leicht: [REIHER], schwer: [KONDOR], gemeinsam: [AUGE] }) },
      { name: 'PROBE tor zur KONDOR', verlockung: 'x', scheitertAn: 'guete', werk: torhalle({ vor: [REIHER, REIHER], schwelle: TOR_SCHWELLE, frei: [AUGE], nacharbeit: [KONDOR], zurueckAufDieBahn: true }) },
      { name: 'PROBE tor zur REIHER', verlockung: 'x', scheitertAn: 'guete', werk: torhalle({ vor: [REIHER, REIHER], schwelle: TOR_SCHWELLE, frei: [AUGE], nacharbeit: [REIHER], zurueckAufDieBahn: true }) },
      { name: 'PROBE tor0.62 zur KONDOR', verlockung: 'x', scheitertAn: 'guete', werk: torhalle({ vor: [REIHER, REIHER], schwelle: 0.62, frei: [AUGE], nacharbeit: [KONDOR], zurueckAufDieBahn: true }) },
      { name: 'PROBE tor0.7 zur KONDOR', verlockung: 'x', scheitertAn: 'guete', werk: torhalle({ vor: [KOLIBRI, REIHER], schwelle: 0.7, frei: [AUGE], nacharbeit: [KONDOR], zurueckAufDieBahn: true }) },
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
      'Letzter Tag der Prüfung. Das Landesamt schickt dreißig Vorgänge, von denen ein guter Teil ohne Beleg aus dem Bestand nicht zu lösen ist, und Rauhut hat den Ringordner aufgeschlagen liegen lassen. Der Bestand ist eine Fremdschnittstelle; er antwortet fast immer, und fast immer ist nicht immer. Für jeden Vorgang, der eine Ersatzbahn nimmt, will Zeile sieben dieselbe Spur sehen wie für alle anderen. Der Tokendeckel steht, die Halle ist voll, und jedes Auge, das du setzt, kostet einen Token und einen Platz auf dem Fundament.',
    lernziel:
      'Nachvollziehbarkeit ist eine Eigenschaft aller Pfade eines Werks, nicht des Pfades, den du dir beim Bauen vorgestellt hast.',
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
    budget: { kosten: 17000, dauer: 900 },
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
        metrik: 'flaeche',
        vergleich: '<=',
        wert: 5,
        text: 'Meisterstück: die Aktenlage stimmt mit höchstens fünf Modulen.',
        optional: true,
      },
    ],
    saat: 1031,
    vorbau: pruefpfad({ werkzeugArt: 'api', haupt: [REIHER, REIHER], ersatz: [REIHER] }),
    reflexion: 'Der Bestand fällt in wenigen Prozent der Fälle aus. Warum steht in der Prüfliste trotzdem keine Toleranz für diese Prozente?',
    notiz:
      'Sprachnotiz, 14. August, kurz nach der Abnahme. Rauhut hat nicht nach der Güte gefragt und nicht nach dem Preis. Er hat sich einen Vorgang herausgesucht, bei dem der Bestand geschwiegen hat, und gefragt, was danach passiert ist. Das ist die ganze Prüfung. Regel: Man wird nicht am Regelfall geprüft, sondern am Ausfall.',
    referenzen: [
      {
        name: 'Alles auf eine Spur',
        ansatz:
          'Die Ersatzbahn mündet zurück in die Hauptbahn, eine Sicherung fängt den Ausfall ab: fünf Module, ein einziges Auge, dafür der mittlere Kern auf jedem Vorgang.',
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
          'Die Ersatzbahn bleibt getrennt und bekommt ihren eigenen Abgriff: ein Modul mehr, dafür ein billigerer Weg für die Vorgänge ohne Beleg.',
        werk: pruefpfad({
          werkzeugArt: 'api',
          haupt: [REIHER, REIHER, AUGE],
          ersatz: [KONDOR, AUGE],
        }),
      },
    ],
    antiMuster: [
      {
        name: 'Auge nur auf der Hauptbahn',
        verlockung: 'Der Bestand fällt in wenigen Prozent der Fälle aus. Für so etwas baut man keine zweite Beobachtung.',
        scheitertAn: 'nachvollziehbarkeit',
        werk: pruefpfad({
          werkzeugArt: 'api',
          haupt: [REIHER, REIHER, AUGE],
          ersatz: [REIHER],
        }),
      },
      {
        name: 'Auge direkt hinter dem Werkzeug',
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
        name: 'Ohne Bestand, dafür KONDOR',
        verlockung: 'Ein großer Kern weiß genug. Wer kein Werkzeug anschliesst, hat auch keine Ersatzbahn zu beobachten.',
        scheitertAn: 'guete',
        werk: strasse([KONDOR, AUGE]),
      },
      {
        name: 'KONDOR auf beiden Bahnen',
        verlockung: 'Wenn am Freitag geprüft wird, bekommt jeder Vorgang das Beste, was die Halle hergibt.',
        scheitertAn: 'budget_kosten',
        werk: pruefpfad({
          werkzeugArt: 'api',
          haupt: [KONDOR, KONDOR, AUGE],
          ersatz: [KONDOR, AUGE],
        }),
      },
      { name: 'PROBE A ohne sich', verlockung: 'x', scheitertAn: 'guete', werk: pruefpfad({ werkzeugArt: 'api', haupt: [REIHER, REIHER, AUGE], ersatz: [], ersatzZurueck: true }) },
      { name: 'PROBE B ersatz REIHER', verlockung: 'x', scheitertAn: 'guete', werk: pruefpfad({ werkzeugArt: 'api', haupt: [REIHER, REIHER, AUGE], ersatz: [REIHER, AUGE] }) },
      { name: 'PROBE C ersatz KOLIBRI', verlockung: 'x', scheitertAn: 'guete', werk: pruefpfad({ werkzeugArt: 'api', haupt: [REIHER, REIHER, AUGE], ersatz: [KOLIBRI, AUGE] }) },
      { name: 'PROBE D sich3 zur', verlockung: 'x', scheitertAn: 'guete', werk: pruefpfad({ werkzeugArt: 'api', versuche: 3, haupt: [REIHER, REIHER, AUGE], ersatz: [], ersatzZurueck: true }) },
      { name: 'PROBE E suche sich2', verlockung: 'x', scheitertAn: 'guete', werk: pruefpfad({ werkzeugArt: 'suche', versuche: 2, haupt: [REIHER, REIHER, AUGE], ersatz: [], ersatzZurueck: true }) },
      { name: 'PROBE F suche 2bahn', verlockung: 'x', scheitertAn: 'guete', werk: pruefpfad({ werkzeugArt: 'suche', haupt: [REIHER, REIHER, AUGE], ersatz: [REIHER, AUGE] }) },
      { name: 'PROBE G api kk haupt', verlockung: 'x', scheitertAn: 'guete', werk: pruefpfad({ werkzeugArt: 'api', versuche: 2, haupt: [KOLIBRI, REIHER, AUGE], ersatz: [], ersatzZurueck: true }) },
    ],
    monolith: monolith(3),
  },
];
