/**
 * SCHWARMWERK — Klangwerk.
 *
 * Die gesamte Klangwelt des Spiels, prozedural erzeugt. Keine einzige
 * Audiodatei, kein Download, nichts Externes.
 *
 * ## Die Musik
 *
 * Halle 3 klingt wie eine große, kalte Werkhalle um drei Uhr nachts, in der
 * jemand konzentriert arbeitet. Tonart ist **D-Dorisch** (Tonika D3 =
 * 146,83 Hz); wird es gefährlich, kippt der Modus nach **D-Aeolisch** — die
 * große Sexte (H) weicht der kleinen (B), und der Raum wird hörbar kühler,
 * ohne dass sich die Tonika bewegt. Kein Beat, keine Fanfaren. Es gibt keinen
 * Anfang und kein Ende: sechs Layer laufen dauerhaft, und nur ihre Gains
 * bewegen sich.
 *
 * | Layer               | Inhalt                                              |
 * |---------------------|-----------------------------------------------------|
 * | `drone`             | D1/D2/A2, je zwei Oszillatoren mit ±3 Cent Schwebung |
 * | `pad_tief`          | Quartenakkord D3–G3–C4, Tiefpass 420 Hz             |
 * | `pad_hoch`          | Quartenakkord A4–D5–G5, langsam atmender Tiefpass   |
 * | `arpeggio`          | sparsame Achtel aus dem aktuellen Akkord            |
 * | `textur_rauschen`   | Bandpass-Rauschen — Lueftung, entfernte Maschinen   |
 * | `perkussion_metall` | Karplus-Strong-Anschläge auf Stahl, sehr selten    |
 *
 * ## Die Technik
 *
 * - Lookahead-Scheduler nach Chris Wilson: ein 25-ms-Takt plant 100 ms voraus
 *   und übergibt IMMER absolute `AudioContext.currentTime`-Argumente.
 *   `requestAnimationFrame` ist hier verboten — unter Renderlast driftet das
 *   Timing sonst hörbar.
 * - Genau ZWEI `ConvolverNode` im ganzen Spiel, als Send-Busse: ein kurzer
 *   Raum (0,8 s) für Bedienklänge, ein langer (3,5 s) für die Halle.
 * - Gain-Staging: `musik`/`klaenge` → `master` → Limiter → Ausgang.
 * - Höchstens 24 gleichzeitige Klang-Stimmen; die aelteste wird gestohlen.
 * - Determinismus: kein `Math.random()`, alles über `zufall()` aus dem RNG.
 */

import { zufall } from '../sim/rng';
import {
  AEOLISCH,
  AKKORDE,
  DORISCH,
  HALL_KURZ,
  HALL_LANG,
  TONIKA_MIDI,
  UI_GRUND_HZ,
  anschlag,
  cent,
  impulsantwort,
  karplusStrongPuffer,
  klemme,
  midiZuHz,
  rampe,
  rauschPuffer,
  reglerZuPegel,
  setze,
  skalenTon,
  type Skala,
} from './synthese';

// ---------------------------------------------------------------------------
// Öffentliche Typen
// ---------------------------------------------------------------------------

/** Steuerachsen der Musik. Jede ist ein Wert 0..1 und wirkt auf alle Layer. */
export type Achse = 'spannung' | 'aktivitaet' | 'gefahr' | 'erfolg' | 'ruhe';

export type Klang =
  | 'ui_zeiger'
  | 'ui_waehlen'
  | 'ui_abbruch'
  | 'ui_fehler'
  | 'modul_setzen'
  | 'modul_entfernen'
  | 'modul_drehen'
  | 'leitung_verbinden'
  | 'leitung_trennen'
  | 'sim_start'
  | 'sim_pause'
  | 'sim_tick'
  | 'paket_eintritt'
  | 'paket_auslieferung'
  | 'paket_verworfen'
  | 'alarm'
  | 'schleife'
  | 'freigabe_mensch'
  | 'ziel_erreicht'
  | 'level_bestanden'
  | 'level_gescheitert'
  | 'notiz_beginn'
  | 'seite_blaettern';

export interface Punkt3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

// ---------------------------------------------------------------------------
// Interne Konstanten
// ---------------------------------------------------------------------------

/** Lookahead des Schedulers in Sekunden (Chris Wilson). */
const VORAUSSCHAU = 0.1;
/** Takt des Schedulers in Millisekunden. */
const TAKT_MS = 25;
/** Harte Obergrenze gleichzeitiger Klang-Stimmen. */
const STIMMEN_GRENZE = 24;
/** Vorlauf, damit ein Klang nie exakt auf `currentTime` fällt (Aussetzer). */
const ANSPIEL_VORLAUF = 0.005;
/** Feste Saat der Klangwelt — dieselbe Halle klingt in jedem Lauf gleich. */
const SAAT = 0x53_43_48_57;
/** Zeit, in der eine Achse ihren neuen Wert erreicht. */
const ACHSEN_GLAETTUNG = 1.5;

type LayerName =
  | 'drone'
  | 'pad_tief'
  | 'pad_hoch'
  | 'arpeggio'
  | 'textur_rauschen'
  | 'perkussion_metall';

const LAYER: readonly LayerName[] = [
  'drone',
  'pad_tief',
  'pad_hoch',
  'arpeggio',
  'textur_rauschen',
  'perkussion_metall',
];

const ACHSEN: readonly Achse[] = ['spannung', 'aktivitaet', 'gefahr', 'erfolg', 'ruhe'];

/** Ruhepegel jedes Layers, wenn alle Achsen auf 0 stehen. */
const GRUNDPEGEL: Readonly<Record<LayerName, number>> = {
  drone: 0.55,
  pad_tief: 0.24,
  pad_hoch: 0.16,
  arpeggio: 0.1,
  textur_rauschen: 0.14,
  perkussion_metall: 0.08,
};

/**
 * Mischmatrix: wie stark jede Achse auf jeden Layer wirkt.
 *
 * Die Summe der negativen Beiträge je Layer bleibt betragsmäßig unter
 * dessen Grundpegel — ein Layer kann also leise werden, aber nie die Phase
 * drehen.
 */
const ACHSEN_MATRIX: Readonly<Record<Achse, Readonly<Record<LayerName, number>>>> = {
  // Spannung: mehr Grundieren, mehr Luft, das Hohe tritt zurück.
  spannung: {
    drone: 0.06,
    pad_tief: 0.1,
    pad_hoch: -0.05,
    arpeggio: 0.08,
    textur_rauschen: 0.16,
    perkussion_metall: 0.1,
  },
  // Aktivität: die Anlage läuft — Arpeggio und Metall treten hervor.
  aktivitaet: {
    drone: 0,
    pad_tief: 0.06,
    pad_hoch: 0.1,
    arpeggio: 0.34,
    textur_rauschen: 0.08,
    perkussion_metall: 0.22,
  },
  // Gefahr: kühler und duenner. Alles Melodische weicht zurück, Rauschen bleibt.
  gefahr: {
    drone: 0.14,
    pad_tief: -0.08,
    pad_hoch: -0.06,
    arpeggio: -0.05,
    textur_rauschen: 0.26,
    perkussion_metall: 0.06,
  },
  // Erfolg: das obere Pad öffnet sich, der Raum wird hell.
  erfolg: {
    drone: 0.04,
    pad_tief: 0.14,
    pad_hoch: 0.3,
    arpeggio: 0.14,
    textur_rauschen: -0.04,
    perkussion_metall: 0.04,
  },
  // Ruhe: Pads tragen, Bewegung verschwindet.
  ruhe: {
    drone: 0.1,
    pad_tief: 0.18,
    pad_hoch: 0.06,
    arpeggio: -0.05,
    textur_rauschen: -0.06,
    perkussion_metall: -0.06,
  },
};

interface Rezept {
  /** Grundpegel des Klangs im Klang-Bus. */
  readonly pegel: number;
  /** Anteil in den kurzen Raum (Bedienklänge klingen dort trocken nach). */
  readonly kurz: number;
  /** Anteil in die große Halle. */
  readonly lang: number;
}

