/**
 * AKT II — DIE WEICHE
 *
 * Neue Mechanik: die Weiche (Router). Sie schätzt ein Merkmal des Auftrags und
 * schickt ihn nach Bahn A (Kriterium nicht erfüllt) oder Bahn B (erfüllt).
 * Zentrale Lektion: Klassifizieren, bevor man bezahlt.
 *
 * Rhythmus (Kishotenketsu):
 *   II-0 KI    — die Weiche isoliert: ein gemischter Strom, zwei Bahnen.
 *   II-1 SHO   — dieselbe Weiche unter dem Tokendeckel aus Akt I. Die Schwelle
 *                wird zur eigentlichen Entwurfsentscheidung.
 *   II-2 TEN   — die Akten werden mehrdeutig, die Schätzung streut, und die
 *                Lösung aus II-1 fällt an der Güte durch.
 *   II-3 KETSU — zwei Sortierungen hintereinander: erst Schwere, dann Fach.
 *                Erst danach darf spezialisiert werden.
 */

import type { LevelDefinition } from './level_typen';
import { Bau, leeresFundament, monolith, reihe } from './bauhilfe';
import type { ModulParameter, Werk } from '../sim/typen';

const QUELLE = '03_workflow_patterns.md#pattern-2-routing';

// ---------------------------------------------------------------------------
// Baumuster dieses Akts
// ---------------------------------------------------------------------------

/** Setzt eine Kette von Kernen ab (ab Spalte x0, Zeile z) und liefert erste und letzte Id. */
function bahn(b: Bau, kerne: readonly ModulParameter[], x0: number, z: number): [string, string] {
  const ids = kerne.map((p, i) => b.setze('kern', p, undefined, x0 + i * 2, z));
  for (let i = 0; i + 1 < ids.length; i++) b.verbinde(ids[i]!, ids[i + 1]!);
  return [ids[0]!, ids[ids.length - 1]!];
}

/** Quelle → Weiche → zwei Kernbahnen → Senke. Das Grundmuster dieses Akts. */
function zweiBahnen(
  weiche: ModulParameter,
  bahnA: readonly ModulParameter[],
  bahnB: readonly ModulParameter[]
): Werk {
  const b = new Bau();
  const q = b.setze('quelle', {}, 'q', 0, 4);
  const w = b.setze('weiche', weiche, 'w', 2, 4);
  const [aErst, aLetzt] = bahn(b, bahnA, 4, 2);
  const [bErst, bLetzt] = bahn(b, bahnB, 4, 6);
  const s = b.setze('senke', {}, 's', 22, 4);
  b.verbinde(q, w);
  b.verbinde(w, aErst, 'a');
  b.verbinde(w, bErst, 'b');
  b.verbinde(aLetzt, s);
  b.verbinde(bLetzt, s);
  return b.fertig();
}

/**
 * Zwei Weichen in Reihe auf derselben Frage: nur wer BEIDE Schätzungen passiert,
 * fährt die billige Bahn. Zwei unabhängige Fehlschätzungen sind seltener als
 * eine — das ist das Gegenmittel gegen Fehlleitung in II-2.
 */
function doppelteWeiche(
  weiche: ModulParameter,
  bahnA: readonly ModulParameter[],
  bahnB: readonly ModulParameter[]
): Werk {
  const b = new Bau();
  const q = b.setze('quelle', {}, 'q', 0, 4);
  const w1 = b.setze('weiche', weiche, 'w1', 2, 4);
  const w2 = b.setze('weiche', weiche, 'w2', 4, 2);
  const [aErst, aLetzt] = bahn(b, bahnA, 6, 1);
  const [bErst, bLetzt] = bahn(b, bahnB, 6, 6);
  const s = b.setze('senke', {}, 's', 22, 4);
  b.verbinde(q, w1);
  b.verbinde(w1, w2, 'a');
  b.verbinde(w1, bErst, 'b');
  b.verbinde(w2, aErst, 'a');
  b.verbinde(w2, bErst, 'b');
  b.verbinde(aLetzt, s);
  b.verbinde(bLetzt, s);
  return b.fertig();
}

/**
 * Erst die Schwere sortieren, dann das Fach: leichte Aufträge in die billige
 * Bahn, schwere über eine zweite Weiche auf zwei Fachbahnen aufteilen.
 */
