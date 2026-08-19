/**
 * Renderer-Spike als Bisektion. `?stufe=N` schaltet den Post-Graphen
 * schrittweise auf, damit die genaue Bruchstelle bestimmbar ist:
 *
 *   0  renderer.render(...)            — nackt, ohne RenderPipeline
 *   1  RenderPipeline, outputNode = pass(scene, camera)
 *   2  + Bloom auf dem gesamten Bild
 *   3  + MRT-Emissive-Kanal, selektiver Bloom
 *   4  + GTAO ueber einen eigenen Normal/Tiefe-PrePass
 *   5  + SMAA (Vollausbau)
 *
 * Die Helligkeitspruefung erfolgt NICHT im Browser (der Drawing Buffer ist
 * nach dem Compositing geleert), sondern im Runner ueber den echten
 * Playwright-Screenshot.
 */

import * as THREE from 'three/webgpu';
import {
  pass,
  mrt,
  output,
  emissive,
  uniform,
  vec4,
  positionWorld,
  mix,
  color,
  normalView,
  velocity,
} from 'three/tsl';
import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { ao } from 'three/addons/tsl/display/GTAONode.js';
import { smaa } from 'three/addons/tsl/display/SMAANode.js';
import { packNormalToRGB } from 'three/tsl';

declare global {
  interface Window {
    __spike?: Record<string, unknown>;
    __spikeFertig?: boolean;
  }
}

const bericht: Record<string, unknown> = { schritt: 'start' };
window.__spike = bericht;

async function lauf(): Promise<void> {
  const leinwand = document.getElementById('leinwand') as HTMLCanvasElement;
  const params = new URLSearchParams(location.search);
  const stufe = Number(params.get('stufe') ?? '5');
  bericht.stufe = stufe;

  const renderer = new THREE.WebGPURenderer({
    canvas: leinwand,
    antialias: false,
    alpha: false,
    stencil: false,
    powerPreference: 'high-performance',
    forceWebGL: params.get('forceWebGL') === '1',
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.AgXToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.info.autoReset = false;

  bericht.schritt = 'vor_init';
  await renderer.init();
  bericht.schritt = 'nach_init';
  bericht.backend = renderer.backend.isWebGPUBackend ? 'webgpu' : 'webgl2';

  const szene = new THREE.Scene();
  szene.background = new THREE.Color(0x0b1017);
  const kamera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 400);
  kamera.position.set(7, 6, 9);
  kamera.lookAt(0, 1.4, 0);

  const boden = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 60),
    new THREE.MeshStandardNodeMaterial({ color: 0x1a2029, roughness: 0.85, metalness: 0.1 })
  );
  boden.rotation.x = -Math.PI / 2;
  boden.receiveShadow = true;
  szene.add(boden);

  const puls = uniform(1.0);
  for (let i = 0; i < 12; i++) {
    const winkel = (i / 12) * Math.PI * 2;
    const mat = new THREE.MeshStandardNodeMaterial({ color: 0x39424f, roughness: 0.35, metalness: 0.8 });
    mat.emissiveNode = mix(color(0x1b6fe0), color(0xffb347), positionWorld.y.mul(0.25).clamp(0, 1)).mul(puls);
    const wuerfel = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.8 + (i % 3) * 0.6, 0.9), mat);
    wuerfel.position.set(Math.cos(winkel) * 4.2, 0.9 + (i % 3) * 0.3, Math.sin(winkel) * 4.2);
    wuerfel.castShadow = true;
    wuerfel.receiveShadow = true;
    szene.add(wuerfel);
  }

  const kugelMat = new THREE.MeshStandardNodeMaterial({ color: 0x20262e, roughness: 0.12, metalness: 1.0 });
  kugelMat.emissiveNode = color(0x66e0ff).mul(1.2);
  const kugel = new THREE.Mesh(new THREE.IcosahedronGeometry(1.4, 4), kugelMat);
  kugel.position.set(0, 2.4, 0);
  kugel.castShadow = true;
  szene.add(kugel);

  const sonne = new THREE.DirectionalLight(0xdfe9ff, 3.0);
  sonne.position.set(8, 14, 6);
  sonne.castShadow = true;
  sonne.shadow.mapSize.set(1024, 1024);
  sonne.shadow.camera.near = 1;
  sonne.shadow.camera.far = 60;
  const sk = sonne.shadow.camera as THREE.OrthographicCamera;
  sk.left = -18;
  sk.right = 18;
  sk.top = 18;
  sk.bottom = -18;
  sonne.shadow.bias = -0.0006;
  szene.add(sonne);
  szene.add(new THREE.HemisphereLight(0x5c86c4, 0x0a0d12, 1.0));

  bericht.schritt = 'post_aufbau';
  let pipeline: THREE.RenderPipeline | undefined;
  const entsorger: Array<() => void> = [];

  if (stufe >= 1) {
    const szenenPass = pass(szene, kamera);
    let knoten: unknown = szenenPass;

    if (stufe === 2) {
      knoten = szenenPass.add(bloom(szenenPass, 0.9, 0.5, 0.6));
    }

    if (stufe >= 3) {
      const mrtKnoten = mrt({ output, emissive: vec4(emissive, output.a) });
      szenenPass.setMRT(mrtKnoten);
      const farbe = szenenPass.getTextureNode('output');
      const leuchten = szenenPass.getTextureNode('emissive');
      knoten = farbe.add(bloom(leuchten, 1.8, 0.55, 0.0));
    }

    if (stufe >= 4) {
      const vorPass = pass(szene, kamera, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
      vorPass.setMRT(mrt({ output: packNormalToRGB(normalView), velocity }));
      const vorTiefe = vorPass.getTextureNode('depth');
      const vorNormal = vorPass.getTextureNode('output');
      const aoPass = ao(vorTiefe, vorNormal, kamera);
      (aoPass as unknown as { resolutionScale: number }).resolutionScale = 0.5;
      const farbe = szenenPass.getTextureNode('output');
      const leuchten = szenenPass.getTextureNode('emissive');
      knoten = farbe.mul(aoPass.getTextureNode()).add(bloom(leuchten, 1.8, 0.55, 0.0));
    }

    if (stufe >= 5) {
      knoten = smaa(knoten as never);
    }

    pipeline = new THREE.RenderPipeline(renderer);
    pipeline.outputNode = knoten as never;
    entsorger.push(() => pipeline?.dispose());
  }

  bericht.schritt = 'post_bereit';

  let frame = 0;
  function zeichne(): void {
    puls.value = 0.6 + 0.4 * Math.sin(frame * 0.05);
    kugel.rotation.y = frame * 0.01;
    renderer.info.reset();
    if (pipeline) pipeline.render();
    else renderer.render(szene, kamera);
    frame++;
  }

  for (let i = 0; i < 8; i++) {
    zeichne();
    await new Promise((r) => requestAnimationFrame(() => r(null)));
  }

  bericht.frames = frame;
  bericht.drawCalls = renderer.info.render.drawCalls;
  bericht.dreiecke = renderer.info.render.triangles;
  bericht.geometrien = renderer.info.memory.geometries;
  bericht.texturen = renderer.info.memory.textures;
  bericht.schritt = 'fertig';
  bericht.erfolg = true;
  window.__spikeFertig = true;

  renderer.setAnimationLoop(() => zeichne());
  void entsorger;
}

lauf().catch((e: unknown) => {
  bericht.schritt = 'fehler';
  bericht.erfolg = false;
  bericht.fehler = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
  bericht.stack = e instanceof Error ? String(e.stack).slice(0, 900) : undefined;
  window.__spikeFertig = true;
  console.error('SPIKE FEHLER', e);
});