/**
 * Pegel und Hallanteile je Klang. Alles hier ist Mischung, nicht Synthese —
 * die Synthese steht in `baueKlang`. Getrennt, damit sich die Balance
 * einstellen lässt, ohne einen einzigen Oszillator anzufassen.
 */
const REZEPTE: Readonly<Record<Klang, Rezept>> = {
  ui_zeiger: { pegel: 0.1, kurz: 0.08, lang: 0.0 },
  ui_waehlen: { pegel: 0.24, kurz: 0.18, lang: 0.02 },
  ui_abbruch: { pegel: 0.2, kurz: 0.16, lang: 0.02 },
  ui_fehler: { pegel: 0.26, kurz: 0.2, lang: 0.04 },
  modul_setzen: { pegel: 0.5, kurz: 0.2, lang: 0.22 },
  modul_entfernen: { pegel: 0.36, kurz: 0.18, lang: 0.16 },
  modul_drehen: { pegel: 0.24, kurz: 0.14, lang: 0.06 },
  leitung_verbinden: { pegel: 0.4, kurz: 0.2, lang: 0.18 },
  leitung_trennen: { pegel: 0.32, kurz: 0.16, lang: 0.12 },
  sim_start: { pegel: 0.42, kurz: 0.1, lang: 0.3 },
  sim_pause: { pegel: 0.36, kurz: 0.1, lang: 0.26 },
  sim_tick: { pegel: 0.06, kurz: 0.04, lang: 0.0 },
  paket_eintritt: { pegel: 0.22, kurz: 0.12, lang: 0.1 },
  paket_auslieferung: { pegel: 0.3, kurz: 0.14, lang: 0.16 },
  paket_verworfen: { pegel: 0.34, kurz: 0.12, lang: 0.2 },
  alarm: { pegel: 0.44, kurz: 0.1, lang: 0.28 },
  schleife: { pegel: 0.36, kurz: 0.12, lang: 0.24 },
  freigabe_mensch: { pegel: 0.32, kurz: 0.16, lang: 0.2 },
  ziel_erreicht: { pegel: 0.36, kurz: 0.16, lang: 0.24 },
  level_bestanden: { pegel: 0.4, kurz: 0.1, lang: 0.5 },
  level_gescheitert: { pegel: 0.38, kurz: 0.08, lang: 0.4 },
  notiz_beginn: { pegel: 0.26, kurz: 0.18, lang: 0.08 },
  seite_blaettern: { pegel: 0.18, kurz: 0.12, lang: 0.03 },
};

/** Ein Bauplatz während der Synthese eines einzelnen Klangs. */
interface Bau {
  readonly zeit: number;
  readonly staerke: number;
  /** Knoten, in den die Stimme mündet. */
  readonly ziel: AudioNode;
  readonly knoten: AudioNode[];
  readonly quellen: AudioScheduledSourceNode[];
  /** Zeitpunkt, an dem die Stimme sicher verklungen ist. */
  ende: number;
  /** Laufende Nummer des Ereignisses — speist den deterministischen Zufall. */
  readonly nummer: number;
}

interface Stimme {
  readonly kopf: GainNode;
  readonly knoten: readonly AudioNode[];
  readonly quellen: readonly AudioScheduledSourceNode[];
  ende: number;
}

// ---------------------------------------------------------------------------
// Klangwerk
// ---------------------------------------------------------------------------

export class Klangwerk {
  // -- Kontext und Gain-Staging ------------------------------------------
  private kontext: BaseAudioContext | null = null;
  private eigenerKontext = false;
  private master: GainNode | null = null;
  private limiter: DynamicsCompressorNode | null = null;
  private musikBus: GainNode | null = null;
  private klangBus: GainNode | null = null;
  private hallKurzEin: GainNode | null = null;
  private hallLangEin: GainNode | null = null;

  // -- Musik --------------------------------------------------------------
  private readonly layerGains = new Map<LayerName, GainNode>();
  private readonly achsenQuellen = new Map<Achse, ConstantSourceNode>();
  private readonly achsenWert: Record<Achse, number> = {
    spannung: 0,
    aktivitaet: 0,
    gefahr: 0,
    erfolg: 0,
    ruhe: 0,
  };
  private skala: Skala = DORISCH;

  // -- Puffer -------------------------------------------------------------
  private rauschen: AudioBuffer | null = null;
  private readonly saiten = new Map<number, AudioBuffer>();

  // -- Stimmenverwaltung --------------------------------------------------
  private readonly stimmenListe: Stimme[] = [];
  private readonly sterbend: Stimme[] = [];
  private readonly musikStimmen: Stimme[] = [];
  private readonly dauerknoten: AudioNode[] = [];
  private readonly dauerquellen: AudioScheduledSourceNode[] = [];
  private ereignisZaehler = 0;

  // -- Scheduler ----------------------------------------------------------
  private takt: ReturnType<typeof setInterval> | null = null;
  private naechsteNotenzeit = 0;
  private schrittIndex = 0;

  // -- Zustand ------------------------------------------------------------
  private aktiv = false;
  private pausiert = false;
  private reglerMusik: number;
  private reglerKlaenge: number;
  private hoererOrt: Punkt3 = { x: 0, y: 0, z: 0 };
  private hoererBlick: Punkt3 = { x: 0, y: 0, z: -1 };

  constructor(
    einstellungen?: { musik?: number; klaenge?: number },
    kontext?: BaseAudioContext
  ) {
    this.reglerMusik = klemme(einstellungen?.musik ?? 0.7, 0, 1);
    this.reglerKlaenge = klemme(einstellungen?.klaenge ?? 0.85, 0, 1);
    if (kontext) this.kontext = kontext;
  }

  /** Läuft die Klangwelt? */
  get laeuft(): boolean {
    return this.aktiv && !this.pausiert;
  }

  /** Anzahl belegter Klang-Stimmen — Testhaken gegen Knotenlecks. */
  get stimmen(): number {
    return this.stimmenListe.length;
  }

  /** Abtastrate des benutzten Kontextes (0, solange keiner existiert). */
  get abtastrate(): number {
    return this.kontext?.sampleRate ?? 0;
  }

  // =========================================================================
  // Lebenszyklus
  // =========================================================================

  /**
   * Startet die Klangwelt. MUSS aus einer Nutzergeste heraus aufgerufen
   * werden — jeder Browser blockiert sonst den AudioContext (Autoplay).
   */
  async starte(): Promise<void> {
    if (this.aktiv) return;
    if (!this.kontext) {
      const bauart: typeof AudioContext | undefined =
        typeof AudioContext !== 'undefined' ? AudioContext : undefined;
      // Ohne Web Audio (z. B. in einer Testumgebung ohne DOM) bleibt das
      // Klangwerk still, statt das Spiel mit einer Ausnahme zu zerreissen.
      if (!bauart) return;
      this.kontext = new bauart({ latencyHint: 'interactive', sampleRate: 48000 });
      this.eigenerKontext = true;
    }

    const ctx = this.kontext;
    if (this.istEchtzeit(ctx) && ctx.state === 'suspended') {
      await ctx.resume();
    }

    this.baueGrundgeruest(ctx);
    this.baueMusik(ctx);
    this.aktiv = true;
    this.pausiert = false;

    // Der Scheduler faengt eine Zehntelsekunde in der Zukunft an — nie exakt
    // jetzt, sonst kommt die erste Note zu spät und wird verschluckt.
    this.naechsteNotenzeit = ctx.currentTime + VORAUSSCHAU;
    this.schrittIndex = 0;
    this.plane();
    this.starteTakt();
  }

