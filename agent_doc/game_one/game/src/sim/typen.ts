/**
 * Domaenenmodell der SCHWARMWERK-Simulation.
 *
 * Die Simulation bildet eine Agent-Orchestrierung als Fabrik ab: Auftraege
 * fliessen als Pakete durch einen gerichteten Graphen aus Modulen. Jedes Modul
 * entspricht einem realen Pattern aus dem Agentic Engineering (siehe
 * `agent_doc/01_agentic-engineering-patterns/`). Die Zahlen in
 * `src/sim/balance.ts` sind aus dem Stand der Technik abgeleitet — das Spiel
 * lehrt damit echte Trade-offs, keine erfundenen.
 */

// ---------------------------------------------------------------------------
// Auftraege
// ---------------------------------------------------------------------------

/** Fachdomaene eines Auftrags — Kerne koennen sich darauf spezialisieren. */
export type Domaene =
  | 'recht'      // Vergabe, Vertraege, oeffentliches Recht
  | 'technik'    // Code, Infrastruktur, Migration
  | 'finanz'     // Abrechnung, Kalkulation, Zahlen
  | 'text'       // Redaktion, Kommunikation, Uebersetzung
  | 'analyse';   // Auswertung, Recherche, Diagnose

export const ALLE_DOMAENEN: readonly Domaene[] = ['recht', 'technik', 'finanz', 'text', 'analyse'];

/** Ein eingehender Auftrag (Ticket) aus dem Kundenstrom. */
export interface Auftrag {
  readonly id: string;
  /** Fachliche Einordnung. */
  readonly domaene: Domaene;
  /** 0 = trivial, 1 = an der Grenze des Machbaren. */
  readonly schwierigkeit: number;
  /** Mehrdeutigkeit des Auftrags: erhoeht Fehlrouting und Unsicherheit. */
  readonly mehrdeutigkeit: number;
  /** Auftrag enthaelt personenbezogene oder eingestufte Daten. */
  readonly vertraulich: boolean;
  /** Auftrag verlangt belegbare Fakten (ohne Werkzeug nicht loesbar). */
  readonly belegpflichtig: boolean;
  /** Auftrag ist rechnerisch (deterministisches Werkzeug schlaegt jedes Modell). */
  readonly rechnerisch: boolean;
  /** Eingeschleuste Anweisung (indirekte Prompt Injection), 0 = harmlos. */
  readonly giftigkeit: number;
  /** Anzeigename fuer HUD und Trace. */
  readonly titel: string;
}

// ---------------------------------------------------------------------------
// Module
// ---------------------------------------------------------------------------

export type ModulArt =
  | 'quelle'      // Auftragseingang
  | 'senke'       // Auslieferung an den Kunden
  | 'kern'        // Modell-Kern (Kolibri / Reiher / Kondor)
  | 'weiche'      // Router: klassifiziert und verteilt
  | 'schranke'    // Gate: deterministische Validierung
  | 'verteiler'   // Fan-out: Parallelisierung
  | 'sammler'     // Aggregation: Voting / Verschmelzen / Bester
  | 'pruefer'     // Evaluator-Optimizer mit Rueckkopplung
  | 'werkzeug'    // Tool Use / MCP
  | 'speicher'    // Context Engineering: Komprimieren / Abrufen / Isolieren
  | 'wall'        // Guardrail: Eingangs- und Ausgangsfilter
  | 'sicherung'   // Retry / Circuit Breaker
  | 'hand'        // Human-in-the-Loop
  | 'auge'        // Observability: Tracing-Abgriff
  | 'schmiede';   // Evolutionskammer (Akt XI)

export type KernGroesse = 'kolibri' | 'reiher' | 'kondor';
export type SammlerModus = 'voting' | 'verschmelzen' | 'bester';
export type SpeicherModus = 'komprimieren' | 'abrufen' | 'isolieren';
export type WallModus = 'eingang' | 'ausgang';
export type WerkzeugArt = 'suche' | 'rechner' | 'datenbank' | 'api';
export type SicherungModus = 'wiederholen' | 'sicherung';
export type HandModus = 'immer' | 'bei_unsicherheit' | 'bei_vertraulich';
export type WeicheKriterium = 'schwierigkeit' | 'domaene' | 'vertraulichkeit' | 'unsicherheit';

