/**
 * AKT VII — DER SPEICHER
 *
 * Neue Mechanik: der Speicher in vier Betriebsarten — verdichten, abrufen,
 * abschotten und puffern.
 * Zentrale Lektion: Kontext ist ein Budget, kein Vorrat. Jeder Kernaufruf
 * bezahlt den gesamten mitgeschleppten Kontext ein zweites Mal, und oberhalb
 * von 45 Prozent Fuellstand wird er zusaetzlich wirkungslos.
 *
 * Rhythmus (Kishotenketsu):
 *   VII-0 KI    — die geerbte lange Kette reisst den Tokendeckel und verliert
 *                 an Güte. Eine Verdichtung in der Mitte repariert beides.
 *   VII-1 SHO   — der Speicher trifft auf die Weiche: 'abrufen' hebt die
 *                 Güte-Decke, aber nur schwere Vorgaenge brauchen das.
 *   VII-2 TEN   — Bruch: der Puffer ist der staerkste Kostenhebel des Akts,
 *                 und jede Verdichtung dahinter macht ihn wertlos. Die Loesung
 *                 aus VII-1 reisst hier den Deckel.
 *   VII-3 KETSU — Synthese unter hartem Deckel: zwei Werkzeuge, gemischte Last,
 *                 und die Reihenfolge von Verdichten und Puffern entscheidet.
 */

import type { KernGroesse, SpeicherModus, Werk, WerkzeugArt } from '../sim/typen';
import type { LevelDefinition } from './level_typen';
import { monolith } from './bauhilfe';
import { Bau } from './bauhilfe';

const QUELLE = '06_tool_use_context_engineering.md#context-engineering';

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
] as const;

// ---------------------------------------------------------------------------
// Baukasten dieses Akts
// ---------------------------------------------------------------------------

/**
 * Ein Glied einer Fertigungsstrasse. Werkzeuge haben zwei Ausgaenge; ist
 * `sicher` gesetzt, haengt an ihrem Ausfall eine Sicherung, die zweimal
 * wiederholt und danach degradiert weiterreicht.
 */
type Glied =
  | { readonly kern: KernGroesse }
  | { readonly speicher: SpeicherModus }
  | { readonly werkzeug: WerkzeugArt; readonly sicher?: true };

function K(groesse: KernGroesse): Glied {
  return { kern: groesse };
}

function SP(modus: SpeicherModus): Glied {
  return { speicher: modus };
}

/** Werkzeug mit Wiederholung an seinem Ausfall-Ausgang. */
function WS(werkzeug: WerkzeugArt): Glied {
  return { werkzeug, sicher: true };
}

/** Werkzeug ohne Wiederholung — ein Ausfall kostet den Beleg. */
function W(werkzeug: WerkzeugArt): Glied {
  return { werkzeug };
}

function setzeGlied(b: Bau, g: Glied, id: string, x: number, z: number): string {
  if ('kern' in g) return b.setze('kern', { groesse: g.kern }, id, x, z);
  if ('speicher' in g) return b.setze('speicher', { modus: g.speicher }, id, x, z);
  return b.setze('werkzeug', { werkzeugArt: g.werkzeug }, id, x, z);
}