  /** Trennt alle Knoten, löscht alle Timer, gibt den Kontext frei. */
  entsorge(): void {
    this.haltTakt();
    const jetzt = this.kontext?.currentTime ?? 0;

    for (const liste of [this.stimmenListe, this.sterbend, this.musikStimmen]) {
      for (const stimme of liste) this.stimmeAufloesen(stimme, jetzt);
      liste.length = 0;
    }
    for (const quelle of this.dauerquellen) this.stoppeStill(quelle, jetzt);
    this.dauerquellen.length = 0;
    for (const knoten of this.dauerknoten) this.trenneStill(knoten);
    this.dauerknoten.length = 0;

    this.layerGains.clear();
    this.achsenQuellen.clear();
    this.saiten.clear();
    this.rauschen = null;
    this.master = null;
    this.limiter = null;
    this.musikBus = null;
    this.klangBus = null;
    this.hallKurzEin = null;
    this.hallLangEin = null;

    if (this.eigenerKontext && this.kontext && 'close' in this.kontext) {
      void (this.kontext as AudioContext).close().catch(() => undefined);
    }
    this.kontext = null;
    this.eigenerKontext = false;
    this.aktiv = false;
    this.pausiert = false;
  }

  /** Blendet in 0,2 s aus und hält den Scheduler an. */
  pausiere(): void {
    if (!this.aktiv || this.pausiert) return;
    const ctx = this.kontext;
    if (!ctx || !this.master) return;
    this.pausiert = true;
    const jetzt = ctx.currentTime;
    rampe(this.master.gain, jetzt, this.master.gain.value, 0, 0.2);
    this.haltTakt();
    if (this.istEchtzeit(ctx)) void ctx.suspend().catch(() => undefined);
  }

  /** Nimmt den Betrieb wieder auf. */
  fortsetzen(): void {
    if (!this.aktiv || !this.pausiert) return;
    const ctx = this.kontext;
    if (!ctx || !this.master) return;
    this.pausiert = false;
    if (this.istEchtzeit(ctx)) void ctx.resume().catch(() => undefined);
    const jetzt = ctx.currentTime;
    rampe(this.master.gain, jetzt, this.master.gain.value, MASTER_PEGEL, 0.4);
    // Zwingend: die Notenzeit neu setzen. Sonst feuert der Scheduler alle
    // aufgestauten Ereignisse der Pause auf einen Schlag.
    this.naechsteNotenzeit = jetzt + VORAUSSCHAU;
    this.starteTakt();
  }

  // =========================================================================
  // Steuerung
  // =========================================================================

  /**
   * Setzt eine Steuerachse auf 0..1. Der Wert wird über ~1,5 s weich
   * nachgefahren — sprunghafte Gains hört man als Knacken, und die Musik
   * soll nicht auf jeden Zahlenausschlag reagieren.
   */
  setzeAchse(achse: Achse, wert: number): void {
    const ziel = klemme(wert, 0, 1);
    this.achsenWert[achse] = ziel;
    const quelle = this.achsenQuellen.get(achse);
    const ctx = this.kontext;
    if (!quelle || !ctx) return;
    const jetzt = ctx.currentTime;
    quelle.offset.cancelScheduledValues(jetzt);
    quelle.offset.setValueAtTime(quelle.offset.value, jetzt);
    quelle.offset.linearRampToValueAtTime(ziel, jetzt + ACHSEN_GLAETTUNG);
  }

  /** Lautstärken als Reglerwerte 0..1 (nichtlinear, `pegel = regler^2,5`). */
  setzeLautstaerke(musik: number, klaenge: number): void {
    this.reglerMusik = klemme(musik, 0, 1);
    this.reglerKlaenge = klemme(klaenge, 0, 1);
    const ctx = this.kontext;
    if (!ctx) return;
    const jetzt = ctx.currentTime;
    if (this.musikBus) {
      rampe(
        this.musikBus.gain,
        jetzt,
        this.musikBus.gain.value,
        reglerZuPegel(this.reglerMusik) * MUSIK_PEGEL,
        0.08
      );
    }
    if (this.klangBus) {
      rampe(
        this.klangBus.gain,
        jetzt,
        this.klangBus.gain.value,
        reglerZuPegel(this.reglerKlaenge) * KLANG_PEGEL,
        0.08
      );
    }
  }

  /** Koppelt das Hörzentrum an die Kamera. `blick` zeigt nach vorn. */
  hoererAn(pos: Punkt3, blick: Punkt3): void {
    this.hoererOrt = pos;
    const laenge = Math.hypot(blick.x, blick.y, blick.z) || 1;
    this.hoererBlick = { x: blick.x / laenge, y: blick.y / laenge, z: blick.z / laenge };
  }

  // =========================================================================
  // Klänge
  // =========================================================================

  /** Spielt einen Klang zentriert (UI, Systemmeldungen). */
  spiele(klang: Klang, staerke = 1): void {
    const ctx = this.kontext;
    if (!this.aktiv || !ctx || !this.klangBus) return;
    this.starteStimme(klang, ctx.currentTime + ANSPIEL_VORLAUF, staerke, this.klangBus, []);
  }

  /**
   * Spielt einen Klang an einem Weltort.
   *
   * Die Räumlichkeit wird von Hand gerechnet statt über `PannerNode`:
   * Abstandsdämpfung `1/(1+d/6)`, ein Luft-Tiefpass, der mit der Entfernung
   * schließt, und ein Stereo-Pan aus der Rechts-Achse der Kamera. Das ist
   * billiger als HRTF, läuft in jedem Kontext gleich und klingt in einer
   * Halle mit viel Nachhall praktisch identisch.
   */
  spieleAmOrt(klang: Klang, pos: Punkt3, staerke = 1): void {
    const ctx = this.kontext;
    if (!this.aktiv || !ctx || !this.klangBus) return;

    const dx = pos.x - this.hoererOrt.x;
    const dy = pos.y - this.hoererOrt.y;
    const dz = pos.z - this.hoererOrt.z;
    const abstand = Math.hypot(dx, dy, dz);
    const naehe = 1 / (1 + abstand / 6);

    // Rechts-Achse der Kamera: blick × oben.
    const rx = this.hoererBlick.y * 0 - this.hoererBlick.z * 1;
    const rz = this.hoererBlick.x * 1 - this.hoererBlick.y * 0;
    const rl = Math.hypot(rx, rz) || 1;
    const seite = abstand > 0.001 ? ((dx * rx) / rl + (dz * rz) / rl) / abstand : 0;

    const raum = ctx.createGain();
    raum.gain.value = klemme(naehe, 0.02, 1);
    const luft = ctx.createBiquadFilter();
    luft.type = 'lowpass';
    // Ferne Quellen verlieren zuerst die Höhen — Luft ist ein Tiefpass.
    luft.frequency.value = klemme(1200 + 18_000 * naehe, 700, 19_000);
    luft.Q.value = 0.7;
    const panner = ctx.createStereoPanner();
    panner.pan.value = klemme(seite, -1, 1) * 0.85;

    raum.connect(luft);
    luft.connect(panner);
    panner.connect(this.klangBus);

    this.starteStimme(klang, ctx.currentTime + ANSPIEL_VORLAUF, staerke, raum, [
      raum,
      luft,
      panner,
    ]);
  }

  // =========================================================================
  // Aufbau des Graphen
  // =========================================================================

