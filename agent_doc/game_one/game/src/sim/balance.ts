/**
 * Balance-Konstanten der SCHWARMWERK-Simulation.
 *
 * Alle Zahlen sind an realen Groessenordnungen des Agentic Engineering
 * orientiert (Stand 2026) und in `agent_doc/game_one/konzept/simulations_modell.md`
 * begruendet. Sie sind bewusst an EINER Stelle gebuendelt: Balance ist eine
 * Design-Entscheidung, kein verstreuter Magic Number.
 *
 * Leitprinzip: Jede Zahl muss eine echte Lektion tragen. Wenn eine Konstante
 * kein Trade-off erzeugt, gehoert sie nicht ins Spiel.
 */

import type { KernGroesse, WerkzeugArt } from './typen';

/** Kern-Kennwerte. Kostenverhaeltnis 1 : 4 : 16 spiegelt reale Modell-Preisstufen. */
export const KERN: Record<
  KernGroesse,
  {
    /** Token je Aufruf bei leerem Kontext. */
    kosten: number;
    /** Bearbeitungsdauer in Ticks. */
    dauer: number;
    /** Bis zu welcher Auftragsschwierigkeit der Kern souveraen ist. */
    kompetenz: number;
    /** Obergrenze der erreichbaren Guete, selbst bei trivialen Auftraegen. */
    basisDeckel: number;
    /** Anteil der Luecke zur Decke, den ein Aufruf schliesst. */
    wirkung: number;
    /** Kontextlast, die ein Aufruf hinterlaesst. */
    kontextLast: number;
    /** Anfaelligkeit fuer eingeschleuste Anweisungen (1 = voellig naiv). */
    anfaelligkeit: number;
    /** Streuung der Ergebnisguete. */
    streuung: number;
    /** Anzeigename im Spiel. */
    name: string;
  }
> = {
  kolibri: {
    kosten: 40,
    dauer: 1,
    kompetenz: 0.35,
    basisDeckel: 0.8,
    wirkung: 0.55,
    kontextLast: 0.06,
    anfaelligkeit: 0.9,
    streuung: 0.07,
    name: 'KOLIBRI',
  },
  reiher: {
    kosten: 160,
    dauer: 2,
    kompetenz: 0.62,
    basisDeckel: 0.92,
    wirkung: 0.7,
    kontextLast: 0.1,
    anfaelligkeit: 0.75,
    streuung: 0.05,
    name: 'REIHER',
  },
  kondor: {
    kosten: 640,
    dauer: 4,
    kompetenz: 0.9,
    basisDeckel: 0.99,
    wirkung: 0.8,
    kontextLast: 0.16,
    anfaelligkeit: 0.6,
    streuung: 0.035,
    name: 'KONDOR',
  },
};

/** Wie stark die Kompetenzluecke die Guete-Decke druckt. */
export const KOMPETENZ_STEILHEIT = 1.6;

/** Spezialisierung: Bonus bei passender Domaene, Malus bei unpassender. */
export const SPEZIALISIERUNG_BONUS = 0.09;
export const SPEZIALISIERUNG_MALUS = 0.05;

/**
 * Context Rot. Unterhalb von KONTEXT_SCHWELLE gibt es keinen Verlust, danach
 * faellt die Wirkung eines Aufrufs stark ab. Das ist die zentrale Lektion des
 * Context Engineering: Kontext ist kein Vorrat, sondern ein Budget.
 */
export const KONTEXT_SCHWELLE = 0.45;
export const KONTEXT_ROT_MAX = 0.85;
export const KONTEXT_ROT_EXPONENT = 1.5;

/** Ab dieser Kontextlast steigt die Halluzinationsneigung spuerbar. */
export const HALLUZINATION_BASIS = 0.03;
export const HALLUZINATION_KONTEXT = 0.22;
export const HALLUZINATION_UNSICHERHEIT = 0.18;
export const HALLUZINATION_SCHADEN = 0.28;

/**
 * Kontext wird bei jedem Aufruf mitbezahlt. Bei voller Kontextlast kostet ein
 * Aufruf das Dreifache. Deshalb sind lange Ketten ueberproportional teuer.
 */
export const KONTEXT_KOSTEN_FAKTOR = 2.0;

/** Auftraege mit Belegpflicht bleiben ohne Werkzeug unter dieser Guete-Decke. */
export const DECKEL_OHNE_BELEG = 0.55;
/** Rechnerische Auftraege ohne deterministisches Werkzeug. */
export const DECKEL_OHNE_RECHNER = 0.6;