function zweiSortierungen(
  erste: ModulParameter,
  zweite: ModulParameter,
  leicht: readonly ModulParameter[],
  fachA: readonly ModulParameter[],
  fachB: readonly ModulParameter[]
): Werk {
  const b = new Bau();
  const q = b.setze('quelle', {}, 'q', 0, 4);
  const w1 = b.setze('weiche', erste, 'w1', 2, 4);
  const [lErst, lLetzt] = bahn(b, leicht, 4, 0);
  const w2 = b.setze('weiche', zweite, 'w2', 4, 6);
  const [aErst, aLetzt] = bahn(b, fachA, 6, 4);
  const [bErst, bLetzt] = bahn(b, fachB, 6, 8);
  const s = b.setze('senke', {}, 's', 24, 4);
  b.verbinde(q, w1);
  b.verbinde(w1, lErst, 'a');
  b.verbinde(w1, w2, 'b');
  b.verbinde(w2, aErst, 'a');
  b.verbinde(w2, bErst, 'b');
  b.verbinde(lLetzt, s);
  b.verbinde(aLetzt, s);
  b.verbinde(bLetzt, s);
  return b.fertig();
}

const KOLIBRI: ModulParameter = { groesse: 'kolibri', spezialisierung: 'keine' };
const REIHER: ModulParameter = { groesse: 'reiher', spezialisierung: 'keine' };
const KONDOR: ModulParameter = { groesse: 'kondor', spezialisierung: 'keine' };

/**
 * Fachkerne für II-3. Spezialisierung lohnt dort, wo die Güte-Decke noch Luft
 * hat — beim KONDOR ist sie fast ausgereizt, beim REIHER nicht.
 */
const KOLIBRI_RECHT: ModulParameter = { groesse: 'kolibri', spezialisierung: 'recht' };
const REIHER_RECHT: ModulParameter = { groesse: 'reiher', spezialisierung: 'recht' };
const REIHER_TECHNIK: ModulParameter = { groesse: 'reiher', spezialisierung: 'technik' };

/** Weiche auf die Domäne "recht": Bahn B trägt die Vergabeakten, Bahn A den Rest. */
const NACH_FACH: ModulParameter = { kriterium: 'domaene', spezialisierung: 'recht' };

// ---------------------------------------------------------------------------

