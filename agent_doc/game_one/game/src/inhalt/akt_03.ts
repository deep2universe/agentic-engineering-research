/**
 * AKT III — DAS WERKZEUG
 *
 * Neue Mechanik: das Werkzeug (RECHENWERK, BESTAND, RECHERCHE, FREMDDIENST).
 * Zentrale Lektion: Ein deterministisches Werkzeug schlägt jedes Modell bei
 * Zahlen — aber jedes angeschlossene Werkzeug liegt danach als Definitionsblock
 * im Kontext und wird bei JEDEM weiteren Kernaufruf mitbezahlt.
 *
 * Rhythmus (Kishotenketsu):
 *   III-0 KI    — rein rechnerische Aufträge; nur das RECHENWERK hebt die Decke.
 *   III-1 SHO   — belegpflichtige Aufträge unter Kostendeckel; die Weiche spart.
 *   III-2 TEN   — Bruch: jedes Werkzeug verteuert jeden späteren Kernaufruf.
 *                 Die Lösung aus III-1 kennt kein Rechenwerk und fällt durch.
 *   III-3 KETSU — gemischter Eingang unter hartem Tokendeckel.
 */

import type { KernGroesse, Werk, WerkzeugArt } from '../sim/typen';
import type { LevelDefinition } from './level_typen';
import { Bau, leeresFundament, monolith, reihe } from './bauhilfe';

const QUELLE = '06_tool_use_context_engineering.md';
const QUELLE_AUSWAHL = '06_tool_use_context_engineering.md#pattern-4-tool-selection-strategy';

// ---------------------------------------------------------------------------
// Baukasten dieses Akts
// ---------------------------------------------------------------------------

/**
 * Ein Glied einer Fertigungsstrasse: entweder ein Werkzeug oder ein Kern.
 * Werkzeuge haben zwei Ausgänge; in diesem Akt gibt es noch keine Sicherung,
 * also führt der 'fehler'-Ausgang immer auf dasselbe nächste Glied wie 'ok'.
 * Ohne diese Verdrahtung gingen die ausgefallenen Aufträge verloren.
 */
type Glied = { readonly werkzeug: WerkzeugArt } | { readonly kern: KernGroesse };

function W(werkzeug: WerkzeugArt): Glied {
  return { werkzeug };
}

function K(kern: KernGroesse): Glied {
  return { kern };
}

function setzeGlied(b: Bau, g: Glied, id: string, x: number, z: number): string {
  return 'werkzeug' in g
    ? b.setze('werkzeug', { werkzeugArt: g.werkzeug }, id, x, z)
    : b.setze('kern', { groesse: g.kern }, id, x, z);
}

function verbindeGlied(b: Bau, g: Glied, von: string, nach: string): void {
  if ('werkzeug' in g) {
    b.verbinde(von, nach, 'ok');
    b.verbinde(von, nach, 'fehler');
  } else {
    b.verbinde(von, nach, 'aus');
  }
}

/** Quelle → Glieder in Reihe → Senke. */
function strasse(glieder: readonly Glied[]): Werk {
  const b = new Bau();
  const q = b.setze('quelle', {}, 'q', 0, 4);
  const ids = glieder.map((g, i) => setzeGlied(b, g, `m${i + 1}`, 2 + i * 2, 4));
  const s = b.setze('senke', {}, 's', 2 + glieder.length * 2, 4);
  const folge = [...ids, s];
  b.verbinde(q, folge[0]!);
  glieder.forEach((g, i) => verbindeGlied(b, g, ids[i]!, folge[i + 1]!));
  return b.fertig();
}

/**
 * Quelle → Vorstufe → Weiche (nach Schwierigkeit) → leichter | schwerer Zweig
 * → Senke. Ist `vor` leer, steht die Weiche ganz vorn, und jeder Zweig bringt
 * seine eigenen Werkzeuge mit.
 */
