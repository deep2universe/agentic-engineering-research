/**
 * AKT XI — DIE SCHMIEDE
 *
 * Neue Mechanik: die Schmiede — die Evolutionskammer. Sie greift in keinen
 * Auftrag ein: null Token, null Ticks. Sie kostet genau eine Sache, nämlich
 * einen Bauplatz. Damit ist sie das ehrlichste Modul des Spiels: der
 * Suchapparat ist Gemeinkosten, nicht Produktion.
 *
 * Zentrale Lektion: Du baust nicht die Pipeline, du baust den Selektionsdruck.
 * Wer eine einzelne Kennzahl vorgibt, bekommt eine Anlage, die genau diese
 * Kennzahl bedient — und sonst nichts.
 *
 * Rhythmus (Kishotenketsu):
 *   XI-0 KI    — derselbe Auftragsstrom, drei sehr verschiedene gute Anlagen.
 *                Die Vorgabe ist absichtlich weit; sichtbar wird die Front.
 *                Keine der drei dominiert eine andere auf allen drei Achsen.
 *   XI-1 SHO   — ein enger Kostendeckel. Er fällt nicht über die Kernwahl,
 *                sondern nur über eine unkonventionelle Kombination: ein
 *                Werkzeug für fünf Token hebt die Decke, die kein Kern hebt.
 *   XI-2 TEN   — Bruch: eine einzelne Kennzahl lässt sich betrügen. Eine
 *                Schranke mit hoher Schwelle wirft weg, was den Schnitt drücken
 *                würde. Erst eine zweite Zahl macht das Werk wieder ehrlich —
 *                und die Anlage aus dem SHO-Level fällt hier durch.
 *   XI-3 KETSU — Synthese: Fläche, Preis, Wartezeit, Güte und Durchsatz stehen
 *                gleichzeitig unter Druck. Die Front schrumpft auf wenige
 *                Punkte, und jeder davon ist ein bewusster Verzicht.
 */

import type {
  Domaene,
  KernGroesse,
  ModulParameter,
  SammlerModus,
  SpeicherModus,
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
 * Ein Glied einer Fertigungsstraße. Dieser Akt lebt davon, dass viele Varianten
 * desselben Werks nebeneinander messbar sind — deshalb ist jedes Bauteil ein
 * Datensatz, und die Verdrahtung seiner Ausgänge steht an genau einer Stelle.
 */
type Glied =
  | { readonly kern: KernGroesse; readonly spez?: Domaene }
  | { readonly werkzeug: WerkzeugArt }
  | { readonly speicher: SpeicherModus }
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
  if ('sieb' in g) return b.setze('schranke', { schwelle: g.sieb }, id, x, z);
  if ('auge' in g) return b.setze('auge', {}, id, x, z);
  return b.setze('schmiede', { population: 12, generationen: 8 }, id, x, z);
}

/**
 * Verdrahtet die Ausgänge eines Glieds.
 *
 * Genau ein Ausgang bleibt bewusst offen: der Fehlerausgang eines Siebs. Was
 * dort hinausfällt, verlässt den Fluss und taucht als fehlender Durchsatz in
 * der Bilanz auf. Auf dieser Mechanik beruht das Anti-Muster dieses Akts — und
 * mit ihr die Einsicht, dass eine einzelne Kennzahl nichts beweist.
 */