export const WERKZEUG: Record<
  WerkzeugArt,
  {
    kosten: number;
    dauer: number;
    ausfallrate: number;
    kontextLast: number;
    /** Wie stark die Unsicherheit sinkt. */
    klaerung: number;
    name: string;
    beschreibung: string;
  }
> = {
  suche: {
    kosten: 60,
    dauer: 2,
    ausfallrate: 0.06,
    kontextLast: 0.14,
    klaerung: 0.6,
    name: 'RECHERCHE',
    beschreibung: 'Retrieval ueber den Wissensbestand. Belegt Aussagen.',
  },
  datenbank: {
    kosten: 30,
    dauer: 1,
    ausfallrate: 0.04,
    kontextLast: 0.08,
    klaerung: 0.45,
    name: 'BESTAND',
    beschreibung: 'Fachdatenbank des Kunden. Schnell, eng, verlaesslich.',
  },
  rechner: {
    kosten: 5,
    dauer: 1,
    ausfallrate: 0.01,
    kontextLast: 0.03,
    klaerung: 0.35,
    name: 'RECHENWERK',
    beschreibung: 'Deterministische Berechnung. Schlaegt jedes Modell bei Zahlen.',
  },
  api: {
    kosten: 20,
    dauer: 3,
    ausfallrate: 0.18,
    kontextLast: 0.06,
    klaerung: 0.3,
    name: 'FREMDDIENST',
    beschreibung: 'Externe Schnittstelle. Faellt regelmaessig aus.',
  },
};

/** Guardrails. Keiner allein genuegt — Defense in Depth ist Pflicht. */
export const WALL = {
  /** Wahrscheinlichkeit, dass ein Eingangsfilter die Einschleusung neutralisiert. */
  eingangWirkung: 0.92,
  /** Wahrscheinlichkeit, dass ein Ausgangsfilter ein kompromittiertes Paket faengt. */
  ausgangWirkung: 0.85,
  /** Falsch-Positiv-Rate: der Filter verwirft harmlose Auftraege. */
  fehlalarm: 0.03,
  kosten: 12,
  dauer: 1,
};

export const SCHRANKE = { kosten: 2, dauer: 1 };
export const WEICHE = { kosten: 15, dauer: 1, fehlleitung: 0.5 };
export const VERTEILER = { kosten: 0, dauer: 0 };
export const SAMMLER = {
  voting: { kosten: 20, dauer: 1 },
  bester: { kosten: 20, dauer: 1 },
  verschmelzen: { kosten: 80, dauer: 2 },
};
export const PRUEFER = {
  kosten: 90,
  dauer: 2,
  /** Der Evaluator irrt sich — deshalb sind sehr hohe Schwellen eine Falle. */
  rauschen: 0.06,
};
export const SPEICHER = {
  komprimieren: { kosten: 25, dauer: 1, kontextFaktor: 0.35, gueteVerlust: 0.03 },
  abrufen: { kosten: 40, dauer: 2, kontextLast: 0.1, klaerung: 0.3, deckelBonus: 0.06 },
  isolieren: { kosten: 10, dauer: 1, kontextDeckel: 0.15, unsicherheitZuschlag: 0.1 },
};
export const SICHERUNG = { kosten: 3, dauer: 1 };
export const HAND = {
  /** Menschen sind langsam. Genau das ist die Lektion. */
  dauer: 24,
  kosten: 0,
  /** Menschen uebersehen selten, aber nicht nie. */
  fehlerrate: 0.02,
  /** Ein Mensch bessert die Guete nach. */
  gueteBonus: 0.06,
};
export const AUGE = { kosten: 1, dauer: 0 };
export const QUELLE = { kosten: 0, dauer: 0 };
export const SENKE = { kosten: 0, dauer: 0 };
export const SCHMIEDE = { kosten: 0, dauer: 0 };

/** Harte Grenzen, damit ein fehlerhaftes Werk die Simulation nicht sprengt. */
export const GRENZEN = {
  /** Maximale Besuche eines Moduls durch ein Paket (Endlosschleifen-Bremse). */
  maxBesuche: 24,
  /** Maximale Ticks eines Laufs. */
  maxTicks: 4000,
  /** Maximale gleichzeitige Pakete. */
  maxPakete: 4000,
  /** Maximale Gesamtkosten, bevor der Lauf als Kostenexplosion abbricht. */
  maxKosten: 5_000_000,
};

/** Umrechnung Token → Euro fuer die HUD-Anzeige (Mischpreis, gerundet). */
export const EURO_JE_MILLION_TOKEN = 6.0;

export function tokenZuEuro(token: number): number {
  return (token / 1_000_000) * EURO_JE_MILLION_TOKEN;
}
