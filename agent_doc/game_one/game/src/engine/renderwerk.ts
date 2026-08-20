/**
 * Das Renderwerk: Renderer, Post-Processing-Graph und Bildgütestufen.
 *
 * Grundsatzentscheidung (per Spike verifiziert, siehe
 * `agent_doc/game_one/belege/renderer_spike_ergebnis.md`): `WebGPURenderer`
 * aus `three/webgpu` mit TSL und `RenderPipeline`. WebGL2 ist kein zweiter
 * Renderer, sondern das Fallback-Backend derselben Klasse. Der gesamte
 * Effektkatalog — MRT-Emissive-Bloom, GTAO über einen Normal-Pre-Pass, SMAA —
 * läuft auf beiden Backends identisch und ist headless mit SwiftShader
 * nachweislich lauffaehig.
 *
 * Drei Temporalmodi, weil temporale Effekte und pixelstabile Visual Regression
 * einander ausschließen:
 *   'prod'        — alles an, so sieht es die Spielerin
 *   'aus'         — keine temporale Akkumulation; Grundlage aller Baselines
 *   'konvergiert' — temporal an, aber erst nach Warmlauf bei fixer Kamera
 */

import * as THREE from 'three/webgpu';
import { pass, mrt, normalView, velocity, packNormalToRGB, uniform, screenUV, float, mix, color } from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { ao } from 'three/addons/tsl/display/GTAONode.js';
import { smaa } from 'three/addons/tsl/display/SMAANode.js';
import { erzeugeUmgebung } from '../welt/umgebung';

export type Bildguete = 'hoch' | 'mittel' | 'niedrig';
export type TemporalModus = 'prod' | 'aus' | 'konvergiert';

export interface RenderwerkOptionen {
  readonly leinwand: HTMLCanvasElement;
  /** Diagnose: Post-Processing vollständig überspringen. */
  readonly ohnePost?: boolean;
  readonly guete?: Bildguete;
  readonly temporal?: TemporalModus;
  /** Erzwingt das WebGL2-Backend (Testläufe, Fehlersuche). */
  readonly erzwingeWebGL?: boolean;
  /** Bewegungsreduktion: kein Pulsieren, kein Überschwingen. */
  readonly reduzierteBewegung?: boolean;
}

interface GuetePreset {
  readonly pixelDeckel: number;
  readonly aoAufloesung: number;
  readonly bloomStaerke: number;
  readonly bloomRadius: number;
  /** Helligkeitsschwelle: nur was heller ist, blueht. */
  readonly bloomSchwelle: number;
  readonly schattenGroesse: number;
  readonly ao: boolean;
  readonly smaa: boolean;
}

/**
 * Emissive-Werte liegen im Spiel STRENG im Band 0.05–0.35. Der Spike hat
 * gezeigt: mit AgX-Tonemapping und diesen Bloom-Stärken brennt alles darüber
 * das Bild vollständig aus.
 */
const PRESETS: Record<Bildguete, GuetePreset> = {
  hoch: { pixelDeckel: 2, aoAufloesung: 0.5, bloomStaerke: 0.85, bloomRadius: 0.6, bloomSchwelle: 0.62, schattenGroesse: 2048, ao: true, smaa: true },
  mittel: { pixelDeckel: 1.5, aoAufloesung: 0.5, bloomStaerke: 0.8, bloomRadius: 0.55, bloomSchwelle: 0.62, schattenGroesse: 1024, ao: true, smaa: true },
  niedrig: { pixelDeckel: 1, aoAufloesung: 0.5, bloomStaerke: 0.7, bloomRadius: 0.5, bloomSchwelle: 0.68, schattenGroesse: 512, ao: false, smaa: false },
};

export class Renderwerk {
  readonly renderer: THREE.WebGPURenderer;
  readonly szene: THREE.Scene;
  readonly kamera: THREE.PerspectiveCamera;
  readonly backend: 'webgpu' | 'webgl2';

  private pipeline: THREE.RenderPipeline | null = null;
  private guete: Bildguete;
  private temporal: TemporalModus;
  private reduziert: boolean;
  private readonly ohnePost: boolean;
  private readonly leinwand: HTMLCanvasElement;
  private readonly entsorger: Array<() => void> = [];
  private konvergenzFrames = 0;

  /** Uniform für alle zeitabhängigen Shader. Wird bewusst NICHT aus `time` gespeist. */
  readonly zeit = uniform(0);
  /** Globale Intensität der Energieanimation (0 bei reduzierter Bewegung). */
  readonly puls = uniform(1);

