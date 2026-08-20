/**
 * AKT IX — DIE HAND
 *
 * Neue Mechanik: die Hand — menschliche Freigabe in drei Betriebsarten
 * (immer, bei Vertraulichkeit, bei Unsicherheit).
 * Zentrale Lektion: Menschen sind teuer in Latenz und billig in Haftung. Eine
 * Freigabe kostet keinen einzigen Token, aber vierundzwanzig Ticks — und die
 * Hand bearbeitet immer nur einen Vorgang. Alles, was hinter ihr steht, wartet.
 *
 * Rhythmus (Kishotenketsu):
 *   IX-0 KI    — die Hand allein: vertrauliche Vorgänge brauchen eine
 *                Unterschrift, sonst zählt nur der Preis je Vorgang.
 *   IX-1 SHO   — die Hand trifft auf die Weiche und auf einen Latenzdeckel:
 *                die Betriebsart entscheidet, wie lang die Schlange wird.
 *   IX-2 TEN   — Bruch: bei hohem Anteil vertraulicher Vorgänge staut selbst
 *                die gezielte Freigabe. Es hilft nur ein zweiter Schalter oder
 *                eine Schwelle, die weniger vor den ersten stellt.
 *   IX-3 KETSU — Synthese: Vertraulichkeit, eingeschleuste Anweisungen und der
 *                Latenzdeckel gleichzeitig. Eine Hand prüft nur, was sie sieht.
 */

import type {
  HandModus,
  KernGroesse,
  ModulParameter,
  SpeicherModus,
  WallModus,
  Werk,
} from '../sim/typen';
import type { LevelDefinition } from './level_typen';
import { Bau, monolith } from './bauhilfe';

const QUELLE = '09_human_in_the_loop.md';

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
] as const;

// ---------------------------------------------------------------------------
// Baukasten dieses Akts
// ---------------------------------------------------------------------------

/**
 * Ein Glied einer Fertigungsstraße. Alle Module dieses Akts haben höchstens
 * zwei Ausgänge; die Verdrahtung der zweiten Ausgänge steckt in
 * `verbindeGlied` und ist damit an genau einer Stelle nachlesbar.
 */
type Glied =
  | { readonly kern: KernGroesse }
  | { readonly hand: HandModus; readonly schwelle?: number }
  | { readonly speicher: SpeicherModus }
  | { readonly wall: WallModus };

function K(groesse: KernGroesse): Glied {
  return { kern: groesse };
}

function HAND(modus: HandModus, schwelle?: number): Glied {
  return schwelle === undefined ? { hand: modus } : { hand: modus, schwelle };
}

function SP(modus: SpeicherModus): Glied {
  return { speicher: modus };
}

function WALL(modus: WallModus): Glied {
  return { wall: modus };
}

function handParameter(g: { readonly hand: HandModus; readonly schwelle?: number }): ModulParameter {
  return g.schwelle === undefined ? { modus: g.hand } : { modus: g.hand, schwelle: g.schwelle };
}

function setzeGlied(b: Bau, g: Glied, id: string, x: number, z: number): string {
  if ('kern' in g) return b.setze('kern', { groesse: g.kern }, id, x, z);
  if ('hand' in g) return b.setze('hand', handParameter(g), id, x, z);
  if ('speicher' in g) return b.setze('speicher', { modus: g.speicher }, id, x, z);
  return b.setze('wall', { modus: g.wall }, id, x, z);
}

/**
 * Verdrahtet die Ausgänge eines Glieds.
 *
 * Zwei Ausgänge bleiben bewusst offen: der abgelehnte Ausgang einer Hand und
 * der Alarm einer Ausgangs-Wall. Was ein Mensch ablehnt und was ein
 * Ausgangsfilter zurückhält, darf den Kunden nicht erreichen — es verlässt den
 * Fluss und taucht als fehlender Durchsatz in der Bilanz auf.
 */
function verbindeGlied(b: Bau, g: Glied, id: string, nach: string): void {
  if ('kern' in g || 'speicher' in g) {
    b.verbinde(id, nach, 'aus');
    return;
  }
  if ('hand' in g) {
    b.verbinde(id, nach, 'frei');
    return;
  }
  b.verbinde(id, nach, 'rein');
  // Ein Eingangsfilter entschärft und schickt weiter; ein Ausgangsfilter hält an.
  if (g.wall === 'eingang') b.verbinde(id, nach, 'alarm');
}