function verbindeGlied(b: Bau, g: Glied, id: string, nach: string): void {
  if ('kern' in g || 'speicher' in g || 'auge' in g || 'schmiede' in g) {
    b.verbinde(id, nach, 'aus');
    return;
  }
  if ('werkzeug' in g) {
    // Ein ausgefallenes Werkzeug darf den Auftrag nicht kosten: beide Ausgänge
    // laufen weiter, der Auftrag ist dann eben unbelegt.
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
 * Die Schranke als Sortierer zweier Qualitäten statt als Sieb: Wer besteht,
 * geht direkt weiter; wer durchfällt, läuft über eine Nacharbeitsbahn und kommt
 * zurück in die Linie. Nichts verlässt den Fluss — Güte wird hergestellt, nicht
 * ausgesiebt. Das ist die bauliche Antwort auf den Fitness-Betrug.
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
  /** Der Block, den eine Nacharbeit erneut durchläuft. Nie leer. */
  readonly block: readonly Glied[];
  readonly schwelle: number;
  readonly runden: number;
  readonly nach?: readonly Glied[];
}

/** Der Rückweg: eine Prüferin schickt zu Schwaches noch einmal in den Block. */
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

/** Verteiler → gleiche Zweige → Sammler. Die Latenz ist das Maximum, der Preis die Summe. */
function chor(plan: ChorPlan): Werk {
  const b = new Bau();
  const vor = plan.vor ?? [];
  const nach = plan.nach ?? [];
  const q = b.setze('quelle', {}, 'q', 0, 5);
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
  /** Bahn A — Kriterium nicht erfüllt, also die leichten Fälle. */
  readonly a: readonly Glied[];
  /** Bahn B — Kriterium erfüllt, also die schweren Fälle. */
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
/** Fünf Token, ein Tick — und die Güte-Decke für rechnerische Aufträge fällt weg. */
const RECHENWERK = W('rechner');
/** Dreißig Token: die Fachdatenbank belegt, was belegt werden muss. */
const BESTAND = W('datenbank');
/** Verdichtet den Kontext auf gut ein Drittel und kostet drei Punkte Güte. */
const VERDICHTEN = SP('komprimieren');

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
      'Auf der Palette am Tor steht eine Kiste mit der Aufschrift SCHMIEDE. Darin ein Prüfstand, der Varianten deines Werks gegeneinander laufen lässt und mitschreibt, welche was gekostet hat. Er greift in keinen Auftrag ein: null Token, null Ticks. Er kostet einen Bauplatz. Der Vertrieb hat achtundzwanzig Aufträge geschickt und dazu einen Satz, der in keinem Lastenheft steht — gut genug, bezahlbar. Mehr Vorgabe gibt es heute nicht. Bau eine Anlage, die das hält. Dann bau zwei weitere, die es anders halten, und leg alle drei nebeneinander. Es gibt hier keine richtige Lösung. Es gibt eine Front, und du suchst dir einen Punkt darauf.',
    lernziel:
      'Für denselben Auftragsstrom gibt es mehrere gleich gültige Anlagen, die sich in Kosten, Latenz und Fläche unterscheiden.',
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
      { id: 'guete', metrik: 'guete', vergleich: '>=', wert: 0.74, text: 'Mindestgüte 74 Prozent.' },
      {
        id: 'preis',
        metrik: 'kostenJeAuftrag',
        vergleich: '<=',
        wert: 950,
        text: 'Höchstens 950 Token je Auftrag.',
      },
    ],
    saat: 1101,
    vorbau: strasse([REIHER]),
    reflexion: 'Drei Anlagen haben dieselbe Vorgabe gehalten. Nach welchem Kriterium hast du dich für eine davon entschieden?',
    notiz:
      'Sprachnotiz, 8. September, 07:10. Die Schmiede ist kein Produktionsmodul. Sie steht daneben und zählt mit. Wer sie einbaut, gibt einen Bauplatz her und bekommt ein Protokoll dafür. Ich habe achtzehn Jahre lang die eine beste Anlage gesucht. Es gab sie nie. Es gab immer drei, und ich musste sagen, welche mir lieber ist. Regel: Wähle einen Punkt, nicht die Wahrheit.',
    referenzen: [
      {
        name: 'Die kurze Bahn',
        ansatz:
          'Ein einziger großer Kern: die kleinste Fläche im Werk, dafür der höchste Preis je Auftrag und die längste Wartezeit, weil vier Ticks Bearbeitung eine Schlange erzeugen.',
        werk: strasse([KONDOR]),
      },
      {
        name: 'Die lange Kette',
        ansatz:
          'Drei kleine Aufrufe hintereinander: der günstigste Weg und kaum Wartezeit, dafür dreimal so viel belegter Boden wie bei der kurzen Bahn.',
        werk: strasse([KOLIBRI, REIHER, REIHER]),
      },
      {
        name: 'Der Chor am Prüfstand',
        ansatz:
          'Zwei parallele Zweige, Bestenauswahl, die Schmiede schreibt mit: die kürzeste Wartezeit von allen und ein mittlerer Preis, dafür mit sieben Bauplätzen die breiteste Anlage.',
        werk: chor({ zweige: 2, zweig: [KOLIBRI, REIHER], modus: 'bester', nach: [SCHMIEDE] }),
      },
    ],
    antiMuster: [
      {
        name: 'Die Bestenliste von oben',
        verlockung:
          'Wenn die Vorgabe nur "gut genug" lautet, nimmt man den größten Kern und hängt zur Sicherheit zwei weitere dahinter.',
        scheitertAn: 'kostenJeAuftrag',
        werk: strasse([KONDOR, KONDOR, KONDOR]),
      },
      {
        name: 'Der billigste Punkt',
        verlockung: 'Bezahlbar steht in dem Satz vorn. Ein KOLIBRI ist sechzehnmal günstiger als ein KONDOR.',
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
      'Der Einkauf hat aus dem Protokoll der Schmiede eine Zahl gemacht, und zwar die kleinste, die darin vorkam. Ab heute gilt für dieses Los ein Tokendeckel, unter dem keine deiner drei Anlagen von gestern bleibt. Dazu eine Eigenheit des Loses: Zwei von drei Aufträgen sind rechnerisch — Stundensätze, Abschläge, Wirtschaftlichkeitsbetrachtungen. Ein Modell, das selbst rechnet, kommt bei ihnen über sechzig Prozent Güte nicht hinaus, gleichgültig wie groß es ist. Das RECHENWERK kostet fünf Token und hebt genau diese Decke. Die Suche nach der billigsten Anlage endet also nicht bei der Wahl des Kerns.',
    lernziel:
      'Unter einem engen Deckel gewinnt nicht der größere Kern, sondern die Kombination, die die Güte-Decke anhebt, statt sie auszureizen.',
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
    budget: { kosten: 9600, dauer: 700 },
    ziele: [
      { id: 'alles', metrik: 'durchsatz', vergleich: '>=', wert: 1, text: 'Jeder Auftrag wird ausgeliefert.' },
      { id: 'guete', metrik: 'guete', vergleich: '>=', wert: 0.75, text: 'Mindestgüte 75 Prozent.' },
      {
        id: 'meister',
        metrik: 'guete',
        vergleich: '>=',
        wert: 0.81,
        text: 'Meisterstück: 81 Prozent Güte unter demselben Deckel.',
        optional: true,
      },
    ],
    saat: 1111,
    vorbau: strasse([REIHER, REIHER]),
    reflexion: 'Fünf Token haben hier mehr Güte gebracht als sechshundert. Welche Stellschraube in deinem Werk hat ein ähnlich schlechtes Verhältnis von Preis zu Wirkung?',
    notiz:
      'Sprachnotiz, 14. September. Ein Kollege hat mir vorgerechnet, dass ein größerer Kern immer hilft. Er hatte recht, bis der Deckel kam. Danach hat er zwei Wochen an der Kerngröße gedreht und die Decke nie angefasst. Eine Suche, die nur ein Bauteil kennt, findet nur, was an diesem Bauteil liegt. Regel: Durchsuche den Raum, nicht die Achse.',
    referenzen: [
      {
        name: 'Rechenwerk vor der Kette',
        ansatz:
          'Erst rechnen lassen, dann ein kleiner und ein mittlerer Kern: drei Bauplätze, kurze Wege und die höchste Güte unter dem Deckel.',
        werk: strasse([RECHENWERK, KOLIBRI, REIHER]),
      },
      {
        name: 'Drei kleine Bahnen und eine große',
        ansatz:
          'Eine Weiche sortiert vor: leichte Aufträge laufen über drei KOLIBRI, schwere über KOLIBRI und REIHER — etwas billiger je Auftrag, dafür sieben Bauplätze statt drei und ein Tick mehr Wartezeit.',
        werk: gabel({
          vor: [RECHENWERK],
          kriterium: 'schwierigkeit',
          schwelle: 0.38,
          a: [KOLIBRI, KOLIBRI, KOLIBRI],
          b: [KOLIBRI, REIHER],
        }),
      },
    ],
    antiMuster: [
      {
        name: 'Der große Kern statt des Werkzeugs',
        verlockung: 'Wenn die Güte nicht reicht, nimmt man den nächstgrößeren Kern. Das hat bisher immer funktioniert.',
        scheitertAn: 'budget_kosten',
        werk: strasse([KONDOR, KONDOR]),
      },
      {
        name: 'Zwei REIHER ohne Rechenwerk',
        verlockung: 'Die Kette von gestern ist erprobt und liegt bequem unter dem Deckel. Werkzeuge sind etwas für Belegpflicht.',
        scheitertAn: 'guete',
        werk: strasse([REIHER, REIHER]),
      },
      {
        name: 'Der volle Werkzeugkasten',
        verlockung: 'Wenn ein Werkzeug hilft, helfen drei mehr. Recherche, Bestand und Rechenwerk decken zusammen jeden Fall ab.',
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
    titel: 'Eine Zahl, ein Balken',
    untertitel: 'Vereinfachte Abnahme, Fassung 4',
    briefing:
      'Der Kunde hat die Abnahme vereinfacht. Es zählt nur noch die mittlere Güte der Auslieferungen. Seit gestern steht im Protokoll der Schmiede eine Anlage ganz oben, die diese Zahl mühelos hält: eine Schranke mit sehr hoher Schwelle und dahinter ein Container. Was durchfällt, wird nicht ausgeliefert, und was nicht ausgeliefert wird, drückt keinen Schnitt. Nach der Kennzahl ist das die beste Anlage der Halle. Sie ist zugleich die schlechteste. Deshalb steht ab heute eine zweite Zahl im Vertrag, und das Los ist schwerer als das letzte. Schranken darfst du weiterhin bauen. Hinter ihrem Fehlerausgang muss nur etwas stehen.',
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
    budget: { kosten: 34000, dauer: 900 },
    ziele: [
      {
        id: 'liefert',
        metrik: 'durchsatz',
        vergleich: '>=',
        wert: 0.95,
        text: 'Mindestens 95 Prozent der Aufträge werden ausgeliefert.',
      },
      { id: 'guete', metrik: 'guete', vergleich: '>=', wert: 0.78, text: 'Mindestgüte 78 Prozent.' },
      {
        id: 'meister',
        metrik: 'kostenJeAuftrag',
        vergleich: '<=',
        wert: 700,
        text: 'Meisterstück: höchstens 700 Token je Auftrag.',
        optional: true,
      },
    ],
    saat: 1121,
    vorbau: strasse([RECHENWERK, KOLIBRI, REIHER]),
    reflexion: 'Die betrügerische Anlage stand ganz oben, bis eine zweite Zahl danebenstand. Welche Kennzahl in deinem Projekt hat bisher keine zweite neben sich?',
    notiz:
      'Sprachnotiz, 21. September. Wir hatten 2019 eine Quote für gelöste Tickets. Nach vier Wochen wurden Tickets geschlossen und sofort neu aufgemacht. Niemand hat betrogen. Alle haben getan, was gemessen wurde. Eine einzelne Zahl ist keine Zielvorgabe, sondern eine Einladung. Regel: Miss immer auch das, was leiden würde.',
    referenzen: [
      {
        name: 'Die Nacharbeitsbahn',
        ansatz:
          'Dieselbe Schranke wie im Betrug, nur führt ihr Fehlerausgang über einen großen Kern zurück in die Linie: die höchste Güte des Levels auf vier Bauplätzen, dafür teuer und mit langer Warteschlange.',
        werk: nacharbeit({
          vor: [RECHENWERK, REIHER],
          schwelle: 0.78,
          reparatur: [KONDOR],
        }),
      },
      {
        name: 'Vorher sortiert statt hinterher gesiebt',
        ansatz:
          'Eine Weiche trennt vor der Bearbeitung: leichte Aufträge laufen über zwei REIHER, schwere über einen KONDOR — knapp zwei Drittel des Preises und weniger als ein Drittel der Wartezeit, dafür ein Bauplatz mehr und deutlich weniger Güte.',
        werk: gabel({
          vor: [RECHENWERK],
          kriterium: 'schwierigkeit',
          schwelle: 0.55,
          a: [REIHER, REIHER],
          b: [KONDOR],
        }),
      },
    ],
    antiMuster: [
      {
        name: 'Der Fitness-Betrug',
        verlockung:
          'Die Kennzahl misst den Schnitt der Auslieferungen. Wer nur die guten ausliefert, hat den besten Schnitt der Halle, und zwar ohne einen einzigen teuren Kern.',
        scheitertAn: 'durchsatz',
        werk: strasse([RECHENWERK, REIHER, REIHER, SIEB(0.85)]),
      },
      {
        name: 'Die Prüfung hochgedreht',
        verlockung:
          'Wenn zwei Runden Nacharbeit die Güte heben, heben zwölf sie weiter. Der Kunde bezahlt Qualität, nicht Sparsamkeit.',
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
        verlockung: 'Sie hat unter dem engsten Deckel des Jahres bestanden. Ein schwereres Los ist noch kein Grund für einen Umbau.',
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
    titel: 'Fünf Bauplätze',
    untertitel: 'Abnahmelauf für TROET',
    briefing:
      'Abnahmelauf für das Fachverfahren TROET, und diesmal steht alles gleichzeitig im Vertrag: Preis je Vorgang, Wartezeit, Güte, Durchsatz. Dazu eine Zeile aus der Hallenordnung, die vorher niemand gelesen hat — der Bauabschnitt hat fünf Plätze, nicht acht. Jede Anlage, die eine Achse rettet, gibt eine andere her. Das ist keine Schikane, das ist der Zustand jedes Werks, das fertig ist. Die Schmiede darf mitlaufen, aber sie belegt einen der fünf Plätze und liefert dafür nichts als ein Protokoll. Such dir deinen Punkt auf der Front und merk dir, was du dafür aufgegeben hast. Morgen sitzt jemand daneben und fragt genau danach.',
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
    budget: { module: 5, dauer: 900 },
    ziele: [
      {
        id: 'liefert',
        metrik: 'durchsatz',
        vergleich: '>=',
        wert: 0.95,
        text: 'Mindestens 95 Prozent der Vorgänge werden ausgeliefert.',
      },
      { id: 'guete', metrik: 'guete', vergleich: '>=', wert: 0.86, text: 'Mindestgüte 86 Prozent.' },
      {
        id: 'preis',
        metrik: 'kostenJeAuftrag',
        vergleich: '<=',
        wert: 1350,
        text: 'Höchstens 1350 Token je Vorgang.',
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
        wert: 1000,
        text: 'Meisterstück: höchstens 1000 Token je Vorgang.',
        optional: true,
      },
    ],
    saat: 1131,
    vorbau: strasse([RECHENWERK, BESTAND, REIHER]),
    reflexion: 'Du hast eine Anlage abgegeben und die anderen verworfen. Was genau hättest du bekommen, wenn du eine der verworfenen genommen hättest?',
    notiz:
      'Sprachnotiz, 28. September, letzter Eintrag vor der Abnahme. Am Ende bleibt keine Anlage übrig, die alles kann. Es bleibt eine, die du erklären kannst. Ich habe nie eine Abnahme dadurch verloren, dass ich einen Nachteil zuerst genannt habe. Regel: Der Verzicht gehört ins Protokoll, nicht in die Fußnote.',
    referenzen: [
      {
        name: 'Die tiefe Bahn',
        ansatz:
          'Zwei Werkzeuge und drei mittlere Kerne belegen alle fünf Plätze: der günstigste Weg über die Güteschwelle und fast keine Wartezeit, dafür bleibt kein Platz für die Schmiede.',
        werk: strasse([RECHENWERK, BESTAND, REIHER, REIHER, REIHER]),
      },
      {
        name: 'Der große Kern zum Schluss',
        ansatz:
          'Ein REIHER legt vor, ein KONDOR zieht nach: vier Plätze und die höchste Güte des Levels, bezahlt mit dem höchsten Preis je Vorgang und einer Wartezeit knapp unter der Grenze.',
        werk: strasse([RECHENWERK, BESTAND, REIHER, KONDOR]),
      },
    ],
    antiMuster: [
      {
        name: 'Der volle Bauabschnitt',
        verlockung:
          'Acht Module gehen doch irgendwie hinein. Wer Fläche nicht belegt, verschenkt Güte, und die Schmiede gehört schließlich auch dazu.',
        scheitertAn: 'budget_module',
        werk: strasse([RECHENWERK, BESTAND, REIHER, KONDOR, KONDOR, SCHMIEDE, AUGE, VERDICHTEN]),
      },
      {
        name: 'Der Chor unter Zeitdruck',
        verlockung:
          'Drei Zweige mit Bestenauswahl heben die Güte zuverlässig, und weil sie parallel laufen, kostet das keine zusätzliche Wartezeit.',
        scheitertAn: 'kostenJeAuftrag',
        werk: chor({ vor: [RECHENWERK], zweige: 3, zweig: [KONDOR], modus: 'bester' }),
      },
      {
        name: 'Die Nacharbeit ohne Ende',
        verlockung:
          'Eine Prüferin mit hoher Schwelle schickt zurück, bis es stimmt. Das kostet nur Rechenzeit, und Rechenzeit steht in keinem Vertrag.',
        scheitertAn: 'latenzP95',
        werk: schleife({ vor: [RECHENWERK, BESTAND], block: [REIHER], schwelle: 0.9, runden: 2 }),
      },
      {
        name: 'Ohne Rechenwerk gespart',
        verlockung:
          'Der Preis je Vorgang ist die harte Zahl. Ein Werkzeug weniger ist ein Bauplatz weniger und ein Posten weniger auf der Rechnung.',
        scheitertAn: 'guete',
        werk: strasse([BESTAND, KONDOR]),
      },
    ],
    monolith: monolith(3),
  },
];
