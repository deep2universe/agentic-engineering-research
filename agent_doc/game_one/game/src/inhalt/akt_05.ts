/**
 * AKT V — DER CHOR
 *
 * Neue Mechanik: der Verteiler (Fan-out) und der Sammler (Aggregation).
 * Zentrale Lektion: Parallelisierung deckelt die Latenz, aber nicht die Kosten.
 * Die Laufzeit eines Fan-out ist das MAXIMUM seiner Zweige — sein Preis ist die
 * SUMME. Wer das verwechselt, baut ein schnelles Werk, das niemand bezahlt.
 *
 * Rhythmus (Kishotenketsu):
 *   V-0 KI    — ein Latenzdeckel, den keine Reihenschaltung erreicht.
 *   V-1 SHO   — der Chor trifft auf die Belegpflicht: das Werkzeug gehört VOR
 *               den Verteiler, sonst bezahlst du es je Zweig.
 *   V-2 TEN   — Bruch: der Kostendeckel. Der dreistimmige Chor aus V-1 kostet
 *               das Dreifache und fällt durch. Gegenmittel ist eine Weiche VOR
 *               dem Verteiler — nur schwere Aufträge werden vielstimmig.
 *   V-3 KETSU — Synthese unter hartem Tokendeckel: zwei Werkzeuge, eine
 *               Sicherung, und die Wahl zwischen Verschmelzen und Bestenauswahl.
 */

import type { KernGroesse, SammlerModus, Werk, WerkzeugArt } from '../sim/typen';
import type { LevelDefinition } from './level_typen';
import { Bau, leeresFundament, monolith } from './bauhilfe';

const QUELLE = '03_workflow_patterns.md#pattern-3-parallelization';
const QUELLE_AGGREGATION = '05_multi_agent_patterns.md';

// ---------------------------------------------------------------------------
// Baukasten dieses Akts
// ---------------------------------------------------------------------------

/**
 * Ein Glied einer Fertigungsstraße: ein Kern oder ein Werkzeug. Werkzeuge
 * haben zwei Ausgänge. Ist `sicher` gesetzt, hängt an ihrem Ausfall-Ausgang
 * eine Sicherung, die zweimal wiederholt und danach degradiert weiterreicht —
 * ohne sie geht jeder ausgefallene Abruf als fehlender Beleg in die Statistik.
 */
type Glied =
  | { readonly kern: KernGroesse }
  | { readonly werkzeug: WerkzeugArt; readonly sicher?: true };

function K(kern: KernGroesse): Glied {
  return { kern };
}

function W(werkzeug: WerkzeugArt): Glied {
  return { werkzeug };
}

/** Werkzeug mit Wiederholung an seinem Ausfall-Ausgang. */
function WS(werkzeug: WerkzeugArt): Glied {
  return { werkzeug, sicher: true };
}

