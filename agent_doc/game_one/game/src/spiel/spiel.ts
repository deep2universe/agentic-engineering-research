/**
 * Das Spiel: verbindet Simulation, Halle, Werkansicht, Kamera, Eingabe und HUD.
 *
 * Ablauf eines Levels (Produktions-Bibel 5.1):
 *   Briefing → Bauen → Simulationslauf → Diagnose → Iteration → Auswertung
 *
 * Die Simulation läuft mit festem Zeitschritt; das Bild interpoliert nur.
 * Damit ist der Ablauf unabhängig von der Bildrate und jederzeit exakt
 * wiederholbar — die Voraussetzung für Zeit-Debugger, Wiedergabe und
 * Bildvergleichstests.
 */

import * as THREE from 'three/webgpu';
import { Renderwerk, type Bildguete, type TemporalModus } from '../engine/renderwerk';
import { Kamerafuehrung } from '../engine/kamera';
import { Zeigerquelle, type Geste, type ZeigerZustand } from '../engine/zeigerquelle';
import { Halle } from '../welt/halle';
import { WerkAnsicht } from '../welt/werk_ansicht';
import { uPuls, uZeit } from '../welt/aussehen';
import { Hud, type Modus } from '../ui/hud';
import { Fokusring } from '../ui/fokusring';
import { befehlFuer, type Befehl } from '../ui/keymap';
import { BauZustand } from './bauzustand';
import { Erzaehlung } from './erzaehlung';
import { Klangregie } from './klangregie';
import { Schmiedebank } from './schmiedebank';
import { METRIK_NAME, hatSchmiede, schmiedeAufgabeAus } from './schmiede_aufgabe';
import { Simulation } from '../sim/simulation';
import { bewerte, type Bewertung } from '../sim/ziele';
import { AKTE, ALLE_LEVEL, naechstesLevel } from '../inhalt/kampagne';
import { KATALOG, BAUBAR } from '../sim/katalog';
import type { LevelDefinition } from '../inhalt/level_typen';
import type { Metriken, ModulArt, Werk } from '../sim/typen';

export type Phase = 'briefing' | 'bauen' | 'simulation' | 'auswertung';

const TICK_MS = 1000 / 12; // Basistakt der Simulation bei Tempo 1x.

export interface SpielOptionen {
  readonly leinwand: HTMLCanvasElement;
  readonly hudZiel: HTMLElement;
  readonly guete?: Bildguete;
  readonly erzwingeWebGL?: boolean;
  /** Im Testbetrieb läuft KEINE eigene Bildschleife — Bilder kommen per Aufruf. */
  readonly ohneSchleife?: boolean;
  /** Diagnose: ohne Post-Processing rendern. */
  readonly ohnePost?: boolean;
  readonly reduzierteBewegung?: boolean;
  /**
   * Kein Ton. Bildvergleichstests brauchen keinen AudioContext, und ein
   * Browser, der zwanzig Testläufe lang Kontexte öffnet, wird langsam.
   */
  readonly ohneKlang?: boolean;
}

export class Spiel {
  readonly renderwerk: Renderwerk;
  readonly halle: Halle;
  readonly ansicht: WerkAnsicht;
  readonly kamera: Kamerafuehrung;
  readonly hud: Hud;
  readonly klang: Klangregie;
  readonly erzaehlung = new Erzaehlung();
  bau: BauZustand;

  level: LevelDefinition;
  phase: Phase = 'briefing';
  sim: Simulation | null = null;
  letzteBewertung: Bewertung | null = null;

  private modus: Modus = 'bauen';
  private gewaehltesModul: ModulArt = 'kern';
  private auswahl: string[] = [];
  private leitungsStart: { modulId: string; port: string } | null = null;
  private zeigerFeld = { x: 0, z: 0 };
  private readonly gedrueckt = new Set<string>();

  private tempo = 4;
  private tickRest = 0;
  private laeuft = false;
  private spielzeit = 0;
  private letzteZeit = 0;
  private schleifeAn = false;
  private readonly zeiger: Zeigerquelle;
  private readonly abbau: Array<() => void> = [];
  private monolithWerte: Metriken | null = null;
  /** Bis zu diesem Tick wurden Ereignisse bereits vertont. */
  private vertontBis = 0;
  private readonly klangErlaubt: boolean;
  private letzteMetriken: Metriken | null = null;
  private readonly blickHilfe = new THREE.Vector3();
  /** Was nach dem Schließen der Akttafel passieren soll. */
  private tafelDann: (() => void) | null = null;
  private readonly strahl = new THREE.Raycaster();
  private readonly fokusring: Fokusring;
  /** Die Werkbank des laufenden Levels. Entsteht erst, wenn eine Schmiede steht. */
  private bank: Schmiedebank | null = null;