  private baueGrundgeruest(ctx: BaseAudioContext): void {
    // master → limiter → Ausgang. Der Limiter faengt nur Spitzen ab; wenn er
    // dauerhaft mehr als 6 dB reduziert, ist das Gain-Staging falsch und
    // nicht der Limiter zu schwach.
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -6;
    limiter.knee.value = 2;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.002;
    limiter.release.value = 0.12;
    limiter.connect(ctx.destination);

    const master = ctx.createGain();
    master.gain.value = MASTER_PEGEL;
    master.connect(limiter);

    const musikBus = ctx.createGain();
    musikBus.gain.value = reglerZuPegel(this.reglerMusik) * MUSIK_PEGEL;
    musikBus.connect(master);

    const klangBus = ctx.createGain();
    klangBus.gain.value = reglerZuPegel(this.reglerKlaenge) * KLANG_PEGEL;
    klangBus.connect(master);

    // Die einzigen zwei Convolver des Spiels. Beide hängen als Send-Bus am
    // Master, niemals einer pro Stimme — eine 3,5-s-Impulsantwort ist mit
    // Abstand der teuerste Knoten im ganzen Graphen.
    const hallKurzEin = ctx.createGain();
    hallKurzEin.gain.value = 1;
    const kurzVorlauf = ctx.createDelay(0.2);
    kurzVorlauf.delayTime.value = 0.008;
    const kurz = ctx.createConvolver();
    kurz.normalize = true;
    kurz.buffer = impulsantwort(ctx, HALL_KURZ);
    const kurzZurueck = ctx.createGain();
    kurzZurueck.gain.value = 0.5;
    hallKurzEin.connect(kurzVorlauf);
    kurzVorlauf.connect(kurz);
    kurz.connect(kurzZurueck);
    kurzZurueck.connect(master);

    const hallLangEin = ctx.createGain();
    hallLangEin.gain.value = 1;
    const langVorlauf = ctx.createDelay(0.2);
    langVorlauf.delayTime.value = 0.045;
    const lang = ctx.createConvolver();
    lang.normalize = true;
    lang.buffer = impulsantwort(ctx, HALL_LANG);
    const langDaempfung = ctx.createBiquadFilter();
    langDaempfung.type = 'lowpass';
    langDaempfung.frequency.value = 4200;
    langDaempfung.Q.value = 0.5;
    const langZurueck = ctx.createGain();
    langZurueck.gain.value = 0.55;
    hallLangEin.connect(langVorlauf);
    langVorlauf.connect(lang);
    lang.connect(langDaempfung);
    langDaempfung.connect(langZurueck);
    langZurueck.connect(master);

    this.limiter = limiter;
    this.master = master;
    this.musikBus = musikBus;
    this.klangBus = klangBus;
    this.hallKurzEin = hallKurzEin;
    this.hallLangEin = hallLangEin;
    this.dauerknoten.push(
      limiter,
      master,
      musikBus,
      klangBus,
      hallKurzEin,
      kurzVorlauf,
      kurz,
      kurzZurueck,
      hallLangEin,
      langVorlauf,
      lang,
      langDaempfung,
      langZurueck
    );

    // Ein einziger Rauschpuffer für alle Rauschklänge — 1 s Stereo, per
    // `loop` mit wechselndem Startpunkt, damit nichts maschinell wiederkehrt.
    this.rauschen = rauschPuffer(ctx, 1, SAAT ^ 0x00ff_00ff, 2);
  }

  private baueMusik(ctx: BaseAudioContext): void {
    const musikBus = this.musikBus;
    if (!musikBus) return;

    // Jeder Layer bekommt einen Gain, der dauerhaft besteht. Layer werden
    // NIE gestartet oder gestoppt — nur ihre Gains wandern.
    for (const name of LAYER) {
      const gain = ctx.createGain();
      gain.gain.value = GRUNDPEGEL[name];
      gain.connect(musikBus);
      this.layerGains.set(name, gain);
      this.dauerknoten.push(gain);
    }
    // Musik geht ebenfalls in die große Halle — sie soll im Raum stehen,
    // nicht im Kopf des Spielers.
    const musikHall = ctx.createGain();
    musikHall.gain.value = 0.35;
    musikBus.connect(musikHall);
    if (this.hallLangEin) musikHall.connect(this.hallLangEin);
    this.dauerknoten.push(musikHall);

    // Eine ConstantSourceNode je Achse, über Skalierungs-Gains auf alle
    // betroffenen Layer-Gains verteilt. Der Hauptthread setzt damit pro
    // Achsenwechsel genau EINEN Parameter — nicht sechs pro Bild.
    for (const achse of ACHSEN) {
      const quelle = ctx.createConstantSource();
      quelle.offset.value = this.achsenWert[achse];
      for (const name of LAYER) {
        const faktor = ACHSEN_MATRIX[achse][name];
        if (faktor === 0) continue;
        const skalierung = ctx.createGain();
        skalierung.gain.value = faktor;
        quelle.connect(skalierung);
        const ziel = this.layerGains.get(name);
        if (ziel) skalierung.connect(ziel.gain);
        this.dauerknoten.push(skalierung);
      }
      quelle.start(0);
      this.achsenQuellen.set(achse, quelle);
      this.dauerquellen.push(quelle);
    }

    this.baueDrone(ctx);
    this.bauePads(ctx);
    this.baueTextur(ctx);
  }

  /**
   * Layer 0 — Drone. D1 (36,71 Hz), D2 (73,42 Hz) und A2 (110 Hz), also
   * Grundton, Oktave und Quinte. Je zwei Oszillatoren mit ±3 Cent Versatz:
   * die daraus entstehende Schwebung von unter 0,5 Hz lässt den Ton atmen,
   * ohne dass man ein Vibrato hört.
   */
  private baueDrone(ctx: BaseAudioContext): void {
    const ziel = this.layerGains.get('drone');
    if (!ziel) return;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    filter.Q.value = 0.6;
    filter.connect(ziel);
    this.dauerknoten.push(filter);

    const toene = [36.71, 73.42, 110.0];
    const pegel = [0.5, 0.36, 0.2];
    for (let i = 0; i < toene.length; i++) {
      const grund = toene[i] ?? 55;
      for (const versatz of [-3, 3]) {
        const osz = ctx.createOscillator();
        osz.type = i === 0 ? 'sine' : 'triangle';
        osz.frequency.value = grund * cent(versatz);
        const g = ctx.createGain();
        g.gain.value = (pegel[i] ?? 0.2) * 0.5;
        osz.connect(g);
        g.connect(filter);
        osz.start(0);
        this.dauerknoten.push(g);
        this.dauerquellen.push(osz);
      }
    }
  }

  /**
   * Layer 1 und 2 — die beiden Pads.
   *
   * Beide sind Quartenschichtungen (Skalenstufen 0/3/6): tief D3–G3–C4,
   * hoch A4–D5–G5. Quarten legen sich nicht auf Dur oder Moll fest; genau
   * deshalb halten sie stundenlang aus, ohne aufdringlich zu werden.
   * Zwei langsame LFOs (0,05 und 0,07 Hz, absichtlich nicht im Verhältnis
   * kleiner ganzer Zahlen) öffnen und schließen die Tiefpaesse — das Pad
   * atmet, kehrt aber nie an denselben Punkt zurück.
   */
  private bauePads(ctx: BaseAudioContext): void {
    const tief = this.layerGains.get('pad_tief');
    const hoch = this.layerGains.get('pad_hoch');
    if (!tief || !hoch) return;

    const baue = (
      ziel: GainNode,
      stufen: readonly number[],
      grundMidi: number,
      eckHz: number,
      hub: number,
      lfoHz: number,
      wellenform: OscillatorType
    ): void => {
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = eckHz;
      filter.Q.value = 0.7;
      filter.connect(ziel);
      this.dauerknoten.push(filter);

      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = lfoHz;
      const lfoTiefe = ctx.createGain();
      lfoTiefe.gain.value = hub;
      lfo.connect(lfoTiefe);
      lfoTiefe.connect(filter.frequency);
      lfo.start(0);
      this.dauerknoten.push(lfoTiefe);
      this.dauerquellen.push(lfo);

      for (const stufe of stufen) {
        const hz = midiZuHz(skalenTon(grundMidi, DORISCH, stufe));
        for (const versatz of [-6, 6]) {
          const osz = ctx.createOscillator();
          osz.type = wellenform;
          osz.frequency.value = hz * cent(versatz);
          const g = ctx.createGain();
          g.gain.value = 0.12;
          osz.connect(g);
          g.connect(filter);
          osz.start(0);
          this.dauerknoten.push(g);
          this.dauerquellen.push(osz);
        }
      }
    };

    // D3–G3–C4, dumpf, trägt den Boden.
    baue(tief, AKKORDE['heimat'] ?? [0, 3, 6], TONIKA_MIDI, 420, 180, 0.05, 'sawtooth');
    // A4–D5–G5, glaesern, öffnet sich bei Erfolg.
    baue(hoch, AKKORDE['heimat'] ?? [0, 3, 6], TONIKA_MIDI + 19, 1800, 900, 0.07, 'triangle');
  }