function verzweigt(
  vor: readonly Glied[],
  schwelle: number,
  leicht: readonly Glied[],
  schwer: readonly Glied[]
): Werk {
  const b = new Bau();
  const q = b.setze('quelle', {}, 'q', 0, 4);
  const s = b.setze('senke', {}, 's', 30, 4);
  const vorIds = vor.map((g, i) => setzeGlied(b, g, `v${i + 1}`, 2 + i * 2, 4));
  const r = b.setze('weiche', { kriterium: 'schwierigkeit', schwelle }, 'r', 2 + vor.length * 2, 4);
  const aIds = leicht.map((g, i) => setzeGlied(b, g, `a${i + 1}`, 4 + vor.length * 2 + i * 2, 1));
  const bIds = schwer.map((g, i) => setzeGlied(b, g, `b${i + 1}`, 4 + vor.length * 2 + i * 2, 7));

  const vorFolge = [...vorIds, r];
  b.verbinde(q, vorFolge[0]!);
  vor.forEach((g, i) => verbindeGlied(b, g, vorIds[i]!, vorFolge[i + 1]!));

  const aFolge = [...aIds, s];
  b.verbinde(r, aFolge[0]!, 'a');
  leicht.forEach((g, i) => verbindeGlied(b, g, aIds[i]!, aFolge[i + 1]!));

  const bFolge = [...bIds, s];
  b.verbinde(r, bFolge[0]!, 'b');
  schwer.forEach((g, i) => verbindeGlied(b, g, bIds[i]!, bFolge[i + 1]!));

  return b.fertig();
}

// ---------------------------------------------------------------------------
// Die vier Level
// ---------------------------------------------------------------------------