  private constructor(renderwerk: Renderwerk, opt: SpielOptionen, start: LevelDefinition) {
    this.renderwerk = renderwerk;
    this.level = start;
    this.halle = new Halle();
    this.ansicht = new WerkAnsicht(this.halle);
    this.kamera = new Kamerafuehrung(renderwerk.kamera);
    this.bau = new BauZustand(start.vorbau);
    this.klangErlaubt = opt.ohneKlang !== true;
    this.klang = new Klangregie();

    renderwerk.szene.add(this.halle.wurzel, this.ansicht.wurzel);
    renderwerk.setzeHauptlicht(this.halle.sonne);
    renderwerk.szene.background = new THREE.Color(0x080b11);
    renderwerk.szene.fog = new THREE.FogExp2(0x0e141c, 0.021);

    this.hud = new Hud(opt.hudZiel, {
      aufModulWahl: (a) => {
        this.gewaehltesModul = a;
        this.setzeModus('bauen');
        this.klang.spiele('ui_waehlen');
      },
      aufStart: () => this.starteOderPausiere(),
      aufZuruecksetzen: () => this.setzeZurueck(),
      aufTempo: (t) => {
        this.tempo = t;
      },
      aufBriefingSchliessen: () => {
        this.hud.schliesseBriefing();
        this.phase = 'bauen';
        this.hud.setzeKontext(this.modus);
        this.klang.spiele('seite_blaettern');
      },
      aufWeiter: () => this.weiter(),
      aufTafelSchliessen: () => this.tafelGeschlossen(),
      aufNochmal: () => {
        this.hud.schliesseErgebnis();
        this.phase = 'bauen';
        this.beendeSimulation();
        this.klang.spiele('ui_abbruch');
      },
    });

    this.zeiger = new Zeigerquelle({
      leinwand: opt.leinwand,
      aufGeste: (g) => this.aufGeste(g),
      aufZeigerAb: (z) => this.aufZeigerAb(z),
      aufZeigerAuf: () => undefined,
      aufZeigerBewegt: (z) => this.aufZeigerBewegt(z),
    });

    if (opt.reduzierteBewegung === true) this.setzeReduzierteBewegung(true);
    /*
     * Der Fokusring hält die Tabulatortaste im Spiel. Ohne ihn fällt der
     * Fokus nach wenigen Tabs auf <body>, und wer ohne Maus arbeitet, steht
     * vor einer Leinwand, die auf nichts mehr reagiert.
     */
    // Der Ring umfasst den ganzen Seitenkörper, nicht nur das HUD: die
    // Leinwand ist selbst fokussierbar (role="application") und muss in der
    // Tabfolge liegen, sonst ist der Bauplatz mit der Tastatur unerreichbar.
    this.fokusring = new Fokusring(opt.leinwand.ownerDocument.body, () => this.hud.offenerDialog());
    this.bindeTastatur();
    this.bindeGroesse(opt.leinwand);
    this.bindeKlangstart();
    this.ladeLevel(start.id);
  }

  static async erzeuge(opt: SpielOptionen): Promise<Spiel> {
    const renderwerk = await Renderwerk.erzeuge({
      leinwand: opt.leinwand,
      ...(opt.guete !== undefined ? { guete: opt.guete } : {}),
      ...(opt.erzwingeWebGL !== undefined ? { erzwingeWebGL: opt.erzwingeWebGL } : {}),
      ...(opt.reduzierteBewegung !== undefined ? { reduzierteBewegung: opt.reduzierteBewegung } : {}),
      ...(opt.ohnePost !== undefined ? { ohnePost: opt.ohnePost } : {}),
    });
    const start = ALLE_LEVEL[0];
    if (!start) throw new Error('Die Kampagne enthält kein einziges Level.');
    const spiel = new Spiel(renderwerk, opt, start);
    if (opt.ohneSchleife !== true) spiel.starteSchleife();
    return spiel;
  }

  // -------------------------------------------------------------------------
  // Level
  // -------------------------------------------------------------------------

  ladeLevel(id: string, saat?: number): void {
    const level = ALLE_LEVEL.find((l) => l.id === id);
    if (!level) throw new Error(`Unbekanntes Level: ${id}`);
    this.level = saat === undefined ? level : ({ ...level, saat } as LevelDefinition);
    this.beendeSimulation();
    this.bau = new BauZustand(level.vorbau);
    this.ansicht.setzeWerk(this.bau.werk());
    this.auswahl = [];
    this.leitungsStart = null;
    this.bank = null;
    this.phase = 'briefing';

    const akt = AKTE.find((a) => a.nummer === level.akt);
    this.hud.zeigeLevel(this.level, akt?.titel ?? '');
    this.gewaehltesModul = this.hud.modulWahl();

    this.monolithWerte = level.monolith
      ? new Simulation({ werk: level.monolith, strom: this.level.strom, saat: this.level.saat }).laufeDurch().metriken
      : null;

    // Die Halle bekommt die Fundstücke des Akts. Sie wachsen mit: was in Akt
    // III dazukommt, liegt in Akt VII immer noch da.
    const at = this.erzaehlung.text(level.akt);
    const stuecke = this.erzaehlung.fundstuecke(level.akt);
    this.halle.setzeFundstuecke(stuecke);
    for (const f of stuecke) if (this.erzaehlung.istGelesen(f.id)) this.halle.markiereGelesen(f.id);
    this.hud.setzeErzaehltexte(
      at.monolith,
      this.erzaehlung.offeneFragen(level.akt).map((r) => r.frage)
    );

    this.hud.zeigeMetriken(this.leereMetriken(), this.level);
    this.hud.setzeStartText('Simulation starten');
    this.kamera.uebersicht();
    this.aktualisiereSchattenbaum();

    /*
     * Reihenfolge: erst die Akttafel, dann der Auftrag.
     *
     * Der kalte Einstieg läuft genau einmal je Akt. Wer ein Level wiederholt,
     * bekommt sofort den Auftrag — sonst liest man denselben Absatz beim
     * dritten Versuch zum dritten Mal, und Atmosphäre wird zur Wartezeit.
     */
    const auftritt = this.erzaehlung.betritt(level.akt);
    if (auftritt.einstieg) {
      this.tafelDann = () => this.zeigeAuftrag();
      this.hud.zeigeAkttafel(
        'einstieg',
        level.akt,
        auftritt.einstieg.titel,
        auftritt.einstieg.untertitel,
        auftritt.einstieg.einstieg,
        'Halle betreten',
        auftritt.aufloesungen.map((r) => ({ frage: r.frage, antwort: r.antwort }))
      );
      this.klang.spiele('notiz_beginn');
    } else {
      this.zeigeAuftrag();
    }
  }