  /**
   * Layer 4 — Rauschtextur. Zwei Bandpaesse auf 240 Hz (Lueftungskanal) und
   * 1900 Hz (entfernte Maschine), beide von einem 0,03-Hz-LFO langsam
   * verstimmt. Kein Zufall pro Bild, sondern reine Modulation: das kostet
   * nichts und klingt trotzdem nie zweimal gleich.
   */
  private baueTextur(ctx: BaseAudioContext): void {
    const ziel = this.layerGains.get('textur_rauschen');
    const puffer = this.rauschen;
    if (!ziel || !puffer) return;

    const quelle = ctx.createBufferSource();
    quelle.buffer = puffer;
    quelle.loop = true;
    quelle.start(0);
    this.dauerquellen.push(quelle);

    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.03;
    lfo.start(0);
    this.dauerquellen.push(lfo);

    for (const [mitte, guete, pegel, hub] of [
      [240, 1.4, 0.5, 60],
      [1900, 6, 0.16, 320],
    ] as const) {
      const band = ctx.createBiquadFilter();
      band.type = 'bandpass';
      band.frequency.value = mitte;
      band.Q.value = guete;
      const g = ctx.createGain();
      g.gain.value = pegel;
      quelle.connect(band);
      band.connect(g);
      g.connect(ziel);
      const tiefe = ctx.createGain();
      tiefe.gain.value = hub;
      lfo.connect(tiefe);
      tiefe.connect(band.frequency);
      this.dauerknoten.push(band, g, tiefe);
    }
  }

  // =========================================================================
  // Scheduler (Chris Wilson)
  // =========================================================================

  private starteTakt(): void {
    if (this.takt !== null) return;
    // Ein Offline-Kontext hat keine fortschreitende Zeit — dort wäre der
    // Timer ein reiner Leerlauf. Die erste Planung ist bereits gelaufen.
    if (!this.kontext || !this.istEchtzeit(this.kontext)) return;
    this.takt = setInterval(() => this.plane(), TAKT_MS);
  }

  private haltTakt(): void {
    if (this.takt !== null) {
      clearInterval(this.takt);
      this.takt = null;
    }
  }

  /**
   * Plant alle Ereignisse, die innerhalb des Lookahead-Fensters liegen.
   * Jedes bekommt seine absolute Zeit mit; nichts wird "jetzt" gestartet.
   */
  private plane(): void {
    const ctx = this.kontext;
    if (!ctx || !this.aktiv || this.pausiert) return;
    const jetzt = ctx.currentTime;

    // Nach einem Tabwechsel kann die Notenzeit weit zurückliegen. Dann wird
    // NICHT aufgeholt, sondern neu angesetzt.
    if (this.naechsteNotenzeit < jetzt - 0.5) this.naechsteNotenzeit = jetzt + VORAUSSCHAU;

    let schutz = 0;
    while (this.naechsteNotenzeit < jetzt + VORAUSSCHAU && schutz++ < 64) {
      this.planeSchritt(this.schrittIndex, this.naechsteNotenzeit);
      this.naechsteNotenzeit += this.schrittdauer();
      this.schrittIndex++;
    }
    this.raeumeAuf(jetzt);
  }

  /**
   * Dauer eines Achtels. 66 BPM in Ruhe, 96 BPM bei voller Aktivität —
   * spuerbar dringlicher, aber immer noch Gehgeschwindigkeit.
   */
  private schrittdauer(): number {
    const bpm = 66 + 30 * this.achsenWert.aktivitaet;
    return 30 / bpm;
  }

  /** Ein Achtel: Arpeggio-Note und/oder Metallanschlag, beides sehr sparsam. */
  private planeSchritt(index: number, zeit: number): void {
    const ctx = this.kontext;
    if (!ctx) return;
    const takt = Math.floor(index / 8);
    const schritt = index % 8;

    if (schritt === 0) {
      // Modus am Taktanfang festlegen: Gefahr kippt D-Dorisch nach D-Aeolisch.
      this.skala = this.achsenWert.gefahr > 0.5 ? AEOLISCH : DORISCH;
    }

    // -- Arpeggio ---------------------------------------------------------
    // Vier Takte lang derselbe Akkord, dann der nächste. Gespielt wird nur
    // ein Teil der Achtel; welcher, entscheidet der deterministische Zufall.
    const akkordNamen = ['heimat', 'atem', 'weite', 'senke'] as const;
    const akkord = akkordNamen[Math.floor(takt / 4) % akkordNamen.length] ?? 'heimat';
    const stufen = AKKORDE[akkord] ?? [0, 3, 6];
    const dichte = 0.28 + 0.42 * this.achsenWert.aktivitaet;
    if (zufall(SAAT, 'arpeggio.dichte', takt, schritt) < dichte) {
      const stufe = stufen[schritt % stufen.length] ?? 0;
      const oktave = zufall(SAAT, 'arpeggio.oktave', takt, schritt) < 0.25 ? 7 : 0;
      const hz = midiZuHz(skalenTon(TONIKA_MIDI + 24, this.skala, stufe + oktave));
      this.planeArpeggioNote(ctx, zeit, hz);
    }

    // -- Perkussion -------------------------------------------------------
    // Ein Anschlag auf Stahl, im Schnitt alle paar Takte. Nie auf der Eins:
    // die Halle soll nicht marschieren.
    if (schritt !== 0 && zufall(SAAT, 'perkussion', takt, schritt) < 0.06) {
      const hz = 620 + 380 * zufall(SAAT, 'perkussion.hoehe', takt, schritt);
      this.planeMetall(ctx, zeit, hz);
    }
  }

  /** Eine Arpeggio-Note: Dreieck, 8 ms Anstieg, 900 ms Ausklang. */
  private planeArpeggioNote(ctx: BaseAudioContext, zeit: number, hz: number): void {
    const ziel = this.layerGains.get('arpeggio');
    if (!ziel) return;
    const osz = ctx.createOscillator();
    osz.type = 'triangle';
    osz.frequency.value = hz;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = hz * 6;
    filter.Q.value = 0.8;
    const g = ctx.createGain();
    const ende = anschlag(g.gain, zeit, { spitze: 0.22, anstieg: 0.008, abfall: 0.9 });
    osz.connect(filter);
    filter.connect(g);
    g.connect(ziel);
    osz.start(zeit);
    osz.stop(ende + 0.02);
    this.musikStimmen.push({ kopf: g, knoten: [g, filter], quellen: [osz], ende: ende + 0.05 });
  }

  /** Ein Metallanschlag aus dem Karplus-Strong-Vorrat. */
  private planeMetall(ctx: BaseAudioContext, zeit: number, hz: number): void {
    const ziel = this.layerGains.get('perkussion_metall');
    if (!ziel) return;
    const puffer = this.saite(ctx, 780, 0.985, 0.6);
    const quelle = ctx.createBufferSource();
    quelle.buffer = puffer;
    quelle.playbackRate.value = klemme(hz / 780, 0.5, 2);
    const g = ctx.createGain();
    const ende = anschlag(g.gain, zeit, { spitze: 0.4, anstieg: 0.002, abfall: 0.5 });
    quelle.connect(g);
    g.connect(ziel);
    quelle.start(zeit);
    quelle.stop(ende + 0.02);
    this.musikStimmen.push({ kopf: g, knoten: [g], quellen: [quelle], ende: ende + 0.05 });
  }

  // =========================================================================
  // Stimmenverwaltung
  // =========================================================================