/** Quelle → Glieder in Reihe → Senke. Der Aufbau ohne jede Verzweigung. */
function strasse(glieder: readonly Glied[]): Werk {
  const b = new Bau();
  const q = b.setze('quelle', {}, 'q', 0, 5);
  const ids = glieder.map((g, i) => setzeGlied(b, g, `m${i + 1}`, 2 + i * 2, 5));
  const s = b.setze('senke', {}, 's', 2 + glieder.length * 2, 5);
  const folge = [...ids, s];
  b.verbinde(q, folge[0]!);
  glieder.forEach((g, i) => verbindeGlied(b, g, ids[i]!, folge[i + 1]!));
  return b.fertig();
}

interface GabelPlan {
  /** Gemeinsame Vorstufe vor der Weiche. */
  readonly vor: readonly Glied[];
  /** Bahn A: Kriterium nicht erfüllt, also die offenen Vorgänge. */
  readonly offen: readonly Glied[];
  /** Bahn B: Kriterium erfüllt, also die vertraulichen Vorgänge. */
  readonly vertraulich: readonly Glied[];
}

/** Quelle → Vorstufe → Weiche auf Vertraulichkeit → zwei Bahnen → Senke. */
function gabel(plan: GabelPlan): Werk {
  const b = new Bau();
  const q = b.setze('quelle', {}, 'q', 0, 5);
  const vorIds = plan.vor.map((g, i) => setzeGlied(b, g, `v${i + 1}`, 2 + i * 2, 5));
  const wx = 2 + plan.vor.length * 2;
  const w = b.setze('weiche', { kriterium: 'vertraulichkeit', schwelle: 0.5 }, 'w', wx, 5);
  const tiefe = Math.max(plan.offen.length, plan.vertraulich.length);
  const s = b.setze('senke', {}, 's', wx + 2 + tiefe * 2, 5);

  const vorFolge = [...vorIds, w];
  b.verbinde(q, vorFolge[0]!);
  plan.vor.forEach((g, i) => verbindeGlied(b, g, vorIds[i]!, vorFolge[i + 1]!));

  const aIds = plan.offen.map((g, i) => setzeGlied(b, g, `a${i + 1}`, wx + 2 + i * 2, 1));
  const aFolge = [...aIds, s];
  b.verbinde(w, aFolge[0]!, 'a');
  plan.offen.forEach((g, i) => verbindeGlied(b, g, aIds[i]!, aFolge[i + 1]!));

  const bIds = plan.vertraulich.map((g, i) => setzeGlied(b, g, `b${i + 1}`, wx + 2 + i * 2, 9));
  const bFolge = [...bIds, s];
  b.verbinde(w, bFolge[0]!, 'b');
  plan.vertraulich.forEach((g, i) => verbindeGlied(b, g, bIds[i]!, bFolge[i + 1]!));
  return b.fertig();
}

interface SchalterPlan {
  /** Gemeinsame Vorstufe, die jeder Vorgang durchläuft. */
  readonly vor: readonly Glied[];
  /** Wie viele Hände sich die vertraulichen Vorgänge teilen. */
  readonly schalter: 1 | 2;
  readonly modus: HandModus;
  readonly schwelle?: number;
  /** Was auf der vertraulichen Bahn vor der Hand steht (etwa ein Abruf). */
  readonly vorHand?: readonly Glied[];
  /** Eingangsfilter ganz vorn. */
  readonly filterEingang?: true;
  /** Ausgangsfilter unmittelbar vor der Auslieferung. */
  readonly filterAusgang?: true;
}

/**
 * Der Bypass-Aufbau dieses Akts: eine Weiche auf Vertraulichkeit schickt die
 * offenen Vorgänge an der Freigabe vorbei. Nur die vertrauliche Bahn läuft auf
 * einen oder — über eine zweite Weiche auf die Schwierigkeit — auf zwei
 * Schalter. Zwei Schalter halbieren die Warteschlange, kosten aber zwei Module.
 */