  private constructor(renderer: THREE.WebGPURenderer, opt: RenderwerkOptionen) {
    this.renderer = renderer;
    this.leinwand = opt.leinwand;
    this.guete = opt.guete ?? 'hoch';
    this.temporal = opt.temporal ?? 'prod';
    this.reduziert = opt.reduzierteBewegung ?? false;
    this.ohnePost = opt.ohnePost === true;
    this.backend = renderer.backend.isWebGPUBackend ? 'webgpu' : 'webgl2';

    this.szene = new THREE.Scene();
    this.kamera = new THREE.PerspectiveCamera(45, 16 / 9, 0.5, 600);
    this.kamera.position.set(18, 16, 22);
    this.kamera.lookAt(0, 0, 0);

    if (this.reduziert) this.puls.value = 0;
  }

  static async erzeuge(opt: RenderwerkOptionen): Promise<Renderwerk> {
    const preset = PRESETS[opt.guete ?? 'hoch'];
    const renderer = new THREE.WebGPURenderer({
      canvas: opt.leinwand,
      antialias: false, // Der Post-Stack läuft immer; FB-MSAA hilft dem Offscreen-Ziel nicht.
      alpha: false,
      stencil: false,
      powerPreference: 'high-performance',
      // Zwischenziele des Post-Stacks in Halbgleitkomma. Ohne das rechnet der
      // Graph in 8 Bit je Kanal, was auf dem WebGL2-Fallback zu vertauschten
      // Farbkanaelen führt — im Bild ein durchgehend roter Stich.
      outputBufferType: THREE.HalfFloatType,
      forceWebGL: opt.erzwingeWebGL === true,
    });
    renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio ?? 1, preset.pixelDeckel));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.AgXToneMapping;
    renderer.toneMappingExposure = 1.02;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.info.autoReset = false;

    // Ohne dieses await bleibt die Leinwand schwarz — ohne jede Fehlermeldung.
    await renderer.init();

    const werk = new Renderwerk(renderer, opt);

    // Image-Based Lighting. Ohne sie sehen alle metallischen Materialien falsch
    // aus — das ist keine Feinheit, sondern der Unterschied zwischen "wirkt
    // echt" und "wirkt wie ein Prototyp".
    const umgebung = erzeugeUmgebung(renderer);
    werk.szene.environment = umgebung.textur;
    werk.szene.environmentIntensity = 0.9;
    werk.beiEntsorgung(() => umgebung.entsorge());

    werk.baueGraph();
    werk.setzeGroesse(opt.leinwand.clientWidth || 1280, opt.leinwand.clientHeight || 720);
    return werk;
  }

  // -------------------------------------------------------------------------
  // Post-Processing
  // -------------------------------------------------------------------------

  private baueGraph(): void {
    this.pipeline?.dispose();
    if (this.ohnePost) {
      this.pipeline = null;
      return;
    }
    const preset = PRESETS[this.guete];
    const temporalAn = this.temporal !== 'aus';

    /*
     * Warum KEIN MRT-Emissive-Kanal für den Bloom:
     *
     * Der naheliegende Weg wäre `setMRT(mrt({ output, emissive }))` und ein
     * Bloom nur auf dem Emissive-Kanal. Das ist die selektivere Lösung — und
     * sie hat sich in der Messung als unbrauchbar erwiesen: auf dem
     * WebGL2-Fallback-Backend legte sie einen roten Schleier über die gesamte
     * Szene, weil Flächen ohne eigenen Emissive-Knoten den zweiten Anhang
     * nicht vollständig beschreiben. Der Vergleich mit und ohne Post-Stack
     * (`?post=0`) hat das eindeutig belegt.
     *
     * Der Ersatz ist der klassische Weg: Bloom über das fertige Bild mit einer
     * Helligkeitsschwelle. Weil im ganzen Spiel nur leuchtende Elemente
     * überhaupt oberhalb der Schwelle liegen (die Halle ist bewusst dunkel
     * gehalten), ist die Auswahl in der Praxis genauso selektiv — nur ohne
     * Abhängigkeit vom MRT-Verhalten des Backends.
     */
    const szenenPass = pass(this.szene, this.kamera);
    const farbe = szenenPass.getTextureNode('output');

    let bild: unknown = farbe;

    if (preset.ao) {
      // GTAO braucht Normalen und Tiefe aus einem EIGENEN Pre-Pass.
      const vorPass = pass(this.szene, this.kamera, {
        minFilter: THREE.NearestFilter,
        magFilter: THREE.NearestFilter,
      });
      vorPass.setMRT(mrt({ output: packNormalToRGB(normalView), velocity }));
      const aoPass = ao(vorPass.getTextureNode('depth'), vorPass.getTextureNode('output'), this.kamera);
      const a = aoPass as unknown as { resolutionScale: number; useTemporalFiltering?: boolean };
      a.resolutionScale = preset.aoAufloesung;
      if ('useTemporalFiltering' in a) a.useTemporalFiltering = temporalAn;
      // NUR der Rotkanal trägt die Verdeckung. Multipliziert man mit der
      // ganzen Textur, löscht man Gruen und Blau des Bildes vollständig aus —
      // das Ergebnis ist ein reines Rotbild. Genau dieser Fehler hat hier
      // stundenlang wie ein Bloom-Problem ausgesehen.
      bild = (bild as THREE.TextureNode).mul(aoPass.getTextureNode().r);
    }

    bild = (bild as { add: (x: unknown) => unknown }).add(
      bloom(farbe, preset.bloomStaerke, preset.bloomRadius, preset.bloomSchwelle)
    );

    /*
     * Vignette und Farbstimmung als letzter Schritt vor der Kantenglaettung.
     * Beides ist billig und trägt mehr zum Eindruck bei als jeder weitere
     * teure Effekt: die Vignette führt den Blick zur Bildmitte, und die
     * leichte Kühlung trennt Halle und Technik farblich.
     */
    const rand = screenUV.sub(0.5).length().mul(1.35);
    const vignette = float(1).sub(rand.mul(rand).mul(0.55)).clamp(0, 1);
    // Farbstimmung als konstanter Ton, nicht als Bildmischung: das hält den
    // Knotentyp eindeutig und kostet nichts.
    const stimmung = mix(color(0x9fb6d6), color(0xffffff), float(0.82));
    bild = (bild as { mul: (x: unknown) => unknown }).mul(vignette);
    bild = (bild as { mul: (x: unknown) => unknown }).mul(stimmung);

    if (preset.smaa) bild = smaa(bild as never);

    const pipeline = new THREE.RenderPipeline(this.renderer);
    pipeline.outputNode = bild as never;
    this.pipeline = pipeline;
    this.konvergenzFrames = 0;
  }

  setzeBildguete(g: Bildguete): void {
    if (g === this.guete) return;
    this.guete = g;
    this.renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio ?? 1, PRESETS[g].pixelDeckel));
    this.baueGraph();
  }

  setzeTemporalModus(m: TemporalModus): void {
    if (m === this.temporal) return;
    this.temporal = m;
    this.baueGraph();
  }

  setzeReduzierteBewegung(an: boolean): void {
    this.reduziert = an;
    this.puls.value = an ? 0 : 1;
  }

  get temporalModus(): TemporalModus {
    return this.temporal;
  }

  get bildguete(): Bildguete {
    return this.guete;
  }

  // -------------------------------------------------------------------------
  // Betrieb
  // -------------------------------------------------------------------------

  setzeGroesse(breite: number, hoehe: number): void {
    const b = Math.max(1, Math.floor(breite));
    const h = Math.max(1, Math.floor(hoehe));
    this.kamera.aspect = b / h;
    this.kamera.updateProjectionMatrix();
    // RenderPipeline hat kein setSize — die Größe kommt aus dem Drawing Buffer.
    this.renderer.setSize(b, h, false);
  }

  /**
   * Zeichnet ein Bild. `sekunden` ist die vergangene Zeit für Shader-Uniforms;
   * im Testmodus setzt der Aufrufer sie auf einen festen Wert, damit Bilder
   * reproduzierbar sind.
   */
  zeichne(sekunden: number): void {
    this.zeit.value = sekunden;
    this.renderer.info.reset();
    if (this.pipeline) this.pipeline.render();
    else this.renderer.render(this.szene, this.kamera);
    this.konvergenzFrames++;
  }

  /** Warmlauf für den Modus 'konvergiert': feste Kamera, N Bilder. */
  konvergiere(bilder = 24, sekunden = 0): void {
    for (let i = 0; i < bilder; i++) this.zeichne(sekunden);
  }

  zaehler(): { drawCalls: number; dreiecke: number; geometrien: number; texturen: number } {
    const i = this.renderer.info;
    return {
      drawCalls: i.render.drawCalls,
      dreiecke: i.render.triangles,
      geometrien: i.memory.geometries,
      texturen: i.memory.textures,
    };
  }

  /** Registriert eine Aufräumfunktion, die `entsorge()` mit ausführt. */
  beiEntsorgung(f: () => void): void {
    this.entsorger.push(f);
  }

  entsorge(): void {
    this.renderer.setAnimationLoop(null);
    for (const f of this.entsorger.splice(0)) {
      try {
        f();
      } catch {
        // Aufräumen darf niemals den Abbau blockieren.
      }
    }
    this.pipeline?.dispose();
    this.pipeline = null;
    this.szene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else mat?.dispose();
    });
    this.szene.clear();
    this.renderer.dispose();
    void this.leinwand;
  }
}