  private starteStimme(
    klang: Klang,
    zeit: number,
    staerke: number,
    ziel: AudioNode,
    zusatz: AudioNode[]
  ): void {
    const ctx = this.kontext;
    if (!ctx) return;
    this.raeumeAuf(ctx.currentTime);

    // Stimmenklau: die aelteste Stimme geht, nicht die neueste. Was gerade
    // ausgelöst wurde, ist fast immer das, worauf der Spieler wartet.
    while (this.stimmenListe.length >= STIMMEN_GRENZE) {
      const aelteste = this.stimmenListe.shift();
      if (!aelteste) break;
      this.stimmeAbwuergen(aelteste, ctx.currentTime);
    }

    const rezept = REZEPTE[klang];
    const kopf = ctx.createGain();
    kopf.gain.value = rezept.pegel * klemme(staerke, 0, 4);
    kopf.connect(ziel);

    const knoten: AudioNode[] = [kopf, ...zusatz];
    if (rezept.kurz > 0 && this.hallKurzEin) {
      const send = ctx.createGain();
      send.gain.value = rezept.kurz;
      kopf.connect(send);
      send.connect(this.hallKurzEin);
      knoten.push(send);
    }
    if (rezept.lang > 0 && this.hallLangEin) {
      const send = ctx.createGain();
      send.gain.value = rezept.lang;
      kopf.connect(send);
      send.connect(this.hallLangEin);
      knoten.push(send);
    }

    const bau: Bau = {
      zeit,
      staerke: klemme(staerke, 0, 4),
      ziel: kopf,
      knoten,
      quellen: [],
      ende: zeit + 0.4,
      nummer: this.ereignisZaehler++,
    };
    this.baueKlang(klang, bau);
    this.stimmenListe.push({
      kopf,
      knoten: bau.knoten,
      quellen: bau.quellen,
      ende: bau.ende + 0.05,
    });
  }

  /** Blendet eine gestohlene Stimme in 12 ms aus, statt sie hart zu kappen. */
  private stimmeAbwuergen(stimme: Stimme, jetzt: number): void {
    try {
      stimme.kopf.gain.cancelScheduledValues(jetzt);
      stimme.kopf.gain.setValueAtTime(stimme.kopf.gain.value, jetzt);
      stimme.kopf.gain.linearRampToValueAtTime(0, jetzt + 0.012);
    } catch {
      // Ein bereits abgeräumter Parameter darf den Stimmenklau nicht stoppen.
    }
    for (const quelle of stimme.quellen) this.stoppeStill(quelle, jetzt + 0.015);
    stimme.ende = jetzt + 0.03;
    this.sterbend.push(stimme);
  }

  /** Trennt verklungene Stimmen vom Graphen — ohne das läuft der Speicher voll. */
  private raeumeAuf(jetzt: number): void {
    for (const liste of [this.stimmenListe, this.sterbend, this.musikStimmen]) {
      for (let i = liste.length - 1; i >= 0; i--) {
        const stimme = liste[i];
        if (!stimme || stimme.ende > jetzt) continue;
        this.stimmeAufloesen(stimme, jetzt);
        liste.splice(i, 1);
      }
    }
  }

  private stimmeAufloesen(stimme: Stimme, jetzt: number): void {
    for (const quelle of stimme.quellen) this.stoppeStill(quelle, jetzt);
    for (const knoten of stimme.knoten) this.trenneStill(knoten);
  }

  private stoppeStill(quelle: AudioScheduledSourceNode, zeit: number): void {
    try {
      quelle.stop(Math.max(0, zeit));
    } catch {
      // `stop` auf einer nie gestarteten oder bereits beendeten Quelle wirft —
      // das ist beim Abräumen belanglos.
    }
    this.trenneStill(quelle);
  }

  private trenneStill(knoten: AudioNode): void {
    try {
      knoten.disconnect();
    } catch {
      // Doppeltes Trennen ist kein Fehler, den irgendjemand sehen müsste.
    }
  }

  // =========================================================================
  // Synthese der Einzelklänge
  // =========================================================================

  /** Ein Oszillator, bereits registriert und verbunden. */
  private osz(bau: Bau, typ: OscillatorType, hz: number): OscillatorNode {
    const ctx = this.kontext;
    if (!ctx) throw new Error('Klangwerk ohne Kontext');
    const osz = ctx.createOscillator();
    osz.type = typ;
    osz.frequency.value = hz;
    bau.quellen.push(osz);
    return osz;
  }

  private gain(bau: Bau, wert: number): GainNode {
    const ctx = this.kontext;
    if (!ctx) throw new Error('Klangwerk ohne Kontext');
    const g = ctx.createGain();
    g.gain.value = wert;
    bau.knoten.push(g);
    return g;
  }

  private filter(bau: Bau, typ: BiquadFilterType, hz: number, guete: number): BiquadFilterNode {
    const ctx = this.kontext;
    if (!ctx) throw new Error('Klangwerk ohne Kontext');
    const f = ctx.createBiquadFilter();
    f.type = typ;
    f.frequency.value = hz;
    f.Q.value = guete;
    bau.knoten.push(f);
    return f;
  }

  /** Ein Ausschnitt aus dem globalen Rauschpuffer, an zufälliger Stelle. */
  private rausch(bau: Bau, dauer: number): AudioBufferSourceNode {
    const ctx = this.kontext;
    if (!ctx) throw new Error('Klangwerk ohne Kontext');
    const quelle = ctx.createBufferSource();
    quelle.buffer = this.rauschen;
    quelle.loop = true;
    const versatz = zufall(SAAT, 'rausch.versatz', bau.nummer) * 0.9;
    quelle.start(bau.zeit, versatz);
    quelle.stop(bau.zeit + dauer + 0.02);
    bau.quellen.push(quelle);
    return quelle;
  }

  /** Gezupfte Metallsaite aus dem Puffervorrat (wird einmal gerechnet). */
  private saite(
    ctx: BaseAudioContext,
    hz: number,
    daempfung: number,
    sekunden: number
  ): AudioBuffer {
    const schluessel = Math.round(hz);
    const vorhanden = this.saiten.get(schluessel);
    if (vorhanden) return vorhanden;
    const puffer = karplusStrongPuffer(ctx, {
      frequenzHz: hz,
      sekunden,
      daempfung,
      glaettung: 0.55,
      saat: SAAT ^ schluessel,
    });
    this.saiten.set(schluessel, puffer);
    return puffer;
  }

  /** Anschlag einer Saite in eine Stimme hinein. */
  private zupfe(bau: Bau, hz: number, dauer: number, spitze: number, daempfung = 0.994): void {
    const ctx = this.kontext;
    if (!ctx) return;
    const puffer = this.saite(ctx, hz, daempfung, Math.min(1.2, dauer + 0.1));
    const quelle = ctx.createBufferSource();
    quelle.buffer = puffer;
    bau.quellen.push(quelle);
    const g = this.gain(bau, 0);
    const ende = anschlag(g.gain, bau.zeit, { spitze, anstieg: 0.002, abfall: dauer });
    quelle.connect(g);
    g.connect(bau.ziel);
    quelle.start(bau.zeit);
    quelle.stop(ende + 0.02);
    bau.ende = Math.max(bau.ende, ende);
  }

  /** Gefilterter Rauschimpuls — die Grundform aller Klicks und Schläge. */
  private impuls(
    bau: Bau,
    typ: BiquadFilterType,
    vonHz: number,
    nachHz: number,
    guete: number,
    dauer: number,
    spitze: number
  ): void {
    const quelle = this.rausch(bau, dauer);
    const f = this.filter(bau, typ, vonHz, guete);
    rampe(f.frequency, bau.zeit, vonHz, nachHz, dauer);
    const g = this.gain(bau, 0);
    const ende = anschlag(g.gain, bau.zeit, {
      spitze,
      anstieg: Math.min(0.006, dauer * 0.2),
      abfall: dauer,
    });
    quelle.connect(f);
    f.connect(g);
    g.connect(bau.ziel);
    bau.ende = Math.max(bau.ende, ende);
  }

