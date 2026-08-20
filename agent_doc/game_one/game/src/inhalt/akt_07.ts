/**
 * AKT VII — DER SPEICHER
 *
 * Neue Mechanik: der Speicher in vier Betriebsarten — verdichten, abrufen,
 * abschotten und puffern.
 * Zentrale Lektion: Kontext ist ein Budget, kein Vorrat. Jeder Kernaufruf
 * bezahlt den mitgeschleppten Kontext ein zweites Mal, und oberhalb von
 * 45 Prozent Füllstand verarbeitet er ihn nicht mehr, sondern schleppt ihn nur.
 *
 * Rhythmus (Kishotenketsu):
 *   VII-0 KI    — die geerbte lange Kette reißt den Tokendeckel und verliert
 *                 an Güte. Eine Verdichtung in der Mitte repariert beides.
 *   VII-1 SHO   — der Speicher trifft auf die Verdichtung aus VII-0: an der
 *                 Kompetenzgrenze hebt kein weiterer Aufruf mehr die Decke,
 *                 ein Abruf schon.
 *   VII-2 TEN   — Bruch: der Puffer ist der stärkste Kostenhebel des Akts,
 *                 und jede Verdichtung dahinter macht ihn wertlos. Die Lösung
 *                 aus VII-1 hat hier außerdem keinen Beleg.
 *   VII-3 KETSU — Synthese unter hartem Deckel: zwei Werkzeuge, gemischte Last,
 *                 und die Reihenfolge von Verdichten und Puffern entscheidet.
 */

import type { KernGroesse, SpeicherModus, Werk, WerkzeugArt } from '../sim/typen';
import type { LevelDefinition } from './level_typen';
import { Bau, monolith } from './bauhilfe';

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
 * Ein Glied einer Fertigungsstraße. Werkzeuge haben zwei Ausgänge; ist
 * `sicher` gesetzt, hängt an ihrem Ausfall eine Sicherung, die zweimal
 * wiederholt und danach degradiert weiterreicht — ohne sie geht jeder
 * ausgefallene Abruf als fehlender Beleg in die Statistik.
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
  /** Gemeinsame Vorstufe vor der Weiche — sie wird einmal bezahlt. */
  readonly vor: readonly Glied[];
  /** Schwelle der Weiche auf `schwierigkeit`. */
  readonly schwelle: number;
  /** Bahn A: Kriterium nicht erfüllt, also die leichteren Vorgänge. */
  readonly leicht: readonly Glied[];
  /** Bahn B: Kriterium erfüllt, also die schweren Vorgänge. */
  readonly schwer: readonly Glied[];
}