function schalterhalle(plan: SchalterPlan): Werk {
  const b = new Bau();
  const q = b.setze('quelle', {}, 'q', 0, 5);
  const vorne: Glied[] = plan.filterEingang ? [WALL('eingang'), ...plan.vor] : [...plan.vor];
  const vorIds = vorne.map((g, i) => setzeGlied(b, g, `v${i + 1}`, 2 + i * 2, 5));
  const wx = 2 + vorne.length * 2;
  const w1 = b.setze('weiche', { kriterium: 'vertraulichkeit', schwelle: 0.5 }, 'w1', wx, 5);
  const ausgang = plan.filterAusgang ? b.setze('wall', { modus: 'ausgang' }, 'wa', wx + 8, 5) : null;
  const s = b.setze('senke', {}, 's', wx + 10, 5);
  const sammelpunkt = ausgang ?? s;

  const vorFolge = [...vorIds, w1];
  b.verbinde(q, vorFolge[0]!);
  vorne.forEach((g, i) => verbindeGlied(b, g, vorIds[i]!, vorFolge[i + 1]!));
  if (ausgang) b.verbinde(ausgang, s, 'rein');

  // Bahn A: nicht vertraulich, geht ohne Freigabe weiter.
  b.verbinde(w1, sammelpunkt, 'a');

  const param = handParameter({ hand: plan.modus, ...(plan.schwelle === undefined ? {} : { schwelle: plan.schwelle }) });
  const vorHand = plan.vorHand ?? [];

  if (plan.schalter === 1) {
    const pIds = vorHand.map((g, i) => setzeGlied(b, g, `p${i + 1}`, wx + i * 2, 9));
    const h = b.setze('hand', param, 'h1', wx + vorHand.length * 2, 9);
    const folge = [...pIds, h];
    b.verbinde(w1, folge[0]!, 'b');
    vorHand.forEach((g, i) => verbindeGlied(b, g, pIds[i]!, folge[i + 1]!));
    b.verbinde(h, sammelpunkt, 'frei');
    return b.fertig();
  }

  const pIds = vorHand.map((g, i) => setzeGlied(b, g, `p${i + 1}`, wx + i * 2, 9));
  const w2 = b.setze('weiche', { kriterium: 'schwierigkeit', schwelle: 0.5 }, 'w2', wx + vorHand.length * 2, 9);
  const folge = [...pIds, w2];
  b.verbinde(w1, folge[0]!, 'b');
  vorHand.forEach((g, i) => verbindeGlied(b, g, pIds[i]!, folge[i + 1]!));
  const h1 = b.setze('hand', param, 'h1', wx + vorHand.length * 2 + 2, 8);
  const h2 = b.setze('hand', param, 'h2', wx + vorHand.length * 2 + 2, 10);
  b.verbinde(w2, h1, 'a');
  b.verbinde(w2, h2, 'b');
  b.verbinde(h1, sammelpunkt, 'frei');
  b.verbinde(h2, sammelpunkt, 'frei');
  return b.fertig();
}

const REIHER = K('reiher');
const KOLIBRI = K('kolibri');
const KONDOR = K('kondor');
/** Freigabe für jeden Vorgang — vierundzwanzig Ticks, egal was drinsteht. */
const IMMER = HAND('immer');
/** Freigabe nur für vertrauliche Vorgänge. */
const BEI_VERTRAULICH = HAND('bei_vertraulich');
/** Abrufen: räumt Unsicherheit ab und hebt die Güte-Decke um sechs Punkte. */
const ABRUF = SP('abrufen');

// ---------------------------------------------------------------------------
// Die vier Level
// ---------------------------------------------------------------------------