  /** Ein gestimmter Ton mit fester Tonhöhe. */
  private ton(
    bau: Bau,
    typ: OscillatorType,
    hz: number,
    dauer: number,
    spitze: number,
    anstieg = 0.004
  ): OscillatorNode {
    const osz = this.osz(bau, typ, hz);
    const g = this.gain(bau, 0);
    const ende = anschlag(g.gain, bau.zeit, { spitze, anstieg, abfall: dauer });
    osz.connect(g);
    g.connect(bau.ziel);
    osz.start(bau.zeit);
    osz.stop(ende + 0.02);
    bau.ende = Math.max(bau.ende, ende);
    return osz;
  }

  /** Ein Gleitton — die Richtung trägt die Bedeutung: hoch = an, runter = aus. */
  private gleitton(
    bau: Bau,
    typ: OscillatorType,
    vonHz: number,
    nachHz: number,
    dauer: number,
    spitze: number
  ): void {
    const osz = this.ton(bau, typ, vonHz, dauer, spitze, 0.01);
    rampe(osz.frequency, bau.zeit, vonHz, nachHz, dauer);
  }

  /**
   * Zwei-Operator-FM. `verhaeltnis` unter 1 oder irrational erzeugt
   * unharmonische Teiltoene — genau das, was einen Alarm alarmierend macht.
   */
  private fm(
    bau: Bau,
    traegerHz: number,
    verhaeltnis: number,
    index: number,
    dauer: number,
    spitze: number
  ): void {
    const traeger = this.osz(bau, 'sine', traegerHz);
    const modulator = this.osz(bau, 'sine', traegerHz * verhaeltnis);
    const hub = this.gain(bau, traegerHz * index);
    modulator.connect(hub);
    hub.connect(traeger.frequency);
    const g = this.gain(bau, 0);
    const ende = anschlag(g.gain, bau.zeit, { spitze, anstieg: 0.006, abfall: dauer });
    traeger.connect(g);
    g.connect(bau.ziel);
    modulator.start(bau.zeit);
    traeger.start(bau.zeit);
    modulator.stop(ende + 0.02);
    traeger.stop(ende + 0.02);
    bau.ende = Math.max(bau.ende, ende);
  }

  /**
   * Die Klangfamilie des Spiels.
   *
   * Alles ist auf D-Dorisch bezogen; das UI-Kit hat seinen Grundton bei
   * D5 = 587,33 Hz. Kein Klang dauert länger als 400 ms — außer
   * `level_bestanden`, der als einziger 2,5 s bekommt, weil er das Ende
   * eines Kapitels markiert.
   */
  private baueKlang(klang: Klang, bau: Bau): void {
    const f0 = UI_GRUND_HZ;
    switch (klang) {
      // -- Bedienung ------------------------------------------------------
      case 'ui_zeiger':
        // Ein Hauch: Sinus auf D6, 4 ms an, 40 ms aus.
        this.ton(bau, 'sine', f0 * 2, 0.04, 0.5, 0.004);
        break;

      case 'ui_waehlen':
        // Quinte D5 + A5, 60 ms. Bestaetigend, weil rein gestimmt.
        this.ton(bau, 'triangle', f0, 0.06, 0.6, 0.002);
        this.ton(bau, 'triangle', f0 * 1.5, 0.07, 0.35, 0.002);
        this.impuls(bau, 'bandpass', 1900, 1400, 6, 0.035, 0.5);
        break;

      case 'ui_abbruch':
        // Dieselbe Quinte, aber abwärts gelesen: A5 nach D5.
        this.gleitton(bau, 'triangle', f0 * 1.5, f0, 0.09, 0.55);
        break;

      case 'ui_fehler': {
        // PFLICHT: Grundton 440 Hz mit hörbarer Schwebung um 25 Hz.
        // Der zweite Oszillator liegt bei 465 Hz — die Differenz ist die
        // Schwebungsfrequenz, 25 Schwankungen pro Sekunde. Das liegt unter
        // der Tonhöhenschwelle und wird als Rauheit gehört, nicht als
        // zweiter Ton. Zusammen mit dem Tiefpass bei 1200 Hz klingt es
        // stumpf und unangenehm, ohne laut zu sein.
        const tiefpass = this.filter(bau, 'lowpass', 1200, 0.8);
        tiefpass.connect(bau.ziel);
        const huelle = this.gain(bau, 0);
        const ende = anschlag(huelle.gain, bau.zeit, {
          spitze: 0.7,
          anstieg: 0.006,
          abfall: 0.38,
        });
        huelle.connect(tiefpass);
        for (const hz of [440, 465]) {
          const osz = this.osz(bau, 'sine', hz);
          const g = this.gain(bau, 0.5);
          osz.connect(g);
          g.connect(huelle);
          osz.start(bau.zeit);
          osz.stop(ende + 0.02);
        }
        bau.ende = Math.max(bau.ende, ende);
        break;
      }

      // -- Bauen ----------------------------------------------------------
      case 'modul_setzen':
        // Ein Modul kommt auf den Boden: erst der Schlag (Sinus 190 → 52 Hz),
        // dann das Nachschwingen des Gehaeuses (Karplus-Strong auf D3).
        this.gleitton(bau, 'sine', 190, 52, 0.09, 0.9);
        this.impuls(bau, 'lowpass', 2500, 700, 0.9, 0.02, 0.6);
        this.zupfe(bau, 146.83, 0.3, 0.35, 0.992);
        break;

      case 'modul_entfernen':
        // Rückwärts gedacht: erst Schaben, dann Nachlassen.
        this.impuls(bau, 'lowpass', 4200, 400, 1.1, 0.18, 0.55);
        this.gleitton(bau, 'sine', 120, 60, 0.16, 0.4);
        break;

      case 'modul_drehen':
        // Zwei kurze Rasten, 45 ms auseinander — eine Sperrklinke.
        this.impuls(bau, 'bandpass', 1200, 1200, 9, 0.02, 0.6);
        this.klickNach(bau, 0.045, 1500, 0.45);
        break;

      case 'leitung_verbinden':
        // Eine Leitung rastet ein: Saite auf D4, dazu ein aufsteigender
        // Hauch von 320 auf 640 Hz.
        this.zupfe(bau, 293.66, 0.26, 0.5, 0.995);
        this.gleitton(bau, 'sine', 320, 640, 0.14, 0.25);
        break;

      case 'leitung_trennen':
        // Abgezogen: Rauschen fällt, Ton fällt mit.
        this.impuls(bau, 'bandpass', 2600, 600, 3, 0.16, 0.5);
        this.gleitton(bau, 'sine', 300, 150, 0.18, 0.3);
        break;

      // -- Simulation -----------------------------------------------------
      case 'sim_start':
        // Die Anlage nimmt Fahrt auf: Quinte aufwärts, dazu Luft.
        this.gleitton(bau, 'triangle', 110, 220, 0.36, 0.5);
        this.impuls(bau, 'bandpass', 400, 2400, 1.2, 0.34, 0.28);
        break;

      case 'sim_pause':
        // Und wieder herunter.
        this.gleitton(bau, 'triangle', 220, 110, 0.3, 0.45);
        this.impuls(bau, 'lowpass', 2400, 500, 1, 0.28, 0.2);
        break;

      case 'sim_tick':
        // Das leiseste Ereignis im Spiel — man hört es nur, wenn man darauf achtet.
        this.impuls(bau, 'bandpass', 2200, 2200, 12, 0.012, 0.45);
        break;

      // -- Pakete ---------------------------------------------------------
      case 'paket_eintritt':
        // Ein Auftrag tritt ein: D5, kurz angezupft.
        this.ton(bau, 'sine', f0, 0.12, 0.55, 0.003);
        this.impuls(bau, 'highpass', 3000, 5000, 0.8, 0.03, 0.25);
        break;

      case 'paket_auslieferung':
        // Zwei Toene, D5 → A5: die Quinte als Zeichen des Gelingens.
        this.ton(bau, 'triangle', f0, 0.1, 0.5, 0.003);
        this.tonNach(bau, 0.08, f0 * 1.5, 0.14, 0.45);
        break;

      case 'paket_verworfen':
        // Etwas fällt herunter und bleibt liegen: Ringmodulation macht den
        // Klang unrund, ohne ihn laut zu machen.
        this.gleitton(bau, 'sine', 140, 38, 0.11, 0.8);
        this.impuls(bau, 'lowpass', 900, 300, 0.9, 0.18, 0.5);
        this.fm(bau, 61, 1.4262, 1.6, 0.2, 0.22);
        break;

      // -- Warnungen ------------------------------------------------------
      case 'alarm':
        // FM mit unharmonischem Verhältnis: zwei Pulse, wie ein Melder,
        // der sich meldet und dann wartet.
        this.fm(bau, 330, 1.7071, 2.2, 0.14, 0.8);
        this.fmNach(bau, 0.19, 330, 1.7071, 2.2, 0.14, 0.7);
        break;

      case 'schleife':
        // Eine Schleife klingt wie ein Klang, der sich selbst einholt:
        // dieselbe Figur zweimal, das zweite Mal leicht verstimmt.
        this.fm(bau, 174.61, 1.5, 1.1, 0.16, 0.55);
        this.fmNach(bau, 0.13, 174.61 * cent(-14), 1.5, 1.3, 0.18, 0.5);
        break;

      case 'freigabe_mensch':
        // Ein Mensch entscheidet: warm, zwei Toene im Terzabstand, weich
        // angeblasen. Der einzige Klang mit langsamem Anstieg (40 ms).
        this.ton(bau, 'sine', 440, 0.34, 0.5, 0.04);
        this.ton(bau, 'sine', 554.37, 0.32, 0.32, 0.05);
        break;

      // -- Fortschritt ----------------------------------------------------
      case 'ziel_erreicht':
        // Aufsteigende Quarten aus dem Grundakkord, 70 ms Abstand.
        this.ton(bau, 'triangle', midiZuHz(skalenTon(TONIKA_MIDI + 24, DORISCH, 0)), 0.1, 0.45);
        this.tonNach(bau, 0.07, midiZuHz(skalenTon(TONIKA_MIDI + 24, DORISCH, 3)), 0.12, 0.4);
        this.tonNach(bau, 0.14, midiZuHz(skalenTon(TONIKA_MIDI + 24, DORISCH, 6)), 0.22, 0.4);
        break;

      case 'level_bestanden': {
        // Der einzige lange Klang: ein Quartenakkord über drei Oktaven,
        // 400 ms Anstieg, 2 s Ausklang. Keine Fanfare — eher, als würde in
        // der Halle das Licht angehen.
        const stufen = [0, 3, 6, 10, 13];
        for (let i = 0; i < stufen.length; i++) {
          const hz = midiZuHz(skalenTon(TONIKA_MIDI + 12, DORISCH, stufen[i] ?? 0));
          const osz = this.osz(bau, i < 2 ? 'sine' : 'triangle', hz * cent(i % 2 === 0 ? -4 : 4));
          const g = this.gain(bau, 0);
          const start = bau.zeit + i * 0.06;
          setze(g.gain, start, 0);
          g.gain.linearRampToValueAtTime(0.24 - i * 0.03, start + 0.4);
          g.gain.linearRampToValueAtTime(0, start + 2.4);
          osz.connect(g);
          g.connect(bau.ziel);
          osz.start(start);
          osz.stop(start + 2.45);
          bau.ende = Math.max(bau.ende, start + 2.45);
        }
        break;
      }

      case 'level_gescheitert':
        // D2 und Es2 zusammen: eine kleine Sekunde ganz unten, 4,4 Hz
        // Schwebung. Nicht laut, nur endgültig.
        this.ton(bau, 'sine', 73.42, 0.4, 0.7, 0.02);
        this.ton(bau, 'sine', 77.78, 0.4, 0.6, 0.02);
        this.impuls(bau, 'lowpass', 600, 180, 0.7, 0.3, 0.2);
        break;

      // -- Notizbuch ------------------------------------------------------
      case 'notiz_beginn':
        // Ein Glockchen auf D6 und dazu Papier.
        this.ton(bau, 'sine', 1174.66, 0.24, 0.3, 0.002);
        this.impuls(bau, 'bandpass', 3200, 1800, 1.6, 0.12, 0.3);
        break;

      case 'seite_blaettern':
        // Nur Papier: Rauschen mit fallendem Bandpass.
        this.impuls(bau, 'bandpass', 4200, 1200, 1.1, 0.15, 0.45);
        break;

      default:
        // `Klang` ist eine geschlossene Union — dieser Zweig ist unerreichbar.
        break;
    }
  }

