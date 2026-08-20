/**
 * Test-Schnittstelle. Wird ausschließlich unter `__TEST__` eingehängt.
 *
 * Sie erlaubt einem Playwright-Test, das Spiel wie eine Spielerin zu bedienen —
 * Module setzen, verdrahten, simulieren — und anschließend gegen den ZUSTAND
 * zu prüfen statt gegen Pixel. Bilder werden über `frameSchritt` einzeln
 * angefordert; im Testbetrieb läuft keine eigene Bildschleife.
 */

import type { Spiel } from '../spiel/spiel';
import type { ModulArt, ModulParameter, Werk } from '../sim/typen';
import { bewerte } from '../sim/ziele';
import { ALLE_LEVEL } from '../inhalt/kampagne';

export interface DebugApi {
  readonly version: string;
  bereit(): boolean;
  levelListe(): string[];
  ladeLevel(id: string, saat?: number): void;
  aktuellesLevel(): { id: string; titel: string; akt: number; module: ModulArt[] };
  setzeModul(art: ModulArt, x: number, z: number, param?: ModulParameter): string | null;
  verbinde(von: string, vonPort: string, nach: string, nachPort?: string): boolean;
  ladeWerk(werk: Werk): void;
  ladeReferenz(nummer?: number): boolean;
  werk(): Werk;
  werkPruefsumme(): string;
  befunde(): { stufe: string; code: string; text: string }[];
  starteSimulation(): void;
  tick(n?: number): void;
  laufeDurch(maxTicks?: number): void;
  metriken(): Record<string, number>;
  bewertung(): { bestanden: boolean; ziele: { id: string; erfuellt: boolean; anzeige: string }[] };
  zustandsHash(): string;
  phase(): string;
  frameSchritt(n?: number): void;
  rendererInfo(): { backend: string; drawCalls: number; dreiecke: number; geometrien: number; texturen: number };
  kameraZustand(): { ziel: [number, number]; abstand: number; gierung: number; neigung: number };
  setzeKamera(zielX: number, zielZ: number, abstand: number, gierung: number, neigung: number): void;
  setzeTemporalModus(m: 'prod' | 'aus' | 'konvergiert'): void;
  setzeReduzierteBewegung(b: boolean): void;
  versteckeHud(b: boolean): void;
  befehl(name: string): void;
  /** Kennungen der lesbaren Fundstücke, die gerade in der Halle liegen. */
  fundstuecke(): string[];
  /**
   * Klickt ein Fundstück an — über den ECHTEN Zeigerweg, nicht über eine
   * Abkürzung. Der Test soll beweisen, dass der Auswahlstrahl trifft, nicht
   * dass sich ein Dialog öffnen lässt. Liefert `false`, wenn das Stück gerade
   * hinter der Kamera oder außerhalb des Bildes liegt.
   */
  klickeFundstueck(id: string): boolean;
  erzaehlZustand(): { einstiege: number[]; aufloesungen: string[]; gelesen: string[] };
  entsorge(): void;
}

declare global {
  interface Window {
    __spiel?: DebugApi;
  }
}

export function haengeDebugApiEin(spiel: Spiel): DebugApi {
  const api: DebugApi = {
    version: '1',

    bereit: () => true,

    levelListe: () => ALLE_LEVEL.map((l) => l.id),

    ladeLevel: (id, saat) => {
      spiel.ladeLevel(id, saat);
      // Erzählung wegräumen: Tests bauen, sie lesen nicht. Die Akttafel
      // laege sonst vor jedem ersten Level eines Akts im Weg.
      spiel.hud.schliesseAkttafel();
      spiel.hud.schliesseFundstueck();
      spiel.hud.schliesseBriefing();
      spiel.phase = 'bauen';
    },

    aktuellesLevel: () => ({
      id: spiel.level.id,
      titel: spiel.level.titel,
      akt: spiel.level.akt,
      module: [...spiel.level.module],
    }),

    setzeModul: (art, x, z, param) => spiel.setzeModul(art, x, z, param ?? {}),

    verbinde: (von, vonPort, nach, nachPort) => spiel.verbinde(von, vonPort, nach, nachPort ?? 'ein'),

    ladeWerk: (werk) => spiel.ladeWerk(werk),

    ladeReferenz: (nummer = 0) => {
      const r = spiel.level.referenzen[nummer];
      if (!r) return false;
      spiel.ladeWerk(r.werk);
      return true;
    },

    werk: () => spiel.bau.werk(),

    werkPruefsumme: () => spiel.bau.pruefsumme(),

    befunde: () => spiel.bau.befunde().map((b) => ({ stufe: b.stufe, code: b.code, text: b.text })),

    starteSimulation: () => {
      spiel.phase = 'bauen';
      spiel.starteOderPausiere();
    },

    tick: (n = 1) => spiel.simulationsTick(n),

    laufeDurch: (maxTicks = 4000) => {
      let i = 0;
      while (spiel.sim && !spiel.sim.fertig && i < maxTicks) {
        spiel.simulationsTick(1);
        i++;
      }
    },

    metriken: () => {
      const m = spiel.sim?.metriken();
      if (!m) return {};
      return { ...m } as unknown as Record<string, number>;
    },

    bewertung: () => {
      const m = spiel.sim?.metriken();
      if (!m) return { bestanden: false, ziele: [] };
      const b = bewerte(spiel.level.ziele, spiel.level.budget, m);
      return {
        bestanden: b.bestanden,
        ziele: b.staende.map((s) => ({ id: s.ziel.id, erfuellt: s.erfuellt, anzeige: s.anzeige })),
      };
    },

    zustandsHash: () => spiel.sim?.zustandsHash() ?? '-',

    phase: () => spiel.phase,

    frameSchritt: (n = 1) => {
      for (let i = 0; i < n; i++) spiel.bild(1 / 60);
    },

    rendererInfo: () => ({ backend: spiel.renderwerk.backend, ...spiel.renderwerk.zaehler() }),

    kameraZustand: () => spiel.kamera.zustand(),

    setzeKamera: (zielX, zielZ, abstand, gierung, neigung) => {
      const v = new (spiel.renderwerk.kamera.position.constructor as new (
        x: number,
        y: number,
        z: number
      ) => { x: number; y: number; z: number })(zielX, 0, zielZ);
      spiel.kamera.setzeSofort(v as never, abstand, gierung, neigung);
    },

    setzeTemporalModus: (m) => spiel.setzeTemporalModus(m),

    setzeReduzierteBewegung: (b) => spiel.setzeReduzierteBewegung(b),

    versteckeHud: (b) => {
      spiel.hud.wurzel.style.display = b ? 'none' : '';
      spiel.hud.schliesseBriefing();
      spiel.hud.schliesseErgebnis();
      spiel.hud.schliesseHilfe();
      spiel.hud.schliesseAkttafel();
      spiel.hud.schliesseFundstueck();
    },

    befehl: (name) => spiel.fuehreBefehlAus(name as never),

    // Netz und Kiste tragen dieselbe Kennung — der Test will jede genau einmal.
    fundstuecke: () => [
      ...new Set(
        spiel.halle.lesbareFundstuecke.map((o) => String(o.userData['fundstueck'])).filter((s) => s !== 'undefined')
      ),
    ],

    klickeFundstueck: (id) => spiel.klickeFundstueck(id),

    erzaehlZustand: () => spiel.erzaehlung.zustand(),

    entsorge: () => spiel.entsorge(),
  };

  window.__spiel = api;
  return api;
}
