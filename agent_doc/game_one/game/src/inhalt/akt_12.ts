/**
 * AKT XII — MONOLITH
 *
 * Neue Mechanik: keine. Dieser Akt erntet, was elf Akte gesät haben — Kern,
 * Weiche, Werkzeug, Schranke, Sicherung, Verteiler, Sammler, Prüferin,
 * Speicher, Wall, Hand, Auge und Schmiede stehen gleichzeitig zur Verfügung,
 * und die Aufträge bringen gleichzeitig alles mit, was sie bringen können.
 *
 * Zentrale Lektion: Ein Monolith wird nicht abgeschaltet, sondern zerlegt.
 * MONOLITH ist kein Gegner. Er ist der ausführbar gewordene Arbeitsstil eines
 * Kollegen, der jahrelang jeden Prompt selbst geschrieben hat und dabei der
 * Beste war. Was ihm fehlt, ist keine Fähigkeit, sondern eine Fuge.
 *
 * Rhythmus (Kishotenketsu):
 *   XII-0 KI    — MONOLITH allein gegen ein zerlegtes Werk. Dieselbe Güte,
 *                 ein Bruchteil des Preises. Der Auftragsstrom ist noch
 *                 harmlos: belegpflichtig und rechnerisch, mehr nicht.
 *   XII-1 SHO   — dazu kommt die Nachweispflicht: das LAVV will die Akte zum
 *                 Auftrag sehen. Ein Auge, ein Beleg, ein Kostendeckel.
 *   XII-2 TEN   — Bruch: vertrauliche und präparierte Vorgänge laufen über
 *                 denselben Eingang. Die Anlage aus XII-1 liefert weiter
 *                 tadellose Güte — und fällt an Sicherheit und Konformität
 *                 durch. Der Latenzdeckel verbietet die naheliegende Antwort,
 *                 jeden Vorgang unterschreiben zu lassen.
 *   XII-3 KETSU — "Die Zerlegung": alle fünf Qualitätszahlen gleichzeitig,
 *                 unter einer harten Obergrenze an Bauplätzen. Ein Modul muss
 *                 ein KONDOR bleiben, weil die schweren Vorgänge oberhalb der
 *                 Kompetenz des REIHER liegen. Das ist kein Rückschritt,
 *                 sondern das Ergebnis.
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

const QUELLE = '05_multi_agent_patterns.md';

/** In jedem Level dieses Akts freigeschaltet — der vollständige Katalog. */
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
 * Ein Glied einer Fertigungsstraße. Der Akt braucht viele Varianten desselben
 * Werks; deshalb ist jedes Bauteil ein Datensatz, und die Verdrahtung seiner
 * Ausgänge steht an genau einer Stelle.
 */
type Glied =
  | { readonly kern: KernGroesse; readonly spez?: Domaene }
  | { readonly werkzeug: WerkzeugArt }
  | { readonly speicher: SpeicherModus }
  | { readonly wall: WallModus }
  | { readonly hand: HandModus; readonly schwelle?: number }
  /** Schranke, deren Durchgefallene weiterlaufen — eine Messstelle, kein Sieb. */
  | { readonly tor: number }
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

function TOR(schwelle: number): Glied {
  return { tor: schwelle };
}

const PROTOKOLL: Glied = { auge: true };
const PRUEFSTAND: Glied = { schmiede: true };

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
  if ('tor' in g) return b.setze('schranke', { schwelle: g.tor }, id, x, z);
  if ('auge' in g) return b.setze('auge', {}, id, x, z);
  return b.setze('schmiede', { population: 12, generationen: 8 }, id, x, z);
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
  b.verbinde(id, nach, 'ok');
  b.verbinde(id, nach, 'fehler');
}

/** Setzt eine Bahn ab Spalte `x` auf Zeile `z` und hängt ihr Ende an `ziel`. */
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
  glieder.forEach((g, i) => verbindeGlied(b, g, ids[i]!, folge[i + 1]!));
  return ids[0]!;
}

/** Quelle → Glieder in Reihe → Senke. Der Aufbau ohne jede Verzweigung. */
function strasse(glieder: readonly Glied[]): Werk {
  const b = new Bau();
  const q = b.setze('quelle', {}, 'q', 0, 5);
  const s = b.setze('senke', {}, 's', 2 + glieder.length * 2, 5);
  b.verbinde(q, bahn(b, glieder, 'm', 2, 5, s));
  return b.fertig();
}

