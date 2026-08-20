/**
 * NARRATIV-PRÜFUNG.
 *
 * Erzählung ist in SCHWARMWERK eine getestete Datenstruktur. Kein Text wird
 * im Renderer zusammengesetzt, und keine Autorenregel bleibt eine Absichts-
 * erklärung: Was in `agent_doc/game_one/belege/produktionsbibel.md`,
 * Abschnitt 8, als Direktive steht, steht hier als Assertion.
 *
 * Der Test ist bewusst streng an den Stellen, an denen Erzähltexte
 * erfahrungsgemäß verrutschen:
 *
 *   Länge          — jeder Slot hat ein Budget, sonst wächst er beim
 *                    Nachbessern immer nur.
 *   Stimme         — Verbotswörter und Pronomen halten die Figuren auseinander,
 *                    auch wenn Monate zwischen zwei Schreibsitzungen liegen.
 *   Lautstärke     — Ausrufezeichen und Emoji sind in einem Spiel für
 *                    Erwachsene eine Frage der Haltung, keine Geschmacksfrage.
 *   Lesbarkeit     — Flesch-Reading-Ease Deutsch als Band, nicht als Zielwert.
 *   Versprechen    — jede gestellte Frage hat eine hinterlegte Antwort und eine
 *                    Frist.
 *   Rechtschreibung— Umlaute werden geschrieben, nicht umschrieben.
 */

import { describe, expect, it } from 'vitest';
import { FIGUREN, figur, type Figur } from '../../src/narrativ/figuren';
import { AKT_TEXTE, aktText } from '../../src/narrativ/akt_texte';
import { FUNDSTUECKE } from '../../src/narrativ/fundstuecke';
import { RAETSEL, offeneRaetsel } from '../../src/narrativ/raetsel';

// ---------------------------------------------------------------------------
// Textsammlung
// ---------------------------------------------------------------------------

interface Stelle {
  readonly quelle: string;
  readonly text: string;
  /** Akt, dem die Stelle zugerechnet wird. 0 = aktunabhängig (Figuren). */
  readonly akt: number;
}

/** Alle Zeichenketten, die ein Mensch je zu Gesicht bekommt. */
function alleStellen(): Stelle[] {
  const s: Stelle[] = [];

  for (const f of FIGUREN) {
    s.push(
      { quelle: `figur.${f.id}.name`, text: f.name, akt: 0 },
      { quelle: `figur.${f.id}.kurz`, text: f.kurz, akt: 0 },
      { quelle: `figur.${f.id}.syntax`, text: f.syntax, akt: 0 },
      { quelle: `figur.${f.id}.verbot`, text: f.verbot, akt: 0 },
      { quelle: `figur.${f.id}.tick`, text: f.tick, akt: 0 },
      { quelle: `figur.${f.id}.stress`, text: f.stress, akt: 0 }
    );
    f.lexikon.forEach((w, i) => s.push({ quelle: `figur.${f.id}.lexikon[${i}]`, text: w, akt: 0 }));
  }

  for (const a of AKT_TEXTE) {
    s.push(
      { quelle: `akt${a.akt}.titel`, text: a.titel, akt: a.akt },
      { quelle: `akt${a.akt}.untertitel`, text: a.untertitel, akt: a.akt },
      { quelle: `akt${a.akt}.einstieg`, text: a.einstieg, akt: a.akt },
      { quelle: `akt${a.akt}.schlusssatz`, text: a.schlusssatz, akt: a.akt },
      { quelle: `akt${a.akt}.monolith`, text: a.monolith, akt: a.akt },
      { quelle: `akt${a.akt}.lehre`, text: a.lehre, akt: a.akt }
    );
  }

  for (const f of FUNDSTUECKE) {
    s.push(
      { quelle: `fund.${f.id}.titel`, text: f.titel, akt: f.akt },
      { quelle: `fund.${f.id}.text`, text: f.text, akt: f.akt },
      { quelle: `fund.${f.id}.vorher`, text: f.vorher, akt: f.akt },
      { quelle: `fund.${f.id}.nachher`, text: f.nachher, akt: f.akt }
    );
  }

  for (const r of RAETSEL) {
    s.push(
      { quelle: `raetsel.${r.id}.frage`, text: r.frage, akt: r.gestelltInAkt },
      { quelle: `raetsel.${r.id}.antwort`, text: r.antwort, akt: r.aufgeloestInAkt }
    );
  }

  return s;
}

