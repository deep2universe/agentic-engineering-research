/**
 * AKT XI — DIE SCHMIEDE
 *
 * Neue Mechanik: die Schmiede — die Evolutionskammer. Sie greift nicht in den
 * Auftragsfluss ein: null Token, null Ticks. Sie kostet genau eine Sache, und
 * zwar einen Bauplatz. Damit ist sie das ehrlichste Modul des Spiels: der
 * Suchapparat ist Gemeinkosten, nicht Produktion.
 *
 * Zentrale Lektion: Du baust nicht die Pipeline, du baust den Selektionsdruck.
 * Wer eine einzelne Kennzahl vorgibt, bekommt eine Anlage, die genau diese
 * Kennzahl bedient — und sonst nichts.
 *
 * Rhythmus (Kishotenketsu):
 *   XI-0 KI    — derselbe Auftragsstrom, drei sehr verschiedene gute Anlagen.
 *                Die Vorgabe ist absichtlich weit; sichtbar wird die Front.
 *   XI-1 SHO   — ein enger Kostendeckel. Er faellt nicht ueber die Kernwahl,
 *                sondern nur ueber eine unkonventionelle Kombination.
 *   XI-2 TEN   — Bruch: die Kennzahl allein laesst sich betruegen. Eine
 *                Schranke mit hoher Schwelle wirft weg, was den Schnitt
 *                druecken wuerde. Erst eine zweite Zahl macht das Werk wieder
 *                ehrlich — und die Anlage aus dem SHO-Level faellt durch.
 *   XI-3 KETSU — Synthese: Flaeche, Preis, Wartezeit, Guete und Durchsatz
 *                stehen gleichzeitig unter Druck. Die Front schrumpft auf
 *                wenige Punkte, und jeder davon ist ein bewusster Verzicht.
 */

import type {
  Domaene,
  HandModus,
  KernGroesse,
  ModulParameter,
  SammlerModus,
  SpeicherModus,
  WallModus,
  WeicheKriterium,
  Werk,
  WerkzeugArt,
} from '../sim/typen';
import type { LevelDefinition } from './level_typen';
import { Bau, monolith } from './bauhilfe';

const QUELLE = '11_frameworks_implementierung.md';

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
  'schmiede',
] as const;

// ---------------------------------------------------------------------------
// Baukasten dieses Akts
// ---------------------------------------------------------------------------

/**
 * Ein Glied einer Fertigungsstrasse. Der Akt braucht viele Varianten desselben
 * Werks — deshalb ist jedes Bauteil ein Datensatz und die Verdrahtung seiner
 * Ausgaenge steht an genau einer Stelle.
 */
type Glied =
  | { readonly kern: KernGroesse; readonly spez?: Domaene }
  | { readonly werkzeug: WerkzeugArt }
  | { readonly speicher: SpeicherModus }
  | { readonly wall: WallModus }
  | { readonly hand: HandModus; readonly schwelle?: number }
  /** Schranke, deren Durchgefallene weiterlaufen — eine Messstelle, kein Sieb. */
  | { readonly schranke: number }
  /** Schranke, deren Durchgefallene den Fluss verlassen — das Sieb. */
  | { readonly sieb: number }
  | { readonly auge: true }
  | { readonly schmiede: true };

function K(groesse: KernGroesse, spez?: Domaene): Glied {
  return spez === undefined ? { kern: groesse } : { kern: groesse, spez };
}

function W(art: WerkzeugArt): Glied {
  return { werkzeug: art };
}

function SP(modus: SpeicherModus): Glied {
  return { speicher: modus };
}

function WA(modus: WallModus): Glied {
  return { wall: modus };
}

function HD(modus: HandModus, schwelle?: number): Glied {
  return schwelle === undefined ? { hand: modus } : { hand: modus, schwelle };
}

function GATE(schwelle: number): Glied {
  return { schranke: schwelle };
}

function SIEB(schwelle: number): Glied {
  return { sieb: schwelle };
}

const AUGE: Glied = { auge: true };
const SCHMIEDE: Glied = { schmiede: true };

function setzeGlied(b: Bau, g: Glied, id: string, x: number, z: number): string {
  if ('kern' in g) {
    const p: ModulParameter =
      g.spez === undefined ? { groesse: g.kern } : { groesse: g.kern, spezialisierung: g.spez };
    return b.setze('kern', p, id, x, z);
  }
  if ('werkzeug' in g) return b.setze('werkzeug', { werkzeugArt: g.werkzeug }, id, x, z);
  if ('speicher' in g) return b.setze('speicher', { modus: g.speicher }, id, x, z);
  if ('wall' in g) return b.setze('wall', { modus: g.wall }, id, x, z);
  if ('hand' in g) {
    const p: ModulParameter =
      g.schwelle === undefined ? { modus: g.hand } : { modus: g.hand, schwelle: g.schwelle };
    return b.setze('hand', p, id, x, z);
  }
  if ('schranke' in g) return b.setze('schranke', { schwelle: g.schranke }, id, x, z);
  if ('sieb' in g) return b.setze('schranke', { schwelle: g.sieb }, id, x, z);
  if ('auge' in g) return b.setze('auge', {}, id, x, z);
  return b.setze('schmiede', { population: 12, generationen: 8 }, id, x, z);
}

