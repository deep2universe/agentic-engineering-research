/**
 * AKT IV — DIE SICHERUNG
 *
 * Neue Mechanik: die Schranke (deterministisches Gate auf der Güte, zwei Token,
 * ein Tick) und die Sicherung (Wiederholung oder Circuit Breaker).
 * Zentrale Lektion: Wiederholen ist kein Plan; rechtzeitig aufgeben ist einer.
 *
 * Rhythmus (Kishotenketsu):
 *   IV-0 KI    — der FREMDDIENST fällt aus; nur die Wiederholung hält die
 *                Belegquote, und der zweite Ausgang eines Werkzeugs bekommt
 *                zum ersten Mal eine Leitung.
 *   IV-1 SHO   — dieselbe Wiederholung unter dem Tokendeckel aus Akt I; die
 *                Schranke erspart die Nachbesserung bei allen, die keine brauchen.
 *   IV-2 TEN   — Bruch: der Fremddienst antwortet langsamer als der Eingang
 *                liefert. Jede Wiederholung belegt ihn ein zweites Mal, der Stau
 *                reißt den Latenzdeckel, und die Straße aus IV-1 fällt durch.
 *                Nur der Circuit Breaker hält — um den Preis fehlender Belege.
 *   IV-3 KETSU — Weiche, Schranke und Sicherung unter hartem Tokendeckel:
 *                vorher schätzen oder hinterher messen, beides trägt.
 */

import type {
  KernGroesse,
  SicherungModus,
  Werk,
  WerkzeugArt,
} from '../sim/typen';
import type { LevelDefinition } from './level_typen';
import { Bau, leeresFundament, monolith } from './bauhilfe';

const QUELLE = '07_resilience_error_handling.md';
const QUELLE_BACKOFF = '07_resilience_error_handling.md#pattern-1-exponential-backoff-mit-jitter';
const QUELLE_BREAKER = '07_resilience_error_handling.md#pattern-2-circuit-breaker';
const QUELLE_DEGRADATION = '07_resilience_error_handling.md#pattern-4-graceful-degradation';

// ---------------------------------------------------------------------------
// Baukasten dieses Akts
// ---------------------------------------------------------------------------

/**
 * Ein Glied einer Fertigungsstraße. Drei Formen:
 *
 *  - `{ k }`   ein Modell-Kern.
 *  - `{ w }`   ein Werkzeug. Ohne `sich` führt der Ausgang 'fehler' auf dasselbe
 *              nächste Glied wie 'ok' (der Stil aus Akt III: der Ausfall wird
 *              durchgereicht und der Vorgang bleibt unbelegt). Mit `sich`
 *              entsteht die Verdrahtung dieses Akts: 'fehler' geht in eine
 *              Sicherung, deren 'zurück' auf das Werkzeug zeigt und deren
 *              'notausgang' auf das nächste Glied. Das ist ein Zyklus — erlaubt,
 *              weil eine Sicherung darin liegt.
 *  - `{ tor }` eine Schranke. 'ok' geht auf das nächste Glied, 'fehler' in eine
 *              eigene Nachbesserungskette, die danach ebenfalls dort mündet.
 */
type Glied =
  | { readonly k: KernGroesse }
  | { readonly w: WerkzeugArt; readonly sich?: SicherungModus; readonly versuche?: number }
  | { readonly tor: number; readonly reparatur: readonly Glied[] };

function K(k: KernGroesse): Glied {
  return { k };
}

/** Werkzeug ohne Ausfallbehandlung — der Ausfall wird durchgereicht. */
function W(w: WerkzeugArt): Glied {
  return { w };
}

/** Werkzeug mit Sicherung am Ausgang 'fehler'. */
function WS(w: WerkzeugArt, sich: SicherungModus, versuche: number): Glied {
  return { w, sich, versuche };
}

/** Schranke mit Nachbesserungskette am Ausgang 'fehler'. */
function TOR(tor: number, reparatur: readonly Glied[]): Glied {
  return { tor, reparatur };
}

/** Vergibt fortlaufend freie Spalten, damit sich nie zwei Module ein Feld teilen. */
class Feld {
  private n = 0;
  next(): number {
    return 2 + this.n++ * 2;
  }
}