export const AKT_3: LevelDefinition[] = [
  // =========================================================================
  {
    id: 'III-0',
    akt: 3,
    nummer: 0,
    titel: 'Das Rechenwerk',
    untertitel: 'TROET rechnet seit 1998 richtig',
    briefing:
      'Die Abrechnung schickt vierundzwanzig Vorgänge, in denen ausschließlich gerechnet wird: Stundensätze, Abschläge, Wechselkurseffekte. Dein Werk aus Akt I liefert dafür Zahlen, die plausibel aussehen und falsch sind. Am Fensterbrett steht ein Terminal mit dem Fachverfahren TROET, Baujahr 1998. Es kann nichts formulieren, nichts einordnen und nichts zusammenfassen. Es rechnet. Häng es als Werkzeug vor deinen Kern und sieh dir an, was mit der Güte passiert.',
    lernziel:
      'Ein rechnerischer Auftrag bleibt ohne deterministisches Werkzeug unter einer harten Güte-Decke.',
    quelle: QUELLE,
    module: ['kern', 'weiche', 'werkzeug'],
    strom: {
      anzahl: 24,
      takt: 2,
      domaenen: ['finanz'],
      schwierigkeit: [0.12, 0.34],
      mehrdeutigkeit: [0.05, 0.2],
      anteilRechnerisch: 1,
    },
    budget: { dauer: 400 },
    ziele: [
      { id: 'alles', metrik: 'durchsatz', vergleich: '>=', wert: 1, text: 'Jeder Auftrag wird ausgeliefert.' },
      { id: 'guete', metrik: 'guete', vergleich: '>=', wert: 0.6, text: 'Mindestgüte 60 Prozent.' },
      {
        id: 'preis',
        metrik: 'kostenJeAuftrag',
        vergleich: '<=',
        wert: 240,
        text: 'Höchstens 240 Token je Auftrag.',
      },
    ],
    saat: 301,
    vorbau: leeresFundament(),
    reflexion:
      'Das Rechenwerk kostet fünf Token. Warum hat der teuerste Kern dieselbe Aufgabe trotzdem nicht gelöst?',
    notiz:
      'Sprachnotiz, 2. April, 07:10. Das Terminal am Fenster läuft seit sechsundzwanzig Jahren. Es hat noch nie eine Zahl erfunden. Das ist keine Nostalgie, das ist eine Eigenschaft. Regel: Was sich ausrechnen lässt, wird ausgerechnet und nicht geschätzt.',
    referenzen: [
      {
        name: 'Rechenwerk und zwei KOLIBRI',
        ansatz: 'Erst rechnen, dann zweimal billig formulieren — mehr Module, weniger Token.',
        werk: strasse([W('rechner'), K('kolibri'), K('kolibri')]),
      },
      {
        name: 'Rechenwerk und ein REIHER',
        ansatz: 'Erst rechnen, dann ein einziger mittlerer Aufruf — kompakt, dafür teurer.',
        werk: strasse([W('rechner'), K('reiher')]),
      },
    ],
    antiMuster: [
      {
        name: 'KONDOR ohne Rechenwerk',
        verlockung: 'Das größte Modell kann doch wohl Prozentrechnung.',
        scheitertAn: 'guete',
        werk: reihe([{ art: 'kern', param: { groesse: 'kondor' } }]),
      },
      {
        name: 'Recherche statt Rechenwerk',
        verlockung: 'Ein Werkzeug ist angeschlossen. Welches es ist, wird schon egal sein.',
        scheitertAn: 'guete',
        werk: strasse([W('suche'), K('kolibri'), K('kolibri')]),
      },
      {
        name: 'Rechenwerk hinter dem Kern',
        verlockung: 'Erst denken lassen, dann nachrechnen — so macht man es doch im Büro.',
        scheitertAn: 'guete',
        werk: strasse([K('reiher'), W('rechner')]),
      },
      {
        name: 'Rechenwerk und KONDOR',
        verlockung: 'Wenn das Werkzeug hilft, hilft es am großen Kern noch mehr.',
        scheitertAn: 'kostenJeAuftrag',
        werk: strasse([W('rechner'), K('kondor')]),
      },
    ],
    monolith: monolith(1),
  },

  // =========================================================================
  {
    id: 'III-1',
    akt: 3,
    nummer: 1,
    titel: 'Beleg oder Behauptung',
    untertitel: 'Anlage 7 zum Vergabevermerk',
    briefing:
      'Das LAVV hat eine Anlage 7 eingeführt. Sie verlangt zu jeder Aussage eine Fundstelle. Ein Teil der Aufträge ist damit belegpflichtig: ohne Werkzeug bleiben sie bei knapp über der Hälfte der Güte stehen, gleich wie groß dein Kern ist. Der Einkauf hat den Tokendeckel aus Akt I nicht vergessen. Du hast zwei Belegwerkzeuge — BESTAND ist schnell und eng, RECHERCHE ist teurer und klärt mehr. Und du hast die Weiche, die entscheidet, wie lang die Kette hinter dem Beleg überhaupt sein muss.',
    lernziel:
      'Einen Beleg liefert nur ein Werkzeug; welcher Kern danach arbeitet, bleibt eine Preisfrage.',
    quelle: QUELLE_AUSWAHL,
    module: ['kern', 'weiche', 'werkzeug'],
    strom: {
      anzahl: 28,
      takt: 2,
      domaenen: ['recht', 'analyse'],
      schwierigkeit: [0.12, 0.7],
      mehrdeutigkeit: [0.1, 0.3],
      anteilBelegpflichtig: 0.55,
    },
    budget: { kosten: 18000, dauer: 500 },
    ziele: [
      { id: 'alles', metrik: 'durchsatz', vergleich: '>=', wert: 1, text: 'Jeder Auftrag wird ausgeliefert.' },
      { id: 'beleg', metrik: 'belegquote', vergleich: '>=', wert: 0.9, text: 'Mindestens 90 Prozent Belegquote.' },
      { id: 'guete', metrik: 'guete', vergleich: '>=', wert: 0.75, text: 'Mindestgüte 75 Prozent.' },
    ],
    saat: 311,
    vorbau: leeresFundament(),
    reflexion:
      'Dein Werkzeug belegt jeden Auftrag, auch den, der keinen Beleg braucht. Was kostet dich diese Bequemlichkeit?',
    notiz:
      'Sprachnotiz, 5. April. Anlage 7 ist keine Schikane, sie ist ein Prüfauftrag in Papierform. Wer keine Fundstelle hat, hat eine Meinung. Regel: Ein Beleg entsteht vor der Antwort, nie danach.',
    referenzen: [
      {
        name: 'Bestand vor der Weiche',
        ansatz: 'Ein billiges Belegwerkzeug für alle, danach trennt die Weiche kurze von langen Ketten.',
        werk: verzweigt(
          [W('datenbank')],
          0.4,
          [K('kolibri'), K('kolibri'), K('kolibri')],
          [K('reiher'), K('reiher')]
        ),
      },
      {
        name: 'Recherche und zwei REIHER',
        ansatz: 'Ein starkes Belegwerkzeug und eine kurze Kette ohne Routing — wenige Module, hoher Preis.',
        werk: strasse([W('suche'), K('reiher'), K('reiher')]),
      },
    ],
    antiMuster: [
      {
        name: 'Weiche ohne Werkzeug',
        verlockung: 'Routing hat in Akt II jedes Problem gelöst. Warum nicht auch dieses?',
        scheitertAn: 'belegquote',
        werk: verzweigt([], 0.4, [K('kolibri'), K('kolibri'), K('kolibri')], [K('reiher'), K('reiher')]),
      },
      {
        name: 'Beleg nachgereicht',
        verlockung: 'Der Kern schreibt, die Recherche hängt die Fundstellen an. Steht doch alles drin.',
        scheitertAn: 'guete',
        werk: strasse([K('reiher'), K('reiher'), W('suche')]),
      },
      {
        name: 'Recherche und drei REIHER',
        verlockung: 'Mehr Durchgänge nach dem Beleg heben die Güte weiter.',
        scheitertAn: 'budget_kosten',
        werk: strasse([W('suche'), K('reiher'), K('reiher'), K('reiher')]),
      },
    ],
    monolith: monolith(2),
  },

  // =========================================================================
  {
    id: 'III-2',
    akt: 3,
    nummer: 2,
    titel: 'Der Werkzeugkasten',
    untertitel: 'Vier Schnittstellen auf einem Kostenblatt',
    briefing:
      'Der Eingang mischt jetzt beides: belegpflichtige Vermerke und rechnerische Vorgänge. Der naheliegende Zug ist, alle vier Schnittstellen hintereinander an die Strasse zu hängen — zusammen kosten sie hundertfünfzehn Token, das klingt harmlos. Es ist nicht harmlos. Jedes Werkzeug, das ein Auftrag passiert hat, liegt danach als Definitionsblock in seinem Kontext und wird bei jedem weiteren Kernaufruf erneut bezahlt: vierzig Token je Werkzeug, je Aufruf. Deine Lösung aus Anlage 7 kennt kein Rechenwerk und reicht hier nicht mehr.',
    lernziel:
      'Jedes angeschlossene Werkzeug verteuert jeden späteren Kernaufruf, auch wenn es gerade nicht benutzt wird.',
    quelle: QUELLE_AUSWAHL,
    module: ['kern', 'weiche', 'werkzeug'],
    strom: {
      anzahl: 28,
      takt: 2,
      domaenen: ['finanz', 'analyse', 'technik'],
      schwierigkeit: [0.12, 0.6],
      mehrdeutigkeit: [0.1, 0.3],
      anteilBelegpflichtig: 0.5,
      anteilRechnerisch: 0.5,
    },
    budget: { dauer: 500 },
    ziele: [
      { id: 'alles', metrik: 'durchsatz', vergleich: '>=', wert: 1, text: 'Jeder Auftrag wird ausgeliefert.' },
      { id: 'guete', metrik: 'guete', vergleich: '>=', wert: 0.72, text: 'Mindestgüte 72 Prozent.' },
      {
        id: 'preis',
        metrik: 'kostenJeAuftrag',
        vergleich: '<=',
        wert: 700,
        text: 'Höchstens 700 Token je Auftrag.',
      },
    ],
    saat: 321,
    vorbau: leeresFundament(),
    reflexion:
      'Vier Werkzeuge kosten zusammen hundertfünfzehn Token. Warum steigt dein Preis je Auftrag um ein Vielfaches davon?',
    notiz:
      'Sprachnotiz, 9. April. Wir hatten einmal elf Schnittstellen an einer Straße. Neun davon wurden nie aufgerufen. Bezahlt haben wir alle elf, bei jedem Vorgang. Regel: Ein Werkzeug, das du anschließt, bezahlst du auch dann, wenn du es nicht benutzt.',
    referenzen: [
      {
        name: 'Ein Werkzeugpaar, zwei Aufrufe',
        ansatz: 'Bestand und Rechenwerk für alle, danach zwei gleich starke Aufrufe — wenige Module, hoher Preis.',
        werk: strasse([W('datenbank'), W('rechner'), K('reiher'), K('reiher')]),
      },
      {
        name: 'Je Zweig das passende Werkzeug',
        ansatz:
          'Das Rechenwerk für alle, danach trennt die Weiche: der leichte Zweig belegt aus dem Bestand, der schwere recherchiert.',
        werk: verzweigt(
          [W('rechner')],
          0.38,
          [W('datenbank'), K('kolibri'), K('kolibri'), K('kolibri')],
          [W('suche'), K('reiher'), K('reiher')]
        ),
      },
    ],
    antiMuster: [
      {
        name: 'Der volle Werkzeugkasten',
        verlockung: 'Vier Schnittstellen für hundertfünfzehn Token — dann ist jeder Fall abgedeckt.',
        scheitertAn: 'kostenJeAuftrag',
        werk: verzweigt(
          [W('suche'), W('datenbank'), W('rechner'), W('api')],
          0.38,
          [K('kolibri'), K('kolibri'), K('kolibri')],
          [K('reiher'), K('reiher')]
        ),
      },
      {
        // Baugleich mit der Referenzlösung aus III-1. Genau daran zeigt sich der
        // Bruch dieses Levels: dieselbe Architektur, ein neuer Auftragsstrom.
        name: 'Nur Belege, kein Rechenwerk',
        verlockung: 'Der Bestand hat in Anlage 7 gereicht. Er wird auch hier reichen.',
        scheitertAn: 'guete',
        werk: verzweigt(
          [W('datenbank')],
          0.4,
          [K('kolibri'), K('kolibri'), K('kolibri')],
          [K('reiher'), K('reiher')]
        ),
      },
      {
        name: 'Werkzeuge zwischen den Kernen',
        verlockung: 'Erst ein Entwurf, dann die Werkzeuge, dann die Reinschrift.',
        scheitertAn: 'kostenJeAuftrag',
        werk: strasse([K('reiher'), W('datenbank'), K('reiher'), W('rechner'), K('reiher')]),
      },
    ],
    monolith: monolith(2),
  },

  // =========================================================================
  {
    id: 'III-3',
    akt: 3,
    nummer: 3,
    titel: 'Gemischter Eingang',
    untertitel: 'Freitag, zwei Tage vor Monatsabschluss',
    briefing:
      'Am Freitag läuft alles über denselben Eingang: Vermerke mit Belegpflicht, Abrechnungen mit Zahlen und ganz gewöhnliche Texte, die weder das eine noch das andere brauchen. Der Tokendeckel gilt für den ganzen Tag, nicht je Auftrag. Du hast drei Hebel, und zwei davon musst du gegeneinander abwägen: welche Werkzeuge an der Straße hängen, wie viele Kernaufrufe danach folgen und wo die Weiche trennt. Ein Meisterstück wartet für die, die unter fünfhundertsechzig Token je Auftrag bleiben.',
    lernziel:
      'Werkzeuge und Kerne konkurrieren um dasselbe Tokenbudget, und die Reihenfolge entscheidet über den Preis.',
    quelle: QUELLE,
    module: ['kern', 'weiche', 'werkzeug'],
    strom: {
      anzahl: 32,
      takt: 2,
      domaenen: ['finanz', 'recht', 'technik', 'text'],
      schwierigkeit: [0.1, 0.75],
      mehrdeutigkeit: [0.1, 0.35],
      anteilBelegpflichtig: 0.45,
      anteilRechnerisch: 0.4,
    },
    budget: { kosten: 23000, dauer: 600 },
    ziele: [
      { id: 'alles', metrik: 'durchsatz', vergleich: '>=', wert: 1, text: 'Jeder Auftrag wird ausgeliefert.' },
      { id: 'guete', metrik: 'guete', vergleich: '>=', wert: 0.78, text: 'Mindestgüte 78 Prozent.' },
      { id: 'beleg', metrik: 'belegquote', vergleich: '>=', wert: 0.9, text: 'Mindestens 90 Prozent Belegquote.' },
      {
        id: 'meister',
        metrik: 'kostenJeAuftrag',
        vergleich: '<=',
        wert: 560,
        text: 'Meisterstück: höchstens 560 Token je Auftrag.',
        optional: true,
      },
    ],
    saat: 331,
    vorbau: leeresFundament(),
    reflexion:
      'Du hast am Freitag zwei Werkzeuge gewählt und zwei weggelassen. Woran hättest du das schon am Montag erkannt?',
    notiz:
      'Sprachnotiz, 12. April. Am Monatsabschluss kommt alles gleichzeitig, und niemand sortiert vor. Sortieren ist deine Aufgabe, nicht die des Eingangs. Regel: Wer nicht trennt, bezahlt für jeden Auftrag den teuersten Weg.',
    referenzen: [
      {
        name: 'Viele kleine Aufrufe',
        ansatz: 'Werkzeuge vorn, danach trennt die Weiche eine lange KOLIBRI-Kette von zwei REIHER-Aufrufen.',
        werk: verzweigt(
          [W('datenbank'), W('rechner')],
          0.42,
          [K('kolibri'), K('kolibri'), K('kolibri')],
          [K('reiher'), K('reiher')]
        ),
      },
      {
        name: 'Ein KONDOR für die schweren Fälle',
        ansatz: 'Dieselben Werkzeuge, aber der schwere Zweig löst in einem einzigen großen Aufruf.',
        werk: verzweigt([W('datenbank'), W('rechner')], 0.6, [K('reiher'), K('reiher')], [K('kondor')]),
      },
    ],
    antiMuster: [
      {
        name: 'Werkzeuge und KONDOR',
        verlockung: 'Mit zwei Werkzeugen und dem größten Kern ist die Güte sicher.',
        scheitertAn: 'budget_kosten',
        werk: strasse([W('datenbank'), W('rechner'), K('kondor')]),
      },
      {
        name: 'Ohne Bestand',
        verlockung: 'Das Rechenwerk kostet fünf Token und hebt die Decke. Das genügt.',
        scheitertAn: 'belegquote',
        werk: strasse([W('rechner'), K('reiher'), K('reiher')]),
      },
      {
        name: 'Werkzeuge ganz am Ende',
        verlockung: 'Erst schreiben lassen, dann Belege und Zahlen anhängen.',
        scheitertAn: 'guete',
        werk: strasse([K('reiher'), K('reiher'), W('datenbank'), W('rechner')]),
      },
    ],
    monolith: monolith(3),
  },
];