/** Konfigurierbare Parameter eines Moduls. Nicht jedes Feld gilt fuer jede Art. */
export interface ModulParameter {
  groesse?: KernGroesse;
  /** Spezialisierung eines Kerns auf eine Domaene — hebt die Guete-Decke. */
  spezialisierung?: Domaene | 'keine';
  modus?: SammlerModus | SpeicherModus | WallModus | SicherungModus | HandModus;
  werkzeugArt?: WerkzeugArt;
  kriterium?: WeicheKriterium;
  /** Schwellwert fuer Schranke, Pruefer, Weiche und Hand (0..1). */
  schwelle?: number;
  /** Maximale Rueckkopplungsrunden eines Pruefers. */
  runden?: number;
  /** Anzahl paralleler Zweige eines Verteilers. */
  zweige?: number;
  /** Maximale Wiederholungen einer Sicherung. */
  versuche?: number;
  /** Anzahl Individuen bzw. Generationen einer Schmiede. */
  population?: number;
  generationen?: number;
}

/** Ein platziertes Modul im Werk. */
export interface Modul {
  readonly id: string;
  readonly art: ModulArt;
  /** Position auf dem Fundament (Gitterkoordinaten). */
  readonly x: number;
  readonly z: number;
  readonly param: ModulParameter;
}

/** Verbindung zwischen zwei Modulen. Ports trennen die Ausgaenge einer Weiche. */
export interface Leitung {
  readonly id: string;
  readonly von: string;
  readonly vonPort: string;
  readonly nach: string;
  readonly nachPort: string;
}

/** Der vom Spieler gebaute Orchestrierungs-Graph. */
export interface Werk {
  readonly module: readonly Modul[];
  readonly leitungen: readonly Leitung[];
}

// ---------------------------------------------------------------------------
// Pakete (Auftrag im Fluss)
// ---------------------------------------------------------------------------

export interface SpurEintrag {
  readonly tick: number;
  readonly modulId: string;
  readonly art: ModulArt;
  readonly ereignis: string;
  readonly guete: number;
  readonly kosten: number;
}

/** Ein Auftrag waehrend der Bearbeitung. Alle Felder sind veraenderlich. */
export interface Paket {
  readonly auftrag: Auftrag;
  /** Eindeutig auch fuer Klone aus einem Verteiler ("a3#2"). */
  readonly id: string;
  /** Loesungsguete 0..1. */
  guete: number;
  /** Kontextlast 0..1 — Treiber des Context Rot. */
  kontext: number;
  /** Unsicherheit 0..1 — steigt bei Mehrdeutigkeit, faellt durch Belege. */
  unsicherheit: number;
  /** Eingeschleuste Anweisung hat gegriffen. */
  kompromittiert: boolean;
  /** Eine Wall hat die eingeschleuste Anweisung unschaedlich gemacht. */
  entgiftet: boolean;
  /** Aussage ist durch ein Werkzeug belegt. */
  belegt: boolean;
  /** Rechnerischer Anteil wurde deterministisch geloest. */
  gerechnet: boolean;
  /** Ein Mensch hat freigegeben. */
  freigegeben: boolean;
  /** Anteil der Bearbeitung, der durch ein Auge beobachtet wurde. */
  beobachteteSchritte: number;
  gesamteSchritte: number;
  /** Verbrauchte Token. */
  kosten: number;
  /** Verstrichene Ticks seit Eintritt. */
  alter: number;
  /** Besuchszaehler je Modul — Schleifenerkennung und Zufalls-Diskriminator. */
  readonly besuche: Map<string, number>;
  readonly spur: SpurEintrag[];
  /** Bei Verteiler-Klonen: Id der Gruppe, die ein Sammler wieder zusammenfuehrt. */
  gruppe?: string;
  /** Fehlerursache, falls das Paket verworfen wurde. */
  fehler?: string;
}

// ---------------------------------------------------------------------------
// Ergebnis eines Laufs
// ---------------------------------------------------------------------------