  /** Ein zweiter Klick nach `versatz` Sekunden (Sperrklinken, Doppelschläge). */
  private klickNach(bau: Bau, versatz: number, hz: number, spitze: number): void {
    const ctx = this.kontext;
    if (!ctx) return;
    const zeit = bau.zeit + versatz;
    const quelle = ctx.createBufferSource();
    quelle.buffer = this.rauschen;
    quelle.loop = true;
    quelle.start(zeit, zufall(SAAT, 'klick.versatz', bau.nummer) * 0.9);
    quelle.stop(zeit + 0.05);
    bau.quellen.push(quelle);
    const f = this.filter(bau, 'bandpass', hz, 9);
    const g = this.gain(bau, 0);
    const ende = anschlag(g.gain, zeit, { spitze, anstieg: 0.001, abfall: 0.022 });
    quelle.connect(f);
    f.connect(g);
    g.connect(bau.ziel);
    bau.ende = Math.max(bau.ende, ende);
  }

  /** Ein Ton, der erst nach `versatz` Sekunden einsetzt. */
  private tonNach(bau: Bau, versatz: number, hz: number, dauer: number, spitze: number): void {
    const zeit = bau.zeit + versatz;
    const osz = this.osz(bau, 'triangle', hz);
    const g = this.gain(bau, 0);
    const ende = anschlag(g.gain, zeit, { spitze, anstieg: 0.004, abfall: dauer });
    osz.connect(g);
    g.connect(bau.ziel);
    osz.start(zeit);
    osz.stop(ende + 0.02);
    bau.ende = Math.max(bau.ende, ende);
  }

  /** Ein FM-Puls mit Versatz — für Melder, die zweimal schlagen. */
  private fmNach(
    bau: Bau,
    versatz: number,
    traegerHz: number,
    verhaeltnis: number,
    index: number,
    dauer: number,
    spitze: number
  ): void {
    const zeit = bau.zeit + versatz;
    const traeger = this.osz(bau, 'sine', traegerHz);
    const modulator = this.osz(bau, 'sine', traegerHz * verhaeltnis);
    const hub = this.gain(bau, traegerHz * index);
    modulator.connect(hub);
    hub.connect(traeger.frequency);
    const g = this.gain(bau, 0);
    const ende = anschlag(g.gain, zeit, { spitze, anstieg: 0.006, abfall: dauer });
    traeger.connect(g);
    g.connect(bau.ziel);
    modulator.start(zeit);
    traeger.start(zeit);
    modulator.stop(ende + 0.02);
    traeger.stop(ende + 0.02);
    bau.ende = Math.max(bau.ende, ende);
  }

  // =========================================================================
  // Hilfsfragen
  // =========================================================================

  /** Echtzeit-Kontext (Browser) oder Offline-Kontext (Test, Vorberechnung)? */
  private istEchtzeit(ctx: BaseAudioContext): ctx is AudioContext {
    return !('startRendering' in ctx) && typeof (ctx as AudioContext).resume === 'function';
  }
}

/** Master-Pegel: lässt dem Limiter Luft, damit er nur Spitzen fasst. */
const MASTER_PEGEL = 0.9;
/** Grundpegel des Musikbusses vor dem Nutzerregler. */
const MUSIK_PEGEL = 0.55;
/** Grundpegel des Klangbusses vor dem Nutzerregler. */
const KLANG_PEGEL = 0.8;