const STELLEN = alleStellen();

/** Wörter einer Zeichenkette, Umlaute inbegriffen. */
function woerter(text: string): string[] {
  return text.match(/[A-Za-zÄÖÜäöüß]+/g) ?? [];
}

// ---------------------------------------------------------------------------
// Lesbarkeit: Flesch-Reading-Ease Deutsch
// ---------------------------------------------------------------------------

/**
 * Silbenzahl, angenähert über Vokalgruppen. Für Deutsch ist das die übliche
 * Näherung: Jede zusammenhängende Vokalfolge zählt als eine Silbe, jedes Wort
 * hat mindestens eine.
 */
export function silben(wort: string): number {
  const gruppen = wort.toLowerCase().match(/[aeiouäöüy]+/g);
  return gruppen === null ? 1 : Math.max(1, gruppen.length);
}

/** Flesch-Reading-Ease in der deutschen Fassung: 180 − ASL − 58.5 × ASW. */
export function flesch(text: string): number {
  const saetze = text
    .split(/[.!?]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
  const w = woerter(text);
  if (saetze.length === 0 || w.length === 0) return 0;
  const asl = w.length / saetze.length;
  const asw = w.reduce((summe, wort) => summe + silben(wort), 0) / w.length;
  return 180 - asl - 58.5 * asw;
}

// ---------------------------------------------------------------------------
// Anglizismen
// ---------------------------------------------------------------------------

/**
 * Erkennungsliste. Nur eindeutig englische Wortformen — Formen, die zugleich
 * deutsche Wörter sind ("will", "was", "war", "man", "hat"), stehen bewusst
 * NICHT darin, weil der Test sonst Rauschen misst statt Anglizismen.
 */
const ENGLISCHE_WORTFORMEN: readonly string[] = [
  // allgemeines Englisch
  'the', 'and', 'with', 'from', 'for', 'you', 'your', 'this', 'that', 'they',
  'have', 'has', 'been', 'are', 'were', 'not', 'but', 'because', 'about',
  'quick', 'win', 'wins', 'best', 'better', 'next', 'never', 'always',
  // Betriebs- und Beraterenglisch
  'meeting', 'meetings', 'deadline', 'deadlines', 'stakeholder', 'stakeholders',
  'alignment', 'mindset', 'roadmap', 'commitment', 'workload', 'workshop',
  'feedback', 'onboarding', 'briefing', 'update', 'updates', 'review', 'reviews',
  'team', 'teams', 'call', 'calls', 'task', 'tasks', 'issue', 'issues',
  'feature', 'features', 'scope', 'timeline', 'follow', 'up', 'asap',
  // Technikenglisch
  'agent', 'agents', 'prompt', 'prompts', 'token', 'tokens', 'router', 'routing',
  'gate', 'gates', 'tracing', 'trace', 'traces', 'guardrail', 'guardrails',
  'pipeline', 'pipelines', 'cache', 'caching', 'batch', 'batching', 'chain',
  'framework', 'deployment', 'cloud', 'service', 'services', 'provider',
  'output', 'input', 'tool', 'tools', 'score', 'scoring', 'benchmark',
  'orchestration', 'evaluator', 'observability', 'retry', 'fallback',
];

/**
 * Zulässige Fachbegriffe. Nur was hier steht, darf in einem Spieltext
 * englisch bleiben. Die Liste ist absichtlich kurz: Für fast alles gibt es
 * ein deutsches Wort, und das Spiel benutzt es (Weiche statt Router, Schranke
 * statt Gate, Wall statt Guardrail, Auge statt Tracing, Werk statt Pipeline).
 */
const ZULAESSIGE_FACHBEGRIFFE: readonly string[] = [
  'agent', 'agents',       // Fachbegriff ohne brauchbare Eindeutschung
  'prompt', 'prompts',     // desgleichen
  'token', 'tokens',       // Abrechnungseinheit, steht so auf der Rechnung
  'router', 'gate', 'tracing', 'guardrail', 'pipeline', 'cache', 'batch',
  'workload',              // Nuri Özdemirs Tick: genau ein englisches Wort je
                           // Nachricht, immer mit Entschuldigung nachgereicht
];

// ---------------------------------------------------------------------------
// Umlaut-Prüfung über eine gepflegte Wortliste
// ---------------------------------------------------------------------------

/**
 * WORTLISTE 1 — verbotene ASCII-Umschreibungen.
 *
 * Eine blinde Zeichensuche nach "ae", "oe", "ue" oder "ss" ist als Prüfung
 * unbrauchbar: "Mauer", "grauer", "dauert", "teuer" und "quer" enthalten alle
 * ein "ue", und "dass", "lassen", "Prozess", "Ausschuss" enthalten alle ein
 * regelgerechtes "ss". Ein Test, der dort anschlägt, wird nach drei Tagen
 * abgeschaltet und schützt danach gar nichts mehr.
 *
 * Deshalb arbeitet die Prüfung mit einer gepflegten Wortliste. Die Einträge
 * sind Wortstämme, weil deutsche Komposita unbegrenzt sind und eine Liste
 * vollständiger Wortformen nie hinterherkäme. Jeder Eintrag ist einzeln
 * geprüft: Es gibt kein gebräuchliches deutsches Wort, das ihn als Teilfolge
 * enthält — die Liste erzeugt also keine falschen Treffer.
 */
const UMSCHRIEBENE_STAEMME: readonly string[] = [
  // "ue" statt "ü"
  'ueber', 'fuer', 'muess', 'koenn', 'duerf', 'wuerd', 'zurueck', 'gruen',
  'kuend', 'kuerz', 'pruef', 'fuehr', 'stueck', 'kuehl', 'gueltig', 'guete',
  'schluess', 'bueh', 'buero', 'huel', 'stuerz', 'ruecken', 'wuensch',
  // "ae" statt "ä"
  'naechst', 'waehr', 'waehl', 'aend', 'spaet', 'erklaer', 'laess', 'faell',
  'haelt', 'traeg', 'staend', 'staerk', 'flaech', 'laeng', 'auftraeg',
  'ausgaeng', 'eingaeng', 'gemaess', 'zulaess', 'vollstaend', 'zusaetz',
  'abhaeng', 'tatsaech', 'qualitaet', 'raetsel', 'aeuss', 'saetze', 'daemm',
  // "oe" statt "ö"
  'moeg', 'loes', 'hoeh', 'hoech', 'behoerd', 'oeffent', 'foerder', 'stoer',
  'groess', 'schoen', 'zoeger', 'hoeflich',
  // "ss" statt "ß"
  'gross', 'schliess', 'ausser', 'aussen', 'heisst', 'weiss', 'strass',
  'verstoss', 'masstab', 'massnahm', 'fliess', 'geniess', 'reiss', 'stoss',
];

/**
 * WORTLISTE 2 — echte deutsche Wörter mit "ae" oder "oe".
 *
 * Diese beiden Buchstabenfolgen sind im Deutschen so selten echt, dass die
 * Prüfung sie umgekehrt führen kann: Jedes Wort, das sie enthält, muss hier
 * stehen. Für "ue" und "ss" geht das nicht (siehe oben), dort trägt allein
 * Wortliste 1. Der Liste fehlt bislang nichts, weil in den Spieltexten kein
 * einziges Wort mit "ae" oder "oe" vorkommt — sie steht als Netz für alles,
 * was später dazugeschrieben wird.
 */
const ECHTE_WOERTER_MIT_AE_OE: readonly string[] = [
  'aerosol', 'aerodynamik', 'israel', 'michael', 'poesie', 'poet',
  'koexistenz', 'koeffizient', 'aloe', 'oeuvre',
  // Eigenname: das erfundene Fachverfahren des LAVV, seit 1998 in Betrieb und
  // in Großbuchstaben ohne Umlaut geschrieben, weil es 1998 nicht anders ging.
  'troet',
];

const AE_ODER_OE = /(ae|oe)/;

// ---------------------------------------------------------------------------
// Anrede
// ---------------------------------------------------------------------------

const DU_FORM = /\b(du|dir|dich|dein|deine|deinen|deinem|deiner|deines)\b/i;

/**
 * Höflichkeitsform. Ein bloßes großgeschriebenes "Sie" reicht als Nachweis
 * NICHT: Am Satzanfang ist es im Deutschen meistens die dritte Person ("Sie
 * antwortet zwar, aber zu langsam"). Deshalb zählt "Sie" nur zusammen mit
 * einer Verbform, die es eindeutig zur Anrede macht — die Possessivformen
 * dagegen zählen für sich.
 */
const HOEFLICHKEITSFORM =
  /\b(Ihnen|Ihre|Ihren|Ihrem|Ihrer|Ihres)\b|\bSie\s+(haben|sind|können|müssen|sollten|werden|finden|sehen|erhalten|bekommen|wissen|dürfen|erfahren|züchten)\b/;

/** Für MONOLITH gilt die harte Fassung: jede Großschreibung ist Anrede. */
const HOEFLICHKEITSFORM_HART = /\b(Sie|Ihnen|Ihre|Ihren|Ihrem|Ihrer|Ihres)\b/;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Narrativ — Umfang und Sammlung', () => {
  it('sammelt genügend Text ein, um überhaupt etwas zu prüfen', () => {
    expect(STELLEN.length).toBeGreaterThan(250);
    const gesamt = STELLEN.reduce((s, st) => s + woerter(st.text).length, 0);
    expect(gesamt).toBeGreaterThan(2500);
  });

  it('hat keine leere Stelle', () => {
    for (const st of STELLEN) {
      expect(st.text.trim().length, `${st.quelle} ist leer`).toBeGreaterThan(0);
    }
  });
});