export const AKT_2: LevelDefinition[] = [
  // =========================================================================
  {
    id: 'II-0',
    akt: 2,
    nummer: 0,
    titel: 'Die zweite Bahn',
    untertitel: 'Zwei Kundengruppen, ein Eingang',
    briefing:
      'Der Jour fixe hat beschlossen, dass Halle 3 "beide Kundengruppen bedient". Praktisch heißt das: Textaufträge aus dem Vertrieb und Vergabeprüfungen des LAVV laufen ab heute nebeneinander über denselben Eingang, unsortiert, im selben Takt. Dafür liegt ein neues Modul im Regal. Die Weiche schätzt die Schwierigkeit eines Auftrags und schickt ihn nach Bahn A oder nach Bahn B. Sie kostet fünfzehn Token. Ein KONDOR kostet sechshundertvierzig. Bau den Eingang so, dass nur das Schwere teuer wird.',
    lernziel:
      'Eine Weiche produziert nichts und entscheidet trotzdem, welcher Auftrag welchen Preis auslöst.',
    quelle: QUELLE,
    module: ['kern', 'weiche'],
    strom: {
      anzahl: 28,
      takt: 2,
      domaenen: ['text', 'recht'],
      schwierigkeit: [0.12, 0.82],
      mehrdeutigkeit: [0.05, 0.18],
    },
    budget: { dauer: 400 },
    ziele: [
      {
        id: 'alles',
        metrik: 'durchsatz',
        vergleich: '>=',
        wert: 1,
        text: 'Jeder Auftrag wird ausgeliefert.',
      },
      { id: 'guete', metrik: 'guete', vergleich: '>=', wert: 0.6, text: 'Mindestgüte 60 Prozent.' },
      {
        id: 'preis',
        metrik: 'kostenJeAuftrag',
        vergleich: '<=',
        wert: 335,
        text: 'Höchstens 335 Token je Auftrag.',
      },
    ],
    saat: 201,
    vorbau: leeresFundament(),
    reflexion:
      'Die Weiche hat jeden Auftrag eingeschätzt, bevor ein Kern ihn gesehen hat. Was kostet dich eine Fehlschätzung nach unten?',
    notiz:
      'Sprachnotiz, 2. April, 07:10. Die Weiche ist das billigste Modul im Regal und das folgenreichste. Sie produziert nichts, sie entscheidet nur. Ich habe zwei Jahre gebraucht, bis ich das nicht mehr als Schwäche gelesen habe. Regel: Sortieren ist Arbeit, auch wenn dabei nichts entsteht.',
    referenzen: [
      {
        name: 'Zwei Bahnen',
        ansatz:
          'Leichtes zweimal durch den KOLIBRI, Schweres einmal durch den KONDOR — wenige Module, hoher Stückpreis.',
        werk: zweiBahnen({ kriterium: 'schwierigkeit', schwelle: 0.45 }, [KOLIBRI, KOLIBRI], [KONDOR]),
      },
      {
        name: 'Schwere Bahn aus zwei REIHER',
        ansatz:
          'Statt eines großen Kerns zwei mittlere in Reihe: deutlich billiger und schneller, dafür ein Modul mehr.',
        werk: zweiBahnen(
          { kriterium: 'schwierigkeit', schwelle: 0.45 },
          [KOLIBRI, KOLIBRI],
          [REIHER, REIHER]
        ),
      },
    ],
    antiMuster: [
      {
        name: 'KONDOR für alles',
        verlockung: 'Ohne Sortierung kann nichts falsch sortiert werden.',
        scheitertAn: 'kostenJeAuftrag',
        werk: reihe([{ art: 'kern', param: KONDOR }]),
      },
      {
        name: 'KOLIBRI für alles',
        verlockung: 'Der kleinste Kern hat im ersten Akt gereicht, also reicht er auch jetzt.',
        scheitertAn: 'guete',
        werk: reihe([{ art: 'kern', param: KOLIBRI }]),
      },
      {
        // Der lehrreichste Fehler dieses Levels: die Güte stimmt, der Preis
        // nicht. Wer nicht sortiert, lässt den leichten Auftrag den schweren
        // mitbezahlen.
        name: 'Zwei REIHER für alles',
        verlockung: 'Ein Kompromiss in der Mitte behandelt beide Kundengruppen gleich gut.',
        scheitertAn: 'kostenJeAuftrag',
        werk: reihe([
          { art: 'kern', param: REIHER },
          { art: 'kern', param: REIHER },
        ]),
      },
    ],
    monolith: monolith(1),
  },

  // =========================================================================
  {
    id: 'II-1',
    akt: 2,
    nummer: 1,
    titel: 'Der Deckel bleibt',
    untertitel: 'Einkauf, zweites Quartal',
    briefing:
      'Der Einkauf hat den Tokendeckel nicht zurückgenommen, sondern verlängert; die Begründung steht in einer Anlage, die niemand geöffnet hat. Der Auftragsstrom ist derselbe wie gestern, nur länger und an der Spitze schwerer. Deine Weiche steht bereits, das Modul ist nicht mehr neu. Was jetzt zählt, ist ihre Schwelle: Wo genau trennst du billig von teuer, und wie viele Aufträge schickst du auf die Bahn, die das Sechzehnfache kostet? Der Deckel gilt für den ganzen Lauf, nicht je Auftrag.',
    lernziel:
      'Die Schwelle einer Weiche ist die eigentliche Entwurfsentscheidung, nicht ihre Existenz.',
    quelle: QUELLE,
    module: ['kern', 'weiche'],
    strom: {
      anzahl: 32,
      takt: 2,
      domaenen: ['text', 'technik', 'recht'],
      schwierigkeit: [0.1, 0.95],
      mehrdeutigkeit: [0.05, 0.2],
    },
    budget: { kosten: 10500, dauer: 500 },
    ziele: [
      {
        id: 'alles',
        metrik: 'durchsatz',
        vergleich: '>=',
        wert: 1,
        text: 'Jeder Auftrag wird ausgeliefert.',
      },
      { id: 'guete', metrik: 'guete', vergleich: '>=', wert: 0.63, text: 'Mindestgüte 63 Prozent.' },
      {
        id: 'meister',
        metrik: 'kostenJeAuftrag',
        vergleich: '<=',
        wert: 265,
        text: 'Meisterstück: höchstens 265 Token je Auftrag.',
        optional: true,
      },
    ],
    saat: 211,
    vorbau: leeresFundament(),
    reflexion:
      'Schieb die Schwelle in Gedanken um zehn Punkte nach unten. Welche Zahl im Bericht bewegt sich zuerst?',
    notiz:
      'Sprachnotiz, 8. April. Der Einkauf fragt nach dem Stückpreis, der Fachbereich nach der Güte. Beide haben recht, und die Weiche ist der einzige Ort, an dem man beiden gleichzeitig antworten kann. Regel: Ein Deckel ist kein Verbot, sondern eine Sortieraufgabe.',
    referenzen: [
      {
        name: 'Schwelle hochgezogen',
        ansatz:
          'Nur die eindeutig schweren Akten bekommen den KONDOR. Wenige Module, dafür teurer je Auftrag und mit Warteschlange.',
        werk: zweiBahnen({ kriterium: 'schwierigkeit', schwelle: 0.6 }, [KOLIBRI, KOLIBRI], [KONDOR]),
      },
      {
        name: 'Mittlere Bahn statt großer',
        ansatz:
          'Standardschwelle, aber die schwere Bahn aus zwei REIHER: ein Modul mehr, dafür deutlich billiger und ohne Stau.',
        werk: zweiBahnen(
          { kriterium: 'schwierigkeit', schwelle: 0.45 },
          [KOLIBRI, KOLIBRI],
          [REIHER, REIHER]
        ),
      },
    ],
    antiMuster: [
      {
        name: 'KONDOR für alles',
        verlockung: 'Der große Kern besteht jedes Gütegate. Der Deckel ist ja nur eine Zahl.',
        scheitertAn: 'budget_kosten',
        werk: reihe([{ art: 'kern', param: KONDOR }]),
      },
      {
        name: 'Zwei REIHER für alles',
        verlockung: 'Die Mitte ist billig genug und spart die ganze Sortiererei.',
        scheitertAn: 'budget_kosten',
        werk: reihe([
          { art: 'kern', param: REIHER },
          { art: 'kern', param: REIHER },
        ]),
      },
      {
        name: 'Schwelle ganz oben',
        verlockung: 'Je höher die Schwelle, desto seltener zahlst du den großen Kern.',
        scheitertAn: 'guete',
        werk: zweiBahnen({ kriterium: 'schwierigkeit', schwelle: 0.9 }, [KOLIBRI, KOLIBRI], [KONDOR]),
      },
    ],
    monolith: monolith(1),
  },

  // =========================================================================
  {
    id: 'II-2',
    akt: 2,
    nummer: 2,
    titel: 'Unscharfe Akten',
    untertitel: 'TROET-Export, Spaltenbreite 80',
    briefing:
      'Das LAVV hat seinen Bestand aus TROET exportiert. Das Fachverfahren ist von 1998, kennt achtzig Spalten je Zeile und keine Abschnitte; was ein Auftrag verlangt, steht irgendwo zwischen Zeile vier und Zeile zweihundert. Deine Weiche schätzt weiter, nur schätzt sie jetzt auf einem Text, der alles und nichts bedeuten kann. Der Fehler fällt nicht an der Weiche auf, sondern zwei Module später, wenn ein KOLIBRI an einer Vergabeprüfung sitzt. Die Schwelle von gestern hält diesem Strom nicht stand.',
    lernziel: 'Ein Router ist nur so gut wie das Merkmal, auf dem er schätzt.',
    quelle: QUELLE,
    module: ['kern', 'weiche'],
    strom: {
      anzahl: 28,
      takt: 2,
      domaenen: ['recht', 'analyse'],
      schwierigkeit: [0.12, 0.85],
      mehrdeutigkeit: [0.6, 0.95],
    },
    budget: { kosten: 17000, dauer: 600 },
    ziele: [
      {
        id: 'alles',
        metrik: 'durchsatz',
        vergleich: '>=',
        wert: 1,
        text: 'Jeder Auftrag wird ausgeliefert.',
      },
      { id: 'guete', metrik: 'guete', vergleich: '>=', wert: 0.7, text: 'Mindestgüte 70 Prozent.' },
      {
        id: 'meister',
        metrik: 'kostenJeAuftrag',
        vergleich: '<=',
        wert: 350,
        text: 'Meisterstück: höchstens 350 Token je Auftrag.',
        optional: true,
      },
    ],
    saat: 221,
    vorbau: leeresFundament(),
    reflexion:
      'Deine Weiche liegt bei diesen Akten oft daneben. Machst du sie vorsichtiger oder stellst du ihr eine zweite Meinung daneben?',
    notiz:
      'Sprachnotiz, 15. April. TROET schreibt seit 1998 dieselben achtzig Spalten, und seit 1998 steht das Wichtige in der Fußnote. Ich habe damals die Schwelle verschoben, bis nichts mehr durchfiel, und danach die Rechnung gesehen. Regel: Wer der Schätzung nicht traut, fragt zweimal, statt sie zu verbiegen.',
    referenzen: [
      {
        name: 'Vorsichtige Schwelle',
        ansatz:
          'Im Zweifel teuer: die Schwelle sinkt, fast alles fährt in den KONDOR. Wenigste Module, höchster Preis, lange Warteschlange.',
        werk: zweiBahnen({ kriterium: 'schwierigkeit', schwelle: 0.3 }, [KOLIBRI, KOLIBRI], [KONDOR]),
      },
      {
        name: 'Zweite Meinung',
        ansatz:
          'Zwei Weichen in Reihe: nur wer beide Schätzungen passiert, fährt billig. Weil kaum noch fehlgeleitet wird, genügt auf der schweren Bahn die mittlere Doppelkette.',
        werk: doppelteWeiche(
          { kriterium: 'schwierigkeit', schwelle: 0.45 },
          [KOLIBRI, KOLIBRI],
          [REIHER, REIHER]
        ),
      },
    ],
    antiMuster: [
      {
        // Baugleich mit der ersten Referenz aus II-1. Genau dieses Werk muss
        // hier durchfallen, sonst bricht das TEN-Level nichts.
        name: 'Die Schwelle von gestern',
        verlockung: 'Gestern hat genau dieser Aufbau bestanden. Die Aufträge sehen doch ähnlich aus.',
        scheitertAn: 'guete',
        werk: zweiBahnen({ kriterium: 'schwierigkeit', schwelle: 0.6 }, [KOLIBRI, KOLIBRI], [KONDOR]),
      },
      {
        name: 'Weiche abgebaut, Mitte doppelt',
        verlockung: 'Wenn die Schätzung nichts taugt, sortiert man eben gar nicht mehr.',
        scheitertAn: 'guete',
        werk: reihe([
          { art: 'kern', param: REIHER },
          { art: 'kern', param: REIHER },
        ]),
      },
      {
        name: 'Alles in den großen Kern',
        verlockung: 'Wer nicht klassifizieren kann, kauft sich die Unsicherheit einfach weg.',
        scheitertAn: 'budget_kosten',
        werk: reihe([{ art: 'kern', param: KONDOR }]),
      },
    ],
    monolith: monolith(1),
  },

  // =========================================================================
  {
    id: 'II-3',
    akt: 2,
    nummer: 3,
    titel: 'Zwei Sortierungen',
    untertitel: 'Rahmenvertrag, Vergabe und Migration',
    briefing:
      'Der neue Rahmenvertrag bündelt zwei Fachbereiche auf einem Eingang: Vergabeprüfung und Migration. Der Tokendeckel ist der härteste, den Halle 3 je hatte, und die Güte soll steigen, nicht fallen. Aus dem ersten Akt weißt du, dass ein spezialisierter Kern seine Decke hebt und auf der falschen Domäne senkt. Jetzt hast du das Modul, das diese Wette entscheidet. Zwei Weichen hintereinander sind erlaubt: erst klären, wie schwer ein Auftrag ist, dann klären, worum es geht.',
    lernziel: 'Spezialisierung zahlt sich erst aus, wenn vor ihr klassifiziert wird.',
    quelle: QUELLE,
    module: ['kern', 'weiche'],
    strom: {
      anzahl: 36,
      takt: 2,
      domaenen: ['recht', 'technik'],
      schwierigkeit: [0.12, 0.85],
      mehrdeutigkeit: [0.15, 0.4],
    },
    budget: { kosten: 12200, dauer: 400 },
    ziele: [
      {
        id: 'alles',
        metrik: 'durchsatz',
        vergleich: '>=',
        wert: 1,
        text: 'Jeder Auftrag wird ausgeliefert.',
      },
      { id: 'guete', metrik: 'guete', vergleich: '>=', wert: 0.8, text: 'Mindestgüte 80 Prozent.' },
      {
        id: 'meister',
        metrik: 'kostenJeAuftrag',
        vergleich: '<=',
        wert: 300,
        text: 'Meisterstück: höchstens 300 Token je Auftrag.',
        optional: true,
      },
    ],
    saat: 231,
    vorbau: leeresFundament(),
    reflexion:
      'Du hast erst nach Schwere und dann nach Fach sortiert. Was ginge verloren, wenn du die Reihenfolge tauschst?',
    notiz:
      'Sprachnotiz, 23. April. Wir haben jahrelang Spezialisten eingekauft und ihnen dann alles auf den Tisch gelegt, was hereinkam. Das Ergebnis war ein teures Mittelmaß mit Visitenkarte. Regel: Ein Spezialist ohne Vorsortierung ist ein Generalist mit Aufschlag.',
    referenzen: [
      {
        name: 'Vorsichtig sortiert, zwei Fachbahnen',
        ansatz:
          'Niedrige Schwelle, danach nach Fach getrennt: je zwei spezialisierte REIHER für Vergabe und Migration. Kompakter, aber teurer je Auftrag.',
        werk: zweiSortierungen(
          { kriterium: 'schwierigkeit', schwelle: 0.25 },
          NACH_FACH,
          [KOLIBRI, KOLIBRI],
          [REIHER_TECHNIK, REIHER_TECHNIK],
          [REIHER_RECHT, REIHER_RECHT]
        ),
      },
      {
        name: 'Breite Sparbahn, drei kleine Kerne',
        ansatz:
          'Höhere Schwelle, dafür drei KOLIBRI auf der Sparbahn: ein Modul mehr, spürbar billiger je Auftrag.',
        werk: zweiSortierungen(
          { kriterium: 'schwierigkeit', schwelle: 0.3 },
          NACH_FACH,
          [KOLIBRI, KOLIBRI, KOLIBRI],
          [REIHER_TECHNIK, REIHER_TECHNIK],
          [REIHER_RECHT, REIHER_RECHT]
        ),
      },
    ],
    antiMuster: [
      {
        // Isoliert genau eine Variable gegen die erste Referenz: identischer
        // Graph, nur überall dieselbe Spezialisierung. Die Migrationsakten
        // zahlen dafür den vollen Malus.
        name: 'Blind auf Vergabe spezialisiert',
        verlockung: 'Spezialisierung hebt die Decke. Auf welche Domäne, ist Nebensache.',
        scheitertAn: 'guete',
        werk: zweiSortierungen(
          { kriterium: 'schwierigkeit', schwelle: 0.25 },
          NACH_FACH,
          [KOLIBRI_RECHT, KOLIBRI_RECHT],
          [REIHER_RECHT, REIHER_RECHT],
          [REIHER_RECHT, REIHER_RECHT]
        ),
      },
      {
        name: 'Sortiert, aber nicht spezialisiert',
        verlockung: 'Die zweite Weiche steht doch. Damit ist die Aufgabe erledigt.',
        scheitertAn: 'guete',
        werk: zweiSortierungen(
          { kriterium: 'schwierigkeit', schwelle: 0.25 },
          NACH_FACH,
          [KOLIBRI, KOLIBRI],
          [REIHER, REIHER],
          [REIHER, REIHER]
        ),
      },
      {
        name: 'Fachbahnen dreifach besetzt',
        verlockung: 'Wenn zwei Durchläufe je Fachbahn gut sind, sind drei besser.',
        scheitertAn: 'budget_kosten',
        werk: zweiSortierungen(
          { kriterium: 'schwierigkeit', schwelle: 0.25 },
          NACH_FACH,
          [KOLIBRI, KOLIBRI],
          [REIHER_TECHNIK, REIHER_TECHNIK, REIHER_TECHNIK],
          [REIHER_RECHT, REIHER_RECHT, REIHER_RECHT]
        ),
      },
      {
        name: 'Gar nicht sortiert',
        verlockung: 'Zwei mittlere Kerne für alle liefern eine Güte, die sich sehen lassen kann.',
        scheitertAn: 'budget_kosten',
        werk: reihe([
          { art: 'kern', param: REIHER },
          { art: 'kern', param: REIHER },
        ]),
      },
    ],
    monolith: (() => {
      const b = new Bau();
      const q = b.setze('quelle', {}, 'q', 0, 4);
      const k = b.setze('kern', KONDOR, 'k', 4, 4);
      const s = b.setze('senke', {}, 's', 8, 4);
      b.kette(q, k, s);
      return b.fertig();
    })(),
  },
];
