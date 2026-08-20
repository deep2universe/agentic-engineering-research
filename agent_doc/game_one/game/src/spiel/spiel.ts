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
import { befehlFuer, type Befehl } from '../ui/keymap';
import { BauZustand } from './bauzustand';
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
}

export class Spiel {
  readonly renderwerk: Renderwerk;
  readonly halle: Halle;
  readonly ansicht: WerkAnsicht;
  readonly kamera: Kamerafuehrung;
  readonly hud: Hud;
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

  private constructor(renderwerk: Renderwerk, opt: SpielOptionen, start: LevelDefinition) {
    this.renderwerk = renderwerk;
    this.level = start;
    this.halle = new Halle();
    this.ansicht = new WerkAnsicht(this.halle);
    this.kamera = new Kamerafuehrung(renderwerk.kamera);
    this.bau = new BauZustand(start.vorbau);

    renderwerk.szene.add(this.halle.wurzel, this.ansicht.wurzel);
    renderwerk.szene.background = new THREE.Color(0x080b11);
    renderwerk.szene.fog = new THREE.FogExp2(0x0e141c, 0.021);

    this.hud = new Hud(opt.hudZiel, {
      aufModulWahl: (a) => {
        this.gewaehltesModul = a;
        this.setzeModus('bauen');
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
      },
      aufWeiter: () => this.weiter(),
      aufNochmal: () => {
        this.hud.schliesseErgebnis();
        this.phase = 'bauen';
        this.beendeSimulation();
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
    this.bindeTastatur();
    this.bindeGroesse(opt.leinwand);
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
    this.phase = 'briefing';

    const akt = AKTE.find((a) => a.nummer === level.akt);
    this.hud.zeigeLevel(this.level, akt?.titel ?? '');
    this.gewaehltesModul = this.hud.modulWahl();

    this.monolithWerte = level.monolith
      ? new Simulation({ werk: level.monolith, strom: this.level.strom, saat: this.level.saat }).laufeDurch().metriken
      : null;
    this.hud.zeigeBriefing(this.level, akt?.titel ?? '', this.monolithWerte);
    this.hud.zeigeMetriken(this.leereMetriken(), this.level);
    this.hud.setzeStartText('Simulation starten');
    this.kamera.uebersicht();
    this.aktualisiereSchattenbaum();
  }

  private weiter(): void {
    this.hud.schliesseErgebnis();
    if (this.letzteBewertung?.bestanden === true) {
      const naechstes = naechstesLevel(this.level.id);
      if (naechstes) {
        this.ladeLevel(naechstes.id);
        return;
      }
      this.hud.melde('Das war das letzte Level der Kampagne.', 'gut', 8000);
    }
    this.phase = 'bauen';
    this.beendeSimulation();
  }

  private leereMetriken(): Metriken {
    return new Simulation({
      werk: { module: [], leitungen: [] },
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
      return;
    }
    const befunde = this.bau.befunde();
    const fehler = befunde.filter((b) => b.stufe === 'fehler');
    if (fehler.length) {
      this.hud.melde(fehler[0]!.text, 'fehler');
      if (fehler[0]!.modulId) this.ansicht.setzeHervorhebung([fehler[0]!.modulId], 'fehler');
      return;
    }
    this.sim = new Simulation({ werk: this.bau.werk(), strom: this.level.strom, saat: this.level.saat });
    this.phase = 'simulation';
    this.laeuft = true;
    this.tickRest = 0;
    this.hud.setzeStartText('Pause');
    this.hud.melde(`${this.level.strom.anzahl} Aufträge laufen ein.`);
    this.ansicht.setzeHervorhebung([], 'auswahl');
  }

  private beendeSimulation(): void {
    this.sim = null;
    this.laeuft = false;
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
    this.hud.zeigeMetriken(m, this.level);
    const b = bewerte(this.level.ziele, this.level.budget, m);
    this.hud.zeigeZiele(this.level, b);
    if (this.sim.fertig) this.werteAus();
  }

  private werteAus(): void {
    if (!this.sim) return;
    const m = this.sim.metriken();
    this.letzteBewertung = bewerte(this.level.ziele, this.level.budget, m);
    this.laeuft = false;
    this.phase = 'auswertung';
    this.hud.zeigeErgebnis(this.level, this.letzteBewertung, m);
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
      return null;
    }
    if (!this.halle.imFundament(x, z)) {
      this.hud.melde('Außerhalb des Fundaments.', 'fehler');
      return null;
    }
    const e = this.bau.setze(art, x, z, param);
    if (!e.ok) {
      this.hud.melde(e.grund, 'fehler');
      return null;
    }
    this.ansicht.setzeWerk(this.bau.werk());
    this.aktualisiereSchattenbaum();
    return e.id;
  }

  verbinde(von: string, vonPort: string, nach: string, nachPort = 'ein'): boolean {
    const e = this.bau.verbinde(von, vonPort, nach, nachPort);
    if (!e.ok) {
      this.hud.melde(e.grund, 'fehler');
      return false;
    }
    this.ansicht.setzeWerk(this.bau.werk());
    this.aktualisiereSchattenbaum();
    return true;
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
        } else if (getroffen) {
          this.hud.melde('Eingang und Auslieferung bleiben stehen.', 'fehler');
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
    const punkt = this.kamera.bodenPunkt(z.ndcX, z.ndcY);
    if (!punkt) return;
    const feld = this.halle.weltZuFeld(punkt);
    if (!this.halle.imFundament(feld.x, feld.z)) return;
    this.klickAufFeld(feld.x, feld.z);
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

  fuehreBefehlAus(befehl: Befehl): void {
    if (this.hud.dialogOffen && befehl !== 'abbrechen' && befehl !== 'hilfe') {
      if (befehl === 'setzen') this.hud.schliesseBriefing();
      return;
    }
    switch (befehl) {
      case 'modus_auswahl':
        this.setzeModus('auswahl');
        break;
      case 'modus_bauen':
        this.setzeModus('bauen');
        break;
      case 'modus_leitung':
        this.setzeModus('leitung');
        break;
      case 'modus_abriss':
        this.setzeModus('abriss');
        break;
      case 'palette_vor':
      case 'palette_zurueck': {
        const liste = this.hud.erlaubteModule();
        if (liste.length === 0) break;
        const i = liste.indexOf(this.gewaehltesModul);
        const n = befehl === 'palette_vor' ? 1 : -1;
        const naechste = liste[(i + n + liste.length) % liste.length]!;
        this.gewaehltesModul = naechste;
        this.hud.setzeModulWahl(naechste);
        this.setzeModus('bauen');
        break;
      }
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
        break;
      }
      case 'abbrechen':
        if (this.hud.dialogOffen) {
          this.hud.schliesseHilfe();
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
    this.halle.decke.visible = this.renderwerk.kamera.position.y < this.halle.masse.hoehe * 0.94;

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
      this.ansicht.zeigeSimulation(this.sim.momentaufnahme(), alpha);
    }

    this.renderwerk.zeichne(this.spielzeit);
  }

  setzeReduzierteBewegung(an: boolean): void {
    uPuls.value = an ? 0 : 1;
    this.renderwerk.setzeReduzierteBewegung(an);
    this.kamera.setzeReduzierteBewegung(an);
  }

  setzeTemporalModus(m: TemporalModus): void {
    this.renderwerk.setzeTemporalModus(m);
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
    this.hud.entsorge();
    this.ansicht.entsorge();
    this.halle.entsorge();
    this.renderwerk.entsorge();
    void BAUBAR;
    void this.schleifeAn;
  }
}