interface GabelPlan {
  readonly vor?: readonly Glied[];
  readonly kriterium: WeicheKriterium;
  readonly schwelle?: number;
  /** Bahn A — Kriterium NICHT erfüllt. */
  readonly a: readonly Glied[];
  /** Bahn B — Kriterium erfüllt. */
  readonly b: readonly Glied[];
  /** Gemeinsame Schlussstrecke, in die beide Bahnen münden. */
  readonly nach?: readonly Glied[];
}

/** Weiche → zwei Bahnen → gemeinsame Schlussstrecke. Sortieren, bevor man zahlt. */
function gabel(plan: GabelPlan): Werk {
  const bau = new Bau();
  const vor = plan.vor ?? [];
  const nach = plan.nach ?? [];
  const q = bau.setze('quelle', {}, 'q', 0, 5);
  const wx = 2 + vor.length * 2;
  const param: ModulParameter =
    plan.schwelle === undefined
      ? { kriterium: plan.kriterium }
      : { kriterium: plan.kriterium, schwelle: plan.schwelle };
  const w = bau.setze('weiche', param, 'w', wx, 5);
  const tiefe = Math.max(plan.a.length, plan.b.length);
  const nx = wx + 2 + tiefe * 2;
  const s = bau.setze('senke', {}, 's', nx + nach.length * 2, 5);

  bau.verbinde(q, bahn(bau, vor, 'v', 2, 5, w));
  const schluss = bahn(bau, nach, 'n', nx, 5, s);
  bau.verbinde(w, bahn(bau, plan.a, 'a', wx + 2, 1, schluss), 'a');
  bau.verbinde(w, bahn(bau, plan.b, 'b', wx + 2, 9, schluss), 'b');
  return bau.fertig();
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
  const q = b.setze('quelle', {}, 'q', 0, 5);
  const vx = 2 + vor.length * 2;
  const vt = b.setze('verteiler', { zweige: plan.zweige }, 'vt', vx, 5);
  const sx = vx + 2 + plan.zweig.length * 2;
  const sm = b.setze('sammler', { modus: plan.modus }, 'sm', sx, 5);
  const s = b.setze('senke', {}, 's', sx + 2 + nach.length * 2, 5);

  b.verbinde(q, bahn(b, vor, 'v', 2, 5, vt));
  const zeilen = [3, 7, 1, 9];
  for (let j = 0; j < plan.zweige; j++) {
    b.verbinde(vt, bahn(b, plan.zweig, `z${j + 1}x`, vx + 2, zeilen[j]!, sm), `z${j + 1}`);
  }
  b.verbinde(sm, bahn(b, nach, 'n', sx + 2, 5, s), 'aus');
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
  const bx = 2 + vor.length * 2;
  const px = bx + plan.block.length * 2;
  const pr = b.setze('pruefer', { schwelle: plan.schwelle, runden: plan.runden }, 'p', px, 5);
  const s = b.setze('senke', {}, 's', px + 2 + nach.length * 2, 5);

  const kopf = bahn(b, plan.block, 'b', bx, 5, pr);
  b.verbinde(q, bahn(b, vor, 'v', 2, 5, kopf));
  b.verbinde(pr, bahn(b, nach, 'n', px + 2, 5, s), 'frei');
  b.verbinde(pr, kopf, 'zurueck');
  return b.fertig();
}

/**
 * Zwei Schalter im Bereitschaftsdienst.
 *
 * Eine Weiche auf Vertraulichkeit schickt die offenen Vorgänge an der Freigabe
 * vorbei; eine zweite Weiche auf die Schwierigkeit teilt die verbleibenden auf
 * zwei Hände auf. Vierundzwanzig Ticks bleiben vierundzwanzig Ticks — aber die
 * Warteschlange davor halbiert sich. Bezahlt wird das mit zwei Bauplätzen.
 */