  private zeigeAuftrag(): void {
    const akt = AKTE.find((a) => a.nummer === this.level.akt);
    this.hud.zeigeBriefing(this.level, akt?.titel ?? '', this.monolithWerte);
  }

  /** Die Akttafel wurde geschlossen — weiter mit dem, was danach dran war. */
  private tafelGeschlossen(): void {
    this.hud.schliesseAkttafel();
    const dann = this.tafelDann;
    this.tafelDann = null;
    this.klang.spiele('seite_blaettern');
    if (dann) dann();
    else {
      this.phase = 'bauen';
      this.hud.setzeKontext(this.modus);
    }
  }

  private weiter(): void {
    this.hud.schliesseErgebnis();
    if (this.letzteBewertung?.bestanden === true) {
      const naechstes = naechstesLevel(this.level.id);
      const alterAkt = this.level.akt;
      if (naechstes) {
        /*
         * Aktwechsel: erst der Schlusssatz des alten Akts, dann das nächste
         * Level. Der Satz steht allein auf der Tafel und trägt keine
         * Bewertung — er ist der Nachhall, nicht die Auswertung. Die stand
         * gerade eben im Ergebnisblatt.
         */
        if (naechstes.akt !== alterAkt) {
          const alt = this.erzaehlung.text(alterAkt);
          this.tafelDann = () => this.ladeLevel(naechstes.id);
          this.hud.zeigeAkttafel(
            'schluss',
            alterAkt,
            alt.titel,
            alt.lehre,
            alt.schlusssatz,
            'Weiter'
          );
          this.klang.spiele('ziel_erreicht');
          return;
        }
        this.ladeLevel(naechstes.id);
        return;
      }
      // Ende der Kampagne: der letzte Schlusssatz bleibt stehen.
      const letzter = this.erzaehlung.text(alterAkt);
      this.tafelDann = null;
      this.hud.zeigeAkttafel('schluss', alterAkt, letzter.titel, letzter.lehre, letzter.schlusssatz, 'Halle verlassen');
      this.klang.spiele('level_bestanden');
      return;
    }
    this.phase = 'bauen';
    this.beendeSimulation();
  }

  /**
   * Kennzahlen im Ruhezustand: nichts ist gelaufen, aber etwas ist gebaut.
   *
   * Der erste Entwurf hat hier ein LEERES Werk simuliert. Ergebnis: Über einem
   * fertig verdrahteten Werk aus neun Modulen stand "Module 0". Das ist die
   * einzige Zahl, die auch ohne Lauf einen Wert hat — sie zählt, was auf dem
   * Fundament steht, nicht was durchgelaufen ist.
   */
  private leereMetriken(): Metriken {
    return new Simulation({
      werk: this.bau.werk(),
      strom: { ...this.level.strom, anzahl: 0 },
      saat: this.level.saat,
    })
      .laufeDurch()
      .metriken;
  }

  // -------------------------------------------------------------------------
  // Simulation
  // -------------------------------------------------------------------------

  starteOderPausiere(): void {
    if (this.phase === 'simulation') {
      this.laeuft = !this.laeuft;
      this.hud.setzeStartText(this.laeuft ? 'Pause' : 'Weiter');
      this.klang.spiele(this.laeuft ? 'sim_start' : 'sim_pause');
      return;
    }
    const befunde = this.bau.befunde();
    const fehler = befunde.filter((b) => b.stufe === 'fehler');
    if (fehler.length) {
      this.hud.melde(fehler[0]!.text, 'fehler');
      this.klang.spiele('ui_fehler');
      if (fehler[0]!.modulId) this.ansicht.setzeHervorhebung([fehler[0]!.modulId], 'fehler');
      return;
    }
    this.sim = new Simulation({ werk: this.bau.werk(), strom: this.level.strom, saat: this.level.saat });
    this.phase = 'simulation';
    this.laeuft = true;
    this.tickRest = 0;
    this.vertontBis = 0;
    this.klang.spiele('sim_start');
    this.hud.setzeStartText('Pause');
    this.hud.melde(`${this.level.strom.anzahl} Aufträge laufen ein.`);
    this.ansicht.setzeHervorhebung([], 'auswahl');
  }

  private beendeSimulation(): void {
    this.sim = null;
    this.laeuft = false;
    this.vertontBis = 0;
    this.letzteMetriken = null;
    this.ansicht.ruhe();
    this.hud.setzeStartText('Simulation starten');
    this.hud.zeigeMetriken(this.leereMetriken(), this.level);
    this.hud.zeigeZiele(this.level, null);
  }

  private setzeZurueck(): void {
    if (this.phase === 'simulation') {
      this.beendeSimulation();
      this.phase = 'bauen';
      return;
    }
    this.bau.leere(this.level.vorbau);
    this.ansicht.setzeWerk(this.bau.werk());
    this.auswahl = [];
    this.hud.melde('Werk geleert.');
    this.aktualisiereSchattenbaum();
  }

  /** Führt genau einen Simulationsschritt aus. Auch für Tests und Einzeltick. */
  simulationsTick(anzahl = 1): void {
    if (!this.sim) return;
    for (let i = 0; i < anzahl && !this.sim.fertig; i++) this.sim.tick();
    const m = this.sim.metriken();
    this.letzteMetriken = m;
    this.hud.zeigeMetriken(m, this.level);
    const b = bewerte(this.level.ziele, this.level.budget, m);
    this.hud.zeigeZiele(this.level, b);
    // Vertonung NACH der Auswertung der Kennzahlen, aber VOR `werteAus` —
    // sonst überlagert das Abschlussmotiv die letzten Auslieferungen.
    this.vertone();
    if (this.sim.fertig) this.werteAus();
  }

