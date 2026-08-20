/**
 * Test-Schnittstelle. Wird ausschließlich unter `__TEST__` eingehängt.
 *
 * Sie erlaubt einem Playwright-Test, das Spiel wie eine Spielerin zu bedienen —
 * Module setzen, verdrahten, simulieren — und anschließend gegen den ZUSTAND
 * zu prüfen statt gegen Pixel. Bilder werden über `frameSchritt` einzeln
 * angefordert; im Testbetrieb läuft keine eigene Bildschleife.
 */

import * as THREE from 'three/webgpu';
import type { Spiel } from '../spiel/spiel';
import type { ModulArt, ModulParameter, Werk } from '../sim/typen';
import { bewerte } from '../sim/ziele';
import { ALLE_LEVEL } from '../inhalt/kampagne';

export interface DebugApi {
  readonly version: string;
  bereit(): boolean;
  /**
   * Zahl der gezeichneten Bilder seit dem Start.
   *
   * Der Zähler beantwortet die Frage, die hier lange offen war: läuft die
   * Bildschleife noch? Renderer-Zähler taugen dafür nicht — die werden je
   * Bild zurückgesetzt und sehen im Stillstand genauso aus wie im Lauf.
   */
  bilder(): number;
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
  /**
   * Bildschirmpunkt eines Gitterfelds, in CSS-Pixeln relativ zur Leinwand.
   *
   * Existiert für Bedienungstests: die dürfen ausschließlich echte Maus- und
   * Tastaturereignisse verschicken, brauchen dafür aber Pixelkoordinaten. Die
   * Umrechnung hier zu machen ist ehrlicher, als im Test eine zweite Projektion
   * nachzubauen, die von der echten abweichen kann.
   */
  feldZuBildschirm(x: number, z: number): { x: number; y: number; imBild: boolean };
  /**
   * Inventar des Szenengraphen. Gebaut für den Fall "die Leinwand ist schwarz,
   * der Renderer meldet aber Draw Calls" — dann liegt der Fehler zwischen
   * Szene und Bild, und nur ein Blick in beide zeigt, wo.
   */
  szenenBefund(): {
    netze: number;
    sichtbar: number;
    dreieckeInSzene: number;
    imBildAusschnitt: number;
    lichter: Array<{ art: string; intensitaet: number; sichtbar: boolean }>;
    kamera: { pos: [number, number, number]; near: number; far: number; blick: [number, number, number] };
    groesste: Array<{ name: string; art: string; dreiecke: number; sichtbar: boolean; imBild: boolean }>;
  };
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
  /** Öffnet die Werkbank der Schmiede. Falsch, wenn keine im Werk steht. */
  oeffneSchmiede(): boolean;
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

    bilder: () => spiel.bildZaehler,

    levelListe: () => ALLE_LEVEL.map((l) => l.id),

    ladeLevel: (id, saat) => {
      spiel.ladeLevel(id, saat);
      // Erzählung wegräumen: Tests bauen, sie lesen nicht. Die Akttafel
      // laege sonst vor jedem ersten Level eines Akts im Weg.
      spiel.hud.schliesseAkttafel();
      spiel.hud.schliesseFundstueck();
      spiel.hud.schliesseSchmiede();
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

    feldZuBildschirm: (x, z) => {
      const kamera = spiel.renderwerk.kamera;
      kamera.updateMatrixWorld();
      const welt = spiel.halle.feldZuWelt(x, z);
      const p = welt.clone().project(kamera);
      const leinwand = spiel.renderwerk.renderer.domElement;
      const b = leinwand.clientWidth;
      const h = leinwand.clientHeight;
      return {
        x: (p.x * 0.5 + 0.5) * b,
        y: (-p.y * 0.5 + 0.5) * h,
        imBild: p.x >= -1 && p.x <= 1 && p.y >= -1 && p.y <= 1 && p.z >= -1 && p.z <= 1,
      };
    },

    szenenBefund: () => {
      const szene = spiel.renderwerk.szene;
      const kamera = spiel.renderwerk.kamera;
      kamera.updateMatrixWorld();
      const frustum = new THREE.Frustum().setFromProjectionMatrix(
        new THREE.Matrix4().multiplyMatrices(kamera.projectionMatrix, kamera.matrixWorldInverse)
      );

      let netze = 0;
      let sichtbar = 0;
      let dreieckeInSzene = 0;
      let imBildAusschnitt = 0;
      const lichter: Array<{ art: string; intensitaet: number; sichtbar: boolean }> = [];
      const alle: Array<{ name: string; art: string; dreiecke: number; sichtbar: boolean; imBild: boolean }> = [];

      szene.traverse((o) => {
        const l = o as THREE.Light;
        if (l.isLight) lichter.push({ art: o.type, intensitaet: l.intensity, sichtbar: o.visible });

        const m = o as THREE.Mesh & { isInstancedMesh?: boolean; count?: number };
        if (!m.isMesh) return;
        netze += 1;

        // "sichtbar" heißt: dieses Objekt UND jeder Vorfahr sind sichtbar.
        let kette = true;
        for (let a: THREE.Object3D | null = o; a; a = a.parent) if (!a.visible) kette = false;
        if (kette) sichtbar += 1;

        const geo = m.geometry;
        const anzahl = geo.index ? geo.index.count : (geo.attributes['position']?.count ?? 0);
        const faktor = m.isInstancedMesh ? (m.count ?? 1) : 1;
        const dreiecke = Math.round((anzahl / 3) * faktor);
        if (kette) dreieckeInSzene += dreiecke;

        if (!geo.boundingSphere) geo.computeBoundingSphere();
        const kugel = geo.boundingSphere?.clone();
        let imBild = false;
        if (kugel) {
          kugel.applyMatrix4(o.matrixWorld);
          imBild = frustum.intersectsSphere(kugel);
        }
        if (kette && imBild) imBildAusschnitt += dreiecke;
        alle.push({ name: o.name || '(ohne Namen)', art: o.type, dreiecke, sichtbar: kette, imBild });
      });

      alle.sort((a, b) => b.dreiecke - a.dreiecke);
      const blick = new THREE.Vector3();
      kamera.getWorldDirection(blick);
      return {
        netze,
        sichtbar,
        dreieckeInSzene,
        imBildAusschnitt,
        lichter,
        kamera: {
          pos: kamera.position.toArray() as [number, number, number],
          near: kamera.near,
          far: kamera.far,
          blick: blick.toArray() as [number, number, number],
        },
        groesste: alle.slice(0, 12),
      };
    },

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
      spiel.hud.schliesseSchmiede();
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

    oeffneSchmiede: () => spiel.oeffneSchmiede(),

    entsorge: () => spiel.entsorge(),
  };

  window.__spiel = api;
  return api;
}