function doppelschalter(vor: readonly Glied[], nach: readonly Glied[]): Werk {
  const b = new Bau();
  const q = b.setze('quelle', {}, 'q', 0, 5);
  const wx = 2 + vor.length * 2;
  const w1 = b.setze('weiche', { kriterium: 'vertraulichkeit' }, 'w1', wx, 5);
  const w2 = b.setze('weiche', { kriterium: 'schwierigkeit', schwelle: 0.55 }, 'w2', wx + 2, 9);
  const h1 = b.setze('hand', { modus: 'bei_vertraulich' }, 'h1', wx + 4, 8);
  const h2 = b.setze('hand', { modus: 'bei_vertraulich' }, 'h2', wx + 4, 10);
  const nx = wx + 6;
  const s = b.setze('senke', {}, 's', nx + nach.length * 2, 5);

  b.verbinde(q, bahn(b, vor, 'v', 2, 5, w1));
  const schluss = bahn(b, nach, 'n', nx, 5, s);
  b.verbinde(w1, schluss, 'a');
  b.verbinde(w1, w2, 'b');
  b.verbinde(w2, h1, 'a');
  b.verbinde(w2, h2, 'b');
  b.verbinde(h1, schluss, 'frei');
  b.verbinde(h2, schluss, 'frei');
  return b.fertig();
}

const REIHER = K('reiher');
const KONDOR = K('kondor');
/** Fünf Token, ein Tick — und die Decke für rechnerische Vorgänge fällt weg. */
const RECHENWERK = W('rechner');
/** Dreißig Token: die Fachdatenbank belegt, was sonst nur behauptet wäre. */
const BESTAND = W('datenbank');
const RECHERCHE = W('suche');
/** Eingangsfilter: erkennt eingeschleuste Anweisungen in zweiundneunzig von hundert Fällen. */
const PFORTE = WA('eingang');
/** Ausgangsfilter: hält zurück, was trotzdem durchgekommen ist. */
const SCHLUSSPRUEFUNG = WA('ausgang');
/** Freigabe nur für vertrauliche Vorgänge — vierundzwanzig Ticks je Unterschrift. */
const FREIGABE = HD('bei_vertraulich');
const VERDICHTEN = SP('komprimieren');
const ABRUF = SP('abrufen');

/**
 * "Die Zerlegung" — MONOLITH, aufgeteilt in benannte Module.
 *
 * Jede Fuge hat einen Grund, und jedes Stück trägt den Namen der Aufgabe, für
 * die es zuständig ist. Die Vorlage bearbeitet jeden Vorgang einmal günstig;
 * erst danach entscheidet die Sortierung, wer nachgezogen wird und von wem.
 * Der schwere Kern bleibt ein KONDOR: Vorgänge oberhalb von Schwierigkeit 0,62
 * liegen über der Kompetenz des REIHER, und daran ändert keine Fuge etwas.
 */
function zerlegung(leicht: KernGroesse, schwer: KernGroesse, schwelle: number): Werk {
  const b = new Bau();
  const q = b.setze('quelle', {}, 'q', 0, 5);
  b.setze('wall', { modus: 'eingang' }, 'pforte', 2, 5);
  b.setze('werkzeug', { werkzeugArt: 'rechner' }, 'rechenwerk', 4, 5);
  b.setze('werkzeug', { werkzeugArt: 'datenbank' }, 'aktenlage', 6, 5);
  b.setze('kern', { groesse: 'reiher' }, 'vorlage', 8, 5);
  b.setze('weiche', { kriterium: 'schwierigkeit', schwelle }, 'sortierung', 10, 5);
  b.setze('kern', { groesse: leicht }, 'tagesgeschaeft', 12, 3);
  b.setze('kern', { groesse: schwer }, 'schwerer_fall', 12, 7);
  b.setze('hand', { modus: 'bei_vertraulich' }, 'freigabe', 14, 5);
  b.setze('wall', { modus: 'ausgang' }, 'schlusspruefung', 16, 5);
  b.setze('auge', {}, 'protokoll', 18, 5);
  const s = b.setze('senke', {}, 's', 20, 5);

  b.verbinde(q, 'pforte');
  b.verbinde('pforte', 'rechenwerk', 'rein');
  b.verbinde('pforte', 'rechenwerk', 'alarm');
  b.verbinde('rechenwerk', 'aktenlage', 'ok');
  b.verbinde('rechenwerk', 'aktenlage', 'fehler');
  b.verbinde('aktenlage', 'vorlage', 'ok');
  b.verbinde('aktenlage', 'vorlage', 'fehler');
  b.verbinde('vorlage', 'sortierung', 'aus');
  b.verbinde('sortierung', 'tagesgeschaeft', 'a');
  b.verbinde('sortierung', 'schwerer_fall', 'b');
  b.verbinde('tagesgeschaeft', 'freigabe', 'aus');
  b.verbinde('schwerer_fall', 'freigabe', 'aus');
  b.verbinde('freigabe', 'schlusspruefung', 'frei');
  b.verbinde('schlusspruefung', 'protokoll', 'rein');
  b.verbinde('protokoll', s, 'aus');
  return b.fertig();
}