/** Legt eine Gliederkette in Zeile `z` ab und verdrahtet sie bis `ziel`. */
function lege(
  b: Bau,
  f: Feld,
  glieder: readonly Glied[],
  z: number,
  ziel: string,
  praefix: string
): string {
  if (glieder.length === 0) return ziel;

  const ids = glieder.map((g, i) => {
    const x = f.next();
    const id = `${praefix}${i}`;
    if ('k' in g) return b.setze('kern', { groesse: g.k }, id, x, z);
    if ('w' in g) return b.setze('werkzeug', { werkzeugArt: g.w }, id, x, z);
    return b.setze('schranke', { schwelle: g.tor }, id, x, z);
  });

  const folge = [...ids, ziel];
  glieder.forEach((g, i) => {
    const von = ids[i]!;
    const nach = folge[i + 1]!;
    if ('k' in g) {
      b.verbinde(von, nach, 'aus');
    } else if ('w' in g) {
      b.verbinde(von, nach, 'ok');
      if (g.sich !== undefined) {
        const s = b.setze(
          'sicherung',
          { modus: g.sich, versuche: g.versuche ?? 2 },
          `${praefix}${i}s`,
          f.next(),
          z + 1
        );
        b.verbinde(von, s, 'fehler');
        b.verbinde(s, von, 'zurueck', 'ein');
        b.verbinde(s, nach, 'notausgang', 'ein');
      } else {
        b.verbinde(von, nach, 'fehler');
      }
    } else {
      const rep = lege(b, f, g.reparatur, z + 2, nach, `${praefix}${i}r`);
      b.verbinde(von, nach, 'ok');
      b.verbinde(von, rep, 'fehler');
    }
  });

  return ids[0]!;
}

/** Quelle → Glieder in Reihe → Senke. */
function strasse(glieder: readonly Glied[]): Werk {
  const b = new Bau();
  const f = new Feld();
  const q = b.setze('quelle', {}, 'q', 0, 4);
  const erst = lege(b, f, glieder, 4, 's', 'm');
  b.setze('senke', {}, 's', f.next(), 4);
  b.verbinde(q, erst);
  return b.fertig();
}

/**
 * Quelle → Vorstufe → Weiche (nach Schwierigkeit) → leichter | schwerer Zweig
 * → Senke. Jeder Zweig ist wieder eine Gliederkette und darf eigene Schranken
 * mitbringen.
 */
function verzweigt(
  vor: readonly Glied[],
  schwelle: number,
  leicht: readonly Glied[],
  schwer: readonly Glied[]
): Werk {
  const b = new Bau();
  const f = new Feld();
  const q = b.setze('quelle', {}, 'q', 0, 4);
  const aErst = lege(b, f, leicht, 8, 's', 'a');
  const bErst = lege(b, f, schwer, 14, 's', 'b');
  const vorErst = lege(b, f, vor, 4, 'r', 'v');
  const r = b.setze('weiche', { kriterium: 'schwierigkeit', schwelle }, 'r', f.next(), 4);
  b.setze('senke', {}, 's', f.next(), 4);
  b.verbinde(q, vorErst);
  b.verbinde(r, aErst, 'a');
  b.verbinde(r, bErst, 'b');
  return b.fertig();
}

/**
 * Der Vorbau von IV-0: der FREMDDIENST steht bereits auf dem Fundament, weil die
 * Verfahrensanweisung ihn vorschreibt. Verdrahtet ist nichts.
 */
function fundamentMitFremddienst(): Werk {
  return {
    module: [
      { id: 'q', art: 'quelle', x: 0, z: 4, param: {} },
      { id: 'w', art: 'werkzeug', x: 6, z: 4, param: { werkzeugArt: 'api' } },
      { id: 's', art: 'senke', x: 16, z: 4, param: {} },
    ],
    leitungen: [],
  };
}

/**
 * Die Referenzlösung aus IV-1. Sie steht hier oben, weil IV-2 sie als
 * Anti-Muster wiederverwendet: dasselbe Werk, ein anderer Auftragsstrom — und
 * genau daran zeigt sich der Bruch dieses Akts.
 */
const STRASSE_AUS_IV_1: Werk = strasse([
  WS('api', 'wiederholen', 3),
  K('kolibri'),
  K('kolibri'),
  TOR(0.7, [K('reiher')]),
]);

// ---------------------------------------------------------------------------
// Die vier Level
// ---------------------------------------------------------------------------