function setzeGlied(b: Bau, g: Glied, id: string, x: number, z: number): string {
  return 'werkzeug' in g
    ? b.setze('werkzeug', { werkzeugArt: g.werkzeug }, id, x, z)
    : b.setze('kern', { groesse: g.kern }, id, x, z);
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

/** Quelle → Glieder in Reihe → Senke. Der Aufbau ohne jede Parallelität. */
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

interface ChorPlan {
  /** Gemeinsame Vorstufe — alles hier wird EINMAL bezahlt, nicht je Zweig. */
  readonly vor?: readonly Glied[];
  readonly zweige: readonly (readonly Glied[])[];
  readonly modus: SammlerModus;
  /** Gemeinsame Nachstufe hinter dem Sammler. */
  readonly nach?: readonly Glied[];
}

/** Quelle → Vorstufe → Verteiler → Zweige → Sammler → Nachstufe → Senke. */
function chor(plan: ChorPlan): Werk {
  const b = new Bau();
  const vor = plan.vor ?? [];
  const nach = plan.nach ?? [];
  const q = b.setze('quelle', {}, 'q', 0, 5);
  const vorIds = vor.map((g, i) => setzeGlied(b, g, `v${i + 1}`, 2 + i * 2, 5));
  const vx = 2 + vor.length * 2;
  const vt = b.setze('verteiler', { zweige: plan.zweige.length }, 'vt', vx, 5);
  const tiefe = Math.max(...plan.zweige.map((z) => z.length));
  const sx = vx + 2 + tiefe * 2;
  const sm = b.setze('sammler', { modus: plan.modus }, 'sm', sx, 5);
  const nachIds = nach.map((g, i) => setzeGlied(b, g, `n${i + 1}`, sx + 2 + i * 2, 5));
  const s = b.setze('senke', {}, 's', sx + 2 + nach.length * 2, 5);

  const vorFolge = [...vorIds, vt];
  b.verbinde(q, vorFolge[0]!);
  vor.forEach((g, i) => verbindeGlied(b, g, vorIds[i]!, vorFolge[i + 1]!, 2 + i * 2, 5));

  plan.zweige.forEach((zweig, zi) => {
    const zeile = 10 + zi * 4;
    const ids = zweig.map((g, i) => setzeGlied(b, g, `z${zi + 1}_${i + 1}`, vx + 2 + i * 2, zeile));
    const folge = [...ids, sm];
    b.verbinde(vt, folge[0]!, `z${zi + 1}`);
    zweig.forEach((g, i) => verbindeGlied(b, g, ids[i]!, folge[i + 1]!, vx + 2 + i * 2, zeile));
  });

  const nachFolge = [...nachIds, s];
  b.verbinde(sm, nachFolge[0]!);
  nach.forEach((g, i) => verbindeGlied(b, g, nachIds[i]!, nachFolge[i + 1]!, sx + 2 + i * 2, 5));
  return b.fertig();
}

interface TeilPlan {
  readonly vor?: readonly Glied[];
  /** Schwelle der Weiche auf `schwierigkeit`. */
  readonly schwelle: number;
  /** Bahn A: leichte Aufträge, seriell und billig. */
  readonly leicht: readonly Glied[];
  /** Bahn B: schwere Aufträge, vielstimmig. */
  readonly zweige: readonly (readonly Glied[])[];
  readonly modus: SammlerModus;
}

/**
 * Quelle → Vorstufe → Weiche → (leichte Bahn seriell | schwere Bahn als Chor)
 * → Senke. Genau der Aufbau, mit dem sich ein Chor bezahlen lässt: er läuft
 * nur für den Teil des Stroms, der ihn braucht.
 */
function geteilterChor(plan: TeilPlan): Werk {
  const b = new Bau();
  const vor = plan.vor ?? [];
  const q = b.setze('quelle', {}, 'q', 0, 5);
  const vorIds = vor.map((g, i) => setzeGlied(b, g, `v${i + 1}`, 2 + i * 2, 5));
  const wx = 2 + vor.length * 2;
  const w = b.setze('weiche', { kriterium: 'schwierigkeit', schwelle: plan.schwelle }, 'w', wx, 5);
  const tiefe = Math.max(...plan.zweige.map((z) => z.length));
  const sx = wx + 4 + tiefe * 2;
  const sm = b.setze('sammler', { modus: plan.modus }, 'sm', sx, 9);
  const s = b.setze('senke', {}, 's', sx + 4, 5);

  const vorFolge = [...vorIds, w];
  b.verbinde(q, vorFolge[0]!);
  vor.forEach((g, i) => verbindeGlied(b, g, vorIds[i]!, vorFolge[i + 1]!, 2 + i * 2, 5));

  const lIds = plan.leicht.map((g, i) => setzeGlied(b, g, `l${i + 1}`, wx + 2 + i * 2, 5));
  const lFolge = [...lIds, s];
  b.verbinde(w, lFolge[0]!, 'a');
  plan.leicht.forEach((g, i) => verbindeGlied(b, g, lIds[i]!, lFolge[i + 1]!, wx + 2 + i * 2, 5));

  const vt = b.setze('verteiler', { zweige: plan.zweige.length }, 'vt', wx + 2, 15);
  b.verbinde(w, vt, 'b');
  plan.zweige.forEach((zweig, zi) => {
    const zeile = 16 + zi * 4;
    const ids = zweig.map((g, i) => setzeGlied(b, g, `z${zi + 1}_${i + 1}`, wx + 4 + i * 2, zeile));
    const folge = [...ids, sm];
    b.verbinde(vt, folge[0]!, `z${zi + 1}`);
    zweig.forEach((g, i) => verbindeGlied(b, g, ids[i]!, folge[i + 1]!, wx + 4 + i * 2, zeile));
  });
  b.verbinde(sm, s);
  return b.fertig();
}

/** Zwei REIHER-Aufrufe hintereinander — die Standardstimme dieses Akts. */
const STIMME_RR: readonly Glied[] = [K('reiher'), K('reiher')];
const STIMME_K: readonly Glied[] = [K('kondor')];

// ---------------------------------------------------------------------------
// Die vier Level
// ---------------------------------------------------------------------------

export const AKT_5: LevelDefinition[] = [
  // =========================================================================
  {
    id: 'V-0',
    akt: 5,
    nummer: 0,
    titel: 'Der Chor',
    untertitel: 'Fristsache, Rückmeldung bis 16 Uhr',
    briefing:
      'Das LAVV hat seine Geschäftsordnung geändert. Neu ist Ziffer 4.2: Rückfragen sind "unverzüglich, spätestens am selben Werktag" zu beantworten. In Ticks heißt das: fünf. Deine Reihenschaltung aus den letzten Akten braucht acht. Auf der Palette am Tor stehen zwei neue Module. Der Verteiler klont ein Paket in bis zu vier Zweige, kostenlos und ohne Zeitverlust. Der Sammler führt die Klone wieder zusammen. Die Zweige laufen gleichzeitig — die Laufzeit ist die des längsten, nicht die Summe. Der Preis ist die Summe. Beides gilt gleichzeitig, und nur eines davon steht in der Geschäftsordnung.',
    lernziel:
      'Ein Fan-out kostet so viel wie alle seine Zweige zusammen und dauert so lang wie sein längster.',
    quelle: QUELLE,
    module: ['kern', 'weiche', 'werkzeug', 'schranke', 'sicherung', 'verteiler', 'sammler'],
    strom: {
      anzahl: 24,
      takt: 5,
      domaenen: ['analyse', 'technik'],
      schwierigkeit: [0.5, 0.85],
      mehrdeutigkeit: [0.05, 0.2],
    },
    budget: { latenz: 5, dauer: 400 },
    ziele: [
      { id: 'alles', metrik: 'durchsatz', vergleich: '>=', wert: 1, text: 'Jeder Auftrag wird ausgeliefert.' },
      { id: 'guete', metrik: 'guete', vergleich: '>=', wert: 0.8, text: 'Mindestgüte 80 Prozent.' },
      {
        id: 'meister',
        metrik: 'kostenJeAuftrag',
        vergleich: '<=',
        wert: 1050,
        text: 'Meisterstück: höchstens 1050 Token je Auftrag.',
        optional: true,
      },
    ],
    saat: 501,
    vorbau: leeresFundament(),
    reflexion: 'Zwei Zweige brauchen dieselbe Zeit wie einer. Woran merkst du trotzdem, dass es zwei waren?',
    notiz:
      'Sprachnotiz, 21. April, 07:40. Ziffer 4.2 ist neu, die Aufträge sind es nicht. Zwei Wege nebeneinander brauchen dieselbe Zeit wie einer. Sie brauchen nur doppelt so viel Geld. Regel: Parallelität kaufst du mit Tokens, nicht mit Ticks.',
    referenzen: [
      {
        name: 'Zwei gleiche Stimmen',
        ansatz: 'Zweimal derselbe große Kern, der Sammler nimmt das bessere Ergebnis — wenige Module, hoher Preis.',
        werk: chor({ zweige: [STIMME_K, STIMME_K], modus: 'bester' }),
      },
      {
        name: 'Ungleiche Stimmen',
        ansatz: 'Ein großer Kern gegen eine Kette aus zwei mittleren — mehr Module, deutlich billiger.',
        werk: chor({ zweige: [STIMME_K, STIMME_RR], modus: 'bester' }),
      },
    ],
    antiMuster: [
      {
        name: 'Ein einzelner großer Kern',
        verlockung: 'Ein KONDOR ist in vier Ticks fertig. Das hält die Frist mit einem einzigen Modul.',
        scheitertAn: 'guete',
        werk: strasse([K('kondor')]),
      },
      {
        name: 'Zwei große Kerne in Reihe',
        verlockung: 'Zwei Durchgänge heben die Güte deutlich. Das hat in Akt I immer funktioniert.',
        scheitertAn: 'budget_latenz',
        werk: strasse([K('kondor'), K('kondor')]),
      },
      {
        name: 'Ein Chor aus mittleren Kernen',
        verlockung: 'Drei Zweige klingen nach dreifacher Sicherheit — und mittlere Kerne sind billiger.',
        scheitertAn: 'guete',
        werk: chor({ zweige: [STIMME_RR, STIMME_RR, STIMME_RR], modus: 'bester' }),
      },
    ],
    monolith: monolith(2),
  },

  // =========================================================================
  {
    id: 'V-1',
    akt: 5,
    nummer: 1,
    titel: 'Drei Stimmen',
    untertitel: 'Anlage 7 gilt weiterhin',
    briefing:
      'Die Belegpflicht aus Anlage 7 ist nicht abgeschafft worden, sie ist nur in eine Fussnote gerutscht. Die Hälfte der Vorgänge braucht weiterhin eine Fundstelle aus dem Bestand, sonst bleibt die Güte bei knapp über der Hälfte stehen. Gleichzeitig gilt Ziffer 4.2 unverändert. Du hast jetzt beides: ein Werkzeug, das belegt, und einen Verteiler, der die Arbeit auf mehrere Stimmen legt. Die Frage ist, wo das Werkzeug steht. Vor dem Verteiler zahlst du es einmal. Hinter ihm zahlst du es je Zweig — und jeder Zweig schleppt seinen eigenen Definitionsblock durch jeden weiteren Kernaufruf.',
    lernziel:
      'Alles vor dem Verteiler wird einmal bezahlt, alles dahinter je Zweig.',
    quelle: QUELLE,
    module: ['kern', 'weiche', 'werkzeug', 'schranke', 'sicherung', 'verteiler', 'sammler'],
    strom: {
      anzahl: 28,
      takt: 5,
      domaenen: ['recht', 'technik', 'analyse'],
      schwierigkeit: [0.3, 0.7],
      mehrdeutigkeit: [0.1, 0.3],
      anteilBelegpflichtig: 0.5,
    },
    budget: { latenz: 7, dauer: 400 },
    ziele: [
      { id: 'alles', metrik: 'durchsatz', vergleich: '>=', wert: 1, text: 'Jeder Auftrag wird ausgeliefert.' },
      { id: 'beleg', metrik: 'belegquote', vergleich: '>=', wert: 0.9, text: 'Mindestens 90 Prozent Belegquote.' },
      { id: 'guete', metrik: 'guete', vergleich: '>=', wert: 0.866, text: 'Mindestgüte 86,6 Prozent.' },
      {
        id: 'preis',
        metrik: 'kostenJeAuftrag',
        vergleich: '<=',
        wert: 1600,
        text: 'Höchstens 1600 Token je Auftrag.',
      },
    ],
    saat: 511,
    vorbau: leeresFundament(),
    reflexion: 'Der Bestand kostet dreissig Token. Warum ist er hinter dem Verteiler trotzdem der teuerste Baustein?',
    notiz:
      'Sprachnotiz, 26. April. Wir hatten einmal den Abruf in jedem Zweig stehen. Drei Zweige, drei Abrufe, dieselbe Fundstelle. Die Rechnung kam trotzdem dreimal. Regel: Was alle Zweige brauchen, gehört vor die Gabelung.',
    referenzen: [
      {
        name: 'Drei Stimmen hinter einem Beleg',
        ansatz: 'Der Bestand steht vor dem Verteiler, drei gleiche Stimmen arbeiten parallel, der Sammler wählt die beste.',
        werk: chor({
          vor: [W('datenbank')],
          zweige: [STIMME_RR, STIMME_RR, STIMME_RR],
          modus: 'bester',
        }),
      },
      {
        name: 'Die lange Kette',
        ansatz: 'Ohne jede Parallelität: Beleg, dann drei Aufrufe hintereinander — halber Preis, ein Tick mehr.',
        werk: strasse([W('datenbank'), K('reiher'), K('reiher'), K('reiher')]),
      },
    ],
    antiMuster: [
      {
        name: 'Vier Stimmen',
        verlockung: 'Wenn drei Stimmen die Güte heben, heben vier sie noch weiter.',
        scheitertAn: 'kostenJeAuftrag',
        werk: chor({
          vor: [W('datenbank')],
          zweige: [STIMME_RR, STIMME_RR, STIMME_RR, STIMME_RR],
          modus: 'bester',
        }),
      },
      {
        name: 'Drei große Stimmen',
        verlockung: 'Große Kerne sind in vier Ticks fertig und treffen die Frist auch parallel.',
        scheitertAn: 'kostenJeAuftrag',
        werk: chor({ vor: [W('datenbank')], zweige: [STIMME_K, STIMME_K, STIMME_K], modus: 'bester' }),
      },
      {
        name: 'Zwei große Kerne in Reihe',
        verlockung: 'Die Güte stimmt, der Preis ist vertretbar. Ein Tick mehr wird niemandem auffallen.',
        scheitertAn: 'budget_latenz',
        werk: strasse([W('datenbank'), K('kondor'), K('kondor')]),
      },
      {
        name: 'Chor ohne Bestand',
        verlockung: 'Drei Stimmen finden gemeinsam schon die richtige Fundstelle.',
        scheitertAn: 'belegquote',
        werk: chor({ zweige: [STIMME_RR, STIMME_RR, STIMME_RR], modus: 'bester' }),
      },
    ],
    monolith: monolith(2),
  },

  // =========================================================================
  {
    id: 'V-2',
    akt: 5,
    nummer: 2,
    titel: 'Die Rechnung des Chors',
    untertitel: 'Der Einkauf hat mitgezählt',
    briefing:
      'Der Chor aus der vergangenen Woche hat funktioniert. Er hat auch dreimal so viel gekostet, und diesmal stand es in der Quartalsübersicht, Zeile 14, gelb hinterlegt. Ab heute gilt ein Tokendeckel für den ganzen Lauf. Die Frist bleibt. Die Belegpflicht bleibt. Sieh dir den Eingang an, bevor du etwas umbaust: die meisten Vorgänge sind Kleinkram, und du schickst jeden einzelnen davon durch drei Stimmen. Ein Chor ist kein Werk, ein Chor ist eine Betriebsart. Du entscheidest, für welchen Teil des Stroms sie gilt.',
    lernziel:
      'Ein Fan-out lohnt sich nur für den Teil des Stroms, der ihn wirklich braucht.',
    quelle: QUELLE,
    module: ['kern', 'weiche', 'werkzeug', 'schranke', 'sicherung', 'verteiler', 'sammler'],
    strom: {
      anzahl: 30,
      takt: 5,
      domaenen: ['recht', 'technik', 'analyse', 'text'],
      schwierigkeit: [0.08, 0.8],
      mehrdeutigkeit: [0.1, 0.3],
      anteilBelegpflichtig: 0.5,
    },
    budget: { kosten: 31000, dauer: 500 },
    ziele: [
      { id: 'alles', metrik: 'durchsatz', vergleich: '>=', wert: 1, text: 'Jeder Auftrag wird ausgeliefert.' },
      { id: 'beleg', metrik: 'belegquote', vergleich: '>=', wert: 0.9, text: 'Mindestens 90 Prozent Belegquote.' },
      { id: 'guete', metrik: 'guete', vergleich: '>=', wert: 0.857, text: 'Mindestgüte 85,7 Prozent.' },
      { id: 'frist', metrik: 'latenzP95', vergleich: '<=', wert: 7, text: 'Die p95-Latenz bleibt bei sieben Ticks.' },
    ],
    saat: 521,
    vorbau: leeresFundament(),
    reflexion: 'Dein Chor singt für jeden Vorgang, auch für den dreizeiligen. Welchen davon würdest du zuerst ausladen?',
    notiz:
      'Sprachnotiz, 3. Mai. Zeile 14 ist gelb. Gelb bedeutet, dass jemand es erklären muss, und das bin ich nicht mehr. Der Chor war nie falsch. Er war nur für alle da. Regel: Sortiere vor der Gabelung, nicht danach.',
    referenzen: [
      {
        name: 'Vorsortiert',
        ansatz: 'Eine Weiche vor dem Verteiler: leichte Vorgänge laufen seriell durch, nur schwere werden zweistimmig.',
        werk: geteilterChor({
          vor: [W('datenbank')],
          schwelle: 0.35,
          leicht: [K('reiher'), K('reiher')],
          zweige: [STIMME_RR, STIMME_RR],
          modus: 'bester',
        }),
      },
      {
        name: 'Kleinerer Chor',
        ansatz: 'Keine Weiche, dafür eine Stimme weniger für alle — schneller und kompakter, aber teurer je Auftrag.',
        werk: chor({ vor: [W('datenbank')], zweige: [STIMME_RR, STIMME_RR], modus: 'bester' }),
      },
    ],
    antiMuster: [
      {
        name: 'Drei Stimmen für alle',
        verlockung: 'Der Aufbau von letzter Woche hat bestanden. Warum sollte er heute nicht bestehen?',
        scheitertAn: 'budget_kosten',
        werk: chor({
          vor: [W('datenbank')],
          zweige: [STIMME_RR, STIMME_RR, STIMME_RR],
          modus: 'bester',
        }),
      },
      {
        name: 'Vorsortiert, aber dreistimmig',
        verlockung: 'Die Weiche spart genug, um den dritten Zweig weiter mitzuschleppen.',
        scheitertAn: 'budget_kosten',
        werk: geteilterChor({
          vor: [W('datenbank')],
          schwelle: 0.35,
          leicht: [K('reiher'), K('reiher')],
          zweige: [STIMME_RR, STIMME_RR, STIMME_RR],
          modus: 'bester',
        }),
      },
      {
        name: 'Die lange Kette',
        verlockung: 'Wenn der Chor zu teuer ist, geht es eben wieder seriell — drei Aufrufe hintereinander.',
        scheitertAn: 'guete',
        werk: strasse([W('datenbank'), K('reiher'), K('reiher'), K('reiher')]),
      },
      {
        name: 'Ein großer Kern für alles',
        verlockung: 'Ein KONDOR ist schnell, billig genug und braucht kein einziges neues Modul.',
        scheitertAn: 'guete',
        werk: strasse([W('datenbank'), K('kondor')]),
      },
    ],
    monolith: monolith(2),
  },

  // =========================================================================
  {
    id: 'V-3',
    akt: 5,
    nummer: 3,
    titel: 'Stimmen und Teile',
    untertitel: 'Monatsabschluss, dritter Anlauf',
    briefing:
      'Am Monatsabschluss läuft alles über denselben Eingang: Vermerke mit Belegpflicht, Abrechnungen mit Zahlen, und ein gutes Drittel davon ist beides zugleich. Dazu kommt, dass die Aufträge diesmal unklar formuliert sind — der Bestand fällt gelegentlich aus, und ein Abruf, der ins Leere läuft, kostet dich einen Beleg. Der Tokendeckel ist hart. Du hast zwei Wege, den Sammler zu benutzen. Die Bestenauswahl nimmt das beste Ergebnis eines Zweigs. Das Verschmelzen addiert, was die Zweige jeweils beigetragen haben, und erbt dafür jeden ihrer Makel. Welcher Weg richtig ist, hängt daran, ob deine Zweige dasselbe tun oder verschiedene Teile.',
    lernziel:
      'Der Sammlermodus entscheidet, wozu die Parallelität überhaupt gut war.',
    quelle: QUELLE_AGGREGATION,
    module: ['kern', 'weiche', 'werkzeug', 'schranke', 'sicherung', 'verteiler', 'sammler'],
    strom: {
      anzahl: 32,
      takt: 5,
      domaenen: ['finanz', 'recht', 'analyse'],
      schwierigkeit: [0.25, 0.78],
      mehrdeutigkeit: [0.35, 0.75],
      anteilBelegpflichtig: 0.5,
      anteilRechnerisch: 0.45,
    },
    budget: { kosten: 50000, dauer: 600 },
    ziele: [
      { id: 'alles', metrik: 'durchsatz', vergleich: '>=', wert: 1, text: 'Jeder Auftrag wird ausgeliefert.' },
      { id: 'beleg', metrik: 'belegquote', vergleich: '>=', wert: 0.98, text: 'Mindestens 98 Prozent Belegquote.' },
      { id: 'guete', metrik: 'guete', vergleich: '>=', wert: 0.87, text: 'Mindestgüte 87 Prozent.' },
      {
        id: 'meister',
        metrik: 'kostenJeAuftrag',
        vergleich: '<=',
        wert: 1250,
        text: 'Meisterstück: höchstens 1250 Token je Auftrag.',
        optional: true,
      },
    ],
    saat: 531,
    vorbau: leeresFundament(),
    reflexion: 'Zwei Zweige haben verschiedene Teile derselben Antwort. Was macht die Bestenauswahl mit dem Teil, den sie verwirft?',
    notiz:
      'Sprachnotiz, 11. Mai. Der Abschluss ist der einzige Tag, an dem alles gleichzeitig kommt. Zwei Stimmen, die dasselbe singen, wählst du aus. Zwei, die verschiedene Teile singen, setzt du zusammen. Regel: Erst klären, ob deine Zweige sich wiederholen oder ergänzen.',
    referenzen: [
      {
        name: 'Zwei Stimmen hinter dem Werkzeugtisch',
        ansatz: 'Beide Werkzeuge mit Wiederholung vor dem Verteiler, dahinter zwei gleiche Stimmen und die Bestenauswahl.',
        werk: chor({
          vor: [WS('datenbank'), WS('rechner')],
          zweige: [STIMME_RR, STIMME_RR],
          modus: 'bester',
        }),
      },
      {
        name: 'Zwei Fachzweige, verschmolzen',
        ansatz: 'Je Zweig ein Werkzeug: der eine belegt, der andere rechnet. Der Sammler verschmilzt, ein großer Kern zieht nach.',
        werk: chor({
          zweige: [
            [WS('datenbank'), K('reiher')],
            [WS('rechner'), K('reiher')],
          ],
          modus: 'verschmelzen',
          nach: [K('kondor')],
        }),
      },
    ],
    antiMuster: [
      {
        name: 'Drei Stimmen am Abschluss',
        verlockung: 'Am wichtigsten Tag des Monats ist eine Stimme mehr keine Verschwendung.',
        scheitertAn: 'budget_kosten',
        werk: chor({
          vor: [WS('datenbank'), WS('rechner')],
          zweige: [STIMME_RR, STIMME_RR, STIMME_RR],
          modus: 'bester',
        }),
      },
      {
        name: 'Werkzeuge ohne Sicherung',
        verlockung: 'Der Bestand fällt selten aus. Für die paar Fälle lohnt sich kein eigenes Modul.',
        scheitertAn: 'belegquote',
        werk: chor({
          vor: [W('datenbank'), W('rechner')],
          zweige: [STIMME_RR, STIMME_RR, STIMME_RR],
          modus: 'bester',
        }),
      },
      {
        name: 'Die lange Kette',
        verlockung: 'Beide Werkzeuge, dann drei Aufrufe hintereinander. Billig, ruhig, bewährt.',
        scheitertAn: 'guete',
        werk: strasse([WS('datenbank'), WS('rechner'), K('reiher'), K('reiher'), K('reiher')]),
      },
      {
        name: 'Ohne Rechenwerk',
        verlockung: 'Der Bestand liefert Zahlen mit. Ein zweites Werkzeug ist doppelte Arbeit.',
        scheitertAn: 'guete',
        werk: chor({
          vor: [WS('datenbank')],
          zweige: [STIMME_RR, STIMME_RR],
          modus: 'bester',
        }),
      },
    ],
    monolith: monolith(3),
  },
];