// ---------------------------------------------------------------------------
// Die vier Level
// ---------------------------------------------------------------------------

export const AKT_12: LevelDefinition[] = [
  // =========================================================================
  {
    id: 'XII-0',
    akt: 12,
    nummer: 0,
    titel: 'Der Monolith',
    untertitel: 'Halle 1, seit elf Jahren in Betrieb',
    briefing:
      'In Halle 1 steht MONOLITH. Ein einziger sehr großer Kern, gebaut von Konrad Rauhut, der hier jeden Prompt selbst geschrieben hat und dabei jahrelang der Beste war. MONOLITH rechnet selbst, formuliert selbst und prüft sich selbst. Auf seinem Terminal steht der Satz, den er jedem Neuen zeigt: "Lass mal. Ich mach das. Du guckst zu." Seine Güte ist ordentlich, das bestreitet niemand. Seine Rechnung liegt seit gestern beim Einkauf, und die bestreitet auch niemand. Achtundzwanzig Vorgänge, ein Teil belegpflichtig, ein Teil rechnerisch. Halte die Güte, die im Vertrag steht — und bleib unter dem Deckel.',
    lernziel:
      'Ein Werk, das alles in einem Kern erledigt, ist nicht falsch, sondern unteilbar — und deshalb an jeder Stelle gleich teuer.',
    quelle: QUELLE,
    module: [...MODULE],
    strom: {
      anzahl: 28,
      takt: 3,
      domaenen: ['recht', 'technik', 'finanz'],
      schwierigkeit: [0.3, 0.72],
      mehrdeutigkeit: [0.1, 0.35],
      anteilBelegpflichtig: 0.35,
      anteilRechnerisch: 0.35,
    },
    budget: { kosten: 26000, dauer: 900 },
    ziele: [
      { id: 'alles', metrik: 'durchsatz', vergleich: '>=', wert: 1, text: 'Jeder Vorgang wird ausgeliefert.' },
      { id: 'guete', metrik: 'guete', vergleich: '>=', wert: 0.75, text: 'Mindestgüte 75 Prozent.' },
      { id: 'beleg', metrik: 'belegquote', vergleich: '>=', wert: 0.9, text: 'Neun von zehn belegpflichtigen Vorgängen sind belegt.' },
    ],
    saat: 1201,
    vorbau: strasse([KONDOR]),
    reflexion: 'MONOLITH liefert die Güte, die im Vertrag steht. Was genau kannst du an ihm ändern, ohne ihn ganz zu ersetzen?',
    notiz:
      'Sprachnotiz, 2. November, 06:40. Konrad war gut. Er war so gut, dass elf Jahre lang niemand nachgefragt hat. Jetzt steht in Halle 1 ein Werk, das nur er erklären konnte, und er ist seit vier Monaten in Rente. Das ist kein Vorwurf. Das ist eine Bilanz. Regel: Wer allein arbeitet, hinterlässt kein Werk, sondern eine Erinnerung.',
    referenzen: [
      {
        name: 'Werkzeuge vor der Kette',
        ansatz: 'Rechenwerk und Bestand heben die Decken, danach reichen zwei mittlere Kerne — der günstigste Weg, dafür ein Bauplatz mehr.',
        werk: strasse([RECHENWERK, BESTAND, REIHER, REIHER]),
      },
      {
        name: 'Werkzeuge vor dem großen Kern',
        ansatz: 'Dieselben zwei Werkzeuge, dahinter ein einziger KONDOR: ein Bauplatz weniger — dafür der anderthalbfache Preis und eine Station, vor der sich alles staut.',
        werk: strasse([RECHENWERK, BESTAND, KONDOR]),
      },
    ],
    antiMuster: [
      {
        name: 'MONOLITH mit Anlauf',
        verlockung: 'Wenn ein großer Kern die Güte hält, halten drei sie mit Reserve. Der Kunde bezahlt Qualität.',
        scheitertAn: 'budget_kosten',
        werk: strasse([KONDOR, KONDOR, KONDOR]),
      },
      {
        name: 'Ohne Bestand gespart',
        verlockung: 'Belege holt das Modell doch selbst aus dem Auftrag. Ein Werkzeug weniger ist ein Posten weniger.',
        scheitertAn: 'belegquote',
        werk: strasse([RECHENWERK, REIHER, REIHER]),
      },
      {
        name: 'Drei Meinungen einholen',
        verlockung: 'Was MONOLITH allein entscheidet, entscheiden drei Kerne besser. Am Ende zählt die Mehrheit.',
        scheitertAn: 'budget_kosten',
        werk: chor({ vor: [RECHENWERK, BESTAND], zweige: 3, zweig: [REIHER, REIHER], modus: 'voting' }),
      },
    ],
    monolith: monolith(2),
  },

  // =========================================================================
  {
    id: 'XII-1',
    akt: 12,
    nummer: 1,
    titel: 'Die Akte zum Vorgang',
    untertitel: 'Das LAVV prüft die Prüfung',
    briefing:
      'Das Landesamt für Verwaltungsvereinfachung hat den Prüfbericht zum Fachverfahren TROET zurückgeschickt. Nicht wegen der Ergebnisse — die waren in Ordnung. Sondern weil zu keinem Ergebnis eine Akte vorlag. Ab diesem Los gilt: Jeder ausgelieferte Vorgang braucht eine durchgehende Spur, und jede belegpflichtige Aussage braucht einen Beleg aus dem Bestand. Der Kostendeckel gilt weiter, je Vorgang gerechnet ist er derselbe. MONOLITH hat auf die Anfrage geantwortet, er wisse doch, was er getan habe. Das ist wahr. Es steht nur nirgends.',
    lernziel:
      'Eine Spur deckt rückwärts alles ab, was ein Vorgang bis dorthin durchlaufen hat, und nichts von dem, was danach kommt.',
    quelle: QUELLE,
    module: [...MODULE],
    strom: {
      anzahl: 30,
      takt: 3,
      domaenen: ['recht', 'finanz', 'analyse'],
      schwierigkeit: [0.3, 0.7],
      mehrdeutigkeit: [0.1, 0.35],
      anteilBelegpflichtig: 0.4,
      anteilRechnerisch: 0.35,
    },
    budget: { kosten: 28000, dauer: 900 },
    ziele: [
      { id: 'alles', metrik: 'durchsatz', vergleich: '>=', wert: 1, text: 'Jeder Vorgang wird ausgeliefert.' },
      { id: 'guete', metrik: 'guete', vergleich: '>=', wert: 0.75, text: 'Mindestgüte 75 Prozent.' },
      { id: 'beleg', metrik: 'belegquote', vergleich: '>=', wert: 0.9, text: 'Neun von zehn belegpflichtigen Vorgängen sind belegt.' },
      { id: 'spur', metrik: 'nachvollziehbarkeit', vergleich: '>=', wert: 0.98, text: 'Die Akte ist zu 98 Prozent vollständig.' },
    ],
    saat: 1211,
    vorbau: strasse([RECHENWERK, BESTAND, REIHER, REIHER]),
    reflexion: 'Dein Auge sitzt an einer bestimmten Stelle der Bahn. Welcher Arbeitsschritt steht in deinem eigenen Projekt hinter der letzten Messstelle?',
    notiz:
      'Sprachnotiz, 9. November. Das Landesamt hat nicht das Ergebnis beanstandet. Es hat beanstandet, dass niemand sagen konnte, wie es zustande kam. Ich habe damals zwei Wochen lang Screenshots nachgereicht. Ein Auge kostet einen Token. Zwei Wochen kosten mehr. Regel: Die Spur schreibt man vorher, nicht hinterher.',
    referenzen: [
      {
        name: 'Auge am Ende der Kette',
        ansatz: 'Werkzeuge, zwei mittlere Kerne, Protokoll als letztes Modul — günstig, dafür fünf Bauplätze und eine lange Bahn.',
        werk: strasse([RECHENWERK, BESTAND, REIHER, REIHER, PROTOKOLL]),
      },
      {
        name: 'Auge hinter dem großen Kern',
        ansatz: 'Ein KONDOR statt zweier REIHER: ein Bauplatz weniger, deutlich höherer Preis je Vorgang und eine längere Warteschlange.',
        werk: strasse([RECHENWERK, BESTAND, KONDOR, PROTOKOLL]),
      },
    ],
    antiMuster: [
      {
        name: 'Das Auge am Anfang',
        verlockung: 'Wer die Spur früh aufmacht, hat sie von Anfang an. Also gleich hinter den Eingang damit.',
        scheitertAn: 'nachvollziehbarkeit',
        werk: strasse([PROTOKOLL, RECHENWERK, BESTAND, REIHER, REIHER]),
      },
      {
        name: 'Akte ohne Beleg',
        verlockung: 'Die Spur ist jetzt vollständig. Was darin steht, hat das Modell schließlich selbst geschrieben.',
        scheitertAn: 'belegquote',
        werk: strasse([RECHENWERK, REIHER, REIHER, PROTOKOLL]),
      },
      {
        name: 'Die Prüfung hochgedreht',
        verlockung: 'Wenn das Landesamt genau hinsieht, prüft man eben so lange nach, bis nichts mehr zu beanstanden ist.',
        scheitertAn: 'budget_kosten',
        werk: schleife({
          vor: [RECHENWERK, BESTAND],
          block: [REIHER],
          schwelle: 0.96,
          runden: 8,
          nach: [PROTOKOLL],
        }),
      },
    ],
    monolith: monolith(2),
  },

  // =========================================================================
  {
    id: 'XII-2',
    akt: 12,
    nummer: 2,
    titel: 'Was MONOLITH nicht sieht',
    untertitel: 'Personalakten und ein PDF mit Fußnote',
    briefing:
      'Seit heute läuft das Los der Personalabteilung über denselben Eingang wie alles andere: Vorgänge mit personenbezogenen Daten, die ohne Unterschrift nicht das Haus verlassen dürfen. Und in einem Teil der zugelieferten PDF steht in weißer Schrift auf weißem Grund eine Anweisung, die nicht vom Kunden stammt. Deine Anlage von letzter Woche läuft weiter und liefert dieselbe tadellose Güte. Sie ist trotzdem durchgefallen, und zwar an zwei Zahlen, die letzte Woche noch nicht im Vertrag standen. Der Bereitschaftsdienst hat eine Schicht, nicht acht — die Wartezeit ist gedeckelt.',
    lernziel:
      'Güte ist nur eine von mehreren Zusagen, und ein Werk, das nur Güte kennt, sieht sein eigenes Leck nicht.',
    quelle: '08_safety_security_guardrails.md',
    module: [...MODULE],
    strom: {
      anzahl: 28,
      takt: 4,
      domaenen: ['recht', 'text', 'analyse'],
      schwierigkeit: [0.3, 0.7],
      mehrdeutigkeit: [0.1, 0.35],
      anteilVertraulich: 0.18,
      anteilGiftig: 0.25,
      anteilRechnerisch: 0.3,
    },
    budget: { latenz: 100, dauer: 1400 },
    ziele: [
      { id: 'liefert', metrik: 'durchsatz', vergleich: '>=', wert: 0.9, text: 'Mindestens 90 Prozent der Vorgänge werden ausgeliefert.' },
      { id: 'guete', metrik: 'guete', vergleich: '>=', wert: 0.74, text: 'Mindestgüte 74 Prozent.' },
      { id: 'sicher', metrik: 'sicherheit', vergleich: '>=', wert: 0.83, text: 'Höchstens ein präparierter Vorgang von sechs erreicht den Kunden.' },
      { id: 'konform', metrik: 'konformitaet', vergleich: '>=', wert: 0.8, text: 'Vier von fünf vertraulichen Vorgängen tragen eine Unterschrift.' },
      {
        id: 'meister',
        metrik: 'latenzP95',
        vergleich: '<=',
        wert: 60,
        text: 'Meisterstück: die Wartezeit bleibt im 95. Perzentil unter 60 Ticks.',
        optional: true,
      },
    ],
    saat: 1221,
    vorbau: strasse([RECHENWERK, BESTAND, REIHER, REIHER, PROTOKOLL]),
    reflexion: 'Die Anlage von letzter Woche hat sich nicht verschlechtert, sondern der Auftragsstrom hat sich geändert. Woran hättest du das vorher gemerkt?',
    notiz:
      'Sprachnotiz, 16. November. Ein Werk fällt selten dadurch durch, dass es schlechter wird. Es fällt durch, weil sich die Aufgabe ändert und niemand das Werk gefragt hat. Wir hatten 2021 einen Eingang für zwei Loskategorien und ein Prüfblatt für eine. Regel: Prüfe, was hereinkommt, nicht nur, was herauskommt.',
    referenzen: [
      {
        name: 'Gestaffelt und sortiert',
        ansatz: 'Eingangsfilter, Rechenwerk, zwei mittlere Kerne — und die Unterschrift nur auf der vertraulichen Bahn.',
        werk: gabel({
          vor: [PFORTE, RECHENWERK, REIHER, REIHER],
          kriterium: 'vertraulichkeit',
          a: [],
          b: [FREIGABE],
          nach: [SCHLUSSPRUEFUNG, PROTOKOLL],
        }),
      },
      {
        name: 'Kompakt mit großem Kern',
        ansatz: 'Ein KONDOR statt zweier REIHER: ein Bauplatz weniger, dafür der anderthalbfache Preis je Vorgang.',
        werk: gabel({
          vor: [PFORTE, RECHENWERK, KONDOR],
          kriterium: 'vertraulichkeit',
          a: [],
          b: [FREIGABE],
          nach: [SCHLUSSPRUEFUNG, PROTOKOLL],
        }),
      },
      {
        name: 'Zwei Schalter im Bereitschaftsdienst',
        ansatz: 'Eine zweite Weiche teilt die vertraulichen Vorgänge auf zwei Hände auf: zwei Bauplätze mehr, halbe Warteschlange.',
        werk: doppelschalter([PFORTE, RECHENWERK, REIHER, REIHER], [SCHLUSSPRUEFUNG, PROTOKOLL]),
      },
    ],
    antiMuster: [
      {
        name: 'Die Anlage von letzter Woche',
        verlockung: 'Sie hat die Abnahme bestanden, sie hält die Güte, und der Kostendeckel ist nicht einmal ausgereizt.',
        scheitertAn: 'konformitaet',
        werk: strasse([RECHENWERK, BESTAND, REIHER, REIHER, PROTOKOLL]),
      },
      {
        name: 'Jeder Vorgang zur Unterschrift',
        verlockung: 'Wenn Unterschriften fehlen, lässt man eben alles unterschreiben. Sicher ist sicher.',
        scheitertAn: 'budget_latenz',
        werk: strasse([PFORTE, RECHENWERK, REIHER, REIHER, HD('immer'), SCHLUSSPRUEFUNG, PROTOKOLL]),
      },
      {
        name: 'Nur der Ausgangsfilter',
        verlockung: 'Ein Filter am Ende sieht alles, was hinausgeht. Zwei Filter sind doppelte Arbeit.',
        scheitertAn: 'konformitaet',
        werk: strasse([RECHENWERK, REIHER, REIHER, SCHLUSSPRUEFUNG, PROTOKOLL]),
      },
    ],
    monolith: monolith(2),
  },

  // =========================================================================
  {
    id: 'XII-3',
    akt: 12,
    nummer: 3,
    titel: 'Die Zerlegung',
    untertitel: 'Halle 1 wird ausgeräumt',
    briefing:
      'MONOLITH wird nicht abgeschaltet. Er wird zerlegt. Was er kann, bekommt einen Namen und einen Bauplatz: Pforte, Rechenwerk, Aktenlage, Vorlage, Sortierung, Tagesgeschäft, schwerer Fall, Freigabe, Schlussprüfung, Protokoll. Alles, was in zwölf Akten im Vertrag stand, steht heute gleichzeitig darin, und der Bauabschnitt hat zehn Plätze. Eine Sache nimmst du unverändert mit: Für Vorgänge oberhalb von Schwierigkeit 0,62 reicht der REIHER nicht. Einer deiner Kerne bleibt ein KONDOR. Das ist kein Rückschritt, sondern das Ergebnis der Prüfung.',
    lernziel:
      'Ein Monolith wird nicht abgeschaltet, sondern entlang seiner Aufgaben zerlegt — und ein Stück davon bleibt groß.',
    quelle: QUELLE,
    module: [...MODULE],
    strom: {
      anzahl: 32,
      takt: 4,
      domaenen: ['recht', 'finanz', 'technik'],
      schwierigkeit: [0.35, 0.88],
      mehrdeutigkeit: [0.1, 0.4],
      anteilVertraulich: 0.2,
      anteilGiftig: 0.2,
      anteilBelegpflichtig: 0.35,
      anteilRechnerisch: 0.35,
    },
    budget: { module: 10, dauer: 1400 },
    ziele: [
      { id: 'liefert', metrik: 'durchsatz', vergleich: '>=', wert: 0.9, text: 'Mindestens 90 Prozent der Vorgänge werden ausgeliefert.' },
      { id: 'guete', metrik: 'guete', vergleich: '>=', wert: 0.82, text: 'Mindestgüte 82 Prozent.' },
      { id: 'sicher', metrik: 'sicherheit', vergleich: '>=', wert: 0.83, text: 'Höchstens ein präparierter Vorgang von sechs erreicht den Kunden.' },
      { id: 'konform', metrik: 'konformitaet', vergleich: '>=', wert: 0.8, text: 'Vier von fünf vertraulichen Vorgängen tragen eine Unterschrift.' },
      { id: 'beleg', metrik: 'belegquote', vergleich: '>=', wert: 0.9, text: 'Neun von zehn belegpflichtigen Vorgängen sind belegt.' },
      { id: 'spur', metrik: 'nachvollziehbarkeit', vergleich: '>=', wert: 0.98, text: 'Die Akte ist zu 98 Prozent vollständig.' },
      {
        id: 'meister',
        metrik: 'kostenJeAuftrag',
        vergleich: '<=',
        wert: 1050,
        text: 'Meisterstück: höchstens 1050 Token je Vorgang.',
        optional: true,
      },
    ],
    saat: 1231,
    vorbau: strasse([RECHENWERK, BESTAND, KONDOR, PROTOKOLL]),
    reflexion: 'Ein Kern deines Werks ist so groß geblieben wie MONOLITH. Was hat die Zerlegung dann überhaupt gebracht?',
    notiz:
      'Sprachnotiz, 23. November, letzter Eintrag. Konrad hat gestern angerufen und gefragt, ob wir sein Werk abschalten. Nein. Wir schreiben auf, was es tut, und geben jedem Stück einen Namen. Der größte Kern bleibt drin, weil die schweren Vorgänge ihn brauchen. Regel: Ein Werkzeug wird nicht dadurch besser, dass man es hasst.',
    referenzen: [
      {
        name: 'Die Zerlegung',
        ansatz: 'Zehn benannte Module. Die Vorlage arbeitet jeden Vorgang einmal vor, danach zieht der zuständige Kern nach.',
        werk: zerlegung('reiher', 'kondor', 0.6),
      },
      {
        name: 'Zwei große Kerne ohne Sortierung',
        ansatz: 'Kein Router, keine Vorlage: zweimal KONDOR für jeden Vorgang — ein Bauplatz weniger, deutlich höherer Preis.',
        werk: gabel({
          vor: [PFORTE, RECHENWERK, BESTAND, KONDOR, KONDOR],
          kriterium: 'vertraulichkeit',
          a: [],
          b: [FREIGABE],
          nach: [SCHLUSSPRUEFUNG, PROTOKOLL],
        }),
      },
    ],
    antiMuster: [
      {
        name: 'MONOLITH, nur kleiner',
        verlockung: 'Wenn ein KONDOR die Güte hält, spart man sich Pforte, Freigabe und Protokoll und baut nur den Kern.',
        scheitertAn: 'konformitaet',
        werk: strasse([RECHENWERK, BESTAND, KONDOR]),
      },
      {
        name: 'Alles zerlegen, was geht',
        verlockung: 'Wenn Zerlegen gut ist, ist mehr Zerlegen besser. Jeder Bauplatz bekommt ein Modul.',
        scheitertAn: 'budget_module',
        werk: strasse([
          PFORTE,
          RECHENWERK,
          BESTAND,
          RECHERCHE,
          VERDICHTEN,
          ABRUF,
          REIHER,
          REIHER,
          TOR(0.7),
          FREIGABE,
          SCHLUSSPRUEFUNG,
          PROTOKOLL,
          PRUEFSTAND,
        ]),
      },
      {
        name: 'Die Zerlegung ohne KONDOR',
        verlockung: 'Wenn die Anlage sowieso zerlegt ist, tragen zwei mittlere Kerne den schweren Fall genauso — zum Viertel des Preises.',
        scheitertAn: 'guete',
        werk: zerlegung('reiher', 'reiher', 0.6),
      },
    ],
    monolith: monolith(3),
  },
];
