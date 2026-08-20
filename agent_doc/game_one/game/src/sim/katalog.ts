/**
 * Modul-Katalog: Ports, Standardparameter, Beschreibungen.
 *
 * Der Katalog ist die einzige Quelle der Wahrheit darüber, welche Anschlüsse
 * ein Modul hat. Sowohl die Simulation als auch der 3D-Editor und die
 * Graph-Validierung lesen von hier — damit kann der Editor keine Leitung
 * erlauben, die die Simulation nicht kennt.
 */

import type { ModulArt, ModulParameter, Modul } from './typen';

export interface PortDefinition {
  readonly id: string;
  readonly name: string;
  /** Kurzerklärung für den Tooltip. */
  readonly hinweis: string;
}

export interface ModulDefinition {
  readonly art: ModulArt;
  readonly name: string;
  readonly kurz: string;
  /** Ein Satz, der das Pattern erklärt. */
  readonly lehrsatz: string;
  /** Verweis in die Forschungsablage. */
  readonly quelle: string;
  readonly eingaenge: readonly PortDefinition[];
  /** Statische Ausgänge. Dynamische (Verteiler) werden berechnet. */
  readonly ausgaenge: readonly PortDefinition[];
  readonly standard: ModulParameter;
  /** Farbleitwert für die 3D-Darstellung (Hex). */
  readonly farbe: number;
  /** Tastenkuerzel in der Bauleiste. */
  readonly taste: string;
}

const EIN: PortDefinition = { id: 'ein', name: 'Eingang', hinweis: 'Aufträge treten hier ein.' };