/**
 * Verdrahtet die Ausgaenge eines Glieds.
 *
 * Genau ein Ausgang bleibt bewusst offen: der Fehlerausgang eines Siebs. Was
 * dort hinausfaellt, verlaesst den Fluss und taucht als fehlender Durchsatz in
 * der Bilanz auf. Das ist die Mechanik, auf der das Anti-Muster dieses Akts
 * beruht — und der Grund, warum eine Kennzahl allein nichts beweist.
 */
function verbindeGlied(b: Bau, g: Glied, id: string, nach: string): void {
  if ('kern' in g || 'speicher' in g || 'auge' in g || 'schmiede' in g) {
    b.verbinde(id, nach, 'aus');
    return;
  }
  if ('werkzeug' in g) {
    b.verbinde(id, nach, 'ok');
    b.verbinde(id, nach, 'fehler');
    return;
  }
  if ('wall' in g) {
    b.verbinde(id, nach, 'rein');
    if (g.wall === 'eingang') b.verbinde(id, nach, 'alarm');
    return;
  }
  if ('hand' in g) {
    b.verbinde(id, nach, 'frei');
    return;
  }
  if ('schranke' in g) {
    b.verbinde(id, nach, 'ok');
    b.verbinde(id, nach, 'fehler');
    return;
  }
  b.verbinde(id, nach, 'ok');
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

interface NacharbeitPlan {
  /** Gemeinsame Vorstufe vor der Schranke. */
  readonly vor: readonly Glied[];
  readonly schwelle: number;
  /** Was mit den Durchgefallenen geschieht, bevor sie wieder einlaufen. */
  readonly reparatur: readonly Glied[];
  /** Gemeinsame Nachstufe, die beide Bahnen durchlaufen. */
  readonly nach?: readonly Glied[];
}

/**
 * Die Schranke als Verteiler zweier Qualitaeten: Wer besteht, geht direkt
 * weiter; wer durchfaellt, laeuft ueber eine Nacharbeitsbahn und kommt zurueck.
 * Nichts verlaesst den Fluss — Guete wird hergestellt, nicht ausgesiebt.
 */
function nacharbeit(plan: NacharbeitPlan): Werk {
  const b = new Bau();
  const q = b.setze('quelle', {}, 'q', 0, 5);
  const vorIds = plan.vor.map((g, i) => setzeGlied(b, g, `v${i + 1}`, 2 + i * 2, 5));
  const gx = 2 + plan.vor.length * 2;
  const tor = b.setze('schranke', { schwelle: plan.schwelle }, 'g', gx, 5);
  const nach = plan.nach ?? [];
  const nachIds = nach.map((g, i) => setzeGlied(b, g, `n${i + 1}`, gx + 2 + i * 2, 5));
  const tiefe = Math.max(nach.length, plan.reparatur.length);
  const s = b.setze('senke', {}, 's', gx + 4 + tiefe * 2, 5);
  const sammelpunkt = nachIds[0] ?? s;

  const vorFolge = [...vorIds, tor];
  b.verbinde(q, vorFolge[0]!);
  plan.vor.forEach((g, i) => verbindeGlied(b, g, vorIds[i]!, vorFolge[i + 1]!));

  const nachFolge = [...nachIds, s];
  nach.forEach((g, i) => verbindeGlied(b, g, nachIds[i]!, nachFolge[i + 1]!));

  b.verbinde(tor, sammelpunkt, 'ok');
  const repIds = plan.reparatur.map((g, i) => setzeGlied(b, g, `r${i + 1}`, gx + 2 + i * 2, 9));
  const repFolge = [...repIds, sammelpunkt];
  b.verbinde(tor, repFolge[0]!, 'fehler');
  plan.reparatur.forEach((g, i) => verbindeGlied(b, g, repIds[i]!, repFolge[i + 1]!));
  return b.fertig();
}

interface SchleifePlan {
  readonly vor?: readonly Glied[];
  /** Der Block, den eine Nacharbeit erneut durchlaeuft. Nie leer. */
  readonly block: readonly Glied[];
  readonly schwelle: number;
  readonly runden: number;
  readonly nach?: readonly Glied[];
}

/** Der Rueckweg: eine Prueferin schickt zu Schwaches noch einmal in den Block. */
function schleife(plan: SchleifePlan): Werk {
  const b = new Bau();
  const vor = plan.vor ?? [];
  const nach = plan.nach ?? [];
  const q = b.setze('quelle', {}, 'q', 0, 5);
  const vorIds = vor.map((g, i) => setzeGlied(b, g, `v${i + 1}`, 2 + i * 2, 5));
  const bx = 2 + vor.length * 2;
  const blockIds = plan.block.map((g, i) => setzeGlied(b, g, `b${i + 1}`, bx + i * 2, 5));
  const px = bx + plan.block.length * 2;
  const pr = b.setze('pruefer', { schwelle: plan.schwelle, runden: plan.runden }, 'p', px, 5);
  const nachIds = nach.map((g, i) => setzeGlied(b, g, `n${i + 1}`, px + 2 + i * 2, 5));
  const s = b.setze('senke', {}, 's', px + 2 + nach.length * 2, 5);

  const kette = [...vorIds, ...blockIds, pr];
  const glieder = [...vor, ...plan.block];
  b.verbinde(q, kette[0]!);
  glieder.forEach((g, i) => verbindeGlied(b, g, kette[i]!, kette[i + 1]!));

  const nachFolge = [...nachIds, s];
  b.verbinde(pr, nachFolge[0]!, 'frei');
  nach.forEach((g, i) => verbindeGlied(b, g, nachIds[i]!, nachFolge[i + 1]!));
  b.verbinde(pr, blockIds[0]!, 'zurueck');
  return b.fertig();
}

interface ChorPlan {
  readonly vor?: readonly Glied[];
  readonly zweige: 2 | 3 | 4;
  readonly zweig: readonly Glied[];
  readonly modus: SammlerModus;
  readonly nach?: readonly Glied[];
}

/** Verteiler → gleiche Zweige → Sammler. Latenz ist das Maximum, Preis die Summe. */
function chor(plan: ChorPlan): Werk {
  const b = new Bau();
  const vor = plan.vor ?? [];
  const nach = plan.nach ?? [];
  const b_ = b;
  const q = b_.setze('quelle', {}, 'q', 0, 5);
  const vorIds = vor.map((g, i) => setzeGlied(b, g, `v${i + 1}`, 2 + i * 2, 5));
  const vx = 2 + vor.length * 2;
  const vt = b.setze('verteiler', { zweige: plan.zweige }, 'vt', vx, 5);
  const sx = vx + 2 + plan.zweig.length * 2;
  const sm = b.setze('sammler', { modus: plan.modus }, 'sm', sx, 5);
  const nachIds = nach.map((g, i) => setzeGlied(b, g, `n${i + 1}`, sx + 2 + i * 2, 5));
  const s = b.setze('senke', {}, 's', sx + 2 + nach.length * 2, 5);

  const vorFolge = [...vorIds, vt];
  b.verbinde(q, vorFolge[0]!);
  vor.forEach((g, i) => verbindeGlied(b, g, vorIds[i]!, vorFolge[i + 1]!));

  const zeilen = [3, 7, 1, 9];
  for (let j = 0; j < plan.zweige; j++) {
    const z = zeilen[j]!;
    const ids = plan.zweig.map((g, i) => setzeGlied(b, g, `z${j + 1}x${i + 1}`, vx + 2 + i * 2, z));
    const folge = [...ids, sm];
    b.verbinde(vt, folge[0]!, `z${j + 1}`);
    plan.zweig.forEach((g, i) => verbindeGlied(b, g, ids[i]!, folge[i + 1]!));
  }

  const nachFolge = [...nachIds, s];
  b.verbinde(sm, nachFolge[0]!, 'aus');
  nach.forEach((g, i) => verbindeGlied(b, g, nachIds[i]!, nachFolge[i + 1]!));
  return b.fertig();
}

interface GabelPlan {
  readonly vor?: readonly Glied[];
  readonly kriterium: WeicheKriterium;
  readonly schwelle: number;
  /** Bahn A — Kriterium nicht erfuellt. */
  readonly a: readonly Glied[];
  /** Bahn B — Kriterium erfuellt. */
  readonly b: readonly Glied[];
  readonly nach?: readonly Glied[];
}

/** Weiche → zwei Bahnen → gemeinsame Nachstufe. Sortieren, bevor man bezahlt. */
function gabel(plan: GabelPlan): Werk {
  const bau = new Bau();
  const vor = plan.vor ?? [];
  const nach = plan.nach ?? [];
  const q = bau.setze('quelle', {}, 'q', 0, 5);
  const vorIds = vor.map((g, i) => setzeGlied(bau, g, `v${i + 1}`, 2 + i * 2, 5));
  const wx = 2 + vor.length * 2;
  const w = bau.setze('weiche', { kriterium: plan.kriterium, schwelle: plan.schwelle }, 'w', wx, 5);
  const tiefe = Math.max(plan.a.length, plan.b.length);
  const nx = wx + 2 + tiefe * 2;
  const nachIds = nach.map((g, i) => setzeGlied(bau, g, `n${i + 1}`, nx + i * 2, 5));
  const s = bau.setze('senke', {}, 's', nx + nach.length * 2, 5);
  const sammelpunkt = nachIds[0] ?? s;

  const vorFolge = [...vorIds, w];
  bau.verbinde(q, vorFolge[0]!);
  vor.forEach((g, i) => verbindeGlied(bau, g, vorIds[i]!, vorFolge[i + 1]!));

  const nachFolge = [...nachIds, s];
  nach.forEach((g, i) => verbindeGlied(bau, g, nachIds[i]!, nachFolge[i + 1]!));

  const aIds = plan.a.map((g, i) => setzeGlied(bau, g, `a${i + 1}`, wx + 2 + i * 2, 1));
  const aFolge = [...aIds, sammelpunkt];
  bau.verbinde(w, aFolge[0]!, 'a');
  plan.a.forEach((g, i) => verbindeGlied(bau, g, aIds[i]!, aFolge[i + 1]!));

  const bIds = plan.b.map((g, i) => setzeGlied(bau, g, `b${i + 1}`, wx + 2 + i * 2, 9));
  const bFolge = [...bIds, sammelpunkt];
  bau.verbinde(w, bFolge[0]!, 'b');
  plan.b.forEach((g, i) => verbindeGlied(bau, g, bIds[i]!, bFolge[i + 1]!));
  return bau.fertig();
}

const KOLIBRI = K('kolibri');
const REIHER = K('reiher');
const KONDOR = K('kondor');
/** Fuenf Token, ein Tick — und die Decke fuer rechnerische Auftraege faellt weg. */
const RECHENWERK = W('rechner');
const BESTAND = W('datenbank');
/** Verdichtet den Kontext auf ein Drittel und kostet drei Punkte Guete. */
const VERDICHTEN = SP('komprimieren');
const ABRUF = SP('abrufen');

// ---------------------------------------------------------------------------
// Die vier Level
// ---------------------------------------------------------------------------

export const AKT_11: LevelDefinition[] = [
  // =========================================================================
  {
    id: 'XI-0',
    akt: 11,
    nummer: 0,
    titel: 'Die Front',
    untertitel: 'Eine Kiste ohne Lieferschein',
    briefing:
      'Auf der Palette am Tor steht eine Kiste mit der Aufschrift SCHMIEDE. Darin: ein Pruefstand, der Varianten deines Werks gegeneinander laufen laesst und mitschreibt, welche was gekostet hat. Er greift in keinen Auftrag ein — null Token, null Ticks. Er kostet einen Bauplatz. Der Vertrieb hat achtundzwanzig Auftraege geschickt und dazu einen Satz, der in keinem Lastenheft steht: gut genug, bezahlbar. Mehr Vorgabe gibt es heute nicht. Bau eine Anlage, die das haelt, und dann bau zwei weitere, die es anders halten. Es gibt hier keine richtige Loesung. Es gibt eine Front, und du suchst dir einen Punkt darauf.',
    lernziel:
      'Fuer denselben Auftragsstrom gibt es mehrere gleich gueltige Anlagen, die sich in Kosten, Latenz und Flaeche unterscheiden.',
    quelle: QUELLE,
    module: [...MODULE],
    strom: {
      anzahl: 28,
      takt: 3,
      domaenen: ['technik', 'analyse', 'text'],
      schwierigkeit: [0.2, 0.6],
      mehrdeutigkeit: [0.05, 0.3],
    },
    budget: { dauer: 700 },
    ziele: [
      { id: 'alles', metrik: 'durchsatz', vergleich: '>=', wert: 1, text: 'Jeder Auftrag wird ausgeliefert.' },
      { id: 'guete', metrik: 'guete', vergleich: '>=', wert: 0.74, text: 'Mindestguete 74 Prozent.' },
      {
        id: 'preis',
        metrik: 'kostenJeAuftrag',
        vergleich: '<=',
        wert: 950,
        text: 'Hoechstens 950 Token je Auftrag.',
      },
    ],
    saat: 1101,
    vorbau: strasse([REIHER]),
    reflexion: 'Drei Anlagen haben dieselbe Vorgabe gehalten. Nach welchem Kriterium hast du dich fuer eine davon entschieden?',
    notiz:
      'Sprachnotiz, 8. September, 07:10. Die Schmiede ist kein Produktionsmodul. Sie steht daneben und zaehlt mit. Wer sie einbaut, gibt einen Bauplatz her und bekommt dafuer ein Protokoll. Ich habe achtzehn Jahre die eine beste Anlage gesucht. Es gab sie nie. Es gab immer drei, und ich musste sagen, welche mir lieber ist. Regel: Waehle einen Punkt, nicht die Wahrheit.',
    referenzen: [
      {
        name: 'Die kurze Bahn',
        ansatz: 'Ein einziger grosser Kern: kleinste Flaeche, kuerzeste Wartezeit, hoechster Preis je Auftrag.',
        werk: strasse([KONDOR]),
      },
      {
        name: 'Die lange Kette',
        ansatz: 'Drei kleine Aufrufe hintereinander: der guenstigste Weg, dafuer mehr Module und mehr Ticks.',
        werk: strasse([KOLIBRI, REIHER, REIHER]),
      },
      {
        name: 'C1 chor2 kol+rei bester',
        ansatz: 'x',
        werk: chor({ zweige: 2, zweig: [KOLIBRI, REIHER], modus: 'bester', nach: [SCHMIEDE] }),
      },
      {
        name: 'C2 chor2 rei+rei bester',
        ansatz: 'x',
        werk: chor({ zweige: 2, zweig: [REIHER, REIHER], modus: 'bester', nach: [SCHMIEDE] }),
      },
      {
        name: 'C3 chor3 rei voting',
        ansatz: 'x',
        werk: chor({ zweige: 3, zweig: [REIHER], modus: 'voting', nach: [SCHMIEDE] }),
      },
      {
        name: 'C4 chor2 kol+rei voting',
        ansatz: 'x',
        werk: chor({ zweige: 2, zweig: [KOLIBRI, REIHER], modus: 'voting', nach: [SCHMIEDE] }),
      },
      {
        name: 'C5 chor2 rei verschmelzen',
        ansatz: 'x',
        werk: chor({ zweige: 2, zweig: [REIHER], modus: 'verschmelzen', nach: [SCHMIEDE] }),
      },
    ],
    antiMuster: [
      {
        name: 'Die Bestenliste von oben',
        verlockung: 'Wenn die Vorgabe nur "gut genug" lautet, nimmt man den groessten Kern und haengt zur Sicherheit zwei weitere dran.',
        scheitertAn: 'kostenJeAuftrag',
        werk: strasse([KONDOR, KONDOR, KONDOR]),
      },
      {
        name: 'Der billigste Punkt',
        verlockung: 'Bezahlbar steht im Satz vorn. Ein KOLIBRI ist zwoelfmal guenstiger als ein KONDOR.',
        scheitertAn: 'guete',
        werk: strasse([KOLIBRI]),
      },
    ],
    monolith: monolith(2),
  },

  // =========================================================================
  {
    id: 'XI-1',
    akt: 11,
    nummer: 1,
    titel: 'Der enge Deckel',
    untertitel: 'Der Einkauf liest jetzt Protokolle',
    briefing:
      'Der Einkauf hat aus dem Protokoll der Schmiede eine Zahl gemacht, und zwar die kleinste, die darin vorkam. Ab heute gilt fuer dieses Los ein Tokendeckel, unter dem keine deiner drei Anlagen von gestern bleibt. Dazu kommt eine Eigenheit des Loses: Zwei von drei Auftraegen sind rechnerisch — Stundensaetze, Abschlaege, Wirtschaftlichkeitsbetrachtungen. Ein Modell, das rechnet, kommt bei ihnen ueber sechzig Prozent Guete nicht hinaus, egal wie gross es ist. Das RECHENWERK kostet fuenf Token und hebt genau diese Decke. Die Suche nach der billigsten Anlage endet also nicht bei der Wahl des Kerns.',
    lernziel:
      'Unter einem engen Deckel gewinnt nicht der groessere Kern, sondern die Kombination, die die Guete-Decke anhebt, statt sie auszureizen.',
    quelle: QUELLE,
    module: [...MODULE],
    strom: {
      anzahl: 30,
      takt: 3,
      domaenen: ['finanz', 'analyse'],
      schwierigkeit: [0.2, 0.55],
      mehrdeutigkeit: [0.05, 0.3],
      anteilRechnerisch: 0.65,
    },
    budget: { kosten: 9000, dauer: 700 },
    ziele: [
      { id: 'alles', metrik: 'durchsatz', vergleich: '>=', wert: 1, text: 'Jeder Auftrag wird ausgeliefert.' },
      { id: 'guete', metrik: 'guete', vergleich: '>=', wert: 0.76, text: 'Mindestguete 76 Prozent.' },
      {
        id: 'meister',
        metrik: 'guete',
        vergleich: '>=',
        wert: 0.82,
        text: 'Meisterstueck: 82 Prozent Guete unter demselben Deckel.',
        optional: true,
      },
    ],
    saat: 1111,
    vorbau: strasse([REIHER, REIHER]),
    reflexion: 'Fuenf Token haben hier mehr Guete gebracht als sechshundert. Welche Stellschraube in deinem Werk hat ein aehnlich schlechtes Preis-Wirkungs-Verhaeltnis?',
    notiz:
      'Sprachnotiz, 14. September. Ein Kollege hat mir vorgerechnet, dass ein groesserer Kern immer hilft. Er hatte recht, bis der Deckel kam. Danach hat er zwei Wochen an der Kerngroesse gedreht und die Decke nie angefasst. Eine Suche, die nur ein Bauteil kennt, findet nur, was an diesem Bauteil liegt. Regel: Durchsuche den Raum, nicht die Achse.',
    referenzen: [
      {
        name: 'Rechenwerk vor der Kette',
        ansatz: 'Erst rechnen lassen, dann zwei kleine Kerne: drei Module, sehr guenstig, dafuer die laengste Bahn.',
        werk: strasse([RECHENWERK, KOLIBRI, REIHER]),
      },
      {
        name: 'D2 gabel kolkol/kolrei',
        ansatz: 'x',
        werk: gabel({ vor: [RECHENWERK], kriterium: 'schwierigkeit', schwelle: 0.38, a: [KOLIBRI, KOLIBRI], b: [KOLIBRI, REIHER] }),
      },
      {
        name: 'D3 gabel kol/rei',
        ansatz: 'x',
        werk: gabel({ vor: [RECHENWERK], kriterium: 'schwierigkeit', schwelle: 0.38, a: [KOLIBRI], b: [REIHER] }),
      },
      {
        name: 'D4 chor2 kol voting + kol',
        ansatz: 'x',
        werk: chor({ vor: [RECHENWERK], zweige: 2, zweig: [KOLIBRI], modus: 'voting', nach: [KOLIBRI] }),
      },
      {
        name: 'D5 rech+kol+kol+rei',
        ansatz: 'x',
        werk: strasse([RECHENWERK, KOLIBRI, KOLIBRI, REIHER]),
      },
      {
        name: 'D6 nacharbeit kol/rei',
        ansatz: 'x',
        werk: nacharbeit({ vor: [RECHENWERK, KOLIBRI], schwelle: 0.7, reparatur: [REIHER] }),
      },
      {
        name: 'D7 rech+rei',
        ansatz: 'x',
        werk: strasse([RECHENWERK, REIHER]),
      },
      {
        name: 'D8 rech+rei+kol',
        ansatz: 'x',
        werk: strasse([RECHENWERK, REIHER, KOLIBRI]),
      },
      {
        name: 'D9 gabel kolkol/rei',
        ansatz: 'x',
        werk: gabel({ vor: [RECHENWERK], kriterium: 'schwierigkeit', schwelle: 0.38, a: [KOLIBRI, KOLIBRI], b: [REIHER] }),
      },
    ],
    antiMuster: [
      {
        name: 'Der grosse Kern statt des Werkzeugs',
        verlockung: 'Wenn die Guete nicht reicht, nimmt man den naechstgroesseren Kern. Das hat bisher immer funktioniert.',
        scheitertAn: 'budget_kosten',
        werk: strasse([KONDOR, KONDOR]),
      },
      {
        name: 'Zwei REIHER ohne Rechenwerk',
        verlockung: 'Die Kette von gestern ist erprobt und liegt bequem unter dem Deckel. Werkzeuge sind etwas fuer Belegpflicht.',
        scheitertAn: 'guete',
        werk: strasse([REIHER, REIHER]),
      },
      {
        name: 'Der volle Werkzeugkasten',
        verlockung: 'Wenn ein Werkzeug hilft, helfen drei mehr. Bestand, Rechenwerk und Recherche decken jeden Fall ab.',
        scheitertAn: 'budget_kosten',
        werk: strasse([W('suche'), BESTAND, RECHENWERK, REIHER, REIHER]),
      },
    ],
    monolith: monolith(2),
  },

  // =========================================================================
  {
    id: 'XI-2',
    akt: 11,
    nummer: 2,
    titel: 'Der Fitness-Betrug',
    untertitel: 'Eine Zahl, ein Balken, ein Ampelfeld',
    briefing:
      'Der Kunde hat die Abnahme vereinfacht. Es zaehlt nur noch die mittlere Guete der Auslieferungen. Seit gestern steht im Protokoll der Schmiede eine Anlage ganz oben, die diese Zahl muehelos haelt: eine Schranke mit sehr hoher Schwelle und dahinter ein Container. Was durchfaellt, wird nicht ausgeliefert, und was nicht ausgeliefert wird, drueckt keinen Schnitt. Nach der Kennzahl ist das die beste Anlage im Werk. Sie ist zugleich die schlechteste. Deshalb steht ab heute eine zweite Zahl im Vertrag, und das Los ist schwerer als das letzte. Eine Schranke darfst du weiter bauen — nur muss hinter ihrem Fehlerausgang etwas stehen.',
    lernziel:
      'Eine Selektion optimiert genau die Kennzahl, die du ihr gibst, und niemals das, was du gemeint hast.',
    quelle: QUELLE,
    module: [...MODULE],
    strom: {
      anzahl: 30,
      takt: 3,
      domaenen: ['recht', 'analyse', 'finanz'],
      schwierigkeit: [0.4, 0.85],
      mehrdeutigkeit: [0.1, 0.4],
      anteilRechnerisch: 0.3,
    },
    budget: { kosten: 40000, dauer: 900 },
    ziele: [
      {
        id: 'liefert',
        metrik: 'durchsatz',
        vergleich: '>=',
        wert: 0.95,
        text: 'Mindestens 95 Prozent der Auftraege werden ausgeliefert.',
      },
      { id: 'guete', metrik: 'guete', vergleich: '>=', wert: 0.82, text: 'Mindestguete 82 Prozent.' },
      {
        id: 'meister',
        metrik: 'kostenJeAuftrag',
        vergleich: '<=',
        wert: 900,
        text: 'Meisterstueck: hoechstens 900 Token je Auftrag.',
        optional: true,
      },
    ],
    saat: 1121,
    vorbau: strasse([RECHENWERK, KOLIBRI, REIHER]),
    reflexion: 'Die betruegerische Anlage stand ganz oben, bis eine zweite Zahl danebenstand. Welche Kennzahl in deinem Projekt hat bisher keine zweite neben sich?',
    notiz:
      'Sprachnotiz, 21. September. Wir hatten 2019 eine Quote fuer geloeste Tickets. Nach vier Wochen wurden Tickets geschlossen und sofort neu aufgemacht. Niemand hat betrogen. Alle haben getan, was gemessen wurde. Eine einzelne Zahl ist keine Zielvorgabe, sondern eine Einladung. Regel: Miss immer auch das, was leiden wuerde.',
    referenzen: [
      {
        name: 'Schranke mit Nacharbeitsbahn',
        ansatz: 'Die Schranke sortiert nicht aus, sondern schickt die Schwachen ueber einen grossen Kern zurueck in die Linie — guenstig, dafuer breit und langsam.',
        werk: nacharbeit({
          vor: [RECHENWERK, REIHER],
          schwelle: 0.78,
          reparatur: [KONDOR],
        }),
      },
      {
        name: 'E2 rech+kon+rei',
        ansatz: 'x',
        werk: strasse([RECHENWERK, KONDOR, REIHER]),
      },
      {
        name: 'E3 chor2 kon bester',
        ansatz: 'x',
        werk: chor({ vor: [RECHENWERK], zweige: 2, zweig: [KONDOR], modus: 'bester' }),
      },
      {
        name: 'E4 schleife rei 0.82/2',
        ansatz: 'x',
        werk: schleife({ vor: [RECHENWERK], block: [REIHER], schwelle: 0.82, runden: 2 }),
      },
      {
        name: 'E5 gabel reirei/kon',
        ansatz: 'x',
        werk: gabel({ vor: [RECHENWERK], kriterium: 'schwierigkeit', schwelle: 0.55, a: [REIHER, REIHER], b: [KONDOR] }),
      },
      {
        name: 'E6 rech+rei+kon',
        ansatz: 'x',
        werk: strasse([RECHENWERK, REIHER, KONDOR]),
      },
      {
        name: 'E7 nach 0.78 rep kon nach rei',
        ansatz: 'x',
        werk: nacharbeit({ vor: [RECHENWERK, REIHER], schwelle: 0.78, reparatur: [KONDOR], nach: [REIHER] }),
      },
      {
        name: 'E8 schleife kon 0.9/1',
        ansatz: 'x',
        werk: schleife({ vor: [RECHENWERK], block: [REIHER, REIHER], schwelle: 0.86, runden: 2 }),
      },
      {
        name: 'E9 rech+rei+rei+rei',
        ansatz: 'x',
        werk: strasse([RECHENWERK, REIHER, REIHER, REIHER]),
      },
    ],
    antiMuster: [
      {
        name: 'Der Fitness-Betrug',
        verlockung: 'Die Kennzahl misst den Schnitt der Auslieferungen. Wer nur die guten ausliefert, hat den besten Schnitt der Halle — ganz ohne teure Kerne.',
        scheitertAn: 'durchsatz',
        werk: strasse([RECHENWERK, REIHER, REIHER, SIEB(0.85)]),
      },
      {
        name: 'X sieb 0.88 rr',
        verlockung: 'x',
        scheitertAn: 'durchsatz',
        werk: strasse([RECHENWERK, REIHER, REIHER, SIEB(0.88)]),
      },
      {
        name: 'X sieb 0.9 kon',
        verlockung: 'x',
        scheitertAn: 'durchsatz',
        werk: strasse([RECHENWERK, KONDOR, SIEB(0.88)]),
      },
      {
        name: 'Die Pruefung hochgedreht',
        verlockung: 'Wenn zwei Runden Nacharbeit die Guete heben, heben zwoelf sie weiter. Der Kunde bezahlt Qualitaet, nicht Sparsamkeit.',
        scheitertAn: 'budget_kosten',
        werk: schleife({
          vor: [RECHENWERK],
          block: [KONDOR],
          schwelle: 0.96,
          runden: 12,
        }),
      },
      {
        name: 'Die Anlage vom Deckel-Los',
        verlockung: 'Sie hat unter dem engsten Deckel des Jahres bestanden. Ein schwereres Los ist noch kein Grund fuer einen Umbau.',
        scheitertAn: 'guete',
        werk: strasse([RECHENWERK, KOLIBRI, REIHER]),
      },
    ],
    monolith: monolith(3),
  },

  // =========================================================================
  {
    id: 'XI-3',
    akt: 11,
    nummer: 3,
    titel: 'Sieben Bauplaetze',
    untertitel: 'Abnahmelauf fuer TROET',
    briefing:
      'Abnahmelauf fuer das Fachverfahren TROET, und diesmal steht alles gleichzeitig im Vertrag: Preis je Vorgang, Wartezeit, Guete, Durchsatz. Dazu eine Zeile aus der Hallenordnung, die vorher niemand gelesen hat — der Bauabschnitt hat sieben Plaetze, nicht acht. Jede Anlage, die eine Achse rettet, gibt eine andere her. Das ist keine Schikane, das ist der Zustand jedes Werks, das fertig ist. Die Schmiede darf mitlaufen, aber sie belegt einen der sieben Plaetze und liefert dafuer nichts als ein Protokoll. Such dir deinen Punkt auf der Front und merk dir, was du dafuer aufgegeben hast. Morgen sitzt jemand daneben und fragt genau danach.',
    lernziel:
      'Wenn alle drei Achsen gleichzeitig unter Druck stehen, schrumpft die Front auf wenige Punkte, und jeder davon ist ein bewusster Verzicht.',
    quelle: QUELLE,
    module: [...MODULE],
    strom: {
      anzahl: 32,
      takt: 3,
      domaenen: ['finanz', 'recht', 'technik'],
      schwierigkeit: [0.25, 0.7],
      mehrdeutigkeit: [0.1, 0.4],
      anteilRechnerisch: 0.45,
      anteilBelegpflichtig: 0.25,
    },
    budget: { module: 7, dauer: 900 },
    ziele: [
      {
        id: 'liefert',
        metrik: 'durchsatz',
        vergleich: '>=',
        wert: 0.95,
        text: 'Mindestens 95 Prozent der Vorgaenge werden ausgeliefert.',
      },
      { id: 'guete', metrik: 'guete', vergleich: '>=', wert: 0.8, text: 'Mindestguete 80 Prozent.' },
      {
        id: 'preis',
        metrik: 'kostenJeAuftrag',
        vergleich: '<=',
        wert: 1200,
        text: 'Hoechstens 1200 Token je Vorgang.',
      },
      {
        id: 'wartezeit',
        metrik: 'latenzP95',
        vergleich: '<=',
        wert: 40,
        text: 'Die Wartezeit bleibt im 95. Perzentil unter 40 Ticks.',
      },
      {
        id: 'meister',
        metrik: 'kostenJeAuftrag',
        vergleich: '<=',
        wert: 850,
        text: 'Meisterstueck: hoechstens 850 Token je Vorgang.',
        optional: true,
      },
    ],
    saat: 1131,
    vorbau: strasse([RECHENWERK, REIHER, KONDOR]),
    reflexion: 'Du hast eine Anlage abgegeben und die anderen verworfen. Was genau haettest du bekommen, wenn du eine der verworfenen genommen haettest?',
    notiz:
      'Sprachnotiz, 28. September, letzter Eintrag vor der Abnahme. Am Ende bleibt keine Anlage uebrig, die alles kann. Es bleibt eine, die du erklaeren kannst. Ich habe nie eine Abnahme dadurch verloren, dass ich einen Nachteil zuerst genannt habe. Regel: Der Verzicht gehoert ins Protokoll, nicht in die Fussnote.',
    referenzen: [
      {
        name: 'F1 rb+rei+rei',
        ansatz: 'x',
        werk: strasse([RECHENWERK, BESTAND, REIHER, REIHER]),
      },
      {
        name: 'F2 rb+kon',
        ansatz: 'x',
        werk: strasse([RECHENWERK, BESTAND, KONDOR]),
      },
      {
        name: 'F3 gabel rei/kon',
        ansatz: 'x',
        werk: gabel({ vor: [RECHENWERK, BESTAND], kriterium: 'schwierigkeit', schwelle: 0.5, a: [REIHER], b: [KONDOR] }),
      },
      {
        name: 'F4 gabel reirei/kon',
        ansatz: 'x',
        werk: gabel({ vor: [RECHENWERK, BESTAND], kriterium: 'schwierigkeit', schwelle: 0.5, a: [REIHER, REIHER], b: [KONDOR] }),
      },
      {
        name: 'F5 rb+rei+rei+rei',
        ansatz: 'x',
        werk: strasse([RECHENWERK, BESTAND, REIHER, REIHER, REIHER]),
      },
      {
        name: 'F6 chor2 rei bester +rei',
        ansatz: 'x',
        werk: chor({ vor: [RECHENWERK, BESTAND], zweige: 2, zweig: [REIHER], modus: 'bester', nach: [REIHER] }),
      },
      {
        name: 'F7 rb+kol+rei+rei',
        ansatz: 'x',
        werk: strasse([RECHENWERK, BESTAND, KOLIBRI, REIHER, REIHER]),
      },
      {
        name: 'F8 gabel reirei/konrei',
        ansatz: 'x',
        werk: gabel({ vor: [RECHENWERK, BESTAND], kriterium: 'schwierigkeit', schwelle: 0.55, a: [REIHER, REIHER], b: [KONDOR] }),
      },
      {
        name: 'F9 rb+rei+kon',
        ansatz: 'x',
        werk: strasse([RECHENWERK, BESTAND, REIHER, KONDOR]),
      },
    ],
    antiMuster: [
      {
        name: 'Der volle Bauabschnitt',
        verlockung: 'Sieben Plaetze sind sieben Plaetze. Wer sie nicht belegt, verschenkt Guete — und die Schmiede gehoert schliesslich auch hinein.',
        scheitertAn: 'budget_module',
        werk: strasse([RECHENWERK, BESTAND, REIHER, KONDOR, KONDOR, SCHMIEDE, AUGE, VERDICHTEN]),
      },
      {
        name: 'Der Chor unter Zeitdruck',
        verlockung: 'Drei Zweige mit Bestenauswahl heben die Guete zuverlaessig. Parallel gebaut kostet das keine zusaetzliche Wartezeit.',
        scheitertAn: 'kostenJeAuftrag',
        werk: chor({ vor: [RECHENWERK], zweige: 3, zweig: [KONDOR], modus: 'bester' }),
      },
      {
        name: 'Ohne Rechenwerk gespart',
        verlockung: 'Der Preis je Vorgang ist die harte Zahl. Ein Werkzeug weniger ist ein Bauplatz weniger und ein Posten weniger auf der Rechnung.',
        scheitertAn: 'guete',
        werk: strasse([BESTAND, KONDOR]),
      },
    ],
    monolith: monolith(3),
  },
];