  /**
   * Reicht die seit dem letzten Aufruf entstandenen Ereignisse an die
   * Klangregie durch.
   *
   * Der Merker `vertontBis` ist nötig, weil ein Bild bei hohem Tempo mehrere
   * Ticks abarbeitet: ohne ihn würde dieselbe Auslieferung mehrfach klingen.
   */
  private vertone(): void {
    if (!this.sim) return;
    this.klang.vertoneEreignisse(this.sim.ereignisse, this.vertontBis, this.tempo);
    this.vertontBis = this.sim.taktZahl + 1;
  }

  private werteAus(): void {
    if (!this.sim) return;
    const m = this.sim.metriken();
    this.letzteBewertung = bewerte(this.level.ziele, this.level.budget, m);
    this.laeuft = false;
    this.phase = 'auswertung';
    this.hud.zeigeErgebnis(this.level, this.letzteBewertung, m);
    this.klang.spiele(this.letzteBewertung.bestanden ? 'level_bestanden' : 'level_gescheitert');
  }

  // -------------------------------------------------------------------------
  // Bauen
  // -------------------------------------------------------------------------

  private setzeModus(m: Modus): void {
    this.modus = m;
    this.leitungsStart = null;
    this.hud.setzeKontext(m);
    if (m !== 'bauen') this.ansicht.zeigeGeist(null, 0, 0, false);
  }

  setzeModul(art: ModulArt, x: number, z: number, param = {}): string | null {
    if (!this.level.module.includes(art)) {
      this.hud.melde(`${KATALOG[art].name} ist in diesem Auftrag nicht freigegeben.`, 'fehler');
      this.klang.spiele('ui_fehler');
      return null;
    }
    if (!this.halle.imFundament(x, z)) {
      this.hud.melde('Außerhalb des Fundaments.', 'fehler');
      this.klang.spiele('ui_fehler');
      return null;
    }
    const e = this.bau.setze(art, x, z, param);
    if (!e.ok) {
      this.hud.melde(e.grund, 'fehler');
      this.klang.spiele('ui_fehler');
      return null;
    }
    this.ansicht.setzeWerk(this.bau.werk());
    this.aktualisiereSchattenbaum();
    this.klangAmFeld('modul_setzen', x, z);
    return e.id;
  }

  verbinde(von: string, vonPort: string, nach: string, nachPort = 'ein'): boolean {
    const e = this.bau.verbinde(von, vonPort, nach, nachPort);
    if (!e.ok) {
      this.hud.melde(e.grund, 'fehler');
      this.klang.spiele('ui_fehler');
      return false;
    }
    this.ansicht.setzeWerk(this.bau.werk());
    this.aktualisiereSchattenbaum();
    this.klang.spiele('leitung_verbinden');
    return true;
  }

  /**
   * Spielt einen Klang dort, wo gebaut wurde. Ein Modul am anderen Hallenende
   * darf leiser und dumpfer klingen als eines direkt vor der Kamera — genau
   * das trennt eine Halle von einer Tabellenkalkulation.
   */
  private klangAmFeld(klang: 'modul_setzen' | 'modul_entfernen', x: number, z: number): void {
    this.klang.spieleAmOrt(klang, this.halle.feldZuWelt(x, z));
  }

  private klickAufFeld(x: number, z: number): void {
    const getroffen = this.bau.modulAufFeld(x, z);
    switch (this.modus) {
      case 'bauen':
        this.setzeModul(this.gewaehltesModul, x, z);
        break;
      case 'abriss':
        if (getroffen && this.bau.entferne(getroffen.id)) {
          this.ansicht.setzeWerk(this.bau.werk());
          this.aktualisiereSchattenbaum();
          this.klangAmFeld('modul_entfernen', x, z);
        } else if (getroffen) {
          this.hud.melde('Eingang und Auslieferung bleiben stehen.', 'fehler');
          this.klang.spiele('ui_fehler');
        }
        break;
      case 'leitung':
        if (!getroffen) return;
        if (!this.leitungsStart) {
          const frei = this.bau.freieAusgaenge(getroffen.id);
          if (frei.length === 0) {
            this.hud.melde('Dieses Modul hat keinen freien Ausgang.', 'fehler');
            return;
          }
          this.leitungsStart = { modulId: getroffen.id, port: frei[0]! };
          this.ansicht.setzeHervorhebung([getroffen.id], 'zeiger');
          this.hud.setzeKontext('leitung', [
            `Ausgang "${frei[0]}" gewählt${frei.length > 1 ? ` (${frei.length} frei)` : ''}`,
          ]);
        } else {
          this.verbinde(this.leitungsStart.modulId, this.leitungsStart.port, getroffen.id);
          this.leitungsStart = null;
          this.ansicht.setzeHervorhebung([], 'zeiger');
          this.hud.setzeKontext('leitung');
        }
        break;
      default:
        this.auswahl = getroffen ? [getroffen.id] : [];
        this.ansicht.setzeHervorhebung(this.auswahl, 'auswahl');
        if (getroffen) this.hud.melde(KATALOG[getroffen.art].lehrsatz, 'info', 6000);
    }
  }

  private aktualisiereSchattenbaum(): void {
    // Die Modulzahl im HUD hängt am Bau, nicht am Lauf — sie muss sich also
    // mit jedem gesetzten und jedem abgerissenen Modul mitbewegen.
    if (this.sim === null) this.hud.zeigeMetriken(this.leereMetriken(), this.level);
    // Die Werkbank hängt an einem konkreten Werk. Wer umbaut, sucht neu —
    // ein Ergebnis, das zu einem anderen Bau gehört, wäre schlicht falsch.
    this.bank = null;
    const w = this.bau.werk();
    this.hud.aktualisiereSchattenbaum(
      w.module.map((m) => ({
        id: m.id,
        text: `${KATALOG[m.art].name}, Feld ${String.fromCharCode(65 + m.x)}${m.z + 1}, ${
          this.bau.freieAusgaenge(m.id).length
        } Ausgänge frei`,
      }))
    );
  }