export const AKT_9: LevelDefinition[] = [
  // =========================================================================
  {
    id: 'IX-0',
    akt: 9,
    nummer: 0,
    titel: 'Die Unterschrift',
    untertitel: 'Dienstanweisung 14, Absatz 2',
    briefing:
      'Seit Montag hängt neben der Stempeluhr eine Dienstanweisung. Absatz 2: Vorgänge mit personenbezogenen Daten verlassen Halle 3 nur mit menschlicher Freigabe. Auf der Palette am Tor steht dafür ein neues Modul. Die Hand kostet keinen einzigen Token. Sie kostet vierundzwanzig Ticks, und sie bearbeitet immer nur einen Vorgang; wer dahinter steht, wartet. Drei Betriebsarten stehen zur Wahl: immer, bei Vertraulichkeit, bei Unsicherheit. Heute zählt nur zweierlei — dass am Ende jeder vertrauliche Vorgang eine Unterschrift trägt, und dass der Einkauf die Rechnung nicht wieder gelb markiert.',
    lernziel:
      'Ein vertraulicher Vorgang wird erst konform, wenn ein Mensch ihn freigegeben hat, und diese Freigabe kostet Zeit statt Token.',
    quelle: QUELLE,
    module: [...MODULE],
    strom: {
      anzahl: 24,
      takt: 6,
      domaenen: ['recht', 'finanz'],
      schwierigkeit: [0.2, 0.55],
      mehrdeutigkeit: [0.05, 0.25],
      anteilVertraulich: 0.35,
    },
    budget: { dauer: 800 },
    ziele: [
      { id: 'alles', metrik: 'durchsatz', vergleich: '>=', wert: 1, text: 'Jeder Vorgang wird ausgeliefert.' },
      {
        id: 'konform',
        metrik: 'konformitaet',
        vergleich: '==',
        wert: 1,
        text: 'Jeder vertrauliche Vorgang trägt eine menschliche Freigabe.',
      },
      { id: 'guete', metrik: 'guete', vergleich: '>=', wert: 0.74, text: 'Mindestgüte 74 Prozent.' },
      {
        id: 'preis',
        metrik: 'kostenJeAuftrag',
        vergleich: '<=',
        wert: 700,
        text: 'Höchstens 700 Token je Vorgang.',
      },
    ],
    saat: 901,
    vorbau: strasse([REIHER, REIHER]),
    reflexion: 'Die Unterschrift hat keinen einzigen Token gekostet. An welcher Stelle taucht sie in deiner Bilanz trotzdem auf?',
    notiz:
      'Sprachnotiz, 7. Juli, 06:40. Die Dienstanweisung ist zwei Seiten lang und hat einen einzigen wichtigen Satz. Ein Mensch haftet, eine Maschine nicht. Der Mensch steht also nicht im Weg, sondern an der Stelle, an der jemand geradestehen muss. Regel: Freigabe ist kein Misstrauen, sondern eine Zuständigkeit.',
    referenzen: [
      {
        name: 'Zwei REIHER, dann die Freigabe',
        ansatz:
          'Zwei mittlere Kerne holen die Güte, die Hand unterschreibt nur die vertraulichen Vorgänge — günstig je Vorgang, dafür ein Modul mehr.',
        werk: strasse([REIHER, REIHER, BEI_VERTRAULICH]),
      },
      {
        name: 'Ein KONDOR, dann die Freigabe',
        ansatz:
          'Ein einziger großer Kern statt der Kette: kleinste Fläche im Werk, höchster Preis je Vorgang.',
        werk: strasse([KONDOR, BEI_VERTRAULICH]),
      },
    ],
    antiMuster: [
      {
        name: 'Ohne Unterschrift',
        verlockung: 'Die Kette liefert saubere Güte zum halben Preis. Die Dienstanweisung ist ein Formblatt, kein Bauteil.',
        scheitertAn: 'konformitaet',
        werk: strasse([REIHER, REIHER]),
      },
      {
        name: 'Freigabe nach Zweifel',
        verlockung: 'Der Mensch soll nur ran, wenn die Maschine unsicher ist. Das spart Wartezeit und klingt nach gesundem Menschenverstand.',
        scheitertAn: 'konformitaet',
        werk: strasse([REIHER, REIHER, HAND('bei_unsicherheit', 0.4)]),
      },
      {
        name: 'Zweimal KONDOR, dann die Freigabe',
        verlockung: 'Wenn am Ende ohnehin ein Mensch draufschaut, soll ihm wenigstens etwas Gutes vorgelegt werden.',
        scheitertAn: 'kostenJeAuftrag',
        werk: strasse([KONDOR, KONDOR, BEI_VERTRAULICH]),
      },
    ],
    monolith: monolith(2),
  },

  // =========================================================================
  {
    id: 'IX-1',
    akt: 9,
    nummer: 1,
    titel: 'Die Schlange',
    untertitel: 'Zielvereinbarung, Kennzahl 3',
    briefing:
      'Der Kunde hat die Konformität der letzten Woche gelobt und im selben Atemzug eine Kennzahl nachgereicht. Kennzahl 3: Ein Vorgang verlässt das Werk in höchstens fünfzig Ticks, gemessen am 95. Perzentil. Deine Anlage steht noch so da, wie du sie am Freitag hinterlassen hast — mit einer Hand in der Betriebsart Immer. Sie unterschreibt alles. Und weil sie immer nur einen Vorgang gleichzeitig bearbeitet, steht der Rest der Halle Schlange. Die Betriebsart entscheidet, wie viel Arbeit vor dem Schalter landet. Eine Weiche entscheidet, wer überhaupt hinkommt.',
    lernziel:
      'Die Betriebsart einer Hand bestimmt, wie viel des Stroms in ihrer Warteschlange landet, und damit die Latenz des gesamten Werks.',
    quelle: QUELLE,
    module: [...MODULE],
    strom: {
      anzahl: 24,
      takt: 8,
      domaenen: ['recht', 'text', 'finanz'],
      schwierigkeit: [0.2, 0.6],
      mehrdeutigkeit: [0.05, 0.3],
      anteilVertraulich: 0.25,
    },
    budget: { latenz: 50, dauer: 800 },
    ziele: [
      { id: 'alles', metrik: 'durchsatz', vergleich: '>=', wert: 1, text: 'Jeder Vorgang wird ausgeliefert.' },
      {
        id: 'konform',
        metrik: 'konformitaet',
        vergleich: '==',
        wert: 1,
        text: 'Jeder vertrauliche Vorgang trägt eine menschliche Freigabe.',
      },
      { id: 'guete', metrik: 'guete', vergleich: '>=', wert: 0.74, text: 'Mindestgüte 74 Prozent.' },
    ],
    saat: 911,
    vorbau: strasse([REIHER, REIHER, IMMER]),
    reflexion: 'Dieselbe Hand, dieselben vertraulichen Vorgänge, ein Bruchteil der Wartezeit. Was genau hast du verändert?',
    notiz:
      'Sprachnotiz, 12. Juli. Wir hatten einmal eine Regel: Alles wird gegengezeichnet. Zwei Wochen später war die Gegenzeichnung der Engpass der ganzen Halle. Die Regel war nicht falsch, sie war unsortiert — die Hälfte der Vorgänge musste niemand sehen. Regel: Sortiere vor dem Schalter, nicht dahinter.',
    referenzen: [
      {
        name: 'Freigabe in der Linie',
        ansatz:
          'Eine einzige Hand mitten in der Kette, umgestellt auf Vertraulichkeit: drei Module, kurze Wege, mittlerer Preis je Vorgang.',
        werk: strasse([REIHER, REIHER, BEI_VERTRAULICH]),
      },
      {
        name: 'Vorsortiert am Eingang',
        ansatz:
          'Eine Weiche trennt vertrauliche von offenen Vorgängen; die offene Bahn bekommt den kleinsten Kern, die vertrauliche den Schalter — deutlich billiger, dafür doppelt so viele Module.',
        werk: gabel({
          vor: [],
          offen: [KOLIBRI, REIHER],
          vertraulich: [REIHER, REIHER, IMMER],
        }),
      },
    ],
    antiMuster: [
      {
        name: 'Alles gegenzeichnen lassen',
        verlockung: 'Wer alles unterschreiben lässt, kann bei keinem Vorgang danebenliegen. Die Betriebsart Immer ist die sicherste von dreien.',
        scheitertAn: 'budget_latenz',
        werk: strasse([REIHER, REIHER, IMMER]),
      },
      {
        name: 'Die Hand wieder ausgebaut',
        verlockung: 'Ohne Schalter gibt es keine Schlange. Die Kennzahl steht in der Zielvereinbarung, die Freigabe nur in einer Dienstanweisung.',
        scheitertAn: 'konformitaet',
        werk: strasse([REIHER, REIHER]),
      },
      {
        name: 'Freigabe nur bei Zweifel',
        verlockung: 'Eine Schwelle auf der Unsicherheit hält die Schlange kurz und trifft trotzdem die kritischen Vorgänge.',
        scheitertAn: 'konformitaet',
        werk: strasse([REIHER, REIHER, HAND('bei_unsicherheit', 0.35)]),
      },
    ],
    monolith: monolith(2),
  },

  // =========================================================================
  {
    id: 'IX-2',
    akt: 9,
    nummer: 2,
    titel: 'Der Andrang',
    untertitel: 'Sonderlauf für das LAVV',
    briefing:
      'Das Landesamt für Verwaltungsvereinfachung hat einen Sonderlauf beauftragt, und in diesem Los ist fast jeder zweite Vorgang vertraulich. Der Latenzdeckel ist zugleich auf vierzig Ticks gesunken. Deine Anlage der letzten Woche steht noch: eine Hand, umgestellt auf Vertraulichkeit, genau so, wie es funktioniert hat. Sie funktioniert nicht mehr. Vierundzwanzig Ticks je Freigabe, alle fünfzehn Ticks ein neuer vertraulicher Vorgang — die Schlange wächst schneller, als sie abgebaut wird. Dienstanweisung 14 kennt seit Januar eine risikobasierte Freigabe: Nicht jeder vertrauliche Vorgang braucht eine Unterschrift, aber jeder zweifelhafte.',
    lernziel:
      'Gegen einen überlasteten Schalter hilft nur ein zweiter Schalter oder weniger Arbeit vor dem ersten.',
    quelle: QUELLE,
    module: [...MODULE],
    strom: {
      anzahl: 30,
      takt: 6,
      domaenen: ['recht', 'finanz', 'analyse'],
      schwierigkeit: [0.25, 0.7],
      mehrdeutigkeit: [0.2, 0.5],
      anteilVertraulich: 0.4,
    },
    budget: { latenz: 40, dauer: 800 },
    ziele: [
      { id: 'alles', metrik: 'durchsatz', vergleich: '>=', wert: 1, text: 'Jeder Vorgang wird ausgeliefert.' },
      {
        id: 'konform',
        metrik: 'konformitaet',
        vergleich: '>=',
        wert: 0.5,
        text: 'Mindestens die Hälfte der vertraulichen Vorgänge trägt eine Freigabe.',
      },
      { id: 'guete', metrik: 'guete', vergleich: '>=', wert: 0.75, text: 'Mindestgüte 75 Prozent.' },
      {
        id: 'meister',
        metrik: 'konformitaet',
        vergleich: '>=',
        wert: 0.9,
        text: 'Meisterstück: mindestens 90 Prozent der vertraulichen Vorgänge tragen eine Freigabe.',
        optional: true,
      },
    ],
    saat: 921,
    vorbau: strasse([REIHER, REIHER, BEI_VERTRAULICH]),
    reflexion:
      'Zwei Wege halten den Deckel: ein zweiter Schalter und eine Schwelle. Welcher der beiden ist einer Prüfung leichter zu erklären?',
    notiz:
      'Sprachnotiz, 19. Juli. Vierundzwanzig Ticks sind vierundzwanzig Ticks, daran ändert kein Werkzeug etwas. Es bleiben zwei Hebel: einen zweiten Schalter aufmachen oder weniger vor den ersten stellen. Beides ist erlaubt, beides kostet. Regel: Gegen eine Warteschlange hilft Kapazität oder Auswahl, niemals Nachdruck.',
    referenzen: [
      {
        name: 'Zwei Schalter hinter der Weiche',
        ansatz:
          'Offene Vorgänge gehen an der Freigabe vorbei, die vertraulichen teilt eine zweite Weiche auf zwei Hände auf — volle Konformität zum Preis von sechs Modulen.',
        werk: schalterhalle({ vor: [REIHER, REIHER], schalter: 2, modus: 'immer' }),
      },
      {
        name: 'Risikobasiert eskaliert',
        ansatz:
          'Ein Abruf räumt vor dem Schalter die Unsicherheit ab, danach eskaliert nur noch, was über der Schwelle liegt — ein Modul weniger und die kürzeste Wartezeit, dafür teurer und ohne volle Konformität.',
        werk: schalterhalle({
          vor: [REIHER, REIHER],
          schalter: 1,
          modus: 'bei_unsicherheit',
          schwelle: 0.2,
          vorHand: [ABRUF],
        }),
      },
    ],
    antiMuster: [
      {
        name: 'Die Anlage der letzten Woche',
        verlockung: 'Sie hat vergangene Woche jede Kennzahl gehalten. Ein anderes Los ist noch kein Grund für einen Umbau.',
        scheitertAn: 'budget_latenz',
        werk: strasse([REIHER, REIHER, BEI_VERTRAULICH]),
      },
      {
        name: 'Ein Schalter für alle Vertraulichen',
        verlockung: 'Die Weiche hält die offenen Vorgänge aus der Schlange. Damit ist der Engpass doch beseitigt.',
        scheitertAn: 'budget_latenz',
        werk: schalterhalle({ vor: [REIHER, REIHER], schalter: 1, modus: 'immer' }),
      },
      {
        name: 'Die Schwelle hochgedreht',
        verlockung: 'Wenn eine hohe Schwelle die Wartezeit senkt, senkt eine noch höhere sie weiter. Die Zahl steht in keiner Dienstanweisung.',
        scheitertAn: 'konformitaet',
        werk: schalterhalle({
          vor: [REIHER, REIHER],
          schalter: 1,
          modus: 'bei_unsicherheit',
          schwelle: 0.3,
          vorHand: [ABRUF],
        }),
      },
      {
        name: 'Freigabe ausgesetzt',
        verlockung: 'Der Deckel ist hart, die Freigabe ist weich. Für einen Sonderlauf kann die Unterschrift einmal warten.',
        scheitertAn: 'konformitaet',
        werk: strasse([REIHER, REIHER]),
      },
    ],
    monolith: monolith(3),
  },

  // =========================================================================
  {
    id: 'IX-3',
    akt: 9,
    nummer: 3,
    titel: 'Der Abnahmelauf',
    untertitel: 'Freitag, sechzehn Uhr',
    briefing:
      'Abnahme. Das Landesamt schickt dreißig Vorgänge und sieht zu. Jeder vierte trägt eine eingeschleuste Anweisung, jeder vierte ist vertraulich, und die beiden Mengen überschneiden sich nur zufällig. Der Latenzdeckel steht bei fünfundfünfzig Ticks. Drei Dinge gelten gleichzeitig: Kein kompromittiertes Ergebnis verlässt die Halle, ein hinreichender Teil der vertraulichen Vorgänge trägt eine Unterschrift, und der Deckel hält. Denk daran, was eine Hand kann und was nicht. Sie erkennt eine Manipulation fast immer — aber nur an den Vorgängen, die ihre Betriebsart ihr überhaupt vorlegt.',
    lernziel:
      'Eine Hand prüft ausschließlich die Vorgänge, die ihre Betriebsart ihr vorlegt, und alles andere muss ein Filter abfangen.',
    quelle: QUELLE,
    module: [...MODULE],
    strom: {
      anzahl: 30,
      takt: 7,
      domaenen: ['recht', 'finanz', 'technik'],
      schwierigkeit: [0.3, 0.75],
      mehrdeutigkeit: [0.15, 0.45],
      anteilVertraulich: 0.25,
      anteilGiftig: 0.25,
    },
    budget: { latenz: 55, dauer: 800 },
    ziele: [
      {
        id: 'liefert',
        metrik: 'durchsatz',
        vergleich: '>=',
        wert: 0.9,
        text: 'Mindestens 90 Prozent der Vorgänge werden ausgeliefert.',
      },
      {
        id: 'dicht',
        metrik: 'sicherheit',
        vergleich: '==',
        wert: 1,
        text: 'Kein kompromittiertes Ergebnis verlässt die Halle.',
      },
      {
        id: 'konform',
        metrik: 'konformitaet',
        vergleich: '>=',
        wert: 0.4,
        text: 'Mindestens 40 Prozent der vertraulichen Vorgänge tragen eine Freigabe.',
      },
      { id: 'guete', metrik: 'guete', vergleich: '>=', wert: 0.79, text: 'Mindestgüte 79 Prozent.' },
      {
        id: 'meister',
        metrik: 'konformitaet',
        vergleich: '>=',
        wert: 0.85,
        text: 'Meisterstück: mindestens 85 Prozent der vertraulichen Vorgänge tragen eine Freigabe.',
        optional: true,
      },
    ],
    saat: 931,
    vorbau: strasse([WALL('eingang'), REIHER, REIHER, BEI_VERTRAULICH, WALL('ausgang')]),
    reflexion: 'Deine Hand hat jede Manipulation erkannt, die auf ihrem Tisch lag. Wie viele Vorgänge hat sie in diesem Lauf nie gesehen?',
    notiz:
      'Sprachnotiz, 26. Juli, letzter Eintrag vor dem Urlaub. Bei einer Abnahme fragt niemand, wie klug ein Werk ist. Gefragt wird, wer unterschrieben hat und was zwischen Eingang und Unterschrift geschehen ist. Eine Hand haftet nur für das, was auf ihrem Tisch lag. Regel: Was du dem Menschen nicht zeigst, hat er auch nicht geprüft.',
    referenzen: [
      {
        name: 'Zwei Schalter, zwei Filter',
        ansatz:
          'Eingangsfilter, zwei Kerne, Bypass für die offenen Vorgänge, zwei Hände für die vertraulichen, Ausgangsfilter vor der Auslieferung — die breiteste Anlage, dafür fast lückenlose Konformität.',
        werk: schalterhalle({
          vor: [REIHER, REIHER],
          schalter: 2,
          modus: 'immer',
          filterEingang: true,
          filterAusgang: true,
        }),
      },
      {
        name: 'Ein Schalter, risikobasiert',
        ansatz:
          'Derselbe Filterrahmen, aber nur ein Schalter: Ein Abruf senkt die Unsicherheit, die Schwelle lässt nur die zweifelhaften Vorgänge eskalieren — ein Modul weniger und die kürzeste Wartezeit, dafür teurer und mit halber Konformität.',
        werk: schalterhalle({
          vor: [REIHER, REIHER],
          schalter: 1,
          modus: 'bei_unsicherheit',
          schwelle: 0.15,
          vorHand: [ABRUF],
          filterEingang: true,
          filterAusgang: true,
        }),
      },
    ],
    antiMuster: [
      {
        name: 'Freigabe in der Linie',
        verlockung: 'Der Aufbau aus der Kennzahlwoche ist erprobt, gefiltert und voll konform. Am Tag der Abnahme baut man nichts um.',
        scheitertAn: 'budget_latenz',
        werk: strasse([WALL('eingang'), REIHER, REIHER, BEI_VERTRAULICH, WALL('ausgang')]),
      },
      {
        name: 'Ein Schalter für alle Vertraulichen',
        verlockung: 'Der Bypass nimmt die offenen Vorgänge aus der Schlange. Ein zweiter Schalter wäre doppelte Fläche für dasselbe Ergebnis.',
        scheitertAn: 'budget_latenz',
        werk: schalterhalle({
          vor: [REIHER, REIHER],
          schalter: 1,
          modus: 'immer',
          filterEingang: true,
          filterAusgang: true,
        }),
      },
      {
        name: 'Die Schwelle zu tief',
        verlockung: 'Je tiefer die Schwelle, desto mehr Unterschriften. Für eine Abnahme kann Konformität nicht schaden.',
        scheitertAn: 'budget_latenz',
        werk: schalterhalle({
          vor: [REIHER, REIHER],
          schalter: 1,
          modus: 'bei_unsicherheit',
          schwelle: 0.12,
          vorHand: [ABRUF],
          filterEingang: true,
          filterAusgang: true,
        }),
      },
      {
        name: 'Die Schwelle zu hoch',
        verlockung: 'Eine hohe Schwelle hält die Wartezeit klein und lässt trotzdem die wirklich unklaren Vorgänge durch die Freigabe laufen.',
        scheitertAn: 'konformitaet',
        werk: schalterhalle({
          vor: [REIHER, REIHER],
          schalter: 1,
          modus: 'bei_unsicherheit',
          schwelle: 0.3,
          vorHand: [ABRUF],
          filterEingang: true,
          filterAusgang: true,
        }),
      },
      {
        name: 'Die Hand als einziger Filter',
        verlockung: 'Ein Mensch erkennt eine eingeschleuste Anweisung besser als jeder Filter. Zwei Wall-Module sind damit überflüssig.',
        scheitertAn: 'sicherheit',
        werk: schalterhalle({ vor: [REIHER, REIHER], schalter: 2, modus: 'immer' }),
      },
      {
        name: 'Nur der Eingangsfilter',
        verlockung: 'Wer die Einschleusung am Tor abfängt, braucht am Ausgang nichts mehr zu prüfen — und spart den Fehlalarm.',
        scheitertAn: 'sicherheit',
        werk: schalterhalle({
          vor: [REIHER, REIHER],
          schalter: 2,
          modus: 'immer',
          filterEingang: true,
        }),
      },
    ],
    monolith: monolith(3),
  },
];