export const KATALOG: Record<ModulArt, ModulDefinition> = {
  quelle: {
    art: 'quelle',
    name: 'AUFTRAGSEINGANG',
    kurz: 'Quelle',
    lehrsatz: 'Jede Orchestrierung beginnt mit einem echten Auftrag, nicht mit einer Technologie.',
    quelle: '01_grundlagen.md',
    eingaenge: [],
    ausgaenge: [{ id: 'aus', name: 'Ausgang', hinweis: 'Eingehende Aufträge.' }],
    standard: {},
    farbe: 0x8fd6ff,
    taste: '',
  },
  senke: {
    art: 'senke',
    name: 'AUSLIEFERUNG',
    kurz: 'Senke',
    lehrsatz: 'Was hier ankommt, sieht der Kunde. Alles davor ist deine Verantwortung.',
    quelle: '01_grundlagen.md',
    eingaenge: [EIN],
    ausgaenge: [],
    standard: {},
    farbe: 0x9dffb0,
    taste: '',
  },
  kern: {
    art: 'kern',
    name: 'MODELL-KERN',
    kurz: 'Kern',
    lehrsatz:
      'Ein Modell ist ein Werkzeug mit Preisschild. Die Kunst ist, das kleinste zu wählen, das reicht.',
    quelle: '03_workflow_patterns.md',
    eingaenge: [EIN],
    ausgaenge: [{ id: 'aus', name: 'Ausgang', hinweis: 'Bearbeitetes Paket.' }],
    standard: { groesse: 'reiher', spezialisierung: 'keine' },
    farbe: 0xffb347,
    taste: '1',
  },
  weiche: {
    art: 'weiche',
    name: 'WEICHE',
    kurz: 'Router',
    lehrsatz:
      'Routing spart Geld, weil die meisten Aufträge leicht sind — und kostet Qualität, wenn es irrt.',
    quelle: '03_workflow_patterns.md#pattern-2-routing',
    eingaenge: [EIN],
    ausgaenge: [
      { id: 'a', name: 'Bahn A', hinweis: 'Kriterium NICHT erfüllt (z. B. leichte Fälle).' },
      { id: 'b', name: 'Bahn B', hinweis: 'Kriterium erfüllt (z. B. schwere Fälle).' },
    ],
    standard: { kriterium: 'schwierigkeit', schwelle: 0.45, spezialisierung: 'technik' },
    farbe: 0xc792ea,
    taste: '2',
  },
  schranke: {
    art: 'schranke',
    name: 'SCHRANKE',
    kurz: 'Gate',
    lehrsatz:
      'Ein Gate ist die billigste Qualitätssicherung der Welt: es kostet fast nichts und spart alles danach.',
    quelle: '03_workflow_patterns.md#pattern-1-prompt-chaining',
    eingaenge: [EIN],
    ausgaenge: [
      { id: 'ok', name: 'Bestanden', hinweis: 'Güte über der Schwelle.' },
      { id: 'fehler', name: 'Durchgefallen', hinweis: 'Güte unter der Schwelle.' },
    ],
    standard: { schwelle: 0.6 },
    farbe: 0x7ee8fa,
    taste: '3',
  },
  verteiler: {
    art: 'verteiler',
    name: 'VERTEILER',
    kurz: 'Fan-out',
    lehrsatz:
      'Parallelisierung kauft Zeit, nicht Geld. Du zahlst jeden Zweig — aber du wartest nur einmal.',
    quelle: '03_workflow_patterns.md#pattern-3-parallelization',
    eingaenge: [EIN],
    ausgaenge: [
      { id: 'z1', name: 'Zweig 1', hinweis: 'Erster paralleler Zweig.' },
      { id: 'z2', name: 'Zweig 2', hinweis: 'Zweiter paralleler Zweig.' },
      { id: 'z3', name: 'Zweig 3', hinweis: 'Dritter paralleler Zweig.' },
      { id: 'z4', name: 'Zweig 4', hinweis: 'Vierter paralleler Zweig.' },
    ],
    standard: { zweige: 3 },
    farbe: 0x64d8a3,
    taste: '4',
  },
  sammler: {
    art: 'sammler',
    name: 'SAMMLER',
    kurz: 'Aggregator',
    lehrsatz:
      'Wie du zusammenführst, entscheidet, wozu die Parallelitaet gut war: Mehrheit, Bestenauswahl oder Verschmelzung.',
    quelle: '05_multi_agent_patterns.md',
    eingaenge: [EIN],
    ausgaenge: [{ id: 'aus', name: 'Ausgang', hinweis: 'Zusammengeführtes Ergebnis.' }],
    standard: { modus: 'voting' },
    farbe: 0x64d8a3,
    taste: '5',
  },
  pruefer: {
    art: 'pruefer',
    name: 'PRÜFERIN',
    kurz: 'Evaluator',
    lehrsatz:
      'Eine Rückkopplung hebt die Güte — bis die Kosten schneller steigen als die Qualität.',
    quelle: '03_workflow_patterns.md#pattern-5-evaluator-optimizer',
    eingaenge: [EIN],
    ausgaenge: [
      { id: 'frei', name: 'Freigabe', hinweis: 'Gut genug. Weiter.' },
      { id: 'zurueck', name: 'Nacharbeit', hinweis: 'Zurück in die Überarbeitung.' },
    ],
    standard: { schwelle: 0.75, runden: 2 },
    farbe: 0xff8fa3,
    taste: '6',
  },
  werkzeug: {
    art: 'werkzeug',
    name: 'WERKZEUG',
    kurz: 'Tool',
    lehrsatz:
      'Ein Modell, das rechnen soll, ist ein Missverständnis. Gib ihm ein Werkzeug — und einen Plan für dessen Ausfall.',
    quelle: '06_tool_use_context_engineering.md',
    eingaenge: [EIN],
    ausgaenge: [
      { id: 'ok', name: 'Erfolg', hinweis: 'Werkzeug hat geliefert.' },
      { id: 'fehler', name: 'Ausfall', hinweis: 'Werkzeug war nicht erreichbar.' },
    ],
    standard: { werkzeugArt: 'suche' },
    farbe: 0xffe66d,
    taste: '7',
  },
  speicher: {
    art: 'speicher',
    name: 'SPEICHER',
    kurz: 'Kontext',
    lehrsatz:
      'Kontext ist kein Vorrat, sondern ein Budget. Komprimieren, abrufen oder isolieren — aber niemals ignorieren.',
    quelle: '06_tool_use_context_engineering.md#context-engineering',
    eingaenge: [EIN],
    ausgaenge: [{ id: 'aus', name: 'Ausgang', hinweis: 'Paket mit verändertem Kontext.' }],
    standard: { modus: 'komprimieren' },
    farbe: 0xa0a8ff,
    taste: '8',
  },
  wall: {
    art: 'wall',
    name: 'WALL',
    kurz: 'Guardrail',
    lehrsatz:
      'Kein einzelner Filter hält alles. Nur gestaffelte Verteidigung kommt nahe an vollständig heran.',
    quelle: '08_safety_security_guardrails.md',
    eingaenge: [EIN],
    ausgaenge: [
      { id: 'rein', name: 'Sauber', hinweis: 'Unauffällig. Weiter.' },
      { id: 'alarm', name: 'Alarm', hinweis: 'Verdacht. In die Quarantaene.' },
    ],
    standard: { modus: 'eingang' },
    farbe: 0xff5c5c,
    taste: '9',
  },
  sicherung: {
    art: 'sicherung',
    name: 'SICHERUNG',
    kurz: 'Resilienz',
    lehrsatz:
      'Wiederholen heilt Zufallsfehler. Gegen dauerhafte Ausfälle hilft nur, rechtzeitig aufzugeben.',
    quelle: '07_resilience_error_handling.md',
    eingaenge: [EIN],
    ausgaenge: [
      { id: 'zurueck', name: 'Erneut', hinweis: 'Zurück zum fehlgeschlagenen Schritt.' },
      { id: 'notausgang', name: 'Notausgang', hinweis: 'Aufgeben und degradiert weiterarbeiten.' },
    ],
    standard: { modus: 'wiederholen', versuche: 2 },
    farbe: 0xff9f43,
    taste: '0',
  },
  hand: {
    art: 'hand',
    name: 'HAND',
    kurz: 'Mensch',
    lehrsatz:
      'Menschliche Freigabe ist kein Notbehelf, sondern ein Architektur-Pattern — mit brutalen Latenzkosten.',
    quelle: '09_human_in_the_loop.md',
    eingaenge: [EIN],
    ausgaenge: [
      { id: 'frei', name: 'Freigegeben', hinweis: 'Mensch hat zugestimmt.' },
      { id: 'abgelehnt', name: 'Abgelehnt', hinweis: 'Mensch hat widersprochen.' },
    ],
    standard: { modus: 'bei_unsicherheit', schwelle: 0.4 },
    farbe: 0xffd6a5,
    taste: 'J',
  },
  auge: {
    art: 'auge',
    name: 'AUGE',
    kurz: 'Tracing',
    lehrsatz:
      'Was du nicht beobachtest, kannst du nicht verantworten. Und was du nicht verantworten kannst, kauft kein Landesamt.',
    quelle: '10_observability_evaluation.md',
    eingaenge: [EIN],
    ausgaenge: [{ id: 'aus', name: 'Ausgang', hinweis: 'Unverändert — aber jetzt belegt.' }],
    standard: {},
    farbe: 0xb8f2e6,
    taste: 'U',
  },
  schmiede: {
    art: 'schmiede',
    name: 'SCHMIEDE',
    kurz: 'Evolution',
    lehrsatz:
      'Wenn du den Suchraum nicht überblickst, lass ihn absuchen. Selektion ist billiger als Genie.',
    quelle: '11_frameworks_implementierung.md',
    eingaenge: [EIN],
    ausgaenge: [{ id: 'aus', name: 'Ausgang', hinweis: 'Optimierte Konfiguration.' }],
    standard: { population: 12, generationen: 8 },
    farbe: 0xf7b2ff,
    taste: 'K',
  },
};

/** Ausgangsports eines konkreten Moduls (Verteiler hängt von `zweige` ab). */
export function ausgaengeVon(modul: Modul): readonly PortDefinition[] {
  const def = KATALOG[modul.art];
  if (modul.art === 'verteiler') {
    const n = Math.max(2, Math.min(4, modul.param.zweige ?? 3));
    return def.ausgaenge.slice(0, n);
  }
  return def.ausgaenge;
}

/** Alle baubaren Modularten (Quelle und Senke sind vom Level gesetzt). */
export const BAUBAR: readonly ModulArt[] = [
  'kern',
  'weiche',
  'schranke',
  'verteiler',
  'sammler',
  'pruefer',
  'werkzeug',
  'speicher',
  'wall',
  'sicherung',
  'hand',
  'auge',
  'schmiede',
];