describe('Akt-Texte — Zeichenbudgets und Vollständigkeit', () => {
  it('hat genau zwölf Akte, lückenlos von 1 bis 12', () => {
    expect(AKT_TEXTE.length).toBe(12);
    expect(AKT_TEXTE.map((a) => a.akt)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it('liefert jeden Akt über aktText() und wirft sonst', () => {
    for (const a of AKT_TEXTE) expect(aktText(a.akt).titel).toBe(a.titel);
    expect(() => aktText(13)).toThrow();
  });

  it('hält den Einstieg zwischen 300 und 650 Zeichen', () => {
    for (const a of AKT_TEXTE) {
      expect(a.einstieg.length, `Akt ${a.akt}: ${a.einstieg.length} Zeichen`).toBeGreaterThanOrEqual(300);
      expect(a.einstieg.length, `Akt ${a.akt}: ${a.einstieg.length} Zeichen`).toBeLessThanOrEqual(650);
    }
  });

  it('hält den Schlusssatz unter 160 Zeichen und das Angebot unter 220', () => {
    for (const a of AKT_TEXTE) {
      expect(a.schlusssatz.length, `Akt ${a.akt} Schlusssatz`).toBeLessThanOrEqual(160);
      expect(a.monolith.length, `Akt ${a.akt} MONOLITH`).toBeLessThanOrEqual(220);
    }
  });

  it('formuliert Titel, Untertitel und Lehre knapp und eindeutig', () => {
    const titel = new Set<string>();
    for (const a of AKT_TEXTE) {
      expect(a.titel.length, `Akt ${a.akt} Titel`).toBeLessThanOrEqual(40);
      expect(a.untertitel.length, `Akt ${a.akt} Untertitel`).toBeLessThanOrEqual(60);
      expect(a.lehre.length, `Akt ${a.akt} Lehre`).toBeLessThanOrEqual(140);
      // Die Lehre ist EIN Satz.
      expect(a.lehre.split(/[.!?]/).filter((t) => t.trim().length > 0).length, `Akt ${a.akt} Lehre`).toBe(1);
      titel.add(a.titel);
    }
    expect(titel.size, 'Akttitel wiederholen sich').toBe(12);
  });

  it('spricht die Spielerin im Einstieg durchgehend mit Du an', () => {
    for (const a of AKT_TEXTE) {
      expect(DU_FORM.test(a.einstieg), `Akt ${a.akt} Einstieg ohne Du-Anrede`).toBe(true);
      expect(HOEFLICHKEITSFORM.test(a.einstieg), `Akt ${a.akt} Einstieg siezt`).toBe(false);
    }
  });
});

describe('Figuren — der Idiolekt-Baukasten', () => {
  it('führt jede Figur mit allen fünf Pflichtfeldern', () => {
    expect(FIGUREN.length).toBeGreaterThanOrEqual(8);
    for (const f of FIGUREN) {
      expect(f.lexikon.length, `${f.id} braucht genau fünf Lexikonwörter`).toBe(5);
      expect(f.verbot.trim().length, `${f.id} ohne Verbotswort`).toBeGreaterThan(2);
      expect(f.tick.trim().length, `${f.id} ohne Tick`).toBeGreaterThan(10);
      expect(f.stress.trim().length, `${f.id} ohne Stress-Angabe`).toBeGreaterThan(10);
      expect(f.syntax.trim().length, `${f.id} ohne Syntax-Angabe`).toBeGreaterThan(20);
      expect(f.kurz.trim().length, `${f.id} ohne Kurzbeschreibung`).toBeGreaterThan(20);
    }
  });

  it('vergibt Ids und Namen eindeutig und liefert sie über figur()', () => {
    expect(new Set(FIGUREN.map((f) => f.id)).size).toBe(FIGUREN.length);
    expect(new Set(FIGUREN.map((f) => f.name)).size).toBe(FIGUREN.length);
    for (const f of FIGUREN) expect(figur(f.id)).toBe(f);
    expect(() => figur('gibt-es-nicht')).toThrow();
  });

  it('hält die Lexikonwörter exklusiv — kein Wort gehört zwei Figuren', () => {
    const gesehen = new Map<string, string>();
    for (const f of FIGUREN) {
      for (const w of f.lexikon) {
        const schluessel = w.toLowerCase();
        const besitzer = gesehen.get(schluessel);
        expect(besitzer, `"${w}" gehört ${besitzer ?? '?'} und ${f.id}`).toBeUndefined();
        gesehen.set(schluessel, f.id);
      }
    }
  });

  it('lässt keine Figur mit dem Wortschatz einer anderen sprechen', () => {
    for (const f of FIGUREN) {
      const fremd = eigeneTexte(f).join(' ').toLowerCase();
      for (const andere of FIGUREN) {
        if (andere.id === f.id) continue;
        for (const w of andere.lexikon) {
          const treffer = new RegExp(`\\b${w.toLowerCase()}\\b`).test(fremd);
          expect(treffer, `${f.id} benutzt "${w}" aus dem Lexikon von ${andere.id}`).toBe(false);
        }
      }
    }
  });

  it('hält jedes Verbotswort in allen Texten der Figur durch', () => {
    for (const f of FIGUREN) {
      const muster = new RegExp(`\\b${f.verbot.toLowerCase()}\\b`, 'i');
      for (const t of eigeneTexte(f)) {
        expect(muster.test(t), `${f.id} sagt sein Verbotswort "${f.verbot}": "${t}"`).toBe(false);
      }
    }
  });
});

/**
 * Alle Texte, die einer Figur zuzurechnen sind. Für MONOLITH gehören dazu
 * ausdrücklich die zwölf Angebote aus den Akt-Texten — sonst ginge die
 * Verbots- und Pronomenprüfung an seiner einzigen echten Sprechrolle vorbei.
 */
function eigeneTexte(f: Figur): string[] {
  const t = [f.kurz, f.syntax, f.tick, f.stress, ...f.lexikon];
  if (f.id === 'monolith') t.push(...AKT_TEXTE.map((a) => a.monolith));
  return t;
}

describe('MONOLITH — der Pronomenwechsel als Dramaturgie', () => {
  const duForm = /\b(du|dir|dich|dein|deine|deinen|deinem|deiner|deines)\b/i;
  const siezen = /\b(Sie|Ihre|Ihren|Ihrem|Ihrer|Ihres|Ihnen)\b/;

  it('duzt in den Akten I bis VIII und siezt dort nie', () => {
    for (const a of AKT_TEXTE.filter((x) => x.akt <= 8)) {
      expect(siezen.test(a.monolith), `Akt ${a.akt}: MONOLITH siezt zu früh — "${a.monolith}"`).toBe(false);
      expect(duForm.test(a.monolith), `Akt ${a.akt}: MONOLITH duzt nicht`).toBe(true);
    }
  });

  it('siezt ab Akt IX und duzt dort nie mehr', () => {
    for (const a of AKT_TEXTE.filter((x) => x.akt >= 9)) {
      expect(duForm.test(a.monolith), `Akt ${a.akt}: MONOLITH duzt noch — "${a.monolith}"`).toBe(false);
      expect(siezen.test(a.monolith), `Akt ${a.akt}: MONOLITH siezt nicht`).toBe(true);
    }
  });

  it('stellt niemals eine Frage', () => {
    for (const a of AKT_TEXTE) {
      expect(a.monolith.includes('?'), `Akt ${a.akt}: MONOLITH fragt`).toBe(false);
    }
  });

  it('beginnt jedes Angebot mit einer Zeitersparnis', () => {
    for (const a of AKT_TEXTE) {
      expect(a.monolith.startsWith('Das spart'), `Akt ${a.akt}: kein Ersparnis-Auftakt`).toBe(true);
    }
  });
});

describe('Lautstärke — Ausrufezeichen und Emoji', () => {
  const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{1F000}-\u{1F2FF}]/u;

  it('setzt höchstens ein Ausrufezeichen je Akt', () => {
    for (let akt = 1; akt <= 12; akt++) {
      const anzahl = STELLEN.filter((s) => s.akt === akt).reduce(
        (summe, s) => summe + (s.text.match(/!/g) ?? []).length,
        0
      );
      expect(anzahl, `Akt ${akt} hat ${anzahl} Ausrufezeichen`).toBeLessThanOrEqual(1);
    }
  });

  it('häuft Ausrufezeichen nirgends', () => {
    for (const s of STELLEN) {
      expect(s.text.includes('!!'), `${s.quelle} häuft Ausrufezeichen`).toBe(false);
    }
  });

  it('benutzt kein Emoji', () => {
    for (const s of STELLEN) {
      expect(emoji.test(s.text), `${s.quelle} enthält ein Emoji`).toBe(false);
    }
  });
});

describe('Sprache — Anglizismenanteil', () => {
  const erkennung = new Set(ENGLISCHE_WORTFORMEN);
  const erlaubt = new Set(ZULAESSIGE_FACHBEGRIFFE);

  it('benutzt kein englisches Wort außerhalb der Fachbegriffsliste', () => {
    const verstoesse: string[] = [];
    for (const s of STELLEN) {
      for (const w of woerter(s.text)) {
        const klein = w.toLowerCase();
        if (erkennung.has(klein) && !erlaubt.has(klein)) verstoesse.push(`${s.quelle}: "${w}"`);
      }
    }
    expect(verstoesse, `Nicht zugelassene Anglizismen:\n  ${verstoesse.slice(0, 20).join('\n  ')}`).toEqual([]);
  });

  it('hält den Anglizismenanteil unter acht Prozent', () => {
    let gesamt = 0;
    let englisch = 0;
    for (const s of STELLEN) {
      for (const w of woerter(s.text)) {
        gesamt++;
        if (erkennung.has(w.toLowerCase())) englisch++;
      }
    }
    const anteil = englisch / gesamt;
    expect(anteil, `Anglizismenanteil ${(anteil * 100).toFixed(2)} Prozent`).toBeLessThan(0.08);
  });
});

describe('Lesbarkeit — Flesch-Reading-Ease Deutsch', () => {
  it('rechnet die Näherung nachvollziehbar', () => {
    expect(silben('Halle')).toBe(2);
    expect(silben('Auftragseingang')).toBe(4);
    expect(silben('und')).toBe(1);
    // Fünf einsilbige Wörter, ein Satz: 180 − 5 − 58.5 × 1 = 116.5
    expect(flesch('Der Mann geht ins Werk.')).toBeCloseTo(116.5, 5);
  });

  it('hält jeden Einstiegstext im Band 30 bis 65', () => {
    for (const a of AKT_TEXTE) {
      const wert = flesch(a.einstieg);
      expect(wert, `Akt ${a.akt}: Flesch ${wert.toFixed(1)}`).toBeGreaterThanOrEqual(30);
      expect(wert, `Akt ${a.akt}: Flesch ${wert.toFixed(1)}`).toBeLessThanOrEqual(65);
    }
  });
});

describe('Fundstücke — Umgebungserzählung mit Vorher und Nachher', () => {
  it('liegen mindestens vierzig Stücke in der Halle', () => {
    expect(FUNDSTUECKE.length).toBeGreaterThanOrEqual(40);
  });

  it('vergibt jede Id genau einmal', () => {
    expect(new Set(FUNDSTUECKE.map((f) => f.id)).size).toBe(FUNDSTUECKE.length);
  });

  it('gibt jedem Akt mindestens zwei Fundstücke', () => {
    for (let akt = 1; akt <= 12; akt++) {
      const anzahl = FUNDSTUECKE.filter((f) => f.akt === akt).length;
      expect(anzahl, `Akt ${akt} hat nur ${anzahl} Fundstücke`).toBeGreaterThanOrEqual(2);
    }
  });

  it('hält jeden Text zwischen 60 und 500 Zeichen', () => {
    for (const f of FUNDSTUECKE) {
      expect(f.text.length, `${f.id}: ${f.text.length} Zeichen`).toBeGreaterThanOrEqual(60);
      expect(f.text.length, `${f.id}: ${f.text.length} Zeichen`).toBeLessThanOrEqual(500);
      expect(f.titel.length, `${f.id} Titel`).toBeLessThanOrEqual(60);
    }
  });

  it('erzählt zu jedem Stück ein Vorher und ein Nachher — sonst ist es Dekoration', () => {
    for (const f of FUNDSTUECKE) {
      expect(f.vorher.length, `${f.id} ohne Vorher`).toBeGreaterThan(20);
      expect(f.nachher.length, `${f.id} ohne Nachher`).toBeGreaterThan(20);
      expect(f.vorher, `${f.id}: Vorher gleich Nachher`).not.toBe(f.nachher);
    }
  });

  it('ordnet jedes Stück einem gültigen Akt und einer bekannten Art zu', () => {
    const arten = new Set(['becher', 'aktenstapel', 'rollwagen', 'schild', 'kabelrolle', 'stuhl']);
    for (const f of FUNDSTUECKE) {
      expect(f.akt, `${f.id}`).toBeGreaterThanOrEqual(1);
      expect(f.akt, `${f.id}`).toBeLessThanOrEqual(12);
      expect(arten.has(f.art), `${f.id} mit unbekannter Art`).toBe(true);
    }
  });

  it('nutzt alle sechs Arten, damit die Halle nicht aus einem Requisit besteht', () => {
    expect(new Set(FUNDSTUECKE.map((f) => f.art)).size).toBe(6);
  });
});

describe('Rätsel — jedes Versprechen hat eine Frist und eine Antwort', () => {
  it('vergibt jede Id genau einmal', () => {
    expect(new Set(RAETSEL.map((r) => r.id)).size).toBe(RAETSEL.length);
  });

  it('hinterlegt die Antwort bereits beim Stellen und macht sie belastbar', () => {
    for (const r of RAETSEL) {
      expect(r.antwort.length, `${r.id}: Antwort zu kurz`).toBeGreaterThan(40);
      expect(r.frage.trim().endsWith('?'), `${r.id}: Frage ohne Fragezeichen`).toBe(true);
    }
  });

  it('löst jedes Rätsel spätestens drei Akte nach dem Stellen auf', () => {
    for (const r of RAETSEL) {
      expect(r.aufgeloestInAkt, `${r.id} wird vor dem Stellen aufgelöst`).toBeGreaterThan(r.gestelltInAkt);
      expect(
        r.aufgeloestInAkt - r.gestelltInAkt,
        `${r.id} bleibt ${r.aufgeloestInAkt - r.gestelltInAkt} Akte offen`
      ).toBeLessThanOrEqual(3);
      expect(r.aufgeloestInAkt, `${r.id} löst hinter dem letzten Akt auf`).toBeLessThanOrEqual(12);
    }
  });

  it('lässt nie mehr als drei Rätsel gleichzeitig offen', () => {
    for (let akt = 1; akt <= 12; akt++) {
      const offen = offeneRaetsel(akt);
      expect(
        offen.length,
        `Akt ${akt} hat ${offen.length} offene Rätsel: ${offen.map((r) => r.id).join(', ')}`
      ).toBeLessThanOrEqual(3);
    }
  });

  it('trägt die Kette des Haupträtsels von Akt I bis Akt VIII', () => {
    const kette = ['initialen_kr', 'monolith_alter', 'rauhut_abgang', 'monolith_stimme'];
    const glieder = kette.map((id) => {
      const r = RAETSEL.find((x) => x.id === id);
      expect(r, `Glied ${id} des Haupträtsels fehlt`).toBeDefined();
      return r as (typeof RAETSEL)[number];
    });
    expect(glieder[0]?.gestelltInAkt).toBe(1);
    expect(glieder[glieder.length - 1]?.aufgeloestInAkt).toBe(8);
    // Lückenlos: Das nächste Glied wird gestellt, bevor das vorige fällt.
    for (let i = 1; i < glieder.length; i++) {
      const vorher = glieder[i - 1];
      const jetzt = glieder[i];
      if (vorher === undefined || jetzt === undefined) continue;
      expect(jetzt.gestelltInAkt, `Lücke vor ${jetzt.id}`).toBeLessThanOrEqual(vorher.aufgeloestInAkt);
    }
  });

  it('endet mit einem aufgeräumten Register — in Akt XII ist nichts mehr offen', () => {
    expect(offeneRaetsel(12).length).toBe(0);
  });
});

describe('Rechtschreibung — Umlaute werden geschrieben, nicht umschrieben', () => {
  const erlaubtAeOe = new Set(ECHTE_WOERTER_MIT_AE_OE);

  it('benutzt keine der umschriebenen Wortformen aus der Wortliste', () => {
    const verstoesse: string[] = [];
    for (const s of STELLEN) {
      const klein = s.text.toLowerCase();
      for (const stamm of UMSCHRIEBENE_STAEMME) {
        const stelle = klein.indexOf(stamm);
        if (stelle < 0) continue;
        const umfeld = s.text.slice(Math.max(0, stelle - 14), stelle + stamm.length + 14);
        verstoesse.push(`${s.quelle} ("${stamm}"): …${umfeld}…`);
      }
    }
    expect(
      verstoesse,
      `Ersatzschreibung statt Umlaut:\n  ${verstoesse.slice(0, 30).join('\n  ')}`
    ).toEqual([]);
  });

  it('kennt kein Wort mit "ae" oder "oe" außerhalb der Ausnahmeliste', () => {
    const verstoesse: string[] = [];
    for (const s of STELLEN) {
      for (const w of woerter(s.text)) {
        const klein = w.toLowerCase();
        if (!AE_ODER_OE.test(klein)) continue;
        if (erlaubtAeOe.has(klein)) continue;
        verstoesse.push(`${s.quelle}: "${w}"`);
      }
    }
    expect(verstoesse, `Unerlaubtes "ae"/"oe":\n  ${verstoesse.slice(0, 30).join('\n  ')}`).toEqual([]);
  });

  it('schlägt bei echten Umschreibungen tatsächlich an', () => {
    // Positivkontrolle: Ohne sie wäre ein leerer Treffersatz kein Beweis.
    const probe = 'Ich muesste ueber die Strasse gehen, die naechste Loesung waere zu gross.';
    const treffer = UMSCHRIEBENE_STAEMME.filter((stamm) => probe.toLowerCase().includes(stamm));
    expect(treffer).toContain('muess');
    expect(treffer).toContain('ueber');
    expect(treffer).toContain('strass');
    expect(treffer).toContain('gross');
    expect(treffer).toContain('naechst');
    expect(treffer).toContain('loes');
  });

  it('hält beide Wortlisten sauber und frei von Dubletten', () => {
    expect(new Set(UMSCHRIEBENE_STAEMME).size).toBe(UMSCHRIEBENE_STAEMME.length);
    expect(new Set(ECHTE_WOERTER_MIT_AE_OE).size).toBe(ECHTE_WOERTER_MIT_AE_OE.length);
    for (const w of UMSCHRIEBENE_STAEMME) {
      expect(w, `"${w}" ist keine Umschreibung`).toMatch(/(ae|oe|ue|ss)/);
      expect(w, `"${w}" ist nicht kleingeschrieben`).toBe(w.toLowerCase());
    }
    for (const w of ECHTE_WOERTER_MIT_AE_OE) {
      expect(w, `"${w}" gehört nicht in diese Ausnahmeliste`).toMatch(AE_ODER_OE);
      expect(w, `"${w}" ist nicht kleingeschrieben`).toBe(w.toLowerCase());
    }
  });
});