function verbindeGlied(b: Bau, g: Glied, id: string, nach: string, x: number, z: number): void {
  if (!('werkzeug' in g)) {
    b.verbinde(id, nach, 'aus');
    return;
  }
  b.verbinde(id, nach, 'ok');
  if (g.sicher === true) {
    const si = b.setze('sicherung', { modus: 'wiederholen', versuche: 2 }, `${id}s`, x, z + 1);
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
  glieder.forEach((g, i) => verbindeGlied(b, g, ids[i]!, folge[i + 1]!, 2 + i * 2, 5));
  return b.fertig();
}

interface GabelPlan {
  /** Gemeinsame Vorstufe vor der Weiche. */
  readonly vor?: readonly Glied[];
  /** Schwelle der Weiche auf `schwierigkeit`. */
  readonly schwelle: number;
  /** Bahn A: Kriterium nicht erfuellt (die leichteren Vorgaenge). */
  readonly leicht: readonly Glied[];
  /** Bahn B: Kriterium erfuellt (die schweren Vorgaenge). */
  readonly schwer: readonly Glied[];
}

/** Quelle → Vorstufe → Weiche → zwei Bahnen → Senke. */
function gabel(plan: GabelPlan): Werk {
  const b = new Bau();
  const vor = plan.vor ?? [];
  const q = b.setze('quelle', {}, 'q', 0, 5);
  const vorIds = vor.map((g, i) => setzeGlied(b, g, `v${i + 1}`, 2 + i * 2, 5));
  const wx = 2 + vor.length * 2;
  const w = b.setze('weiche', { kriterium: 'schwierigkeit', schwelle: plan.schwelle }, 'w', wx, 5);
  const tiefe = Math.max(plan.leicht.length, plan.schwer.length);
  const s = b.setze('senke', {}, 's', wx + 2 + tiefe * 2, 5);

  const vorFolge = [...vorIds, w];
  b.verbinde(q, vorFolge[0]!);
  vor.forEach((g, i) => verbindeGlied(b, g, vorIds[i]!, vorFolge[i + 1]!, 2 + i * 2, 5));

  const aIds = plan.leicht.map((g, i) => setzeGlied(b, g, `a${i + 1}`, wx + 2 + i * 2, 1));
  const aFolge = [...aIds, s];
  b.verbinde(w, aFolge[0]!, 'a');
  plan.leicht.forEach((g, i) => verbindeGlied(b, g, aIds[i]!, aFolge[i + 1]!, wx + 2 + i * 2, 1));

  const bIds = plan.schwer.map((g, i) => setzeGlied(b, g, `b${i + 1}`, wx + 2 + i * 2, 9));
  const bFolge = [...bIds, s];
  b.verbinde(w, bFolge[0]!, 'b');
  plan.schwer.forEach((g, i) => verbindeGlied(b, g, bIds[i]!, bFolge[i + 1]!, wx + 2 + i * 2, 9));
  return b.fertig();
}

const KONDOR = K('kondor');
const REIHER = K('reiher');
/** Verdichten: Kontext mal 0,35 — drei Zehntel Güte als Preis. */
const VERDICHTEN = SP('komprimieren');
/** Puffern: der Kontextstand wird gemerkt und kostet danach nur noch ein Zehntel. */
const PUFFERN = SP('puffern');
/** Abschotten: Kontext hart auf 0,15 gedeckelt, dafuer mehr Unsicherheit. */
const ABSCHOTTEN = SP('isolieren');
/** Abrufen: hebt die Güte-Decke um 0,06 und klaert die Unsicherheit. */
const ABRUFEN = SP('abrufen');

// ---------------------------------------------------------------------------
// Die vier Level
// ---------------------------------------------------------------------------

export const AKT_7: LevelDefinition[] = [
  // =========================================================================
  {
    id: 'VII-0',
    akt: 7,
    nummer: 0,
    titel: 'Die lange Leitung',
    untertitel: 'Übernahme aus Halle 2',
    briefing:
      'Halle 2 wird aufgeloest, ihre Vorgaenge kommen zu dir. Mit ihnen kommt das Werk, das sie bearbeitet hat: vier grosse Kerne hintereinander, seit achtzehn Monaten unveraendert, laut Übergabeprotokoll "bewaehrt". Der Einkauf sieht das anders und hat einen Tokendeckel dazugelegt. Sieh dir an, was in der Kette passiert: jeder Kern haengt sein Ergebnis an das des Vorgaengers, und jeder naechste Kern bezahlt den ganzen Anhang noch einmal mit. Ab einem Fuellstand von 45 Prozent kommt dazu, dass er ihn nicht mehr verarbeitet, sondern nur noch mitschleppt. Auf der Palette steht ein neues Modul. Es kann Kontext verdichten, abrufen, abschotten oder puffern. Heute reicht die erste Betriebsart.',
    lernziel:
      'Eine Verdichtung in der Mitte einer Kette senkt die Kosten aller folgenden Aufrufe und macht sie zugleich wieder wirksam.',
    quelle: QUELLE,
    module: [...MODULE],
    strom: {
      anzahl: 30,
      takt: 5,
      domaenen: ['recht', 'analyse'],
      schwierigkeit: [0.6, 0.88],
      mehrdeutigkeit: [0.0, 0.12],
    },
    budget: { kosten: 102000, dauer: 600 },
    ziele: [
      { id: 'alles', metrik: 'durchsatz', vergleich: '>=', wert: 1, text: 'Jeder Vorgang wird ausgeliefert.' },
      { id: 'guete', metrik: 'guete', vergleich: '>=', wert: 0.95, text: 'Mindestgüte 95 Prozent.' },
    ],
    saat: 701,
    vorbau: strasse([KONDOR, KONDOR, KONDOR, KONDOR]),
    reflexion: 'Der vierte Kern hat mehr gekostet als der erste. Woran genau lag das?',
    notiz:
      'Sprachnotiz, 2. Juni, 07:10. Halle 2 hat achtzehn Monate lang jeden Vorgang durch dieselben vier Kerne geschickt und war stolz darauf. Niemand hat je gefragt, was der vierte Kern eigentlich liest. Regel: Was du nicht wegwirfst, bezahlst du bei jedem Schritt erneut.',
    referenzen: [
      {
        name: 'Verdichtet in der Mitte',
        ansatz: 'Die geerbte Kette bleibt, ein Verdichter nach dem zweiten Kern raeumt den Kontext auf.',
        werk: strasse([KONDOR, KONDOR, VERDICHTEN, KONDOR, KONDOR]),
      },
      {
        name: 'Verdichtet und gepuffert',
        ansatz: 'Frueher verdichten, den verbleibenden Rest puffern — ein Modul mehr, dafuer deutlich billiger.',
        werk: strasse([KONDOR, VERDICHTEN, KONDOR, PUFFERN, KONDOR, KONDOR]),
      },
    ],
    antiMuster: [
      {
        name: 'Die geerbte Kette',
        verlockung: 'Das Werk aus Halle 2 hat achtzehn Monate lang funktioniert. Warum sollte man es anfassen?',
        scheitertAn: 'budget_kosten',
        werk: strasse([KONDOR, KONDOR, KONDOR, KONDOR]),
      },
      {
        name: 'Noch ein Kern hinten dran',
        verlockung: 'Wenn die Güte nicht reicht, haengt man einen fuenften Kern an. Das war bisher immer die Antwort.',
        scheitertAn: 'budget_kosten',
        werk: strasse([KONDOR, KONDOR, KONDOR, KONDOR, KONDOR]),
      },
      {
        name: 'Die Kette gekuerzt',
        verlockung: 'Wenn die Kette zu teuer ist, nimmt man eben einen Kern heraus. Kostet weniger, spart den Umbau.',
        scheitertAn: 'guete',
        werk: strasse([KONDOR, KONDOR, KONDOR]),
      },
    ],
    monolith: monolith(3),
  },

  // =========================================================================
  {
    id: 'VII-1',
    akt: 7,
    nummer: 1,
    titel: 'Das Archiv',
    untertitel: 'Altfaelle, Bestand TROET',
    briefing:
      'Aus dem Fachverfahren TROET kommen Altfaelle. Ein Teil davon liegt oberhalb dessen, was der groesste Kern aus eigener Kraft beantworten kann — er laeuft nicht gegen ein Kostenproblem, sondern gegen eine Decke. Mehr Aufrufe heben sie nicht, denn die Decke haengt am Kern, nicht an der Anzahl der Versuche. Der Speicher kann abrufen: er holt vorhandenes Wissen aus dem Bestand dazu, hebt die Decke um sechs Punkte und raeumt Unsicherheit ab. Er kostet vierzig Token und zehn Punkte Kontextlast, und die bezahlst du danach in jedem Kernaufruf mit. Der Eingang ist gemischt. Nicht jeder Vorgang steht an der Decke.',
    lernziel:
      'Ein Wissensabruf hebt die Güte-Decke und lohnt genau dort, wo der Vorgang an dieser Decke steht.',
    quelle: QUELLE,
    module: [...MODULE],
    strom: {
      anzahl: 30,
      takt: 5,
      domaenen: ['recht', 'analyse', 'technik'],
      schwierigkeit: [0.5, 1.4],
      mehrdeutigkeit: [0.1, 0.3],
    },
    budget: { kosten: 140000, dauer: 600 },
    ziele: [
      { id: 'alles', metrik: 'durchsatz', vergleich: '>=', wert: 1, text: 'Jeder Vorgang wird ausgeliefert.' },
      { id: 'guete', metrik: 'guete', vergleich: '>=', wert: 0.95, text: 'Mindestgüte 95 Prozent.' },
    ],
    saat: 711,
    vorbau: strasse([KONDOR, KONDOR, KONDOR]),
    reflexion: 'Zwei Vorgaenge, gleicher Abruf, gleicher Preis. Warum hat er nur bei einem von beiden gewirkt?',
    notiz:
      'Sprachnotiz, 9. Juni. TROET ist von 1998 und weiss trotzdem mehr ueber diese Faelle als jeder Kern. Wir haben lange geglaubt, ein groesseres Modell ersetze den Bestand. Es ersetzt ihn nicht, es raet nur teurer. Regel: Wissen holt man, Rechenkraft kauft man.',
    referenzen: [
      {
        name: 'Abruf vor der Kette',
        ansatz: 'Ein Abruf ganz vorn, danach vier grosse Kerne — kompakt, ohne Sortierung, dafuer teuer.',
        werk: strasse([ABRUFEN, KONDOR, KONDOR, KONDOR, KONDOR]),
      },
      {
        name: 'Nur die schweren ins Archiv',
        ansatz: 'Eine Weiche trennt vorher: leichte Vorgaenge laufen ohne Abruf, nur die schweren holen Wissen dazu.',
        werk: gabel({
          schwelle: 0.9,
          leicht: [KONDOR, KONDOR, VERDICHTEN, KONDOR],
          schwer: [ABRUFEN, KONDOR, KONDOR, VERDICHTEN, KONDOR],
        }),
      },
    ],
    antiMuster: [
      {
        name: 'Ohne Archiv, dafuer laenger',
        verlockung: 'Was ein Abruf kann, kann ein weiterer Kernaufruf auch. Man muss ihm nur genug Durchgaenge geben.',
        scheitertAn: 'guete',
        werk: strasse([KONDOR, KONDOR, KONDOR, KONDOR, KONDOR]),
      },
      {
        name: 'Abruf hinter der Kette',
        verlockung: 'Erst arbeiten lassen, dann das Wissen dazuholen — so steht der Abruf da, wo das Ergebnis entsteht.',
        scheitertAn: 'guete',
        werk: strasse([KONDOR, KONDOR, KONDOR, KONDOR, ABRUFEN]),
      },
      {
        name: 'Zwei Abrufe fuer alle',
        verlockung: 'Wenn ein Abruf die Decke hebt, heben zwei sie weiter. Vierzig Token sind kein Argument.',
        scheitertAn: 'budget_kosten',
        werk: strasse([ABRUFEN, KONDOR, ABRUFEN, KONDOR, KONDOR, KONDOR]),
      },
    ],
    monolith: monolith(3),
  },

  // =========================================================================
  {
    id: 'VII-2',
    akt: 7,
    nummer: 2,
    titel: 'Der Puffer, der keiner war',
    untertitel: 'Quartalsuebersicht, Zeile 9',
    briefing:
      'Der Abruf aus der vergangenen Woche steht in der Quartalsuebersicht, Zeile 9, und der Deckel ist seither halb so hoch. Der Speicher hat eine vierte Betriebsart, und sie ist der staerkste Kostenhebel dieses Akts: Puffern merkt sich den Kontextstand, und jeder spaetere Kernaufruf bezahlt fuer diesen Anteil nur noch ein Zehntel. Es gibt eine Bedingung, und sie steht in keinem Handbuch: Verdichten und Abschotten werfen den gemerkten Stand weg. Wer beides einbaut, ohne auf die Reihenfolge zu achten, bezahlt den Puffer und bekommt nichts dafuer — und liegt am Ende ueber dem Werk, das nur eines von beidem hat.',
    lernziel:
      'Ein Puffer wirkt nur so lange, bis das naechste Verdichten oder Abschotten ihn fuer ungueltig erklaert.',
    quelle: QUELLE,
    module: [...MODULE],
    strom: {
      anzahl: 30,
      takt: 5,
      domaenen: ['recht', 'technik', 'analyse'],
      schwierigkeit: [0.55, 0.9],
      mehrdeutigkeit: [0.1, 0.3],
    },
    budget: { kosten: 92500, dauer: 600 },
    ziele: [
      { id: 'alles', metrik: 'durchsatz', vergleich: '>=', wert: 1, text: 'Jeder Vorgang wird ausgeliefert.' },
      { id: 'guete', metrik: 'guete', vergleich: '>=', wert: 0.94, text: 'Mindestgüte 94 Prozent.' },
    ],
    saat: 721,
    vorbau: strasse([KONDOR, KONDOR, PUFFERN, VERDICHTEN, KONDOR, KONDOR]),
    reflexion: 'Dein Puffer hat acht Token gekostet und nichts gespart. Was stand zwischen ihm und dem naechsten Kern?',
    notiz:
      'Sprachnotiz, 16. Juni. Ich habe einmal eine Woche gebraucht, um zu verstehen, warum unser Puffer nichts brachte. Zwei Felder weiter stand ein Verdichter. Beide waren richtig gebaut, nur in der falschen Ordnung. Regel: Erst aufraeumen, dann merken — nie umgekehrt.',
    referenzen: [
      {
        name: 'Erst verdichten, dann puffern',
        ansatz: 'Der Verdichter raeumt auf, der Puffer merkt sich den aufgeraeumten Stand — die Reihenfolge, die haelt.',
        werk: strasse([KONDOR, VERDICHTEN, KONDOR, PUFFERN, KONDOR, KONDOR]),
      },
      {
        name: 'Nur puffern',
        ansatz: 'Auf jede Verdichtung verzichten und allein auf den Puffer setzen — ein Modul weniger, dafuer teurer.',
        werk: strasse([KONDOR, KONDOR, PUFFERN, KONDOR, KONDOR]),
      },
    ],
    antiMuster: [
      {
        name: 'Puffern und dann verdichten',
        verlockung: 'Beide Betriebsarten sparen Kontextkosten. Also baut man beide ein und nimmt beide Ersparnisse mit.',
        scheitertAn: 'budget_kosten',
        werk: strasse([KONDOR, KONDOR, PUFFERN, VERDICHTEN, KONDOR, KONDOR]),
      },
      {
        name: 'Nur verdichten',
        verlockung: 'Die Verdichtung hat im letzten Level beides repariert. Warum sollte sie hier nicht reichen?',
        scheitertAn: 'budget_kosten',
        werk: strasse([KONDOR, KONDOR, VERDICHTEN, KONDOR, KONDOR]),
      },
      {
        name: 'Die nackte Kette',
        verlockung: 'Ohne Speicher gibt es auch keinen Speicherfehler. Vier Kerne, fertig.',
        scheitertAn: 'budget_kosten',
        werk: strasse([KONDOR, KONDOR, KONDOR, KONDOR]),
      },
    ],
    monolith: monolith(3),
  },

  // =========================================================================
  {
    id: 'VII-3',
    akt: 7,
    nummer: 3,
    titel: 'Die Reihenfolge',
    untertitel: 'Monatsabschluss, Halle 3',
    briefing:
      'Am Monatsabschluss laeuft alles ueber einen Eingang: Vermerke mit Belegpflicht, Abrechnungen mit Zahlen, und ein gutes Drittel ist beides zugleich. Zwei Werkzeuge sind also gesetzt, und beide bleiben danach als Definitionsblock im Kontext liegen — vierzig Token je Werkzeug, bei jedem einzelnen Kernaufruf danach. Der Deckel ist hart und er ist niedrig. Du hast alles, was der Akt hergibt: verdichten, abrufen, abschotten, puffern. Die Bausteine sind nicht die Frage. Die Frage ist, in welcher Reihenfolge sie stehen.',
    lernziel:
      'Erst aufraeumen und dann puffern kostet weniger als dieselben Module in umgekehrter Ordnung.',
    quelle: QUELLE,
    module: [...MODULE],
    strom: {
      anzahl: 32,
      takt: 5,
      domaenen: ['finanz', 'recht', 'analyse'],
      schwierigkeit: [0.3, 0.9],
      mehrdeutigkeit: [0.2, 0.5],
      anteilBelegpflichtig: 0.5,
      anteilRechnerisch: 0.4,
    },
    budget: { kosten: 88000, dauer: 700 },
    ziele: [
      { id: 'alles', metrik: 'durchsatz', vergleich: '>=', wert: 1, text: 'Jeder Vorgang wird ausgeliefert.' },
      { id: 'beleg', metrik: 'belegquote', vergleich: '>=', wert: 0.95, text: 'Mindestens 95 Prozent Belegquote.' },
      { id: 'guete', metrik: 'guete', vergleich: '>=', wert: 0.94, text: 'Mindestgüte 94 Prozent.' },
      {
        id: 'meister',
        metrik: 'kostenJeAuftrag',
        vergleich: '<=',
        wert: 2400,
        text: 'Meisterstück: höchstens 2400 Token je Vorgang.',
        optional: true,
      },
    ],
    saat: 731,
    vorbau: strasse([WS('datenbank'), WS('rechner'), KONDOR, KONDOR, KONDOR, KONDOR]),
    reflexion: 'Zwei Werkzeuge liegen im Kontext, auch wenn du sie nicht mehr brauchst. Wann waere der beste Moment, sie loszuwerden?',
    notiz:
      'Sprachnotiz, 30. Juni, letzter Eintrag aus Halle 3. Der Abschluss ist der einzige Tag, an dem alles gleichzeitig kommt. Dieselben acht Module, zweimal anders sortiert, und dazwischen liegen achtzehn Prozent. Regel: Die Teile entscheiden, was moeglich ist — die Ordnung entscheidet, was es kostet.',
    referenzen: [
      {
        name: 'Aufraeumen, dann merken',
        ansatz: 'Beide Werkzeuge mit Wiederholung, danach verdichten und erst dann puffern — die guenstigste Ordnung.',
        werk: strasse([WS('datenbank'), WS('rechner'), KONDOR, VERDICHTEN, PUFFERN, KONDOR, KONDOR]),
      },
      {
        name: 'Frueh abgeschottet',
        ansatz: 'Statt zu verdichten den Kontext hart abschotten und danach puffern — ein Kern weniger, dafuer mehr Unsicherheit.',
        werk: strasse([WS('datenbank'), WS('rechner'), ABSCHOTTEN, PUFFERN, KONDOR, KONDOR, KONDOR]),
      },
    ],
    antiMuster: [
      {
        name: 'Merken, dann aufraeumen',
        verlockung: 'Erst den vollen Stand sichern, dann verdichten — so hat man beides und verliert nichts.',
        scheitertAn: 'budget_kosten',
        werk: strasse([WS('datenbank'), WS('rechner'), KONDOR, PUFFERN, VERDICHTEN, KONDOR, KONDOR]),
      },
      {
        name: 'Werkzeuge und vier Kerne',
        verlockung: 'Die Werkzeuge sind Pflicht, der Rest ist die bewaehrte Kette. Speicher spart hier bestimmt nichts.',
        scheitertAn: 'budget_kosten',
        werk: strasse([WS('datenbank'), WS('rechner'), KONDOR, KONDOR, KONDOR, KONDOR]),
      },
      {
        name: 'Ohne Rechenwerk',
        verlockung: 'Der Bestand liefert Zahlen mit. Ein zweites Werkzeug ist doppelte Arbeit und doppelter Kontext.',
        scheitertAn: 'guete',
        werk: strasse([WS('datenbank'), KONDOR, VERDICHTEN, PUFFERN, KONDOR, KONDOR]),
      },
      {
        name: 'Werkzeuge ohne Sicherung',
        verlockung: 'Der Bestand faellt selten aus. Fuer die paar Faelle lohnt sich kein eigenes Modul.',
        scheitertAn: 'belegquote',
        werk: strasse([W('datenbank'), W('rechner'), KONDOR, VERDICHTEN, PUFFERN, KONDOR, KONDOR]),
      },
    ],
    monolith: monolith(3),
  },
];

export { REIHER };