export const AKT_4: LevelDefinition[] = [
  // =========================================================================
  {
    id: 'IV-0',
    akt: 4,
    nummer: 0,
    titel: 'Der Fremddienst',
    untertitel: 'Bieterregister, Verfügbarkeit 82 Prozent',
    briefing:
      'Das Landesamt betreibt das Bieterregister als Schnittstelle nach außen. Jeder Vermerk muss dort geprüft werden — so steht es in der Verfahrensanweisung, und die Verfahrensanweisung kennt keine Ausnahme für Wartungsfenster. Der Dienst antwortet in etwa vier von fünf Fällen. Beim Rest kommt nichts zurück. Das Werkzeug hat für diesen Fall einen zweiten Ausgang, und bisher hast du ihn nie gebraucht. Was du daran hängst, entscheidet, ob aus einem kurzen Aussetzer ein unbelegter Vermerk wird. Der Fremddienst steht schon auf dem Fundament. Verdrahte ihn — beide Ausgänge.',
    lernziel:
      'Ein Werkzeug hat zwei Ausgänge, und der zweite entscheidet über deine Belegquote.',
    quelle: QUELLE_BACKOFF,
    module: ['kern', 'weiche', 'werkzeug', 'schranke', 'sicherung'],
    strom: {
      anzahl: 24,
      takt: 5,
      domaenen: ['technik', 'analyse'],
      schwierigkeit: [0.12, 0.34],
      mehrdeutigkeit: [0.05, 0.2],
      anteilBelegpflichtig: 1,
    },
    budget: { dauer: 400 },
    ziele: [
      { id: 'alles', metrik: 'durchsatz', vergleich: '>=', wert: 1, text: 'Jeder Auftrag wird ausgeliefert.' },
      { id: 'beleg', metrik: 'belegquote', vergleich: '>=', wert: 0.98, text: 'Mindestens 98 Prozent Belegquote.' },
      { id: 'guete', metrik: 'guete', vergleich: '>=', wert: 0.72, text: 'Mindestgüte 72 Prozent.' },
      {
        id: 'preis',
        metrik: 'kostenJeAuftrag',
        vergleich: '<=',
        wert: 520,
        text: 'Höchstens 520 Token je Auftrag.',
      },
    ],
    saat: 401,
    vorbau: fundamentMitFremddienst(),
    reflexion:
      'Der Fremddienst fiel bei jedem fünften Aufruf aus, und deine Belegquote liegt trotzdem bei hundert Prozent. Wie oft hättest du wiederholen müssen, wenn er den ganzen Tag ausgefallen wäre?',
    notiz:
      'Sprachnotiz, 16. April, 07:20. Das Bieterregister war noch nie zuverlässig. Wir haben zwei Jahre lang jeden Ausfall abends von Hand nachgetragen. Dann hat jemand eine Wiederholung eingebaut, und die Abende gehörten wieder uns. Regel: Ein zweiter Ausgang ohne Leitung ist ein Aktenordner, den niemand führt.',
    referenzen: [
      {
        name: 'Wiederholung und drei KOLIBRI',
        ansatz:
          'Der Ausfall geht über die Sicherung zurück in den Fremddienst; danach drei billige Aufrufe — mehr Module, deutlich weniger Token.',
        werk: strasse([WS('api', 'wiederholen', 3), K('kolibri'), K('kolibri'), K('kolibri')]),
      },
      {
        name: 'Wiederholung und zwei REIHER',
        ansatz:
          'Dieselbe Sicherung, aber zwei mittlere Aufrufe statt drei kleiner — kompakter und fast doppelt so teuer.',
        werk: strasse([WS('api', 'wiederholen', 3), K('reiher'), K('reiher')]),
      },
    ],
    antiMuster: [
      {
        name: 'Der Ausfall geht weiter',
        verlockung: 'Der zweite Ausgang muss irgendwohin. Häng ihn an denselben Kern wie den ersten.',
        scheitertAn: 'belegquote',
        werk: strasse([W('api'), K('kolibri'), K('kolibri'), K('kolibri')]),
      },
      {
        // Der Held aus IV-2 als Falle in IV-0: der Ausfall ist hier vorübergehend,
        // und wer sofort aufgibt, verliert Belege ohne Not.
        name: 'Sofort aufgegeben',
        verlockung: 'Eine Sicherung ist eine Sicherung. Ob sie wiederholt oder abschaltet, wird schon egal sein.',
        scheitertAn: 'belegquote',
        werk: strasse([WS('api', 'sicherung', 2), K('kolibri'), K('kolibri'), K('kolibri')]),
      },
      {
        name: 'Ein KONDOR für alles',
        verlockung: 'Wenn schon die Schnittstelle wackelt, soll wenigstens der Kern sitzen.',
        scheitertAn: 'kostenJeAuftrag',
        werk: strasse([WS('api', 'wiederholen', 3), K('kondor')]),
      },
      {
        name: 'Ohne Register',
        verlockung: 'Der Dienst fällt aus, kostet Zeit und bringt Ärger. Ohne ihn läuft die Straße rund.',
        scheitertAn: 'guete',
        werk: strasse([K('kolibri'), K('kolibri'), K('kolibri')]),
      },
    ],
    monolith: monolith(1),
  },

  // =========================================================================
  {
    id: 'IV-1',
    akt: 4,
    nummer: 1,
    titel: 'Die Schranke',
    untertitel: 'Nachbesserung auf Zuruf',
    briefing:
      'Der Einkauf hat den Tokendeckel wieder aufgemacht und dieses Mal fester zugezogen. Über den Eingang laufen kurze Auskünfte und schwere Prüfaufträge gemischt, belegpflichtig ist fast alles. Die naheliegende Antwort lautet: jeden Vorgang zweimal durch einen mittleren Kern. Das hält die Güte und reißt den Deckel. Die Schranke misst statt zu schätzen — sie sieht die Güte, die tatsächlich herausgekommen ist, kostet zwei Token und einen Tick und schickt nur die Durchgefallenen in die Nachbesserung. Wo du sie ansetzt und wie hoch du sie hängst, ist deine Entscheidung.',
    lernziel:
      'Ein Gate kostet fast nichts und erspart dir die Nachbesserung bei allen, die keine brauchen.',
    quelle: QUELLE,
    module: ['kern', 'weiche', 'werkzeug', 'schranke', 'sicherung'],
    strom: {
      anzahl: 28,
      takt: 5,
      domaenen: ['recht', 'analyse', 'technik'],
      schwierigkeit: [0.15, 0.6],
      mehrdeutigkeit: [0.1, 0.3],
      anteilBelegpflichtig: 0.85,
    },
    budget: { kosten: 13000, dauer: 500 },
    ziele: [
      { id: 'alles', metrik: 'durchsatz', vergleich: '>=', wert: 1, text: 'Jeder Auftrag wird ausgeliefert.' },
      { id: 'beleg', metrik: 'belegquote', vergleich: '>=', wert: 0.98, text: 'Mindestens 98 Prozent Belegquote.' },
      { id: 'guete', metrik: 'guete', vergleich: '>=', wert: 0.76, text: 'Mindestgüte 76 Prozent.' },
    ],
    saat: 411,
    vorbau: leeresFundament(),
    reflexion:
      'Deine Schranke steht bei siebzig Prozent. Wie viele Vorgänge wären bei achtzig Prozent zusätzlich in die Nachbesserung gelaufen, und was hätte dich das gekostet?',
    notiz:
      'Sprachnotiz, 19. April. Wir hatten früher eine Endkontrolle für alles. Jeder Vorgang, jedes Mal, unabhängig davon, wie gut er war. Das war gerecht und es war teuer. Gerecht und teuer ist keine Tugend, sondern eine Bequemlichkeit. Regel: Prüfe alle, bessere wenige nach.',
    referenzen: [
      {
        name: 'Zwei KOLIBRI, dann die Schranke',
        ansatz:
          'Billig vorarbeiten, das Gate bei siebzig Prozent, und nur die Durchgefallenen bekommen einen REIHER — mehr Module, ein Drittel der Token.',
        werk: STRASSE_AUS_IV_1,
      },
      {
        name: 'Ein REIHER, dann die Schranke',
        ansatz:
          'Ein starker erster Aufruf, ein höheres Gate, ein Modul weniger — dafür fast der ganze Deckel.',
        werk: strasse([WS('api', 'wiederholen', 3), K('reiher'), TOR(0.75, [K('reiher')])]),
      },
    ],
    antiMuster: [
      {
        name: 'Nachbesserung für alle',
        verlockung: 'Zwei mittlere Kerne hintereinander liefern die beste Güte im Akt. Warum daran sparen?',
        scheitertAn: 'budget_kosten',
        werk: strasse([WS('api', 'wiederholen', 3), K('reiher'), K('reiher')]),
      },
      {
        name: 'Drei KOLIBRI für alle',
        verlockung: 'Wenn der kleine Kern billig ist, nimm eben drei davon und spar dir das Gate.',
        scheitertAn: 'guete',
        werk: strasse([WS('api', 'wiederholen', 3), K('kolibri'), K('kolibri'), K('kolibri')]),
      },
      {
        name: 'Das Gate ohne Wiederholung',
        verlockung: 'Die Schranke fängt doch alles ab, was schiefgeht. Dann braucht der Fremddienst keine Sicherung.',
        scheitertAn: 'belegquote',
        werk: strasse([W('api'), K('kolibri'), K('kolibri'), TOR(0.7, [K('reiher')])]),
      },
      {
        name: 'Das Gate bei 95 Prozent',
        verlockung: 'Je höher die Schranke hängt, desto besser das Ergebnis. Und nachbessern soll der große Kern.',
        scheitertAn: 'budget_kosten',
        werk: strasse([WS('api', 'wiederholen', 3), K('reiher'), TOR(0.95, [K('kondor')])]),
      },
    ],
    monolith: monolith(2),
  },

  // =========================================================================
  {
    id: 'IV-2',
    akt: 4,
    nummer: 2,
    titel: 'Der Stau',
    untertitel: 'Anlage 12, drei Tage vor der Frist',
    briefing:
      'Das Bieterregister hat eine neue Version bekommen und antwortet seitdem langsamer, als der Eingang liefert. Jeder Vorgang, den du zurückschickst, belegt die Schnittstelle ein zweites Mal — und alle anderen warten. Deine Straße von gestern wiederholt genau so lange, bis der Stau die Frist frisst. Die Sicherung kann auch anders: als Sicherung im Wortsinn. Nach genug beobachteten Fehlern geht sie auf und schickt alles über den Notausgang, unbelegt, aber pünktlich. Ein Wort zum Meisterstück dieses Levels: MONOLITH hält es seit Jahren, und keine saubere Lösung wird es je erreichen. Sieh es dir an und lass es liegen.',
    lernziel:
      'Ein Circuit Breaker tauscht Vollständigkeit gegen Termintreue, und diesen Tausch triffst du bewusst oder gar nicht.',
    quelle: QUELLE_BREAKER,
    module: ['kern', 'weiche', 'werkzeug', 'schranke', 'sicherung'],
    strom: {
      anzahl: 30,
      takt: 3,
      domaenen: ['recht', 'finanz', 'analyse'],
      schwierigkeit: [0.2, 0.68],
      mehrdeutigkeit: [0.1, 0.3],
      anteilBelegpflichtig: 1,
      anteilRechnerisch: 0.5,
    },
    budget: { latenz: 20, dauer: 400 },
    ziele: [
      { id: 'alles', metrik: 'durchsatz', vergleich: '>=', wert: 1, text: 'Jeder Auftrag wird ausgeliefert.' },
      { id: 'guete', metrik: 'guete', vergleich: '>=', wert: 0.77, text: 'Mindestgüte 77 Prozent.' },
      { id: 'beleg', metrik: 'belegquote', vergleich: '>=', wert: 0.92, text: 'Mindestens 92 Prozent Belegquote.' },
      {
        id: 'meister',
        metrik: 'flaeche',
        vergleich: '<=',
        wert: 2,
        text: 'Meisterstück: höchstens zwei Module im ganzen Werk.',
        optional: true,
      },
    ],
    saat: 421,
    vorbau: leeresFundament(),
    reflexion:
      'Der Notausgang hat sieben Prozent deiner Vorgänge ohne Beleg ausgeliefert. Wem in deinem Haus erklärst du, warum das die richtige Entscheidung war?',
    notiz:
      'Sprachnotiz, 23. April, 21:40. Ich habe einmal eine Nacht lang zugesehen, wie ein Werk sich selbst wiederholt hat. Achthundert Versuche, kein einziger Erfolg, und morgens war die Frist weg. Aufgeben hat einen schlechten Ruf. Zu Unrecht. Regel: Wer nicht aufhören kann, hat keinen Plan, sondern eine Gewohnheit.',
    referenzen: [
      {
        name: 'Sicherung und zwei REIHER',
        ansatz:
          'Der Breaker geht nach drei beobachteten Fehlern auf; danach zwei mittlere Aufrufe — wenige Module, kurze Latenz, hoher Preis.',
        werk: strasse([W('rechner'), WS('api', 'sicherung', 3), K('reiher'), K('reiher')]),
      },
      {
        name: 'Sicherung, zwei KOLIBRI und ein Gate',
        ansatz:
          'Derselbe Breaker, aber billig vorarbeiten und nur die Durchgefallenen nachbessern — mehr Module und ein Tick mehr, dafür ein Sechstel weniger Token je Auftrag.',
        werk: strasse([
          W('rechner'),
          WS('api', 'sicherung', 3),
          K('kolibri'),
          K('kolibri'),
          TOR(0.75, [K('reiher')]),
        ]),
      },
    ],
    antiMuster: [
      {
        name: 'Sechs Versuche',
        verlockung: 'Wenn zwei Wiederholungen die Belegquote gerettet haben, retten sechs sie erst recht.',
        scheitertAn: 'budget_latenz',
        werk: strasse([W('rechner'), WS('api', 'wiederholen', 6), K('reiher'), K('reiher')]),
      },
      {
        name: 'Die Sicherung reißt sofort',
        verlockung: 'Der Breaker hält den Takt. Je früher er aufgeht, desto besser die Latenz.',
        scheitertAn: 'belegquote',
        werk: strasse([W('rechner'), WS('api', 'sicherung', 1), K('reiher'), K('reiher')]),
      },
      {
        // Baugleich mit der ersten Referenzlösung aus IV-1. Genau daran zeigt
        // sich der Bruch: dieselbe Architektur, ein langsamerer Fremddienst.
        name: 'Die Straße von gestern',
        verlockung: 'Gestern hat diese Straße den Tokendeckel gehalten. Der Eingang ist derselbe geblieben.',
        scheitertAn: 'budget_latenz',
        werk: STRASSE_AUS_IV_1,
      },
      {
        name: 'Der volle Werkzeugkasten',
        verlockung: 'Wenn ein Register ausfällt, hängen wir eben vier weitere daneben. Anlage 12 verlangt sie ohnehin.',
        scheitertAn: 'budget_latenz',
        werk: strasse([
          W('rechner'),
          W('datenbank'),
          W('suche'),
          W('datenbank'),
          W('suche'),
          WS('api', 'wiederholen', 4),
          K('reiher'),
          K('reiher'),
        ]),
      },
    ],
    monolith: monolith(1),
  },

  // =========================================================================
  {
    id: 'IV-3',
    akt: 4,
    nummer: 3,
    titel: 'Die Frist',
    untertitel: 'Freitag, 16:00, Abgabe am Montag',
    briefing:
      'Am Freitag kommt alles über denselben Eingang: kurze Auskünfte, Abrechnungen und Vergabevermerke, belegpflichtig durchweg, ein gutes Drittel davon rechnerisch. Der Tokendeckel gilt für den ganzen Tag, nicht je Auftrag. Unterscheiden kannst du auf zwei Arten: vorher schätzen, was ein Vorgang kosten wird — das macht die Weiche —, oder hinterher messen, was herausgekommen ist — das macht die Schranke. Beide sparen dieselbe Summe auf verschiedenen Wegen. Die Sicherung brauchst du in jedem Fall. Wer alle Vorgänge gleich behandelt, reißt den Deckel; wer nichts nachbessert, verfehlt die Güte.',
    lernziel:
      'Vorher schätzen und hinterher messen sind zwei Wege zur selben Ersparnis, und beide brauchen einen Plan für den Ausfall.',
    quelle: QUELLE_DEGRADATION,
    module: ['kern', 'weiche', 'werkzeug', 'schranke', 'sicherung'],
    strom: {
      anzahl: 32,
      takt: 4,
      domaenen: ['recht', 'finanz', 'technik', 'text'],
      schwierigkeit: [0.1, 0.75],
      mehrdeutigkeit: [0.1, 0.35],
      anteilBelegpflichtig: 1,
      anteilRechnerisch: 0.4,
    },
    budget: { kosten: 15600, dauer: 600 },
    ziele: [
      { id: 'alles', metrik: 'durchsatz', vergleich: '>=', wert: 1, text: 'Jeder Auftrag wird ausgeliefert.' },
      { id: 'guete', metrik: 'guete', vergleich: '>=', wert: 0.75, text: 'Mindestgüte 75 Prozent.' },
      { id: 'beleg', metrik: 'belegquote', vergleich: '>=', wert: 0.95, text: 'Mindestens 95 Prozent Belegquote.' },
      {
        id: 'meister',
        metrik: 'kostenJeAuftrag',
        vergleich: '<=',
        wert: 420,
        text: 'Meisterstück: höchstens 420 Token je Auftrag.',
        optional: true,
      },
    ],
    saat: 431,
    vorbau: leeresFundament(),
    reflexion:
      'Du hast an drei Stellen entschieden, wann etwas gut genug ist. Welche dieser drei Schwellen würdest du deinem Kunden im Angebot offenlegen?',
    notiz:
      'Sprachnotiz, 26. April. Der Freitag war immer der ehrlichste Tag der Woche. Da zeigt sich, ob ein Werk gebaut wurde oder gewachsen ist. Gewachsene Werke behandeln alles gleich, weil niemand mehr weiß, warum es einmal anders war. Regel: Jede Schwelle in deinem Werk braucht einen Namen und einen Grund.',
    referenzen: [
      {
        name: 'Zwei Schranken in Reihe',
        ansatz:
          'Keine Weiche, dafür zwei gestaffelte Gates: erst billig nachbessern, dann teuer. Wenige Token, dafür acht Module und ein längerer Weg.',
        werk: strasse([
          W('rechner'),
          WS('api', 'wiederholen', 3),
          K('kolibri'),
          TOR(0.62, [K('kolibri')]),
          TOR(0.75, [K('reiher')]),
        ]),
      },
      {
        name: 'Weiche vorn, Gate im schweren Zweig',
        ansatz:
          'Die Weiche schätzt vorab und trennt die Bahnen; nur der schwere Zweig misst nach. Günstiger je Auftrag, aber langsamer und ein Modul mehr.',
        werk: verzweigt(
          [W('rechner'), WS('api', 'wiederholen', 3)],
          0.42,
          [K('kolibri'), K('kolibri')],
          [K('reiher'), TOR(0.8, [K('reiher')])]
        ),
      },
    ],
    antiMuster: [
      {
        name: 'Zwei Bahnen ohne Gate',
        verlockung: 'Die Weiche hat in Akt II jedes Kostenproblem gelöst. Eine Schranke braucht es dann nicht mehr.',
        scheitertAn: 'budget_kosten',
        werk: verzweigt(
          [W('rechner'), WS('api', 'wiederholen', 3)],
          0.42,
          [K('kolibri'), K('kolibri'), K('kolibri')],
          [K('reiher'), K('reiher')]
        ),
      },
      {
        name: 'Weiche und Gate ohne Sicherung',
        verlockung: 'Sortiert und nachgemessen ist doch alles abgesichert. Der Ausfall geht einfach weiter.',
        scheitertAn: 'belegquote',
        werk: verzweigt(
          [W('rechner'), W('api')],
          0.42,
          [K('kolibri'), K('kolibri'), TOR(0.72, [K('reiher')])],
          [K('reiher'), K('reiher')]
        ),
      },
      {
        name: 'Drei KOLIBRI für alle',
        verlockung: 'Freitag ist kein Tag für Feinheiten. Drei kleine Kerne, fertig, Wochenende.',
        scheitertAn: 'guete',
        werk: strasse([
          W('rechner'),
          WS('api', 'wiederholen', 3),
          K('kolibri'),
          K('kolibri'),
          K('kolibri'),
        ]),
      },
      {
        name: 'KONDOR für alles',
        verlockung: 'Vor einer Frist nimmt man das größte Modell. Das ist keine Verschwendung, das ist Vorsicht.',
        scheitertAn: 'budget_kosten',
        werk: strasse([W('rechner'), WS('api', 'wiederholen', 3), K('kondor')]),
      },
    ],
    monolith: monolith(3),
  },
];