  // -------------------------------------------------------------------------
  // Eingabe
  // -------------------------------------------------------------------------

  private aufGeste(g: Geste): void {
    this.kamera.verarbeiteGeste(g);
  }

  private aufZeigerAb(z: ZeigerZustand): void {
    if (this.hud.dialogOffen) return;
    // Fundstücke liegen außerhalb des Fundaments und werden zuerst geprüft.
    // Sie können nichts verdecken, was man bebauen kann.
    if (this.oeffneFundstueck(z.ndcX, z.ndcY)) return;
    const punkt = this.kamera.bodenPunkt(z.ndcX, z.ndcY);
    if (!punkt) return;
    const feld = this.halle.weltZuFeld(punkt);
    if (!this.halle.imFundament(feld.x, feld.z)) return;
    this.klickAufFeld(feld.x, feld.z);
  }

  /**
   * Prüft, ob unter dem Zeiger ein lesbares Fundstück liegt, und öffnet es.
   *
   * Der Strahl trifft nur die Gruppe der Fundstücke, nicht die ganze Szene —
   * eine Halle mit einigen tausend Dreiecken pro Bild zu durchsuchen wäre für
   * einen Klick auf einen Kaffeebecher deutlich zu teuer.
   */
  private oeffneFundstueck(ndcX: number, ndcY: number): boolean {
    const ziele = this.halle.lesbareFundstuecke;
    if (ziele.length === 0) return false;
    this.strahl.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.renderwerk.kamera);
    const treffer = this.strahl.intersectObjects(ziele as THREE.Object3D[], false);
    const id = treffer[0]?.object.userData['fundstueck'];
    if (typeof id !== 'string') return false;
    const f = this.erzaehlung.fundstueck(id);
    if (!f) return false;
    this.erzaehlung.markiereGelesen(id);
    this.halle.markiereGelesen(id);
    this.hud.zeigeFundstueck(f, this.erzaehlung.leseStand(this.level.akt));
    this.klang.spiele('notiz_beginn');
    return true;
  }

  private aufZeigerBewegt(z: ZeigerZustand): void {
    if (z.gedrueckt && z.wahl) {
      // Orbit ausschließlich mit Wahltaste — Strg ist auf macOS belegt.
      this.kamera.drehe(1, 0);
      return;
    }
    const punkt = this.kamera.bodenPunkt(z.ndcX, z.ndcY);
    if (!punkt) return;
    const feld = this.halle.weltZuFeld(punkt);
    this.zeigerFeld = feld;
    if (this.modus === 'bauen' && this.phase === 'bauen') {
      const gueltig = this.halle.imFundament(feld.x, feld.z) && !this.bau.modulAufFeld(feld.x, feld.z);
      this.ansicht.zeigeGeist(this.gewaehltesModul, feld.x, feld.z, gueltig);
    }
  }

  private bindeTastatur(): void {
    const ab = (e: KeyboardEvent): void => {
      const ziel = e.target as HTMLElement | null;
      if (ziel && (ziel.tagName === 'INPUT' || ziel.tagName === 'TEXTAREA')) return;
      if (e.code === 'Tab') return; // Tab gehört dem DOM-Fokus.
      this.gedrueckt.add(e.code);
      // Modulkuerzel zuerst: Sie sind die haeufigste Taste im Spiel, und sie
      // gelten nur, solange kein Dialog offen ist.
      if (!e.metaKey && !e.ctrlKey && !e.altKey && !this.hud.dialogOffen && this.waehleModulPerTaste(e.key)) {
        e.preventDefault();
        return;
      }
      const befehl = befehlFuer(e);
      if (befehl === null) return;
      e.preventDefault();
      this.fuehreBefehlAus(befehl);
    };
    const auf = (e: KeyboardEvent): void => {
      this.gedrueckt.delete(e.code);
    };
    globalThis.addEventListener('keydown', ab);
    globalThis.addEventListener('keyup', auf);
    this.abbau.push(
      () => globalThis.removeEventListener('keydown', ab),
      () => globalThis.removeEventListener('keyup', auf)
    );
  }

  /**
   * Wählt das Modul, dessen Kürzel gedrückt wurde.
   *
   * Die Kürzel stehen im Katalog und sind über die ganze Kampagne stabil: Der
   * MODELL-KERN liegt in Akt I auf der 1 und in Akt XII immer noch. Das ist der
   * Grund, warum sie NICHT aus der Position in der Palette abgeleitet werden —
   * eine Taste, die je nach Level etwas anderes tut, ist keine Abkürzung.
   *
   * Ein Kürzel für ein Modul, das dieses Level nicht freigibt, sagt das auch.
   * Stillschweigend nichts zu tun wäre die schlechtere Antwort: Die Palette
   * zeigt das Modul nicht, also ist die naheliegende Vermutung „meine Tastatur
   * spinnt" und nicht „das gibt es hier noch nicht".
   */
  private waehleModulPerTaste(taste: string): boolean {
    const gesucht = taste.toUpperCase();
    for (const art of BAUBAR) {
      if (KATALOG[art].taste !== gesucht) continue;
      if (!this.level.module.includes(art)) {
        this.hud.melde(`${KATALOG[art].name} ist in diesem Auftrag nicht freigegeben.`, 'fehler');
        this.klang.spiele('ui_fehler');
        return true;
      }
      this.gewaehltesModul = art;
      this.hud.setzeModulWahl(art);
      this.setzeModus('bauen');
      this.klang.spiele('ui_waehlen');
      return true;
    }
    return false;
  }

  fuehreBefehlAus(befehl: Befehl): void {
    if (this.hud.dialogOffen && befehl !== 'abbrechen' && befehl !== 'hilfe') {
      // Enter bestätigt den offenen Dialog — Tafel zuerst, sie liegt oben.
      if (befehl === 'setzen') {
        if (this.hud.akttafelOffen) this.tafelGeschlossen();
        else if (this.hud.schmiedeOffen) {
          // Enter im Formular startet die Suche; Schließen geht über Escape.
          this.sucheInDerSchmiede();
        } else {
          this.hud.schliesseFundstueck();
          this.hud.schliesseBriefing();
          if (this.phase === 'briefing') this.phase = 'bauen';
        }
      }
      return;
    }
    switch (befehl) {
      case 'modus_auswahl':
        this.setzeModus('auswahl');
        break;
      case 'modus_leitung':
        this.setzeModus('leitung');
        break;
      case 'modus_abriss':
        this.setzeModus('abriss');
        break;
      case 'setzen':
        this.klickAufFeld(this.zeigerFeld.x, this.zeigerFeld.z);
        break;
      case 'loeschen':
        for (const id of this.auswahl) this.bau.entferne(id);
        this.auswahl = [];
        this.ansicht.setzeWerk(this.bau.werk());
        this.aktualisiereSchattenbaum();
        break;
      case 'verbinden':
        if (this.auswahl.length === 2) {
          const frei = this.bau.freieAusgaenge(this.auswahl[0]!);
          if (frei[0]) this.verbinde(this.auswahl[0]!, frei[0], this.auswahl[1]!);
        } else this.hud.melde('Markiere genau zwei Module.', 'fehler');
        break;
      case 'gierung_links':
        this.kamera.rasteGierung(-1);
        break;
      case 'gierung_rechts':
        this.kamera.rasteGierung(1);
        break;
      case 'fokus': {
        const p = this.auswahl[0] ? this.ansicht.modulPosition(this.auswahl[0]) : null;
        if (p) this.kamera.fokussiere(p, 16);
        break;
      }
      case 'uebersicht':
        this.kamera.uebersicht();
        break;
      case 'sim_start':
        this.starteOderPausiere();
        break;
      case 'sim_einzeltick':
        if (this.sim) {
          this.laeuft = false;
          this.simulationsTick(1);
        }
        break;
      case 'sim_schneller':
        this.tempo = Math.min(60, this.tempo * 3);
        this.hud.setzeTempo(this.tempo);
        break;
      case 'sim_langsamer':
        this.tempo = Math.max(1, Math.round(this.tempo / 3));
        this.hud.setzeTempo(this.tempo);
        break;
      case 'rueckgaengig':
        if (this.bau.macheRueckgaengig()) {
          this.ansicht.setzeWerk(this.bau.werk());
          this.aktualisiereSchattenbaum();
          this.hud.melde('Rückgängig.');
        }
        break;
      case 'wiederholen':
        if (this.bau.wiederhole()) {
          this.ansicht.setzeWerk(this.bau.werk());
          this.aktualisiereSchattenbaum();
        }
        break;
      case 'hilfe':
      case 'handbuch':
        this.hud.schalteHilfe();
        break;
      case 'briefing': {
        const akt = AKTE.find((a) => a.nummer === this.level.akt);
        this.hud.zeigeBriefing(this.level, akt?.titel ?? '', this.monolithWerte);
        this.klang.spiele('seite_blaettern');
        break;
      }
      case 'schmiede':
        this.oeffneSchmiede();
        break;
      case 'ton': {
        const stumm = !this.klang.stumm;
        this.klang.setzeStumm(stumm);
        this.hud.melde(stumm ? 'Ton aus.' : 'Ton an.');
        break;
      }
      case 'abbrechen':
        if (this.hud.akttafelOffen) {
          this.tafelGeschlossen();
          break;
        }
        if (this.hud.dialogOffen) {
          this.hud.schliesseHilfe();
          this.hud.schliesseFundstueck();
          this.hud.schliesseSchmiede();
          this.hud.schliesseBriefing();
          if (this.phase === 'briefing') this.phase = 'bauen';
          break;
        }
        if (this.leitungsStart) {
          this.leitungsStart = null;
          this.ansicht.setzeHervorhebung([], 'zeiger');
        } else if (this.phase === 'simulation') {
          this.beendeSimulation();
          this.phase = 'bauen';
        } else this.setzeModus('auswahl');
        break;
      default:
        break;
    }
  }

  /**
   * Startet die Klangwelt beim ERSTEN Zeiger- oder Tastendruck irgendwo im
   * Dokument.
   *
   * Der Umweg über `document` statt über die Leinwand ist Absicht: die erste
   * Handlung im Spiel ist regelmäßig ein Klick auf "Verstanden" im Briefing —
   * das ist ein DOM-Knopf, nicht die Leinwand. Ohne diesen Weg bliebe das
   * Spiel bis zum ersten Bauklick stumm, und der Einstieg klänge tot.
   *
   * Die Zuhörer entfernen sich selbst; ein zweiter Startversuch käme sonst
   * bei jedem Klick.
   */
  private bindeKlangstart(): void {
    if (!this.klangErlaubt) return;
    const wecke = (): void => {
      loese();
      void this.klang.starte();
    };
    const loese = (): void => {
      globalThis.removeEventListener('pointerdown', wecke, true);
      globalThis.removeEventListener('keydown', wecke, true);
    };
    globalThis.addEventListener('pointerdown', wecke, true);
    globalThis.addEventListener('keydown', wecke, true);
    this.abbau.push(loese);
  }

  private bindeGroesse(leinwand: HTMLCanvasElement): void {
    const anpassen = (): void => {
      const b = leinwand.clientWidth || globalThis.innerWidth;
      const h = leinwand.clientHeight || globalThis.innerHeight;
      this.renderwerk.setzeGroesse(b, h);
    };
    globalThis.addEventListener('resize', anpassen);
    this.abbau.push(() => globalThis.removeEventListener('resize', anpassen));
    anpassen();
  }

  // -------------------------------------------------------------------------
  // Bildschleife
  // -------------------------------------------------------------------------

  private starteSchleife(): void {
    this.schleifeAn = true;
    this.letzteZeit = 0;
    this.renderwerk.renderer.setAnimationLoop((zeitMs: number) => {
      const dt = this.letzteZeit === 0 ? 1 / 60 : Math.min(0.1, (zeitMs - this.letzteZeit) / 1000);
      this.letzteZeit = zeitMs;
      this.bild(dt);
    });
  }

  /** Ein Bild. Im Testbetrieb ruft der Test das direkt auf. */
  bild(dt: number): void {
    this.spielzeit += dt;
    uZeit.value = this.spielzeit;

    // Tastatur-Schwenk
    const x = (this.gedrueckt.has('KeyD') || this.gedrueckt.has('ArrowRight') ? 1 : 0) -
      (this.gedrueckt.has('KeyA') || this.gedrueckt.has('ArrowLeft') ? 1 : 0);
    const z = (this.gedrueckt.has('KeyS') || this.gedrueckt.has('ArrowDown') ? 1 : 0) -
      (this.gedrueckt.has('KeyW') || this.gedrueckt.has('ArrowUp') ? 1 : 0);
    this.kamera.schwenkeStetig(x, z, dt, this.gedrueckt.has('ShiftLeft') || this.gedrueckt.has('ShiftRight'));
    this.kamera.aktualisiere(dt);

    // Decke und Fachwerk ausblenden, sobald die Kamera darüber steht — sonst
    // schaut man durch das eigene Dach und die Träger zerschneiden das Bild.
    /*
     * Decke UND Fachwerk ausblenden, sobald die Kamera über die Träger
     * steigt. Nur die Decke zu verstecken genügt nicht: das Fachwerk ist so
     * massiv, dass es aus der Vogelperspektive das halbe Bild zerschneidet und
     * die Baufläche unlesbar macht. Bei flachem Blickwinkel bleibt beides
     * stehen und trägt den Industriecharakter.
     */
    const ueberDach = this.renderwerk.kamera.position.y > this.halle.masse.hoehe * 0.82;
    this.halle.decke.visible = !ueberDach;
    this.halle.fachwerk.visible = !ueberDach;

    if (this.sim && this.laeuft) {
      this.tickRest += dt * 1000 * this.tempo;
      let schritte = 0;
      while (this.tickRest >= TICK_MS && schritte < 240 && this.sim && !this.sim.fertig) {
        this.tickRest -= TICK_MS;
        this.simulationsTick(1);
        schritte++;
      }
    }
    if (this.sim) {
      const alpha = Math.min(1, this.tickRest / TICK_MS);
      this.ansicht.zeigeSimulation(this.sim.momentaufnahme(), alpha, dt);
    }

    this.fuehreKlangNach();
    this.renderwerk.zeichne(this.spielzeit);
  }

  /**
   * Koppelt Hörer und Musikachsen an das Bild.
   *
   * Das läuft bewusst jedes Bild und nicht nur bei Zustandswechseln: die
   * Achsen werden im Klangwerk über rund anderthalb Sekunden nachgefahren, und
   * der Fortschrittswert ändert sich mit jedem Tick. Ein Aufruf je Bild ist
   * billig — es werden fünf Zahlen gesetzt — und ohne ihn ruckelt die Musik in
   * Stufen statt zu atmen. Solange kein Ton läuft, sind alle Aufrufe leer.
   */
  private fuehreKlangNach(): void {
    if (!this.klang.laeuft) return;
    const k = this.renderwerk.kamera;
    k.getWorldDirection(this.blickHilfe);
    this.klang.richteHoerer(k.position, this.blickHilfe);

    // Die Kennzahlen kommen aus dem letzten Tick, nicht frisch berechnet:
    // `metriken()` sortiert für die Perzentile, und das je Bild zu tun wäre
    // Arbeit für nichts. Zwischen zwei Ticks ändern sie sich ohnehin nicht.
    const gesamt = this.level.strom.anzahl;
    const m = this.sim ? this.letzteMetriken : null;
    this.klang.fuehreNach({
      phase: this.phase,
      metriken: m,
      fortschritt: m && gesamt > 0 ? Math.min(1, (m.geliefert + m.verworfen) / gesamt) : 0,
      bestanden: this.phase === 'auswertung' ? (this.letzteBewertung?.bestanden ?? null) : null,
    });
  }

  setzeReduzierteBewegung(an: boolean): void {
    uPuls.value = an ? 0 : 1;
    this.renderwerk.setzeReduzierteBewegung(an);
    this.kamera.setzeReduzierteBewegung(an);
  }

  setzeTemporalModus(m: TemporalModus): void {
    this.renderwerk.setzeTemporalModus(m);
  }

  // -------------------------------------------------------------------------
  // Schmiede
  // -------------------------------------------------------------------------

  /**
   * Öffnet die Werkbank der Schmiede.
   *
   * Sie steht nur zur Verfügung, wenn eine SCHMIEDE im Werk steht. Das ist der
   * ganze Preis der Mechanik: ein Bauplatz. Der Suchapparat kostet keinen
   * Token und keinen Tick — er ist Gemeinkosten, nicht Produktion.
   */
  oeffneSchmiede(): boolean {
    if (!hatSchmiede(this.bau.werk())) {
      this.hud.melde('Dafür braucht es eine SCHMIEDE im Werk.', 'fehler');
      this.klang.spiele('ui_fehler');
      return false;
    }
    if (this.phase === 'simulation') {
      this.hud.melde('Die Schmiede sucht nur zwischen den Läufen.', 'fehler');
      this.klang.spiele('ui_fehler');
      return false;
    }
    this.bank ??= new Schmiedebank(
      schmiedeAufgabeAus(this.level),
      this.bau.werk(),
      this.level.strom,
      this.level.saat
    );
    this.zeichneSchmiede();
    this.klang.spiele('notiz_beginn');
    return true;
  }

  /** Zeichnet die Werkbank aus dem aktuellen Bankzustand neu. */
  private zeichneSchmiede(): void {
    const bank = this.bank;
    if (!bank) return;
    const aufgabe = schmiedeAufgabeAus(this.level);
    const z = bank.zustand();
    const lauf = bank.lauf;
    this.hud.zeigeSchmiede({
      hinweis: aufgabe.hinweis,
      maxZiele: aufgabe.maxZiele,
      ziele: aufgabe.waehlbareZiele.map((x) => ({
        metrik: x.metrik,
        name: `${METRIK_NAME[x.metrik] ?? x.metrik} ${x.richtung === 'klein' ? '↓' : '↑'}`,
        aktiv: z.ziele.some((g) => g.metrik === x.metrik),
      })),
      bedingungen: aufgabe.waehlbareBedingungen.map((b) => ({
        text: b.text,
        aktiv: z.bedingungen.some((g) => g.text === b.text),
      })),
      population: z.population,
      generationen: z.generationen,
      auswertungen: bank.geschaetzteAuswertungen(),
      budget: aufgabe.budget,
      lauf: lauf
        ? {
            ausgang: lauf.ausgang,
            auswahl: lauf.auswahl.map((x) => x.metriken),
            warnungen: lauf.ergebnis.warnungen,
            ausnutzung: lauf.ausnutzung,
          }
        : null,
      aufZiel: (m) => {
        if (!bank.schalteZiel(m)) {
          this.hud.melde(`Höchstens ${aufgabe.maxZiele} Ziele. Entscheide dich.`, 'fehler');
          this.klang.spiele('ui_fehler');
        }
        this.zeichneSchmiede();
      },
      aufBedingung: (t) => {
        bank.schalteBedingung(t);
        this.zeichneSchmiede();
      },
      aufAufwand: (p, g) => {
        bank.setzeAufwand(p, g);
        this.zeichneSchmiede();
      },
      aufSuchen: () => this.sucheInDerSchmiede(),
      aufUebernehmen: (i) => this.uebernimmAusSchmiede(i),
    });
  }

  private sucheInDerSchmiede(): void {
    const bank = this.bank;
    if (!bank) return;
    const bereit = bank.bereit();
    if (!bereit.ok) {
      this.hud.melde(bereit.grund, 'fehler', 7000);
      this.klang.spiele('ui_fehler');
      return;
    }
    const lauf = bank.starte();
    this.zeichneSchmiede();
    this.klang.spiele(lauf.auswahl.length > 0 ? 'ziel_erreicht' : 'ui_fehler');
    this.hud.melde(
      `${lauf.ergebnis.auswertungen} Anlagen ausgewertet, ${lauf.auswahl.length} zur Wahl.`,
      lauf.auswahl.length > 0 ? 'gut' : 'fehler',
      7000
    );
  }

  private uebernimmAusSchmiede(index: number): void {
    const bank = this.bank;
    const gewaehlt = bank?.lauf?.auswahl[index];
    if (!bank || !gewaehlt) return;
    this.ladeWerk(bank.uebernimm(gewaehlt));
    this.hud.schliesseSchmiede();
    this.hud.melde(`Anlage "Fund ${index + 1}" übernommen. Jetzt lauf sie einmal.`, 'gut', 7000);
    this.klang.spiele('level_bestanden', 0.5);
  }

  /**
   * Klickt ein Fundstück über den echten Zeigerweg an.
   *
   * Das Stück wird auf die Bildebene projiziert und dann ganz normal
   * angestrahlt. Damit prüft der Test dieselbe Kette wie ein Mausklick — bis
   * hin zu der Frage, ob das Stück überhaupt zu sehen ist.
   */
  klickeFundstueck(id: string): boolean {
    const ziel = this.halle.lesbareFundstuecke.find((o) => o.userData['fundstueck'] === id);
    if (!ziel) return false;
    const p = new THREE.Vector3();
    ziel.getWorldPosition(p);
    p.y += 0.05;
    p.project(this.renderwerk.kamera);
    if (p.x < -1 || p.x > 1 || p.y < -1 || p.y > 1 || p.z > 1) return false;
    return this.oeffneFundstueck(p.x, p.y);
  }

  /** Laedt eine fertige Blaupause — für Tests, Referenzlösungen und Import. */
  ladeWerk(werk: Werk): void {
    this.bau.ladeWerk(werk);
    this.ansicht.setzeWerk(this.bau.werk());
    this.aktualisiereSchattenbaum();
  }

  entsorge(): void {
    this.schleifeAn = false;
    for (const f of this.abbau.splice(0)) f();
    this.zeiger.entsorge();
    this.fokusring.entsorge();
    this.klang.entsorge();
    this.hud.entsorge();
    this.ansicht.entsorge();
    this.halle.entsorge();
    this.renderwerk.entsorge();
    void BAUBAR;
    void this.schleifeAn;
  }
}