/** Quelle → Vorstufe → Weiche → zwei Bahnen → Senke. */
function gabel(plan: GabelPlan): Werk {
  const b = new Bau();
  const q = b.setze('quelle', {}, 'q', 0, 5);
  const vorIds = plan.vor.map((g, i) => setzeGlied(b, g, `v${i + 1}`, 2 + i * 2, 5));
  const wx = 2 + plan.vor.length * 2;
  const w = b.setze('weiche', { kriterium: 'schwierigkeit', schwelle: plan.schwelle }, 'w', wx, 5);
  const tiefe = Math.max(plan.leicht.length, plan.schwer.length);
  const s = b.setze('senke', {}, 's', wx + 2 + tiefe * 2, 5);

  const vorFolge = [...vorIds, w];
  b.verbinde(q, vorFolge[0]!);
  plan.vor.forEach((g, i) => verbindeGlied(b, g, vorIds[i]!, vorFolge[i + 1]!, 2 + i * 2, 5));

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
/** Verdichten: Kontext mal 0,35, drei Hundertstel Güte als Preis. */
const VERDICHTEN = SP('komprimieren');
/** Puffern: der Kontextstand wird gemerkt und kostet danach nur ein Zehntel. */
const PUFFERN = SP('puffern');
/** Abschotten: Kontext hart auf 0,15 gedeckelt, dafür mehr Unsicherheit. */
const ABSCHOTTEN = SP('isolieren');
/** Abrufen: hebt die Güte-Decke um 0,06 und räumt Unsicherheit ab. */
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
      'Halle 2 wird aufgelöst, ihre Vorgänge kommen zu dir. Mit ihnen kommt das Werk, das sie bearbeitet hat: vier große Kerne hintereinander, seit achtzehn Monaten unverändert, laut Übergabeprotokoll bewährt. Der Einkauf hat einen Tokendeckel dazugelegt. Sieh dir an, was in der Kette passiert. Jeder Kern hängt sein Ergebnis an das des Vorgängers, und jeder folgende Kern bezahlt den ganzen Anhang noch einmal mit. Ab 45 Prozent Füllstand kommt dazu, dass er ihn nicht mehr verarbeitet, sondern nur noch mitschleppt. Auf der Palette am Tor steht ein neues Modul. Es kann Kontext verdichten, abrufen, abschotten oder puffern. Heute brauchst du nur die erste Betriebsart.',
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
    reflexion: 'Der vierte Kern hat mehr gekostet als der erste und weniger bewirkt. Woran genau lag das?',
    notiz:
      'Sprachnotiz, 2. Juni, 07:10. Halle 2 hat achtzehn Monate lang jeden Vorgang durch dieselben vier Kerne geschickt und war stolz darauf. Niemand hat je gefragt, was der vierte Kern eigentlich liest. Regel: Was du nicht wegwirfst, bezahlst du bei jedem Schritt erneut.',
    referenzen: [
      {
        name: 'Verdichtet in der Mitte',
        ansatz: 'Die geerbte Kette bleibt stehen, ein Verdichter nach dem zweiten Kern räumt den Kontext auf.',
        werk: strasse([KONDOR, KONDOR, VERDICHTEN, KONDOR, KONDOR]),
      },
      {
        name: 'Verdichtet und gepuffert',
        ansatz: 'Früher verdichten und den Rest puffern: ein Modul und ein Tick mehr, dafür deutlich billiger.',
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
        verlockung: 'Wenn die Güte nicht reicht, hängt man einen fünften Kern an. Das war bisher immer die Antwort.',
        scheitertAn: 'budget_kosten',
        werk: strasse([KONDOR, KONDOR, KONDOR, KONDOR, KONDOR]),
      },
      {
        name: 'Die Kette gekürzt',
        verlockung: 'Wenn die Kette zu teuer ist, nimmt man eben einen Kern heraus. Spart Geld und spart den Umbau.',
        scheitertAn: 'guete',
        werk: strasse([KONDOR, KONDOR, KONDOR]),
      },
    ],
    monolith: monolith(2),
  },

  // =========================================================================
  {
    id: 'VII-1',
    akt: 7,
    nummer: 1,
    titel: 'Das Archiv',
    untertitel: 'Altfälle aus dem Bestand TROET',
    briefing:
      'Aus dem Fachverfahren TROET kommen die Altfälle, und sie liegen samt und sonders oberhalb dessen, was der größte Kern aus eigener Kraft beantworten kann. Du läufst hier nicht gegen ein Kostenproblem, sondern gegen eine Decke: ab einem gewissen Punkt hebt kein weiterer Aufruf mehr die Güte, er verbraucht nur Kontext und macht das Ergebnis unsicherer. Der Speicher hat dafür eine zweite Betriebsart. Abrufen holt vorhandenes Wissen aus dem Bestand dazu, hebt die Decke um sechs Punkte und räumt Unsicherheit ab. Es kostet vierzig Token und zehn Punkte Kontextlast, und die zahlst du danach in jedem Kernaufruf mit. Die Verdichtung aus der letzten Woche hast du weiterhin.',
    lernziel:
      'An der Kompetenzgrenze eines Kerns hebt nur zusätzliches Wissen die Güte-Decke, kein zusätzlicher Aufruf.',
    quelle: QUELLE,
    module: [...MODULE],
    strom: {
      anzahl: 30,
      takt: 5,
      domaenen: ['recht', 'analyse', 'technik'],
      schwierigkeit: [0.95, 1.4],
      mehrdeutigkeit: [0.1, 0.3],
    },
    budget: { kosten: 95000, dauer: 600 },
    ziele: [
      { id: 'alles', metrik: 'durchsatz', vergleich: '>=', wert: 1, text: 'Jeder Vorgang wird ausgeliefert.' },
      { id: 'guete', metrik: 'guete', vergleich: '>=', wert: 0.855, text: 'Mindestgüte 85,5 Prozent.' },
    ],
    saat: 711,
    vorbau: strasse([KONDOR, KONDOR, KONDOR, KONDOR]),
    reflexion: 'Der fünfte Aufruf hat die Güte gesenkt statt gehoben. Was hat er dem Kern gegeben, was der vierte nicht schon hatte?',
    notiz:
      'Sprachnotiz, 9. Juni. TROET ist von 1998 und weiß trotzdem mehr über diese Fälle als jeder Kern. Wir haben lange geglaubt, ein größeres Modell ersetze den Bestand. Es ersetzt ihn nicht, es rät nur teurer. Regel: Wissen holt man, Rechenkraft kauft man.',
    referenzen: [
      {
        name: 'Abruf vor der Kette',
        ansatz: 'Ein Abruf ganz vorn, danach drei große Kerne — wenige Module, kurze Laufzeit, hoher Preis.',
        werk: strasse([ABRUFEN, KONDOR, KONDOR, KONDOR]),
      },
      {
        name: 'Abruf und Verdichtung',
        ansatz: 'Abruf vorn, Verdichter nach dem ersten Kern: zwei Module mehr und ein Tick langsamer, dafür billiger.',
        werk: strasse([ABRUFEN, KONDOR, VERDICHTEN, KONDOR, KONDOR]),
      },
    ],
    antiMuster: [
      {
        name: 'Ohne Archiv, dafür länger',
        verlockung: 'Was ein Abruf kann, kann ein weiterer Kernaufruf auch. Man muss ihm nur genug Durchgänge geben.',
        scheitertAn: 'guete',
        werk: strasse([KONDOR, KONDOR, KONDOR, KONDOR, KONDOR]),
      },
      {
        name: 'Abruf hinter der Kette',
        verlockung: 'Erst arbeiten lassen, dann Wissen dazuholen — so steht der Abruf dort, wo das Ergebnis entsteht.',
        scheitertAn: 'guete',
        werk: strasse([KONDOR, KONDOR, KONDOR, KONDOR, ABRUFEN]),
      },
      {
        name: 'Zwei Abrufe für alle',
        verlockung: 'Wenn ein Abruf die Decke hebt, heben zwei sie weiter. Vierzig Token sind kein Argument.',
        scheitertAn: 'budget_kosten',
        werk: strasse([ABRUFEN, ABRUFEN, KONDOR, KONDOR, KONDOR]),
      },
    ],
    monolith: monolith(2),
  },

  // =========================================================================
  {
    id: 'VII-2',
    akt: 7,
    nummer: 2,
    titel: 'Der Puffer, der keiner war',
    untertitel: 'Quartalsübersicht, Zeile 9',
    briefing:
      'Der Abruf steht in der Quartalsübersicht, Zeile 9, gelb hinterlegt, und der Deckel ist seither deutlich niedriger. Dazu sind sieben von zehn Vorgängen belegpflichtig, eine Recherche ist also gesetzt — und sie legt vierzehn Punkte Kontextlast auf jeden Vorgang, bevor der erste Kern überhaupt anfängt. Der Speicher hat eine vierte Betriebsart, und sie ist der stärkste Kostenhebel dieses Akts: Puffern merkt sich den Kontextstand, und jeder spätere Kernaufruf bezahlt für diesen Anteil nur noch ein Zehntel. Es gibt eine Bedingung, und sie steht in keinem Handbuch: Verdichten und Abschotten werfen den gemerkten Stand weg.',
    lernziel:
      'Ein Puffer wirkt nur so lange, bis das nächste Verdichten oder Abschotten ihn für ungültig erklärt.',
    quelle: QUELLE,
    module: [...MODULE],
    strom: {
      anzahl: 30,
      takt: 5,
      domaenen: ['recht', 'technik', 'analyse'],
      schwierigkeit: [0.55, 0.88],
      mehrdeutigkeit: [0.05, 0.25],
      anteilBelegpflichtig: 0.7,
    },
    budget: { kosten: 80000, dauer: 600 },
    ziele: [
      { id: 'alles', metrik: 'durchsatz', vergleich: '>=', wert: 1, text: 'Jeder Vorgang wird ausgeliefert.' },
      { id: 'beleg', metrik: 'belegquote', vergleich: '>=', wert: 0.98, text: 'Mindestens 98 Prozent Belegquote.' },
      { id: 'guete', metrik: 'guete', vergleich: '>=', wert: 0.94, text: 'Mindestgüte 94 Prozent.' },
    ],
    saat: 721,
    vorbau: strasse([WS('suche'), KONDOR, PUFFERN, VERDICHTEN, KONDOR, KONDOR]),
    reflexion: 'Dein Puffer hat gekostet und nichts gespart. Welches Modul stand zwischen ihm und dem nächsten Kern?',
    notiz:
      'Sprachnotiz, 16. Juni. Ich habe einmal eine Woche gebraucht, um zu verstehen, warum unser Puffer nichts brachte. Zwei Felder weiter stand ein Verdichter. Beide waren richtig gebaut, nur in der falschen Ordnung. Regel: Erst aufräumen, dann merken — nie umgekehrt.',
    referenzen: [
      {
        name: 'Erst verdichten, dann puffern',
        ansatz: 'Der Verdichter räumt auf, der Puffer merkt sich den aufgeräumten Stand — die Ordnung, die hält.',
        werk: strasse([WS('suche'), KONDOR, VERDICHTEN, PUFFERN, KONDOR, KONDOR]),
      },
      {
        name: 'Nur puffern',
        ansatz: 'Auf jede Verdichtung verzichten und allein auf den Puffer setzen: ein Modul weniger, ein Tick schneller, etwas teurer.',
        werk: strasse([WS('suche'), KONDOR, PUFFERN, KONDOR, KONDOR]),
      },
    ],
    antiMuster: [
      {
        name: 'Puffern und dann verdichten',
        verlockung: 'Beide Betriebsarten senken Kontextkosten. Also baut man beide ein und nimmt beide Ersparnisse mit.',
        scheitertAn: 'budget_kosten',
        werk: strasse([WS('suche'), KONDOR, PUFFERN, VERDICHTEN, KONDOR, KONDOR]),
      },
      {
        name: 'Nur verdichten',
        verlockung: 'Die Verdichtung hat in der Übernahmewoche beides repariert. Warum sollte sie hier nicht reichen?',
        scheitertAn: 'budget_kosten',
        werk: strasse([WS('suche'), KONDOR, VERDICHTEN, KONDOR, KONDOR]),
      },
      {
        name: 'Recherche und drei Kerne',
        verlockung: 'Ohne Speicher gibt es auch keinen Speicherfehler. Beleg holen, dreimal arbeiten lassen, fertig.',
        scheitertAn: 'budget_kosten',
        werk: strasse([WS('suche'), KONDOR, KONDOR, KONDOR]),
      },
      {
        name: 'Puffern und dann abschotten',
        verlockung: 'Wenn schon die Verdichtung den Puffer stört, nimmt man eben das Abschotten. Das ist eine andere Betriebsart.',
        scheitertAn: 'budget_kosten',
        werk: strasse([WS('suche'), KONDOR, PUFFERN, ABSCHOTTEN, KONDOR, KONDOR]),
      },
      {
        name: 'Ohne Recherche',
        verlockung: 'Drei große Kerne wissen genug. Die Belegpflicht ist eine Formalie aus Anlage 7.',
        scheitertAn: 'belegquote',
        werk: strasse([KONDOR, KONDOR, KONDOR]),
      },
    ],
    monolith: monolith(2),
  },

  // =========================================================================
  {
    id: 'VII-3',
    akt: 7,
    nummer: 3,
    titel: 'Die Reihenfolge',
    untertitel: 'Monatsabschluss, Halle 3',
    briefing:
      'Am Monatsabschluss läuft alles über einen Eingang: Vermerke mit Belegpflicht, Abrechnungen mit Zahlen, ein gutes Drittel ist beides zugleich. Zwei Werkzeuge sind damit gesetzt, und beide bleiben danach als Definitionsblock im Kontext liegen — vierzig Token je Werkzeug, bei jedem einzelnen Kernaufruf danach. Der Deckel ist hart und er ist niedrig. Du hast alles, was der Akt hergibt: verdichten, abrufen, abschotten, puffern. Die Bausteine sind nicht mehr die Frage. Die Frage ist, in welcher Ordnung sie stehen und welcher Teil des Stroms welchen Weg nimmt.',
    lernziel:
      'Erst aufräumen und dann puffern kostet weniger als dieselben Module in umgekehrter Ordnung.',
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
    budget: { kosten: 89000, dauer: 700 },
    ziele: [
      { id: 'alles', metrik: 'durchsatz', vergleich: '>=', wert: 1, text: 'Jeder Vorgang wird ausgeliefert.' },
      { id: 'beleg', metrik: 'belegquote', vergleich: '>=', wert: 0.98, text: 'Mindestens 98 Prozent Belegquote.' },
      { id: 'guete', metrik: 'guete', vergleich: '>=', wert: 0.93, text: 'Mindestgüte 93 Prozent.' },
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
    vorbau: strasse([WS('suche'), WS('rechner'), KONDOR, KONDOR, KONDOR, KONDOR]),
    reflexion: 'Zwei Werkzeugblöcke liegen im Kontext, auch wenn du sie längst nicht mehr brauchst. Wann wäre der beste Moment, sie loszuwerden?',
    notiz:
      'Sprachnotiz, 30. Juni, letzter Eintrag aus Halle 3. Der Abschluss ist der einzige Tag, an dem alles gleichzeitig kommt. Dieselben Module, zweimal anders sortiert, und dazwischen liegt ein Zehntel der Rechnung. Regel: Die Teile entscheiden, was möglich ist — die Ordnung entscheidet, was es kostet.',
    referenzen: [
      {
        name: 'Aufräumen, dann merken',
        ansatz: 'Beide Werkzeuge mit Wiederholung, danach verdichten und erst dann puffern — eine gerade Straße, wenige Module.',
        werk: strasse([WS('suche'), WS('rechner'), KONDOR, VERDICHTEN, PUFFERN, KONDOR, KONDOR]),
      },
      {
        name: 'Aufgeräumt und vorsortiert',
        ansatz: 'Dieselbe Vorstufe, dahinter eine Weiche: leichte Vorgänge bekommen einen Kern, schwere zwei — billiger und schneller, dafür vier Module mehr.',
        werk: gabel({
          vor: [WS('suche'), WS('rechner'), KONDOR, VERDICHTEN, PUFFERN],
          schwelle: 0.6,
          leicht: [KONDOR],
          schwer: [KONDOR, KONDOR],
        }),
      },
    ],
    antiMuster: [
      {
        name: 'Merken, dann aufräumen',
        verlockung: 'Erst den vollen Stand sichern, dann verdichten — so hat man beides und verliert nichts davon.',
        scheitertAn: 'budget_kosten',
        werk: strasse([WS('suche'), WS('rechner'), KONDOR, PUFFERN, VERDICHTEN, KONDOR, KONDOR]),
      },
      {
        name: 'Werkzeuge und vier Kerne',
        verlockung: 'Die Werkzeuge sind Pflicht, der Rest ist die bewährte Kette. Speicher spart hier sicher nichts.',
        scheitertAn: 'budget_kosten',
        werk: strasse([WS('suche'), WS('rechner'), KONDOR, KONDOR, KONDOR, KONDOR]),
      },
      {
        name: 'Ohne Rechenwerk',
        verlockung: 'Die Recherche liefert Zahlen mit. Ein zweites Werkzeug ist doppelte Arbeit und doppelter Kontext.',
        scheitertAn: 'guete',
        werk: strasse([WS('suche'), KONDOR, VERDICHTEN, PUFFERN, KONDOR, KONDOR]),
      },
      {
        name: 'Werkzeuge ohne Sicherung',
        verlockung: 'Die Recherche fällt selten aus. Für die paar Fälle lohnt sich kein eigenes Modul.',
        scheitertAn: 'belegquote',
        werk: strasse([W('suche'), W('rechner'), KONDOR, VERDICHTEN, PUFFERN, KONDOR, KONDOR]),
      },
    ],
    monolith: monolith(3),
  },
];