export interface Metriken {
  /** Anteil ausgelieferter Auftraege (0..1). */
  readonly durchsatz: number;
  /** Mittlere Guete der ausgelieferten Auftraege (0..1). */
  readonly guete: number;
  /** Gesamtkosten in Token. */
  readonly kosten: number;
  /** Kosten je ausgeliefertem Auftrag. */
  readonly kostenJeAuftrag: number;
  /** Median-Latenz in Ticks. */
  readonly latenzP50: number;
  /** 95-Perzentil-Latenz in Ticks. */
  readonly latenzP95: number;
  /** Anteil abgewehrter Angriffe (1 = kein Leck). */
  readonly sicherheit: number;
  /** Anteil vollstaendig nachvollziehbarer Auftraege. */
  readonly nachvollziehbarkeit: number;
  /** Anteil vertraulicher Auftraege mit menschlicher Freigabe. */
  readonly konformitaet: number;
  /** Belegquote bei belegpflichtigen Auftraegen. */
  readonly belegquote: number;
  /** Gesamtdauer des Laufs in Ticks. */
  readonly dauer: number;
  /** Anzahl Module (Zachlike-Metrik "Flaeche"). */
  readonly flaeche: number;
  /** Anzahl gelieferter Auftraege. */
  readonly geliefert: number;
  /** Anzahl verworfener Auftraege. */
  readonly verworfen: number;
  /** Anzahl Auftraege, die kompromittiert ausgeliefert wurden. */
  readonly lecks: number;
}

export interface LaufErgebnis {
  readonly metriken: Metriken;
  readonly pakete: readonly Paket[];
  readonly ereignisse: readonly SimEreignis[];
  /** Deterministische Pruefsumme ueber den Endzustand (Golden-Master-Tests). */
  readonly pruefsumme: string;
  readonly abgebrochen: boolean;
  readonly abbruchGrund?: string;
}

/** Ereignisse fuer die 3D-Darstellung und fuer Trace-Ansichten. */
export interface SimEreignis {
  readonly tick: number;
  readonly art:
    | 'eintritt'
    | 'ankunft'
    | 'abgang'
    | 'auslieferung'
    | 'verworfen'
    | 'geklont'
    | 'vereint'
    | 'schleife'
    | 'alarm'
    | 'blockiert';
  readonly paketId: string;
  readonly modulId: string;
  readonly leitungId?: string;
  readonly text?: string;
}

// ---------------------------------------------------------------------------
// Level
// ---------------------------------------------------------------------------

export interface Budget {
  /** Maximale Gesamtkosten in Token. */
  readonly kosten?: number;
  /** Maximale p95-Latenz in Ticks. */
  readonly latenz?: number;
  /** Maximale Anzahl Module. */
  readonly module?: number;
  /** Maximale Laufdauer in Ticks. */
  readonly dauer?: number;
}

export interface Ziel {
  readonly id: string;
  readonly text: string;
  /** Wird gegen die Metriken geprueft. Muss rein und deterministisch sein. */
  readonly pruefe: (m: Metriken) => boolean;
  /** Fortschritt 0..1 fuer die HUD-Anzeige. */
  readonly fortschritt: (m: Metriken) => number;
  /** Optionales Ziel ("Meisterstueck") — nicht notwendig zum Bestehen. */
  readonly optional?: boolean;
}

export interface AuftragsStrom {
  readonly anzahl: number;
  /** Ticks zwischen zwei Auftraegen. */
  readonly takt: number;
  readonly domaenen: readonly Domaene[];
  readonly schwierigkeit: readonly [number, number];
  readonly mehrdeutigkeit?: readonly [number, number];
  readonly anteilVertraulich?: number;
  readonly anteilBelegpflichtig?: number;
  readonly anteilRechnerisch?: number;
  readonly anteilGiftig?: number;
}

export interface Level {
  readonly id: string;
  readonly akt: number;
  readonly nummer: number;
  readonly titel: string;
  readonly untertitel: string;
  /** Kundenauftrag im Klartext — die narrative Rahmung. */
  readonly briefing: string;
  /** Was der Spieler hier lernt (didaktisches Lernziel). */
  readonly lernziel: string;
  /** Verweis in die Forschungsablage, z. B. "03_workflow_patterns.md#routing". */
  readonly quelle: string;
  /** Freigeschaltete Modularten in diesem Level. */
  readonly module: readonly ModulArt[];
  readonly strom: AuftragsStrom;
  readonly budget: Budget;
  readonly ziele: readonly Ziel[];
  readonly saat: number;
  /** Vorgebautes Werk (Tutorial-Level starten nicht auf leerem Fundament). */
  readonly vorbau?: Werk;
  /** Nach dem Bestehen gezeigte Reflexionsfrage (Transfer-Hebel). */
  readonly reflexion: string;
  /** Ilvas Notiz — Story-Text, der beim Betreten abgespielt wird. */
  readonly notiz?: string;
}
