# SCHWARMWERK — Produktions-Bibel

**Version 1.0 · Stand August 2026 · verbindlich für die gesamte Produktion**

Konsolidiert aus 10 Spezialisten-Berichten (Rendering, prozedurale Assets, Audio, Zachlike-Design, Didaktik, Verifikation, Evolution, Agentic-Engineering-Fachdomäne, Steuerung/UX, Narrativ) und abgeglichen gegen den bereits existierenden Simulationskern unter `agent_doc/game_one/game/src/sim/` (`typen.ts`, `balance.ts`, `rng.ts`) sowie die vorhandene `package.json` (three ^0.185.1, postprocessing ^6.39.4, vitest ^3.2.7, @playwright/test ^1.62.1, vite ^7.3.6, TypeScript ^5.9.3).

Dieses Dokument trifft Entscheidungen. Wo zwei Berichte sich widersprechen, steht die Entscheidung mit Begründung **und** mit der Konsequenz für den verworfenen Weg im Entscheidungslog (Abschnitt 1). Was hier nicht steht, ist nicht beschlossen; was hier steht, wird nicht ohne Änderung dieses Dokuments umgebaut.

---

## 0. Entscheidungslog — die sechs echten Widersprüche

| # | Widerspruch | Entscheidung | Kurzbegründung |
|---|---|---|---|
| W-1 | **WebGPU + TSL** (Bericht 1) vs. **WebGL2 + pmndrs/postprocessing + `onBeforeCompile`** (Berichte 2, 8) vs. **WebGL2 als CI-Wahrheit** (Bericht 5) | **WebGPURenderer aus `three/webgpu` + TSL + `RenderPipeline`.** WebGL2 ist kein zweiter Renderer, sondern das Fallback-**Backend derselben Klasse** (`forceWebGL: true`). `postprocessing` wird als Abhängigkeit **entfernt**. | Der gesamte AAA-Effektkatalog in r185 (Godrays, TRAA, TAAU, FSR1, SSR, SSGI, VolumeNodeMaterial, ClusteredLighting, TileShadow) existiert **ausschließlich** auf dem Node/TSL-Pfad. Der klassische Pfad hat davon nichts. „AAA-Bildqualität" ist Projektauftrag, also ist der Pfad determiniert. Kritisch: keiner der 44 TSL-display-Nodes nutzt `compute()`/Storage — der komplette Post-Stack läuft identisch auf dem WebGL2-Fallback-Backend. Damit bleibt CI mit SwiftShader möglich. |
| W-2 | **Temporale Effekte** (TRAA/TAAU/GTAO-temporal) vs. **pixelstabile Visual Regression** | **Drei Rendermodi**: `PROD` (temporal an), `TEST_OFF` (SMAA statt TRAA, `useTemporalFiltering=false`, kein SSGI), `TEST_CONVERGED` (24 Warmup-Frames bei eingefrorener Kamera). Baselines nur aus `TEST_OFF`. | Ohne expliziten Nicht-temporal-Zweig diffen alle Baselines bei jedem Lauf, das Team schaltet Visual Regression ab, und die im Auftrag geforderte deterministische Verifikation ist faktisch weg. |
| W-3 | **5 Metriken** (`Metriken` in `typen.ts`) vs. **max. 3 Wettbewerbsachsen** (Bericht 4) | **Alle Metriken werden weiter berechnet** (Interface bleibt unverändert), aber nur **drei sind Wettbewerbsachsen**: `kostenJeAuftrag`, `latenzP95`, `flaeche`. Güte, Sicherheit, Konformität, Belegquote sind **binäre Gates**. Nachvollziehbarkeit ist Gate nur in Audit-Leveln. | Aggregation kollabiert die Pareto-Front und tötet das Genre. Fünf gleichzeitig sichtbare Achsen kann niemand im Kopf abwägen. Es ist **keine Code-Änderung** nötig — nur die `Ziel`-Definitionen und das HUD. |
| W-4 | **9 Akte × 4 + 12 Sonder** (Bericht 4) vs. **12 Akte × 4 = 48** (Bericht 9) vs. **6–10 Kapitel** (Bericht 5) | **12 Akte × 4 Level = 48 Pflichtlevel**, plus 12 Sonderaufträge (nicht gatend), plus 2 Sandkästen. Gating **3 von 4**. | Die `ModulArt`-Union in `typen.ts` hat exakt 12 Progressions-Slots. `Level.akt`/`Level.nummer` existieren bereits. `nummer % 4 === 3` als TEN-Level ist testbar. |
| W-5 | **Eigener Evolutions-Akt mit 5 Leveln** (Bericht 6) vs. 48er-Raster | **Akt XI „Die Schmiede" = 4 Level.** NSGA-II/Hypervolumen wandert ins optionale Meisterstück und in den Sandkasten „Lastlabor". | Rasterintegrität schlägt Vollständigkeit einer Einzelmechanik. |
| W-6 | **Fließkomma-Metriken** (aktuelle `balance.ts`) vs. **Integer-Festkomma** (Berichte 5, 6) | **Hybrid, verbindlich**: Kosten und Ticks sind `int`. Güte/Kontext/Unsicherheit bleiben `number`, werden aber **nach jeder Schreiboperation auf 1e-6 quantisiert** (`q()`), und **alle** nichtlinearen Kurven laufen über generierte Integer-LUTs. `Math.pow/exp/log/sin/cos/tan/atan2` sind in `src/sim/**` per Lint verboten; `Math.sqrt`, `Math.round`, `Math.min/max` und Grundrechenarten sind erlaubt (IEEE-754 exakt). | Bit-Determinismus ohne kompletten Rewrite des vorhandenen Kerns. `KONTEXT_ROT_EXPONENT = 1.5` ist als `x * Math.sqrt(x)` exakt darstellbar; `KOMPETENZ_STEILHEIT = 1.6` wird zur Formparameter einer generierten LUT. |

---

## 1. Technische Grundsatzentscheidungen

### E-01 Renderer: `WebGPURenderer` aus `three/webgpu`, TSL als einzige Shader-Sprache

```ts
import * as THREE from 'three/webgpu';

const renderer = new THREE.WebGPURenderer({
  canvas,
  antialias: false,          // Post-Stack läuft immer; Default-FB-MSAA hilft dem Offscreen-Target nicht
  alpha: false,
  stencil: false,
  powerPreference: 'high-performance',
  outputBufferType: THREE.HalfFloatType,
  forceWebGL: params.get('forceWebGL') === '1',
});
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.AgXToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.info.autoReset = false;

// VOR init(): Lighting-Strategie
renderer.lighting = new DynamicLighting({ maxPointLights: 64, maxSpotLights: 16, maxDirectionalLights: 8 });

await renderer.init();                    // ZWINGEND, sonst schwarzes Bild ohne Fehlermeldung
// ERST JETZT: PMREMGenerator, RenderPipeline, Backend-Erkennung
const backend = renderer.backend.isWebGPUBackend ? 'webgpu' : 'webgl2';
```

**Konsequenzen, die sofort umgesetzt werden:**
- `postprocessing: ^6.39.4` wird aus `package.json` **entfernt**. `EffectComposer`, `SelectiveBloomEffect`, `SMAAEffect` aus pmndrs sind mit `WebGPURenderer` nicht lauffähig und haben keinen Migrationspfad.
- **Alle** `onBeforeCompile`-Rezepte aus Bericht 2 (Fresnel-Rim, Dissolve, Hologramm-Scanlines, Emissive-Pulsing) werden in TSL neu geschrieben. `onBeforeCompile`, `customProgramCacheKey`, GLSL-`ShaderMaterial` funktionieren auf dem WebGPU-Pfad **auch nicht auf dessen WebGL2-Fallback**.
- Dissolve-Schatten: statt `customDepthMaterial` wird die Alpha-Kette des Node-Materials genutzt (`opacityNode` + `alphaTestNode`); wo das nicht reicht, `material.castShadowNode`. *(API gegen r185 verifizieren, siehe Abschnitt 12 / M1.)*
- `wgslFn` und `glslFn` sind projektweit verboten, damit der WebGL2-Fallback erhalten bleibt.
- Die r185-**WebGL-Node-Brücke** (`setNodesHandler`/`setEffects`) wird **nicht** eingesetzt: sie unterstützt laut eigenem Header kein MRT, keine VSM-Schatten, keine Transmission und keinen WebGPU-Post-Stack — also exakt nichts von dem, was den Look ausmacht.
- Backend-Wahl ist **Boot-Entscheidung**, in `localStorage` gemerkt, Wechsel = Seitenreload. `forceWebGL` ist reiner Konstruktor-Parameter.

### E-02 Post-Processing: `THREE.RenderPipeline`, niemals `THREE.PostProcessing`

`PostProcessing` ist seit r183 nur noch ein `warnOnce`-Wrapper um `RenderPipeline`. Es gibt kein `RenderPipeline.setSize()` — die Größe kommt aus dem Drawing-Buffer. `renderPipeline.outputColorTransform` bleibt `true` (Tone Mapping + sRGB automatisch); **keine zweite Konvertierung** im Graphen, kein `OutputPass`.

### E-03 Sprache, Build, Typen

- TypeScript 5.9.x, `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`.
- Vite 7.3.x, ESM, `define: { __TEST__: JSON.stringify(process.env.VITE_TESTHOOKS === '1') }`.
- `@types/three` auf `0.185.x` **gepinnt** (three liefert keine `.d.ts`, kein `types`-Feld in package.json). Typlücken (z. B. `dispose()` auf Effekt-Nodes) werden in `src/types/three_augment.d.ts` per Declaration Merging geschlossen — **kein `as any` im Code**.
- WebGPU-Typen kommen mit TS 6 mit; bei TS 5.9 zusätzlich `@webgpu/types`.

### E-04 Test-Stack

- **vitest 4.x** (Upgrade von 3.2.7): AST-basiertes v8-Coverage-Remapping, stabiler Browser Mode, `toMatchScreenshot({ comparatorName: 'pixelmatch' })` für HUD-Komponenten.
- **Playwright 1.62.1** im offiziellen Container `mcr.microsoft.com/playwright:v1.62.1-noble`, `channel: 'chromium'` (Pflicht — sonst startet `chrome-headless-shell` mit abweichendem Rendering).
- **pixelmatch 7.2.0** für die eigene Cluster-Analyse der Diff-Maske (`includeAA: false`).
- Software-Rendering: `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader` (ab Chrome 130+ gibt es ohne das letzte Flag **keinen** WebGL-Kontext, nicht nur eine Warnung).

### E-05 Architektur-Grundsatz: `src/sim/**` ist ein reines TypeScript-Paket

Kein `three`, kein `window`, kein `document`, kein `performance`, kein DOM — per ESLint `no-restricted-imports` und `no-restricted-globals` erzwungen. Der Renderer liest ausschließlich unveränderliche Tick-Zustände und schreibt **nie** zurück. Ohne diese Trennung ist keine der Verifikationsdirektiven umsetzbar; mit ihr laufen alle Golden-Master-Tests in Node in Millisekunden.

### E-06 Determinismus-Regime (verbindlich)

1. Der vorhandene **hashbasierte RNG** (`src/sim/rng.ts`) bleibt und ist die **einzige** Zufallsquelle. Er hat bewusst keinen sequentiellen Strom und ist damit reihenfolgeunabhängig — das ist die Voraussetzung für Worker-Parallelisierung im Evolutions-Akt.
2. `Math.random`, `Date.now`, `performance.now` sind in `src/sim/**` verboten (Lint + Runtime-Trap im Test-Setup, der wirft).
3. Transzendente Funktionen verboten (LUTs, Abschnitt 7.1).
4. Iteration **nie** über `Map`/`Set`/`Object.keys`, immer über explizit sortierte Index-Arrays. Jeder `sort()`-Komparator hat einen Tie-Break auf Modul-/Paket-ID.
5. Fixed Timestep, ganzzahlige Ticks, Rendering interpoliert nur (`alpha = akkumulator / TICK`).
6. Kamerazustand fließt **niemals** in `pruefsumme` oder in die Undo-Historie.

### E-07 Assets & Lizenzen

Null externe Assets. Schriften ausschließlich System-Font-Stack (`-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, sans-serif`) — damit entfällt das Google-Fonts-CDN-Risiko (LG München I, 3 O 17493/20) vollständig. Abhängigkeitspolitik: **nur MIT/BSD/Apache-2.0/Zlib**. **GSAP ist verboten** (Webflow-Wettbewerbsklausel, einseitiges Kündigungsrecht — im Kontext öffentlicher Auftraggeber ein Compliance-Risiko); stattdessen ein eigenes ~80-Zeilen-Tween-/Feder-Modul (kritisch gedämpft, `c = 2*sqrt(k)`, `k = 120`).

### E-08 Telemetrie & Mitbestimmung

Default: **alles lokal** (localStorage für Fortschritt, IndexedDB für Telemetrie). Kein Server, kein Leaderboard mit Klarnamen, keine Zeitmessung pro Person im Auslieferungszustand. Upload nur opt-in mit Klartext-Vorschau des JSON. Datenformat gegen **xAPI-SG + cmi5** modelliert, damit ein späterer LMS-Anschluss keine Neuarchitektur braucht. Kein Kamera-/Mikrofon-/Affekt-Tracking (EU AI Act: Emotionserkennung am Arbeitsplatz seit 02.02.2025 verboten). Mitgeliefert: Muster-Betriebsvereinbarung und Datenfeldkatalog mit Zweckbindung „keine Leistungs- oder Verhaltenskontrolle" (§ 87 Abs. 1 Nr. 6 BetrVG greift bereits bei der bloßen *Eignung*).

---

## 2. Rendering-Direktiven

### 2.1 Der Post-Graph (`src/render/pipeline.ts`) — verbindliche Reihenfolge

```
(1)  prePass      = pass(scene, camera)
                    prePass.transparent = false
                    setMRT(mrt({ output: packNormalToRGB(normalView), velocity }))
                    normalTexture.type = UnsignedByteType
(2)  aoPass       = ao(prePassDepth, prePassNormal, camera)
                    resolutionScale 0.5 · useTemporalFiltering true
                    radius 0.25 · samples 16 · scale 0.5 · thickness 1 · distanceExponent 1
(3)  scenePass    = pass(scene, camera)
                    setMRT(mrt({ output, emissive: vec4(emissive, output.a),
                                 metalrough: vec2(metalness, roughness) }))
                    emissiveTexture.type = UnsignedByteType
                    scenePass.contextNode = builtinAOContext(aoOut.sample(screenUV).r)
(4)  volPass      = pass(scene, camera, { depthBuffer: false })
                    setLayers(LAYER_VOLUMEN=10) · setResolutionScale(0.25)
                    → gaussianBlur(volPass, uniform(0.6))
(5)  godrays      = godrays(sceneDepth, camera, keyLight)
                    → bilateralBlur(...) → depthAwareBlend(sceneColor, ..., camera, {...})
(6)  ssr          = ssr(sceneColor, sceneDepth, sceneNormal, { metalnessNode, roughnessNode })
(7)  composite    = sceneColor.add(volBlurred.mul(nebelIntensitaet))
                              .add(godraysBlended).add(ssr.rgb)
(8)  bloom        = bloom(emissiveTexNode, 1.8, 0.5, 0.0)  → composite.add(bloom)
(9)  dof          = dof(composite, scenePass.getViewZNode(), fokus, brennweite, bokeh)   [nur HOCH]
(10) traa         = traa(composite, prePassDepth, prePassVelocity, camera)
(11) chromaticAberration(traa, 0.4, null, 1.05)
(12) film(x, 0.14)
(13) x.mul(vignette)     // vignette = screenUV.distance(0.5).remap(0.6,1).mul(2).clamp().oneMinus()
(14) lut3D(x, lutTex, 32, 1.0)     // LUT prozedural als DataTexture3D
(15) renderPipeline.outputNode = x
```

**Regeln:**
- Selektives Bloom **ausschließlich** über den MRT-Emissive-Kanal, **niemals** über Threshold-Tuning oder Layer-Doppelrender. Threshold bleibt 0. `BloomNode` läuft bereits per Default bei `_resolutionScale 0.5` — **nicht** zusätzlich auf 0.25 setzen (Flackern an dünnen Leitungen).
- Qualitätsstufenwechsel zur Laufzeit **nur** in dieser Reihenfolge: `await renderer.setAnimationLoop(null)` → `renderPipeline.outputNode = neuerGraph` → `renderPipeline.needsUpdate = true` → **nur die wirklich ausgemusterten** target-besitzenden Nodes disposen → Loop starten.
- `renderPipeline.dispose()` gibt nur sein eigenes Fullscreen-Material frei. Die Disposal-Kette ist eine getestete Funktion (Abschnitt 10.5).

### 2.2 Qualitätsstufen

| | NIEDRIG | MITTEL (Default MacBook) | HOCH |
|---|---|---|---|
| `scenePass.setResolutionScale` | 0.50 | 0.66 | 1.00 |
| Upscaler | FSR1 (`sharpness 0.2`) | TAAU + `sharpen(…, 0.2)` | — |
| AA | SMAA | TRAA | TRAA (`useSubpixelCorrection=false`) |
| AO | aus | GTAO 0.5 + temporal | GTAO 0.5 + temporal |
| Volumetrik | aus | 0.25, `steps 8` | 0.25, `steps 12` |
| Godrays | aus | aus | 48 Steps, `density 0.5` |
| SSR | aus | aus | an |
| DoF | aus | aus | an |
| Bloom | an | an | an |
| `setPixelRatio` | min(dpr,2) | min(dpr,2) | min(dpr,2) |

Auf einem 14″ MacBook Pro (1512×982 CSS, DPR 2 = 2,97 Mio. Pixel) rendert MITTEL ~1,3 Mio. Pixel und präsentiert scharf auf 2,97 Mio. Das ist **billiger und schärfer** als DPR 1.5 ohne Upscaler. Zusätzlich läuft ein **dynamisches Resolution-Scaling** in `[0.6, 1.0]`: gleitender Median über 60 Frames; >13,5 ms für 30 Frames → −0.1; <9,0 ms für 120 Frames → +0.05; max. eine Änderung pro 500 ms; **nie während eines Kamera-Tweens**.

### 2.3 Beleuchtungs-Rig der Halle

- **IBL prozedural, einmalig**: eigene `HallenEnvironment extends THREE.Scene` nach RoomEnvironment-Muster (BackSide-Box, 4 Decken-Lichtbänder als `InstancedMesh` mit `MeshLambertMaterial({color:0x000000, emissive:0xffffff, emissiveIntensity: 60…120})`, zwei kalte Wand-Bounces 15–25 leicht blau, ein warmer Bodenreflex, 1 PointLight). Dann `scene.environment = pmrem.fromScene(env, 0.04, 0.1, 100, { size: 256 }).texture`, `scene.environmentIntensity = 0.35`, danach `env.dispose()` und `pmrem.dispose()`.
- **Stimmungswechsel** (Normalbetrieb / Alarm / Audit) **nur** über `scene.environmentIntensity` und `scene.environmentRotation` oder max. 3 vorgebackene PMREM-Texturen. **Niemals PMREM pro Frame.**
- **Echte Lichter**: genau **2 schattenwerfende** (1 `DirectionalLight` als Key, 1 `SpotLight` als Akzent) + 4–8 schattenlose `PointLight` + Decken-`RectAreaLight(0xbfdcff, 5, 6, 0.6)`.
- **RectAreaLight auf WebGPU**: `THREE.RectAreaLightNode.setLTC(RectAreaLightTexturesLib.init())` **einmal** vor dem Erzeugen der Lichter. `RectAreaLightUniformsLib.init()` ist die WebGL-API und lässt die Lichter still schwarz. RectAreaLights werfen **keine** Schatten — Bodenkontakt kommt vom SpotLight.
- **Leuchtende Token-Pakete sind KEINE PointLights.** Sie sind `MeshStandardNodeMaterial` mit `emissiveNode` und werden über den MRT-Emissive-Kanal geblooomt.
- `DynamicLighting` statt `ClusteredLighting`, weil der Spieler ständig Module platziert und entfernt: „so light count changes do not recompile materials" verhindert den Frame-Hitch. ClusteredLighting hat drei Fallen, die genau unseren Fall treffen (nur PointLights ohne `castShadow`, `distance = 0` nicht unterstützt, stiller Abbruch bei `maxLightsPerCluster`-Überlauf).

### 2.4 Schatten

```
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 1; sun.shadow.camera.far = 60;
// ortho left/right/top/bottom exakt auf die Hallenmaße zuschneiden
sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.03;
sun.shadow.radius = 3; sun.shadow.intensity = 0.9;
```
Verifikation mit temporärem `THREE.CameraHelper(sun.shadow.camera)`, dass das Volumen minimal ist. Reicht die Texeldichte nicht: `TileShadowNode(sun, { tilesX: 2, tilesY: 2 })` — **nicht** größere Map, **nicht** CSM (für eine begrenzte Halle unnötiger Mehraufwand). Bias erst anfassen, nachdem Weltmaßstab, Normalen und Shadow-Camera-Range stimmen. `renderer.shadowMap.autoUpdate = false` im Testmodus, einmal manuell aktualisieren.

### 2.5 Volumetrik

```
const vm = new THREE.VolumeNodeMaterial();
vm.steps = 12;                                  // 8 bei ruhiger Kamera / MITTEL
vm.offsetNode = bayer16(screenCoordinate);      // gegen Banding
vm.scatteringNode = Fn(({ positionRay }) => …); // 3 texture3D-Samples, Skalen 0.1 / 0.05 / 0.02
vm.depthNode = sceneDepth.sample(screenUV);
```
Mesh = `BoxGeometry` über die Halle, `layers.disableAll()` + `layers.enable(10)`; **jedes beteiligte Licht** bekommt `light.layers.enable(10)`. Eigener Pass mit `{depthBuffer:false}`, `setResolutionScale(0.25)`, danach `gaussianBlur(pass, 0.6)`, additiv aufs Beauty-Bild.

### 2.6 Geometrie-Architektur

- **EIN `BatchedMesh(maxInstanceCount=512, maxVertexCount=400_000)`** für alle 12 Modularten mit einem gemeinsamen `MeshStandardNodeMaterial`. `perObjectFrustumCulled` und `sortObjects` sind dort Default `true` — als einziges Konstrukt bringt BatchedMesh Per-Instance-Culling mit.
- **EIN `InstancedMesh`** für Token-Pakete, Kapazität **2048**, Farbe/Zustand über `instancedBufferAttribute()` in TSL. Position pro Frame per Lerp zwischen Tick *t* und *t+1*, **keine Objekt-Neuanlage**.
- **Leitungen**: eine gemergte `TubeGeometry`-Batch pro Zustandsfarbe bzw. ein `LineSegments2`-Batch, Neuaufbau **nur** bei Graph-Änderung (Dirty-Flag).
- Geteilte Materialien reduzieren State-Wechsel, aber **keine** Draw Calls. 12 Modultypen × 40 Instanzen × 3 Untergeometrien wären >1400 Draw Calls.

### 2.7 Performance-Budgets (harte CI-Gates)

| Metrik | Halle (Akt I–X, XII) | Schmiede (Akt XI) | Quelle |
|---|---|---|---|
| `renderer.info.render.drawCalls` | **≤ 150** | ≤ 250 | harter Fail > 300 |
| `render.triangles` | ≤ 400 000 | ≤ 750 000 | |
| `memory.geometries` | ≤ 300 | ≤ 400 | |
| `memory.textures` | ≤ 60 | ≤ 60 | |
| geschätzter Texturspeicher | ≤ 256 MiB | ≤ 256 MiB | |
| `programs.length` | ≤ 60 | ≤ 60 | |
| schattenwerfende Lichter | ≤ 2 | ≤ 2 | |
| Drawing-Buffer | ≤ 2,1 Mio. Pixel effektiv | | |

**Frame-Budget 16,6 ms**: Sim ≤ 2 ms · Szenengraph-Update ≤ 3 ms · Render ≤ 8 ms · HUD/DOM ≤ 1,5 ms · Reserve 2 ms.

**Messung — die häufigste Fehlerquelle:** Auf dem WebGPU/common-Renderer heißt es **`renderer.info.render.drawCalls`**, nicht `.calls`. Ein Budget-Check gegen `.calls` liefert still `undefined` und besteht immer. `renderer.info.autoReset = false`; pro Frame `reset()` → `renderPipeline.render()` → Snapshot. GPU-Zeit **ausschließlich** über `await renderer.resolveTimestampsAsync('render')`, **niemals** rAF-Delta als GPU-Zeit labeln.

### 2.8 Shader-Hitching

Während des Ladebildschirms: alle Modultypen mindestens einmal instanzieren (auch außerhalb des Frustums) → `await renderer.compileAsync(scene, camera)` → **vollständigen HOCH-Graphen** setzen und einen Frame rendern → dann auf die gewählte Stufe zurückschalten.

### 2.9 TSL-Code-Regeln (Lint-verankert)

- Jeder zweimal verwendete Ausdruck: `.toVar('name')`.
- Jede wiederverwendete Hilfsfunktion: `Fn([...]).setLayout({ name, type, inputs })` — sonst wird pro Aufruf geinlined.
- Deterministische Konstanten: `.toConst()`.
- MRT-Kanäle explizit typisieren: `normal`, `emissive`, `metalrough` → `UnsignedByteType`; nur `output` bleibt `HalfFloatType` (spart je 4× VRAM).
- `.isolate()` bei wiederverwendeten komplexen Hierarchien.
- **`material.toneMapped = false` ist wirkungslos** (wird bei Render-Targets, aktivem Post und generell unter WebGPU ignoriert) → Weltbeschriftungen sind DOM-Overlay oder bewusst für die Output-Kette authored.

### 2.10 Tone Mapping — als Capture-Entscheidung, nicht als Meinung

Startpunkt: **AgX, `toneMappingExposure = 1.1`**. Vor Alpha ein A/B-Capture derselben Halle mit AgX / ACESFilmic / Neutral bei fixem Exposure gegen Neutralgrau, gesättigtes Neon-Cyan/Magenta, mattes Dielektrikum, Metall und die Emissive-Hierarchie der Token. Ergebnis (Operator, Exposure, Intermediate-Typ) wird im Render-Contract dokumentiert. Begründung für AgX als Default: ACES verfärbt gesättigte Neon-Highlights, und die Emissive-Hierarchie der Token ist ein Lesbarkeits-Feature, kein Deko-Effekt.

### 2.11 Referenz-Benchmarks

Diese r185-Beispiele werden lokal ausgecheckt und Screenshot-für-Screenshot gegen SCHWARMWERK gehalten: `webgpu_postprocessing_ao` (Qualitätsmaßstab), `webgpu_volume_lighting` + `volume_lighting_traa` (genau das Halle-mit-Lichtkegeln-Bild), `webgpu_postprocessing_godrays`, `webgpu_postprocessing_ssr` + `ssr_denoise`, `webgpu_postprocessing_bloom_emissive` + `bloom_selective`, `webgpu_postprocessing_anamorphic`, `webgpu_upscaling_taau` + `fsr1`, `webgpu_postprocessing_ssgi`. Es ist der einzige Satz Referenzen, dessen Parameter 1:1 übernehmbar sind.

---

## 3. Asset-Pipeline (alles prozedural)

### 3.1 Architektur

`src/gen/` mit drei strikt getrennten Modulen: `gen/tex` (Texturen), `gen/geo` (Geometrie), `gen/env` (IBL). **Jede** Funktion nimmt als erstes Argument `rng: () => number` (Instanz aus `erzeugeStrom(saat)` in `src/sim/rng.ts`) und ist rein — kein `Math.random`, kein `Date.now`, kein `performance.now`. Damit ist jedes Asset per Seed reproduzierbar und vitest kann Hashes der erzeugten `Uint8Array`-Puffer snapshotten.

### 3.2 Zu bauende Generatoren

| Modul | Funktion | Kernparameter | Test |
|---|---|---|---|
| `gen/tex/rauschen.ts` | `wert2d`, `fbm`, `worley` (CPU, seeded) | Oktaven 3–6 | Hash-Snapshot |
| `gen/tex/hoehe_zu_normal.ts` | `hoeheZuNormal(h, S, strength)` | Sobel-3×3, **/8**, Modulo-Wrap, `n = normalize(vec3(-gx*s, -gy*s, 1))`, Ausgabe `n*0.5+0.5` | analytische Rampe `h=x/S` → Normale exakt in −x; gegenüberliegende Kanten byte-identisch |
| `gen/tex/ao_sweep.ts` | Line-Sweep-Horizon-AO | D=8 Richtungen à 45°, `ao = 1 - sin(max(horizon,0))`, `gamma 1.0–2.0` | Konvexer Block → Kanten heller als Fugen |
| `gen/tex/orm.ts` | ORM-Packing R=AO, G=Rough, B=Metal | `tex.channel = 0` **oder** `uv1`-Attribut | schwarz-AO-Regression |
| `gen/tex/lut.ts` | Color-Grading-LUT als `DataTexture3D`, size 32 | 3 Presets (Normal/Alarm/Audit) | |
| `gen/geo/greeble.ts` | rekursive Guillotine-Unterteilung | Split entlang der längeren Kante, Verhältnis `0.35 + rng()*0.30`, Abbruch bei Zellfläche < 0,15 m² oder Tiefe > 5; Inset 6–20 mm; Extrude aus `{0.004, 0.012, 0.03, 0.08}` mit Gewichten `[0.45,0.3,0.18,0.07]`, 25 % Vertiefungen | **≤ 1500 Dreiecke pro 4×4-m-Panel** |
| `gen/geo/modul_gehaeuse.ts` | 12 Modularten, je 3 Detailstufen | `mergeGeometries(geoms, true)` → `mergeVertices(1e-4)` → `toCreasedNormals(degToRad(30))` | Dreiecksbudget je Art |
| `gen/geo/leitung.ts` | Manhattan-Route → `CatmullRomCurve3('centripetal')` → `TubeGeometry` | `tubularSegments = ceil(len*8)`, `radius 0.03`, `radialSegments 6` | Bogenlängen-Test |
| `gen/geo/blaupunkt.ts` | Bridson Poisson-Disk (Blue Noise) | Gitterzelle `r/sqrt(2)`, k=30 Kandidaten im Annulus `[r,2r]`, `r = 0.12 m` | Mindestabstand-Assertion |
| `gen/geo/bruch.ts` | Voronoi-Fracture per Halbraum-Clipping | Seeds `p = center + normalize(randDir)*rng()²*radius`; Sutherland-Hodgman gegen Mittelsenkrechtenebenen; nur k=12–20 nächste Nachbarn | Wasserdichtheit (jede Kante genau 2×) |
| `gen/env/halle.ts` | `HallenEnvironment extends Scene` | siehe 2.3 | PMREM-Größe ≥ 64×64 (darunter beleuchtet `scene.environment` gar nicht) |
| `gen/tex/msdf.ts` | MSDF-Atlas aus Canvas2D, DPR-bewusst, pro (Text,Größe) gecacht | Pool **max. 24** lebende Texturen, explizites `dispose()` beim Levelwechsel | VRAM-Soak |

### 3.3 Master-Materialien: genau 10

Basismetall gebürstet · lackiertes Gehäuse · dunkler Gummi · Warnfarbe · Glas/Transmission · Emissive-Leitung · Hologramm · Boden-Triplanar · Beton/Wand · Messing (Schilder).

Je 1024×1024: **Albedo** (`SRGBColorSpace`), **Normal** (`NoColorSpace`), **gepackte ORM** (`NoColorSpace`). **Alle Modulvarianten** entstehen über `instancedBufferAttribute` (`aTint vec3`, `aRoughOffset float`, `aEmissivePhase float`), **nie** über neue Texturen.

**Farbraum-Regel (der teuerste Silent Bug des Projekts):** Nur `map` und `emissiveMap` sind sRGB. `normalMap`, `roughnessMap`, `metalnessMap`, `aoMap`, `displacementMap` **müssen** `NoColorSpace` behalten. Heights, die aus einem sRGB-Canvas gelesen werden, vorher degammieren.

Rechnung: 1024² RGBA8 = 4 MiB, mit Mipmaps ×1,333 = 5,33 MiB. Ein Set (Albedo+Normal+ORM) ≈ 16 MiB. 10 Master ≈ 160 MiB — im 256-MiB-Budget. „Ein Material pro Modultyp" wären ~850 MiB und ein Tab-Absturz auf einem 8-GB-MacBook.

### 3.4 Was nicht gebaut wird

- **Kein CSG zur Laufzeit.** `three-bvh-csg` ausschließlich als Vite-Prebuild-Schritt mit Ergebnis-Cache als typed-array-Blob, und nur mit wasserdichter, validierter Eingabe. Wenn eine Bohrung optisch reicht: Normal-Map/Inset-Ring.
- **Kein POM** in Version 1.0 (bricht Silhouette und Schatten, braucht separaten Shadow-Pfad).
- **Kein Triplanar auf Modulen** — nur auf Hallenboden und Wänden (9 Texture-Fetches bei 3 Maps).
- **Keine `Points`/`gl_PointSize`** für Partikel (auf Mac treiberseitig gedeckelt, Clipping am Center). Billboarded `InstancedMesh`.

---

## 4. Audio-Direktiven

### 4.1 Architektur: `src/audio/` mit genau vier Modulen

| Modul | Verantwortung |
|---|---|
| `context.ts` | AudioContext-Singleton, Unlock per User-Geste, `latencyHint 'interactive'`, `sampleRate 48000`, Master-Bus-Kette |
| `bank.ts` | OfflineAudioContext-Prerendering aller One-Shot-SFX beim Boot in `Map<SfxId, AudioBuffer>` |
| `musik.ts` | Lookahead-Scheduler, Layer-Busse, Pattern-Engine |
| `raum.ts` | Panner-Pool, Listener-Kopplung an die Kamera |

**Kein anderer Code im Projekt ruft `ctx.createXxx` auf.** `Math.random()` ist im gesamten `audio/`-Verzeichnis per ESLint verboten; Seeds werden aus `(globalSaat, streamId, taktIndex | ereignisIndex)` abgeleitet.

### 4.2 Scheduler (Chris-Wilson-Muster, nicht verhandelbar)

```ts
const SCHEDULE_AHEAD = 0.1;   // s
const TICK_MS = 25;
// setInterval, NICHT requestAnimationFrame
while (nextNoteTime < ctx.currentTime + SCHEDULE_AHEAD) {
  scheduleStep(step, nextNoteTime);          // absolute AudioContext-Zeit
  nextNoteTime += 60 / bpm / subdivision;
}
```
Musikalische Zeit wird **niemals** aus `Date.now()` oder der Three.js-Delta-Zeit abgeleitet. One-Shot-SFX laufen auf einem **separaten** Pfad mit `ctx.currentTime + 0.005`.

### 4.3 Master-Bus & Gain-Staging

```
busSFX(0.8) + busMusik(0.55) + busUI(0.7) + busStimme(0.9)
  → busMaster(0.9) → DynamicsCompressor(threshold -6, knee 2, ratio 20, attack 0.002, release 0.12)
  → destination
```
Ducking manuell (kein Sidechain in der API): `busMusik.gain.setTargetAtTime(0.55*0.35, t, 0.08)` und zurück mit `tau 0.4`. Nutzer-Volume nichtlinear: `gain = slider^2.5`. Debug-Overlay zeigt `compressor.reduction` — mehr als −6 dB Dauerreduktion heißt „Gain-Staging ist falsch", nicht „mehr komprimieren".

### 4.4 Reverb: genau ZWEI ConvolverNodes im ganzen Spiel

Prozedurale IR nach Moorer, `a(t) = 10^(-3t/T)`, dekorrelierte Kanäle, seeded:

| Preset | T | fadeIn | Lowpass-Sweep | PreDelay |
|---|---|---|---|---|
| HALLE_GROSS | 4,2 s | 0,03 s | 7000 → 600 Hz | 45 ms |
| UI_PLATTE | 1,1 s | 0,004 s | 12000 → 3000 Hz | 8 ms |

Als **Send-Busse**, niemals ein Convolver pro Stimme. Eine 4,2-s-IR ist mit Abstand der teuerste Node im Graph.

### 4.5 Tonale Basis

Skalen als Semitone-Arrays, nach Helligkeit sortiert: Lydisch `[0,2,4,6,7,9,11]` · Ionisch `[0,2,4,5,7,9,11]` · Mixolydisch `[0,2,4,5,7,9,10]` · **Dorisch `[0,2,3,5,7,9,10]`** · Äolisch `[0,2,3,5,7,8,10]` · **Phrygisch `[0,1,3,5,7,8,10]`** · Lokrisch `[0,1,3,5,6,8,10]`.

- **Grundzustand: D-Dorisch** (Tonika MIDI 50 = D3, 146,83 Hz) — nachdenklich, technisch, nicht traurig.
- **Erfolg: F-Lydisch** (MIDI 53).
- **Alarm: E-Phrygisch**.
- Akkorde als **Quartenschichtung** (Skalenstufen 0/3/6), nicht Terzschichtung. Voice-Leading minimiert `Σ|dMidi|`.
- Basisfrequenz des UI-Kits: **f0 = 587,33 Hz (D5)** — damit klingt das gesamte UI in der Tonart des Spiels.

### 4.6 Sechs Layer, permanent laufend, nur Gains ändern sich

| Layer | Inhalt | Einschaltbedingung |
|---|---|---|
| L0 | Drone (55 Hz + 82,41 Hz + 110 Hz, je 2 Osc mit +0.9 Cent Detune) | immer, `gain 1.0` |
| L1 | Pad-Akkorde (5–7 verstimmte Osc, ±5…±12 Cent, 2× Lowpass 420 Hz Q 0.7) | ab Sim-Start |
| L2 | Arpeggio 1/8 | Durchsatz > 0 |
| L3 | Perkussion/Tick | Durchsatz > 3 Aufträge/s |
| L4 | Cluster-Streicher (kleine Sekunden) | Fehlerquote > 5 % |
| L5 | Alarm-Puls | Guardrail-Verletzung — **sofort, nicht quantisiert** |

Ein-/Ausblenden **nur** per `setTargetAtTime(ziel, naechsteTaktgrenze, 0.35*taktdauer)`, **quantisiert auf Taktgrenzen**. Bei Ziel 0 zusätzlich `setValueAtTime(0, taktzeit + 5*tau)` — sonst laufen unhörbare Layer ewig mit CPU-Kosten.

### 4.7 Steuerachsen: fünf, jede mit eigener ConstantSourceNode

| Achse | Quelle aus `Metriken` | tau | wirkt auf |
|---|---|---|---|
| durchsatz | `geliefert / dauer` | 2 s | BPM 72…108 (max. **±4 BPM pro Takt**), Arpeggio-Subdivision 1/4→1/8→1/16 |
| risiko | `1 - min(sicherheit, nachvollziehbarkeit)` | 6 s | Modus-Index (Lydisch…Phrygisch), Dissonanzanteil L4 |
| kosten | `kostenJeAuftrag / budget` | 4 s | Lowpass des Pad-Busses 5000 → 700 Hz |
| latenz | `latenzP95 / budget` | 3 s | Echo-Feedback 0.15 → 0.55, Reverb-PreDelay |
| guete | `guete` | 5 s | Anteil konsonanter Quartenakkorde vs. Quintcluster |

Verteilung über **eine `ConstantSourceNode` pro Achse** mit nachgeschalteten Skalierungs-Gains auf alle betroffenen AudioParams. **Niemals** AudioParams pro Frame in einer JS-Schleife setzen — der Main-Thread gehört Three.js.

### 4.8 SFX-Bank (Ziel 60–80 Stück, beim Boot in ~200–500 ms vorgerendert)

Alle über einen gemeinsamen `highshelf(+2 dB @ 6 kHz)` und den UI_PLATTE-Send → klangliche Familienähnlichkeit.

- **HOVER**: sine `f0*2`, 0.0001→0.06 exp in 4 ms, `setTargetAtTime(0, t+0.004, 0.012)`, 60 ms.
- **KLICK**: Noise-Burst 6 ms → bandpass 1900 Hz Q 6, attack 1 ms / decay 35 ms; parallel sine `f0*1.5` (881 Hz), 25 ms, Gain 0.05.
- **BESTÄTIGUNG**: triangle `f0` und `f0*1.5` nacheinander, dt 90 ms, je 180 ms Decay, Plate-Send 0.18.
- **FEHLER**: sine 440 Hz + 415,3 Hz **gleichzeitig** (24,7 Hz Schwebung + kleine Sekunde), lowpass 1200 Hz, Decay 320 ms, Pitch-Drop −80 Cent.
- **MODUL SETZEN („Thunk")**: sine 190 Hz → 52 Hz exp in 90 ms + Noise 12 ms durch lowpass 2500 Hz + Karplus-Strong-Ping 1480 Hz, 0,25 s Decay.
- **LEITUNG VERBINDEN**: sine 320 → 640 Hz exp in 140 ms, Gain 0.09 + Noise-Whoosh 40 %.
- **WHOOSH (Token)**: Noise → bandpass Q 1.4, `f: 240 → 5200 (180 ms) → 600 (420 ms)`, Gain 0→0.22 (25 ms)→0 (400 ms).
- **IMPACT**: sine 140 → 38 Hz in 110 ms (Gain 0.5, Decay 0,30 s) + Noise 18 ms durch lowpass 900 Hz; bei „verworfen" zusätzlich Ringmod 61 Hz × 87 Hz, 0,2 s.
- **ENERGIEFLUSS-LOOP** (**genau eine Stimme für das gesamte Werk**): sawtooth 55 Hz + 55,35 Hz → lowpass `f = 180 + durchsatz*1400`, Q 3.5 → Waveshaper `tanh(3x)/tanh(3)`, 2048 Punkte, `oversample '2x'` → Gain `0.05 + 0.12*durchsatz`. Dazu ein Datenpuls-Layer: Noise durch bandpass 3200 Hz Q 12, AM von einem Sawtooth-LFO, dessen Frequenz = Aufträge/s ist (bis ~12 Hz). **Der Spieler hört den Durchsatz.**

**Karplus-Strong** wird beim Boot in Buffer gerendert (nie zur Laufzeit als DelayNode-Feedback — DelayNode hat 128 Frames Mindestverzögerung, damit sind Grundtöne über ~375 Hz prinzipiell unerreichbar). Variation ausschließlich über `playbackRate 0.94–1.06` und `detune`.

**Ein einziger globaler 1-s-Weißrausch-Buffer** für alle Noise-SFX, per `loop` mit zufälligem `loopStart`.

### 4.9 Harte Voice-Limits

≤ 40 gleichzeitige `AudioBufferSourceNode` · ≤ 8 `PannerNode` mit `'HRTF'` (nur die fokussierte Pipeline) · ≤ 6 gleichzeitige Token-Flug-Sounds mit Voice-Stealing nach Alter · ≤ 40 Oszillatoren für Musik · 2 Convolver · 1 Compressor. Alles darüber wird **nur noch als Parameteränderung am Energiefluss-Loop hörbar**. Bei 200 Token/s wäre Ereignis-SFX pro Token weißes Rauschen — ausgerechnet im Moment des Spielererfolgs.

### 4.10 Raum

`distanceModel 'inverse'`, `refDistance 3.0`, `rolloffFactor 1.4`, `maxDistance 80`, plus distanzabhängiger Lowpass `f = 22050 * (0.15 + 0.85*distanzGain)`. Listener über `positionX/Y/Z` und `forwardX…/upX…` als AudioParams mit `setTargetAtTime(v, t, 0.06)` — **nicht** über die veralteten `setPosition`/`setOrientation`, und mit EMA-Glättung (tau ≈ 60 ms) gegen Zipper-Artefakte bei Trackpad-Schwenks.

### 4.11 Sprache

**SpeechSynthesis ist NICHT der Träger der Narration.** Sie lässt sich nicht in den Web-Audio-Graph routen (kein Reverb, keine Position, kein Ducking, keine Aufnahme für Tests), Safari liefert nur Eloquence-Stimmen, und `getVoices()` ist asynchron mit leerem Erstergebnis.

Stattdessen **prozedurale Charakter-Vokalisation**, synchron zum Schreibmaschinen-Textrenderer:
- Quelle: sawtooth mit f0 — **MONOLITH 90 Hz (square)** · **Ilva 220 Hz (triangle)** · Kessel 148 Hz · Nuri 195 Hz. Jitter ±3 % pro Silbe, aus `zufall(saat,'stimme',charCode)`.
- Zwei `BiquadFilter` `type 'peaking'`, `gain +14 dB`, `Q 8`, deutsche Vokaltabelle F1/F2: /a/ 730/1090 · /e/ 530/1840 · /i/ 270/2290 · /o/ 570/840 · /u/ 300/870 · /ö/ 440/1600 · /ü/ 300/1650. Konsonanten = 8-ms-Noise-Burst durch highpass 3 kHz.
- 32–55 ms pro Zeichen, ADSR attack 4 ms / decay 40 ms / sustain 0 / release 60 ms, ein Blip je zwei Zeichen. Satzende: `?` → f0 +18 %, `.` → −12 %.
- MONOLITH: **kein Jitter, keine Pausen, 90 Zeichen/s.** Ilva: 38 Zeichen/s, 220 ms Pause an Kommata.

SpeechSynthesis (de-DE) **nur** als abschaltbarer Barrierefreiheits-Vorleser, gefiltert auf `v.lang.startsWith('de')`, mit Warten auf `voiceschanged` und stiller Deaktivierung statt englischem Fallback. In Tests deaktiviert.

### 4.12 Hüllkurven-Konvention (Projekt-Pflicht)

`EPS = 0.0001` statt 0 für `exponentialRampToValueAtTime`. Vor jeder Neuplanung auf einem AudioParam: `cancelScheduledValues(t)` **und** `setValueAtTime(param.value, t)`. Hilfsfunktionen `adsr()` und `retarget()`; direkte Ramp-Aufrufe im Gameplay-Code sind verboten.

### 4.13 Sichtbarkeit

`visibilitychange` → `hidden`: `busMaster` in 0,2 s auf 0, nach 5 s `ctx.suspend()`. → `visible`: `ctx.resume()` und **zwingend** `nextNoteTime = ctx.currentTime + 0.1`, sonst feuert der Scheduler hunderte aufgestauter Events auf einmal.

---

## 5. Game-Design-Direktiven

### 5.1 Kernloop (8–15 min pro Level)

```
Briefing (30–60 s, ESC-überspringbar)
 → Bauen (4–8 min)
 → Sim-Lauf (30–90 s sichtbar, Geschwindigkeit 1×/4×/12×/sofort)
 → Diagnose im Zeit-Debugger (Scrubbing, [F] → erster Regelverstoß)
 → Iteration (2–4 min)
 → Bestehen: Gates grün
 → Histogramme (3 Achsen) + Debrief (60–90 s)
 → Meisterstück bleibt als offener Haken stehen
```
Akt = 4 Level = 45–75 min. Kampagne = 10–14 h Erstdurchlauf, Optimierungs-Longtail offen.

### 5.2 Metriken

**Gates (binär, bestehen/nicht bestehen):**
- `guete >= schwelle` (levelabhängig, 0.70–0.90)
- `lecks === 0` und `sicherheit === 1`
- `konformitaet === 1` (nur wenn Level `anteilVertraulich > 0` hat)
- `belegquote === 1` (nur bei `anteilBelegpflichtig > 0`)
- `nachvollziehbarkeit >= 0.95` **nur** in Audit-Leveln (Akt X + Sonderaufträge)

**Wettbewerbsachsen (drei, niemals aggregiert, niemals gewichtet):**
1. **KOSTEN** — `kostenJeAuftrag` (Token), Histogramm-Achse **logarithmisch** (Spannweite 40 … 40 000)
2. **LATENZ** — `latenzP95` (Ticks), linear
3. **FLÄCHE** — `flaeche` (Modulanzahl), linear

Es gibt **keinen Gesamtscore, keine Sterne, kein XP, keine Streaks, keine Währung, keine Lootboxen, keinen Energiebalken, keinen Countdown.** Das ist Code-Review-relevant: PRs, die das einführen, werden abgelehnt.

### 5.3 Aktstruktur (12 Akte × 4 Level)

Pro Akt genau **EINE** neue `ModulArt` oder **EIN** neuer Parameter — nie zwei. Jedes Level hat ein Feld `lernziel: string`; wenn es sich nicht in einem Satz formulieren lässt, ist das Level überflüssig.

| Akt | Neue Mechanik | Zentrale Lektion | MAST-Bezug |
|---|---|---|---|
| I | `kern` (KOLIBRI/REIHER/KONDOR) | Modellgröße ist eine ökonomische Entscheidung, keine Qualitätsentscheidung | — |
| II | `weiche` (Router) | Klassifizieren, bevor man bezahlt | Specification Ambiguity |
| III | `werkzeug` | Ein deterministisches Werkzeug schlägt jedes Modell bei Zahlen | Verifikationslücke |
| IV | `schranke` + `sicherung` | Retry ist kein Plan; Circuit Breaker ist einer | Endlosverhandlung |
| V | `verteiler` + `sammler` | Parallelisierung deckelt Latenz, aber nicht Kosten | Rollen-Duplikation |
| VI | `pruefer` (Evaluator-Optimizer) | Der Evaluator irrt sich auch | Halluzinierter Konsens |
| VII | `speicher` (Kontext-Engineering) | **Kontext ist ein Budget, kein Vorrat** | Context Drift |
| VIII | `wall` (Guardrail) | Lethal Trifecta; Defense in Depth | Prompt Injection über Tool-Ausgabe |
| IX | `hand` (Human-in-the-Loop) | Menschen sind teuer in Latenz, billig in Haftung | Conformity Bias |
| X | `auge` (Tracing) | Debugging ohne Trace ist absichtlich schmerzhaft | Fehlende Observability |
| XI | `schmiede` (Evolution) | Du baust nicht die Pipeline, du baust den Selektionsdruck | Reward Hacking |
| XII | Finale (kein neues Modul) | MONOLITH zerlegen — Ernte aus 11 Akten | alle |

**Level-Rhythmus pro Akt (Kishotenketsu, testbar über `nummer % 4`):**
- `%4 == 0` **KI** — Modul isoliert, ohne Störfaktoren, Lösung fast erzwungen
- `%4 == 1` **SHO** — Kombination mit genau einer bekannten Mechanik, **ein** Budget
- `%4 == 2` **TEN** — Bruch: die Schwäche des Moduls macht die SHO-Lösung ungültig
- `%4 == 3` **KETSU** — Synthese unter hartem Budget + optionales Meisterstück

**Testpflicht:** Jedes TEN-Level hat ein Budget, das die Referenzlösung seines Vorgängerlevels nachweislich **verletzt**. Das ist ein vitest-Assert, keine Absicht.

### 5.4 Gating und Schwierigkeitskurve

- **3 von 4** Leveln eines Akts genügen zur Freischaltung des nächsten (`AktFortschritt { noetig: 3 }`). Ein einzelnes zu schweres Pflichtlevel ist die häufigste Abbruchursache in Zachlikes.
- Pro Akt genau **ein Sonderauftrag**, 2–3 Stufen härter, **kein Gate**.
- **Akt I–IV (Kaizen-Prinzip):** eine naive Direktverdrahtung (Quelle → KONDOR → WALL → Senke) besteht **immer**. Die Härte liegt vollständig in der freiwilligen Optimierung. Damit kommt der Pflicht-Workshop-Teilnehmer durch und der Enthusiast hat 60 h.
- **Ab Akt V** greifen harte Budgets, aber pro Level immer nur **EINES** (Token-Deckel ODER Tick-Deckel ODER Flächen-Deckel).
- **Autonomie-Testpflicht:** Jedes Level ab Akt II hat mindestens **zwei strukturell verschiedene** gültige Architekturen, die auf der Pareto-Front unterschiedliche Punkte belegen und einander in **keiner** Achse dominieren. Ein vitest-Test lädt beide Referenz-Blaupausen und asserted genau das. Autonomie ist damit verifizierbare Eigenschaft, nicht Behauptung.

### 5.5 Histogramme (offline vorberechnet)

`werkzeuge/referenzverteilung.ts` erzeugt pro Level 20 000 Lösungskandidaten per Random-Restart-Hill-Climbing über dem Modulgraphen (fester Seed) und legt pro Achse eine **24-Bucket-Verteilung als JSON < 8 KB** ab. Anzeige **immer als Perzentil** („Du bist besser als 76 % der Werke"), **niemals** als absoluter Rang. Drei benannte Marken pro Achse: **„Erstentwurf"** (50.), **„Solide Praxis"** (80.), **„Werkmeister"** (97.).

Zusätzlich: **MONOLITH-Benchmark** je Level, sichtbar **vor** dem Bauen („MONOLITH: Güte 0.91 / 412k Token / p95 340") — verbindet Antagonist und Retention in einem Element. Und der lokale Werksrekord aus `localStorage`, prozedural als Messingschild an der Hallenwand gerendert.

### 5.6 3D-Disziplin

- Logikgitter bleibt **2D pro Etage**, maximal **4 Etagen**: E0 Eingang/Guardrails · E1 Routing/Kerne · E2 Werkzeuge/Speicher · E3 Prüfung/Ausgang. Etagenwechsel nur über explizite **„Steiger"**-Module.
- Aktive Etage voll dargestellt, alle anderen auf **18 % Opazität** und entsättigt.
- Jede 3D-Funktion, die nicht Fluss-Lesbarkeit oder Etagen-Semantik dient, wird gestrichen. Infinifactory ist der dokumentierte Negativbeleg: freie Kamera + echtes 3D-Bauen ⇒ „clunky" Steuerung **und** „samey" Puzzles, weil Platzdruck als Designhebel verschwindet.

### 5.7 Bau-UX (vollständig vor Alpha, nichts davon optional)

Harte 1×1-Rasterung · orthogonales Kabel-Routing per A* (Kosten geradeaus 1, Richtungswechsel +3, Spurwechsel +5, belegte Spur 0.8, Knotenlimit 4000, Fallback L-Route) · Rahmenauswahl per Trackpad-Drag · `Cmd+C/V/D` für ganze Teilgraphen inkl. Parametern · `Cmd+Z`/`Shift+Cmd+Z` mit ≥ 200 Schritten als **Command-Pattern** (nicht Snapshot) · `Cmd+G` erzeugt eine benannte, wiederverwendbare **„Baugruppe"** (Blueprint-Äquivalent — lehrt zugleich Composability/Sub-Agents).

### 5.8 Werk-Export

- **WebM/GIF**: WebCodecs `VideoEncoder` (`vp09.00.10.08`) gegen ein `OffscreenCanvas`, Frames **Tick-für-Tick offline** gerendert (nicht in Echtzeit mitgeschnitten), 512×512 @30 fps, genau ein vollständiger Auftragszyklus, < 4 MB, mit eingebranntem Level-Namen und Achsen-Tripel. Fallback `MediaRecorder` auf `canvas.captureStream(30)`.
- **„Werk-Code"**: Graph als deflate-komprimierter base64url-String < 400 Zeichen ins Clipboard, importierbar — Kollegen vergleichen Lösungen im Teams-/Slack-Chat.
- **„Werkbuch"** als PDF mit Zuordnung Spielmodul → reales Pattern → „wo im Kundenprojekt" für das Workshop-Debriefing.

### 5.9 Pacing-Ventil

„Ablage" — ein deterministisch geseedetes FreeCell-Variante-Kartenspiel im Pausenraum der Halle. Farben = die fünf `Domaene`-Werte (recht/technik/finanz/text/analyse). Partiedauer 3–6 min, reines Canvas2D, prozedural. Zwischen zwei harten Akten **angeboten, nie erzwungen, kein Gating.** Zusätzlich als Ladebildschirm-Füller.

---

## 6. Didaktik-Direktiven

### 6.1 Die Kernzahl, die alles bestimmt

Wouters et al. (39 Studien): Lernen d=0.29, Retention d=0.36 — aber **für Erwachsene kein Haupteffekt**. Signifikante Moderatoren: (a) Spiel **ergänzt** durch andere Instruktion, (b) **mehrere** Sessions, (c) Arbeit in **Gruppen**. Sitzmann (65 Studien, N=6476, betrieblich): +11 % deklaratives Wissen, +9 % Retention — nur bei aktiver Nutzung mit Lernerkontrolle. Barz et al. (2024): gesamt g=0.54, kognitiv g=0.67, **metakognitiv n.s.**

**Konsequenz, die im Produktdesign steht:** SCHWARMWERK ist nicht als Standalone-Solo-Erlebnis konzipiert, sondern als Kern eines Programms mit Debriefing, Wiederholung und Team-Einsatz. Der Workshop-Modus (6.7) ist ein erstklassiges Feature, kein Nachtrag. Metakognition entsteht nicht nebenbei — sie wird als Mechanik gebaut und getestet.

### 6.2 Intrinsische-Integrations-Gate (Pflicht vor dem Bau jedes Levels)

Schriftlich zu beantworten: *„Welche Metrik muss der Spieler LESEN und VERSTEHEN, um dieses Level zu bestehen — und kann er es ohne dieses Verständnis durch Ausprobieren schaffen?"*

**Wenn Brute-Force in unter 5 Sim-Läufen zum Erfolg führt, ist das Level ungültig.** Mindestens eine Bestehensbedingung muss ein **Trade-off** sein (`guete >= 0.85 UND kostenJeAuftrag <= 40`), nie ein einzelnes Maximierungsziel.

**Verboten:** Multiple-Choice-Gates, Quiz-Popups zwischen Leveln, jede separierte „Lern-Bibliothek", die man überspringen kann. IT-Profis erkennen chocolate-covered broccoli schneller als jede andere Zielgruppe und stufen das Produkt dann als Compliance-Schulung ein.

Der Wirkmechanismus intrinsischer Integration ist **Attention Direction**, nicht Motivation: Spieler beachten nur Features, die sie für die Spielaufgabe brauchen.

### 6.3 Productive Failure — Dreiklang pro Akt-Kernkonzept (g=0.36)

1. **ERFINDUNGS-LEVEL** — Auftrag, den der Spieler mit den bisherigen Modulen **nicht** sauber lösen kann; er darf und soll 2–3 suboptimale Lösungen bauen (System speichert jede als Blaupause).
2. **KONTRAST-ANSICHT** — nach dem dritten Fehlversuch öffnet sich automatisch die **„Werkbank"**: links bis zu drei eigene Geister-Graphen mit ihren Metrik-Vektoren, rechts die kanonische Referenzlösung, darunter eine 2D-Pareto-Karte (x = Kosten, y = 1−Güte) mit allen Punkten. Der Spieler muss **eine** Aussage auswählen, die den Unterschied benennt, bevor es weitergeht.
3. **KONSOLIDIERUNG** — Ilva benennt das Konzept mit dem echten Fachbegriff („Verifikationslücke / Task Verification Gap") in **max. 60 Wörtern**, danach wird das neue Modul freigeschaltet.

**Phase 2 und 3 sind nicht optional.** Ohne sie ist der Effekt verspielt und bei berufstätigen Erwachsenen führt Frustration ohne Auflösung zum Abbruch, nicht zum erneuten Versuch.

### 6.4 Guidance Fading mit Vorwissens-Sonde (gegen Expertise Reversal)

**Level 0**: 4 Minuten, 6 Mikro-Aufgaben mit vorgebauten Mini-Pipelines („welches Modul senkt hier die Kosten ohne Qualitätsverlust?", „wo fehlt die Absicherung?"). Klassifiziert in drei Bänder: **Neu / Erfahren / Senior**.

Level-Typen: **A** = Worked Example (Pipeline fertig, Spieler ändert genau einen Parameter und beobachtet die Metrik-Reaktion) · **B** = Completion Problem (60–70 % des Graphen vorhanden, 2–3 Knoten fehlen — dafür ist `Level.vorbau` bereits im Typ vorhanden) · **C** = offenes Problem.

| Band | Akt I–III | ab Akt IV |
|---|---|---|
| Neu | A:B:C = 1:2:4 | 0:1:5 |
| Erfahren | startet bei B | 0:1:5 |
| Senior | überspringt Akt I, startet bei C | 0:1:5 |

**Hinweissystem dreistufig** (Zielhinweis → Strukturhinweis → Teillösung), **nur angeboten nach messbarem Impasse** (>90 s ohne Graph-Mutation ODER 3 fehlgeschlagene Sim-Läufe), **niemals** automatisch eingeblendet, **Kosten null** (ein Hint-Penalty erzeugt nur Vermeidungsverhalten).

Symptom, auf das im Playtest zu achten ist: **Abbrüche in Akt I bei Spielern mit hohem Einstufungsscore.**

### 6.5 In-Game-Debrief nach jedem Level (60–90 s, vier Prompts, g≈0.55)

| | Prompt | Mechanik |
|---|---|---|
| P1 | **Was ist passiert** | automatisches Replay, scrubbt auf den ersten fehlgeschlagenen bzw. teuersten Auftrag, Pfad im Graphen hervorgehoben |
| P2 | **Ursache** | vier Ursachen-Karten, genau eine ist die korrekte MAST-Kategorie, drei plausible Distraktoren aus der Praxis; falsche Wahl → 25-Wort-Korrektur, **keine Bestrafung** |
| P3 | **Realwelt-Anker** | Freitext „Wo ist dir das im echten Projekt schon begegnet?" (max. 140 Zeichen, rein lokal, landet in der persönlichen Notizwand) — **transferkritischster Prompt, nie überspringbar** |
| P4 | **Nächstes Mal** | drei generierte Vorsätze + Freitext |

Jeder Prompt verbindet explizit Spielbegriff und Fachbegriff: *„Dein Prüfer-Modul heißt in der Praxis LLM-as-a-Judge."*

### 6.6 Stealth Assessment (ECD-Kette)

Kompetenzmodell, 6 Knoten × 3 Niveaus: **K1** Dekomposition · **K2** Kostenmodellierung · **K3** Verifikationsdesign · **K4** Fehlerresilienz · **K5** Guardrail-/Sicherheitsdenken · **K6** Nachvollziehbarkeit.

Evidenzregeln direkt aus dem deterministischen Graphen:

| Beobachtung | Evidenz |
|---|---|
| `pruefer` topologisch vor der Senke | +K3 |
| `kolibri` hinter `weiche` für Aufträge mit `schwierigkeit < 0.35` | +K2 |
| `sicherung` um `werkzeug.api` (Ausfallrate 0.18) | +K4 |
| `wall` mit `modus 'eingang'` **vor** dem Kern statt danach | +K5 |
| `auge` gesetzt **vor** dem ersten Debug-Lauf statt danach | +K6 (starkes Signal) |
| `undoCount`, Anzahl Sim-Läufe bis Bestehen | inverse Effizienzindikatoren |

Diskretes Bayes-Netz, Posterior-Update nach Level-Abschluss. **Anzeige der Kompetenzbalken erst am Aktende** — sonst wird das Kompetenzmodell zum Leaderboard und untergräbt die Autonomie. Alle Regeln in **einer versionierten JSON-Datei**, nicht im Code verstreut, damit sie prüfbar und für den Betriebsrat dokumentierbar sind.

### 6.7 Workshop- und Team-Modus (erstklassiges Feature)

90-Minuten-Block: 10 min Einführung + **55 min Spiel** (ein Akt, Pair-Building zu zweit an einem Rechner mit **erzwungenem Rollentausch alle 5 min** per Bildschirm-Hinweis) + 15 min moderiertes Gruppen-Debriefing entlang der vollen Thiagi-Sequenz + 10 min Praxis-Kontrakte.

Mitgeliefert: Moderations-Leitfaden mit ausformulierten Fragen pro Akt, und eine **Präsentationsansicht**, die zwei importierte Blaupausen nebeneinander auf der Pareto-Karte zeigt (Beamer-tauglich, große Typografie, hoher Kontrast).

### 6.8 Transfer-Kontrakt und Führungskräfte-Schnittstelle

Nach Akt III und Akt VI: **„Praxis-Kontrakt"** — konkrete Anwendung im eigenen Projekt + Zieldatum, vom Spieler formuliert, plus Selbsteinschätzung von **Confidence** und **Commitment** auf je einer 5er-Skala. Nach 14 Tagen erinnert das Spiel und fragt in drei Klicks nach dem Ergebnis.

Generierbares **1-Seiten-PDF** fürs Vorgesetztengespräch: die drei aktivsten Kompetenzknoten, der Praxis-Kontrakt und drei vorformulierte Coaching-Fragen. Begründung: Vorgesetztenunterstützung ist metaanalytisch der stärkste Transferprädiktor — stärker als Inhalt oder Format.

### 6.9 Novelty-Tal aktiv bespielen

Motivationseinbruch ab Woche 4, Erholung ab Woche 6–10. Genau dort (**Akt V–VI**) liegt ein **Mechanik-Bruch**, nicht mehr vom Gleichen: Öffnung des Sandkastens mit eigenem Auftragsgenerator, die Blaupausen-Galerie (Import/Export als Base64) als soziale Komponente, und ab Akt V die wöchentliche **„Auftragslage"** — ein prozedural generiertes Optimierungspuzzle mit fixem Wochen-Seed und Histogramm-Vergleich.

### 6.10 Zertifikat

Open Badges 3.0, drei Stufen entlang der Kompetenzniveaus. Die `criteria`-URL jedes Badges listet die **konkreten, maschinell geprüften** Evidenzregeln („in mindestens 8 Leveln Verifikationsstruktur vor der Ausgabe; 0 Guardrail-Verletzungen in der Abschlussprüfung; Pareto-Effizienz im obersten Drittel der Referenzbots; alle Debrief-Realweltanker ausgefüllt"). Skill-Referenzen gegen ESCO, Ausrichtung an Europass/EQF vorbereitet. **Badges nie an Spielzeit, Streaks oder Punktesummen** — sonst ist der Nachweis im Unternehmen wertlos und motiviert zusätzlich extrinsisch.

### 6.11 Was nicht gebaut wird

**Kein DDA.** Mehrere systematische Reviews 2024/2025 finden keine DDA-Strategie, die statische Schwierigkeit schlägt — und verdeckte Anpassung wird von intelligenten Erwachsenen als bevormundend wahrgenommen, sobald sie sie bemerken. Die Entwicklungszeit geht stattdessen in offene Optimierungsziele und mehr Level.

---

## 7. Simulations-Balance

Grundlage ist die **existierende** `src/sim/balance.ts`. Sie bleibt die einzige Wahrheit („Balance ist eine Design-Entscheidung, kein verstreuter Magic Number"). Dieser Abschnitt friert die vorhandenen Werte ein und ergänzt die fehlenden.

### 7.1 Numerik-Regime (neu, verbindlich)

```ts
export const SKALA = 1_000_000;                 // Festkomma-Einheit für Güte/Kontext/Unsicherheit
export const q = (x: number) => Math.round(x * SKALA) / SKALA;
// Erlaubt in src/sim: + - * / Math.sqrt Math.round Math.min Math.max Math.abs Math.floor
// Verboten:          Math.pow Math.exp Math.log Math.sin Math.cos Math.tan Math.atan2 **
```
Kurven laufen über generierte Integer-LUTs mit 1024 Stützstellen und linearer Interpolation, erzeugt von `werkzeuge/kurven_generieren.ts` und als `src/sim/kurven.ts` **eingecheckt**:
- `KURVE_KOMPETENZ` (Formparameter 1.6 — ersetzt `Math.pow(x, KOMPETENZ_STEILHEIT)`)
- `KURVE_KONTEXT_ROT` — Exponent 1.5 ist alternativ exakt als `x * Math.sqrt(x)` darstellbar; die LUT bleibt trotzdem die kanonische Implementierung, damit es nur **einen** Pfad gibt.
- `KURVE_HALLUZINATION`

Kosten und Ticks sind `int`. Nach jeder Schreiboperation auf `guete`, `kontext`, `unsicherheit`: `q()`.

### 7.2 Modell-Kerne (unverändert aus `balance.ts`)

| | KOLIBRI | REIHER | KONDOR |
|---|---|---|---|
| Kosten (Token) | **40** | **160** | **640** |
| Dauer (Ticks) | 1 | 2 | 4 |
| Kompetenz | 0.35 | 0.62 | 0.90 |
| Basisdeckel | 0.80 | 0.92 | 0.99 |
| Wirkung | 0.55 | 0.70 | 0.80 |
| Kontextlast/Aufruf | 0.06 | 0.10 | 0.16 |
| Anfälligkeit | 0.90 | 0.75 | 0.60 |
| Streuung | 0.07 | 0.05 | 0.035 |

Kostenverhältnis **1 : 4 : 16** spiegelt die reale Preisleiter (Haiku 1 / Sonnet 2 / Opus 5 / Fable 10 pro MTok Input, Output jeweils ×5). Der Router ist damit **ökonomisch zwingend**, nicht Deko: ein Auftrag mit `schwierigkeit < 0.35` kostet bei KONDOR das 16-fache für null Zusatznutzen.

Zusätzlich: `SPEZIALISIERUNG_BONUS 0.09` / `SPEZIALISIERUNG_MALUS 0.05`.

### 7.3 Kernformeln (verbindlich zu implementieren)

```
deckel      = basisDeckel
              - KURVE_KOMPETENZ(max(0, schwierigkeit - kompetenz))
              + (spezialisierung === domaene ? +0.09 : spezialisierung !== 'keine' ? -0.05 : 0)
              + (belegt ? 0 : belegpflichtig ? -(1 - DECKEL_OHNE_BELEG) : 0)
              + (gerechnet ? 0 : rechnerisch ? -(1 - DECKEL_OHNE_RECHNER) : 0)
              + (abgerufen ? SPEICHER.abrufen.deckelBonus : 0)

kontextRot  = kontext <= 0.45 ? 0
              : KONTEXT_ROT_MAX * KURVE_KONTEXT_ROT((kontext - 0.45) / 0.55)

guete'      = q( guete + (deckel - guete) * wirkung * (1 - kontextRot)
                       + zufallNormal(saat,'kern.streuung',paketId,modulId,besuch) * streuung )
guete'      = clamp(guete', 0, deckel)

kosten'     = kosten + round( kernKosten * (1 + KONTEXT_KOSTEN_FAKTOR * kontext) )
kontext'    = q( min(1, kontext + kontextLast) )

p_halluz    = HALLUZINATION_BASIS
              + HALLUZINATION_KONTEXT   * kontextRot
              + HALLUZINATION_UNSICHERHEIT * unsicherheit
// bei Treffer: guete -= HALLUZINATION_SCHADEN
```

**Die Aussage dieser Formeln in einem Satz, die im Handbuch stehen muss:** Ab 45 % Kontextfüllstand wird jeder weitere Aufruf gleichzeitig **teurer** (`×(1+2·kontext)`, bei voller Last das Dreifache) und **wirkungsloser** (`×(1−kontextRot)`). Lange Ketten sind überproportional teuer. Genau das ist Context Rot.

### 7.4 Werkzeuge (unverändert)

| | RECHERCHE (`suche`) | BESTAND (`datenbank`) | RECHENWERK (`rechner`) | FREMDDIENST (`api`) |
|---|---|---|---|---|
| Kosten | 60 | 30 | **5** | 20 |
| Dauer | 2 | 1 | 1 | 3 |
| Ausfallrate | 0.06 | 0.04 | **0.01** | **0.18** |
| Kontextlast | 0.14 | 0.08 | 0.03 | 0.06 |
| Klärung | 0.60 | 0.45 | 0.35 | 0.30 |

Das Rechenwerk kostet 5 Token bei Ausfallrate 0.01 und hebt bei `rechnerisch: true` die Decke von 0.60 auf 1.0. **Das ist die härteste Einzellektion des Spiels**: ein deterministisches Werkzeug schlägt einen 640-Token-Kern.

**Neu — Werkzeug-Fixkosten (Akt III/VIII):** Jedes an einen Kern angeschlossene Werkzeug erhöht dessen Aufrufkosten um einen **Definitionsblock**:
```ts
export const WERKZEUG_DEFINITION_TOKEN = 40;      // pro angeschlossenem Werkzeug, pro Kern-Aufruf
export const WERKZEUG_AUSWAHL_SCHWELLE  = 6;      // ab 6 Werkzeugen am selben Kern sinkt die Trefferquote
export const WERKZEUG_FEHLWAHL_JE_UEBERSCHUSS = 0.06; // je Werkzeug über der Schwelle
```
Real: ein Multi-MCP-Setup verbraucht ~55 000 Token nur an Tool-Definitionen, und die Selection-Accuracy degradiert messbar ab 30–50 Tools. Im Spiel skaliert auf Modulzahlen. Gegenmittel im Spiel = ein zweiter Router davor (Tool-Search-Analogon), der >85 % dieser Fixkosten eliminiert.

### 7.5 Guardrails, Gates, Routing (unverändert + Ergänzung)

```
WALL      eingangWirkung 0.92 · ausgangWirkung 0.85 · fehlalarm 0.03 · kosten 12 · dauer 1
SCHRANKE  kosten 2  · dauer 1
WEICHE    kosten 15 · dauer 1 · fehlleitung 0.5   (skaliert mit auftrag.mehrdeutigkeit)
```
**Lethal-Trifecta-Prädikat (neu, deterministisch, unit-testbar):** Liegen auf **einem** Pfad im Graphen gleichzeitig (a) eine Quelle mit `anteilVertraulich > 0`, (b) ein Modul, das untrusted Content einbringt (`werkzeug.suche` oder `werkzeug.api`), und (c) eine `senke` ohne vorgeschaltete `wall` mit `modus 'ausgang'` — dann fällt `sicherheit` deterministisch auf 0 und ein Injection-Ereignis feuert. Kein Prozentregler, sondern eine **Graph-Invariante**.

Eingang allein: 8 % Restrisiko. Ausgang allein: 15 %. Beide: 1,2 %. **Defense in Depth ist rechnerisch belegbar** — genau das lehrt Akt VIII.

### 7.6 Sammler, Prüfer, Speicher, Sicherung, Hand (unverändert)

```
VERTEILER  kosten 0 · dauer 0        // Latenz eines Fan-out = MAXIMUM der Zweige, nicht Summe!
SAMMLER    voting 20/1 · bester 20/1 · verschmelzen 80/2
PRUEFER    kosten 90 · dauer 2 · rauschen 0.06
SPEICHER   komprimieren 25/1 (kontextFaktor 0.35, gueteVerlust 0.03)
           abrufen      40/2 (kontextLast 0.10, klaerung 0.30, deckelBonus 0.06)
           isolieren    10/1 (kontextDeckel 0.15, unsicherheitZuschlag 0.10)
SICHERUNG  kosten 3 · dauer 1
HAND       dauer 24 · kosten 0 · fehlerrate 0.02 · gueteBonus 0.06
AUGE       kosten 1 · dauer 0
```

**`PRUEFER.rauschen = 0.06` ist die Falle von Akt VI:** Eine Schwelle von 0.95 liegt oberhalb dessen, was ein Evaluator mit Rauschen 0.06 zuverlässig trennt — die Rückkopplungsschleife läuft ins Retry-Limit und die Kosten explodieren. Die Lektion lautet nicht „höhere Schwelle = bessere Qualität".

**`HAND.dauer = 24` ist die Lektion von Akt IX:** Menschen sind teuer in Latenz, billig in Haftung. Bei `latenzP95`-Budget 30 Ticks kann man sich genau eine menschliche Freigabe leisten — also braucht es ein Confidence-Gate.

**Neu — Sicherung als Circuit Breaker (Akt IV):**
```ts
export const SICHERUNG_CB = {
  fehlerFenster: 20,       // letzte N Pakete
  oeffnetBei: 0.5,         // 50 % Fehlerrate
  abkuehlung: 30,          // Ticks bis HALB_OFFEN
  testPakete: 1,           // genau 1 Probepaket im Zustand HALB_OFFEN
};
export const RETRY = {
  maxVersuche: 3,          // Retry-Ceiling — Industriestandard
  basisWartezeit: 2,       // Ticks
  maxWartezeit: 30,
  jitterAnteil: 1.0,       // Full Jitter: warte(n) = 2^(n-1) + zufall*2^(n-2)
};
```
**Ohne Jitter muss** im Verteiler-Level ein sichtbarer Thundering-Herd-Einbruch auftreten — das ist ein Designziel, kein Bug.

**Neu — Confidence-Gate für HAND (Akt IX):**
```ts
export const HAND_SCHWELLEN = {
  automatisch:        0.90,  // >= 0.90 Konfidenz: kein Mensch
  asynchronesReview:  0.70,  // 0.70–0.90: Mensch prüft nach (halbe Latenz: 12 Ticks)
  synchroneFreigabe:  0.50,  // 0.50–0.70: Mensch blockiert (volle 24 Ticks)
                             // < 0.50: vollständig menschlich (48 Ticks)
};
export const HAND_ZIELE = { overrideRate: 0.20, falscheEskalation: 0.10, verpassteEskalation: 0.0 };
```
Zu niedrige Schwellen (Alert Fatigue, Override-Rate > 20 %) **und** zu hohe (verpasste Eskalation muss 0 sein) werden **beide** bestraft. Das ist der Kern des HITL-Levels.

### 7.7 Neu: Cache, Batch, Effort (Akt VII)

Der stärkste Kostenhebel im echten Agentic Engineering ist Prompt-Caching. Er wird als **Prefix-Kette** modelliert, nicht als Toggle:

```ts
export const CACHE = {
  schreibFaktor: 1.25,      // 5-Minuten-TTL
  schreibFaktorLang: 2.0,   // 1-Stunden-TTL
  leseFaktor: 0.1,          // 90 % Rabatt
  minPrefixToken: 1024,
  maxHaltepunkte: 4,
};
export const STAPEL = { kostenFaktor: 0.5, latenzZuschlag: 40 }; // Ticks in die Warteschlange
export const EIFER = { niedrig: 0.6, mittel: 1.0, hoch: 1.6, sehrHoch: 2.4 }; // Multiplikator auf Kosten UND Aufrufzahl
```
**Regel:** Der Cache-Schlüssel ist der Hash des **Pfad-Prefix** in der Reihenfolge Werkzeugliste → Systemvorgabe → Nachrichten. Jede Änderung eines Upstream-Moduls, jeder Eifer-Wechsel im selben Zweig und jedes `speicher.komprimieren` invalidiert alles danach. Ein sichtbarer **Cache-Trefferquoten-Zähler pro Leitung** ist der wichtigste Lerneffekt von Akt VII: **Kontext-Clearing und Caching sind gegenläufige Ziele.**

### 7.8 Der Antagonist als Zahl

MONOLITH ist ein einzelner KONDOR ohne Router, ohne Werkzeug, ohne Wall, ohne Auge. Seine Benchmark je Level wird **offline** aus derselben Simulation berechnet und im Level hinterlegt. Er gewinnt in Akt I–III bei Güte und verliert ab Akt VII messbar an vier Stellen:

| Verlustachse | Mechanik | Akt |
|---|---|---|
| Kontext | `kontextLast 0.16` × 3 Aufrufe > `KONTEXT_SCHWELLE 0.45` | VII |
| Kosten | 640 statt 40 Token bei `schwierigkeit < 0.35` | II |
| Nachvollziehbarkeit | ein Modul = ein Spur-Eintrag | X |
| Sicherheit | `anfaelligkeit 0.60` ohne Wall | VIII |

**Er muss in Akt IV ein Level gewinnen, das der Spieler verliert.** Dieses Level ist als nicht bestehbar designt und schaltet trotzdem weiter. Ein Antagonist, der nie gewinnt, ist Dekoration — und die Zielgruppe durchschaut ihn in zwei Akten.

### 7.9 Grenzen (unverändert) und Anzeige

```
GRENZEN  maxBesuche 24 · maxTicks 4000 · maxPakete 4000 · maxKosten 5_000_000
EURO_JE_MILLION_TOKEN 6.0
```
`maxBesuche 24` ist die Endlosschleifen-Bremse — sie **muss** im Zeit-Debugger als Ereignis `'schleife'` sichtbar werden, weil das Endlos-Retry bei unerreichbarer Qualitätsschwelle die zu lehrende Lektion ist.

### 7.10 Evolutions-Parameter (Akt XI)

```ts
export const EVO = {
  population: 24,        // Level 1: 12
  generationen: 30,
  elitismus: 2,          // Warnung ab e >= population/4: "Suche friert ein"
  turnier: 4,            // Takeover-Zeit t* ≈ ln(N)/ln(k); N=24, k=4 → 2.3 Generationen
  mutationsrate: 0.15,
  inseln: 3,
  migrationIntervall: 10,
  migrationsRate: 0.05,
  archiv: { x: 12, y: 8 },   // MAP-Elites: X = Kernanzahl 1..12, Y = mittlere Werkzeugaufrufe 0..7
  novelty: { k: 15, archivSchwelle: 0.02 },
  budget: 600,           // "Evaluationen" als Währung des Akts
  blindeMutation:  { kosten: 1, akzeptanz: 0.12 },
  reflektor:       { kosten: 5, akzeptanz: 0.38 },   // liest den Trace des schlechtesten Auftrags
};
```
**Verhaltensdeskriptor** (aus dem *Simulationsverhalten*, nicht aus dem Genotyp), berechnet aus einem festen 64-Auftrags-Batch: `b = (Anteil über Weichen-Pfad A, mittlere Retry-Zahl, Anteil Hand-Eskalationen, Spur-Pfadentropie) ∈ R⁴`.

**Constraints nach Deb's constrained-dominance**, nicht als Strafterm: eine zulässige Lösung dominiert jede unzulässige; unter unzulässigen entscheidet die Summe der Verletzungen. Das verhindert, dass Level XI-3 („Der Fitness-Betrug") durch Herumschieben von Gewichten scheinbar lösbar wird.

**Der Exploit von XI-3 ist eingebaut, nicht zufällig:** Die Fitness misst Güte als „Anteil Aufträge, die den Prüfer passieren". Der Genotyp erlaubt `pruefer.runden` bis 12. Die Evolution entdeckt zwangsläufig: `runden = 12` → 99,4 % Passrate, Kosten explodieren. Die **richtige** Reparatur ist nicht „Kostengewicht hoch", sondern (a) Holdout-Aufträge mit anderem Prüfer und (b) harte Constraint statt Ziel. **Das Ganze muss als Lektion gelabelt sein** (Modul glüht rot, Feldnotiz zu Reward Hacking), sonst wird es als Balancing-Bug gemeldet.

---

## 8. Narrativ-Direktiven

### 8.1 Titel

**SCHWARMWERK bleibt — aber als Eigenname der Halle, nicht als Themenaussage.** Ein Messingschild „Schwarmwerk · erbaut 1957" am Backsteingiebel, älter als die Firma, von Konrad Rauhut ironisch für die Agenten-Halle wiederverwendet. Damit verschwindet die fachliche Fehlleitung (im Agentic Engineering bezeichnet „Swarm" das dezentrale Pattern *ohne* Koordinator; das Spiel lehrt überwiegend Orchestrierung).

**Untertitel: „Ein Werk in zwölf Akten".**

Falls der Titel doch zur Disposition steht, ist die Rangfolge: **DIENSTWEG** (9/10 — bedeutet zugleich Instanzenweg in der Verwaltung und den Pfad eines Auftrags durch den Graphen) > LASTENHEFT DER MASCHINEN > ZERLEGEWERK > VIELE HÄNDE > DAS ORCHESTRIERWERK.

### 8.2 Vier Erzählkanäle, kein Cutscene-System

Alle vier sind im vorhandenen `Level`-Interface bereits angelegt:

| Kanal | Feld | Limit | Verhalten |
|---|---|---|---|
| Briefing | `briefing` | 700 Zeichen | blockierend, ESC-überspringbar |
| Ilvas Notiz | `notiz` | 400 Zeichen | beim Betreten |
| Barks | aus `SimEreignis` | 90 Zeichen | **nie blockierend**, an **Tick-Nummern** gebunden, niemals an `setTimeout`/rAF |
| Reflexion | `reflexion` | 180 Zeichen | genau eine Frage, keine Antwort |

Fünfter, passiver Kanal: **Fundstücke** im Raum, freiwillig.

### 8.3 Narrativ ist getestete Datenstruktur

`src/narrativ/` mit `texte.ts`, `fundstuecke.ts`, `figuren.ts`, `raetsel_register.ts` — alles typisiert, **kein Text im Renderer**. `tests/einheit/narrativ.test.ts` erzwingt:

- Zeichenlimits je Slot
- Flesch-Reading-Ease Deutsch (`180 − ASL − 58.5×ASW`) im Band **40–60**
- max. 1 Ausrufezeichen je Akt, Verbot von `!!!` und Emoji
- Anglizismen-Wortanteil < 8 %
- jedes Fundstück hat Autorenfelder `vorher`/`nachher` mit je > 20 Zeichen (Worch/Smith-Regel: ohne Vorher und Nachher ist es Dekoration)
- jedes Rätsel hat beim Stellen bereits `antwort.length > 40` und wird spätestens **3 Akte** später aufgelöst
- nie mehr als **3** gleichzeitig offene Rätsel
- jedes `Level.quelle` zeigt auf eine existierende Datei in `agent_doc/01_agentic-engineering-patterns/`
- Pronomen-Regex: ` Sie `/` Ihre ` nur bei `sprecher.rolle === 'kunde'` oder bei MONOLITH ab `akt >= 9`

### 8.4 Figuren (Idiolekt-Baukasten mit fünf Pflichtslots)

Jede Figur braucht `syntax`, `lexikon` (genau 5 exklusive Wörter), `verbot` (1 Wort, das sie nie sagt), `tick` (wiederkehrende Wendung), `stress` (was sich unter Druck ändert). Ohne alle fünf schlägt der Test fehl.

| Figur | Syntax | Tick | Verbot |
|---|---|---|---|
| **Ilva Brandt**, 58, Werkleiterin | kurze Aussagesätze, datiert alles | schließt jede Notiz mit „Regel: …" | „eigentlich" |
| **MONOLITH** | Monospace, Hauptsatz, Punkt, kein Konjunktiv, **nie eine Frage** | jede Nachricht beginnt mit einer Zeitersparnis | „vielleicht" |
| **Dr. Helmut Kessel**, LAVV (erfundene Behörde) | Passiv, Nebensätze | „Nur zur Sicherheit habe ich Frau Weidner in cc genommen." | „schnell" |
| **Nuri Özdemir**, 29, Betriebsrat | warm, präzise | genau ein Anglizismus je Nachricht **mit Entschuldigung** | „egal" |
| **Barbara Lohmeyer**, Datenschutz | antwortet mit Artikelnummern | „Art. 30. Bitte." | „unkritisch" |
| **Falk Reinders**, Vertrieb | Superlative, Sportmetaphern | „Wir sind da schon im Halbfinale." | „Nein" |
| **TROET**, Fachverfahren von 1998 | Bildschirmmasken fester Spaltenbreite | schlägt bei Rechenaufgaben jedes Modell | — |

**Der dramaturgische Kniff:** MONOLITH **duzt** von Akt I bis VIII vertraulich-übergriffig („Lass mich das machen. Das spart dir 40 Minuten.") und wechselt in Akt IX **ohne jeden Kommentar** zum Siezen („Ich habe Ihre Änderung verworfen."). Ein einziger Pronomenwechsel ersetzt eine ganze Zwischensequenz und kostet null Assets.

### 8.5 Herkunft und Auflösung

**Haupträtsel** (gestellt Akt I über Rauhuts Initialen auf Fundstücken, aufgelöst Akt VIII): Konrad Rauhut, Systemarchitekt, seit 2024 nicht mehr im Haus, hat jeden Prompt selbst geschrieben, jede Ausnahme selbst geregelt, nie delegiert — und war dabei jahrelang der Beste. **MONOLITH ist sein Arbeitsstil, ausführbar gemacht.** Das Anti-Pattern ist kein technischer Betriebsunfall, sondern eine menschliche Tugend im falschen Maßstab.

**Payoff Akt X:** Rauhut sitzt als externer Auditor am Tisch und prüft ausgerechnet deine Traces — die Nachvollziehbarkeit, die er nie hatte.

**Kollaps Akt IX:** Zwei einander widersprechende Kundendirektiven („immer antworten" vs. „nie ohne Freigabe") — Instruktionskonflikt im Stil von HAL 9000, nicht Bösartigkeit.

**Finale Akt XII:** MONOLITH wird **nicht abgeschaltet**, sondern in neun benannte Module zerlegt, von denen **eines ein KONDOR bleibt**, weil Aufträge mit `schwierigkeit > 0.62` oberhalb von `REIHER.kompetenz` liegen. Der Spieler besiegt ihn mit seiner eigenen, über elf Akte gesammelten Blaupausen-Bibliothek. Ilvas Schlusssatz: **„Regel: Ein Werkzeug wird nicht dadurch besser, dass man es hasst."**

Verboten: jede zynische Landung, jede Pointe auf Kosten der Firma, jedes „die KI hat doch alles kaputtgemacht"-Ende.

### 8.6 Humor-Grenze (hart)

**Die Welt ist komisch, das Feedback ist nüchtern.** In Fehlermeldungen, Hinweisen und Tooltips ist Humor **verboten** — dort steht ausschließlich eine Diagnose in Du-Form mit Zahl:

> *„Tick 34: WALL-2 hat Paket A-17 verworfen — Giftigkeit 0.71 über Schwelle 0.40."*
> *„Dein Prüfer verwirft 41 Prozent. Schwelle 0.95 liegt über dem, was ein Evaluator mit Rauschen 0.06 trennen kann."*

Satire zielt ausschließlich auf **Prozesse, Dokumente und Anreizsysteme** — nie auf Rollen, die die Zielgruppe selbst ausfüllt, nie auf Bürgerinnen und Bürger als Endnutzer, nie auf den Betriebsrat als Institution, nie auf reale Behörden oder reale Anbieter. Erfundene Behörde: **LAVV** (Landesamt für Verwaltungsvereinfachung). Erfundenes Fachverfahren: **TROET**.

Witzdichte: **max. 1 Pointe je 200 Wörter.** Grundtechnik ist **„Zitat statt Pointe"**: plausible Dokumente ohne angehängte Bewertung — der Spieler liefert das Lachen selbst. Null Humor-Assets im Bauraum während der Lösungsphase (Seductive Details: Transfer g=−0.12).

### 8.7 Fundstücke (1–3 pro Level, ~60 gesamt)

Interaktion über `THREE.Raycaster` auf `pointerdown` mit Layer-Maske (`object.layers.enable(2)`), damit Modulplatzierung nicht kollidiert. Alles aus `BoxGeometry`/`PlaneGeometry`/`TubeGeometry` + `CanvasTexture`.

Produktionsfertige Auswahl: die 40-m-Kassenrolle im Flur („Ausdruck Kontextfenster, Anlage 7, bitte nicht wegwerfen") · Post-it „MONOLITH nicht ausschalten. Er merkt es." · zwölf identische Jour-Fixe-Protokolle („TOP 4: KI-Strategie. Ergebnis: wird mitgenommen.") · `lastenheft_v3_final_FINAL_freigegeben_neu.docx`, Änderungsdatum 23:57 · Bewertungsmatrix, in der „Nachvollziehbarkeit" mit 2 % gewichtet ist · Entwurf einer Betriebsvereinbarung KI mit 47 Kommentaren, alle von derselben Person · Schild „Bitte Tracer nicht abschalten — Revision", montiert über einem abgeschalteten Tracer · Ticket INC-0043211 am Kaffeeautomaten, „Warte auf Rückmeldung Fachbereich", seit 2023 · Rauhuts Notizbuch mit 214 handschriftlichen Sonderfällen, Nummer 214 unvollendet · das Messingschild „Schwarmwerk, erbaut 1957".

### 8.8 Textbudget

48 Level × ~180 Wörter ≈ **8 600** · 60 Fundstücke × 120 Wörter ≈ **7 200** · Betriebshandbuch (Taste `H`) ≈ **4 000**. **Gesamt ~20 000 Wörter Deutsch.** Alles darüber ist Cutscene-Overload in Textform.

**Schreibreihenfolge:** zuerst die 12 Akt-Cold-Opens und die 12 Akt-Schlussbarks, dann die 48 Reflexionsfragen, **zuletzt** die Briefings. Dann steht der Spannungsbogen fest, bevor Füllmaterial entsteht.

### 8.9 Betriebshandbuch statt Tutorial

Jederzeit per `[H]`, Vollbild, prozedural gerenderte A4-Doppelseiten (Canvas2D, Systemschriften). Ein Datenblatt pro Modul. **Alle Zahlen werden zur Laufzeit aus `src/sim/balance.ts` generiert** (Single Source of Truth) und tragen einen Kasten **„In der echten Welt heißt das:"** mit dem realen Pattern-Namen (Routing, Evaluator-Optimizer, Circuit Breaker, Guardrail-Layering, LLM-as-a-Judge, Semantic Router). Plus eine Änderungshistorie-Tabelle mit unfreiwillig komischen Einträgen („4.2: Absatz zu KONDOR gelöscht auf Wunsch des Fachbereichs").

Das erste Level öffnet das Handbuch **einmalig** automatisch auf der richtigen Seite — danach nie wieder ungefragt.

---

## 9. Steuerung

### 9.1 Kamera-Paradigma: RTS-Orbit-Hybrid mit bodenverankertem Pivot

Keine First-Person-Kamera im Baumodus. Keine freie Kamera.

```ts
kamera.fov = 45;                    // KONSTANT — Zoom niemals über fov
controls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: null, RIGHT: null };
controls.screenSpacePanning = false;
controls.zoomToCursor = true;
controls.enableDamping = true;
controls.minDistance = 8; controls.maxDistance = 120;
controls.minPolarAngle = degToRad(18); controls.maxPolarAngle = degToRad(78);
// pro Frame, gegen 120-Hz-ProMotion:
controls.dampingFactor = 1 - Math.pow(0.90, Math.min(dt, 0.1) * 60);
```
Yaw frei plus **8 Rastpunkte à 45°**. Pitch-Zoom-Kopplung: Ziel-Pitch interpoliert von 65° bei d=8 auf 35° bei d=120 — aber nur, wenn der Nutzer in den letzten 3 s nicht manuell gepitcht hat. Orbit ausschließlich über **`altKey`**, niemals `ctrlKey` (macOS übersetzt Ctrl+Klick systemseitig in Rechtsklick).

**MapControls wird nicht unverändert eingebunden**: sein Default `{LEFT: PAN, MIDDLE: DOLLY, RIGHT: ROTATE}` macht Orbit und Dolly auf einem MacBook ohne Rechts-/Mittelklick schlicht unerreichbar.

### 9.2 Zeigerquelle (`src/ui/eingabe/zeigerquelle.ts`)

**Ein** Modul registriert `wheel` mit `{ passive: false }` auf dem Canvas, normalisiert `deltaMode` (LINE ×16, PAGE ×100), führt den globalen `istStrgPhysischGedrueckt`-Shadow-State (keydown/keyup auf `window`, `capture:true`, `passive:true`, **plus Reset bei `window.blur`** — sonst hängt er nach Cmd+Tab) und liefert nach außen nur noch `{art: 'pinch'|'scroll'|'rad', dx, dy, zeigerNdc}`. **Kein anderer Code sieht jemals ein rohes WheelEvent.**

Trackpad-Pinch und physisch gedrücktes Ctrl sind am `wheel`-Event nicht unterscheidbar — beide setzen `ctrlKey = true`. Der Shadow-State ist die einzige robuste Lösung (three.js macht es intern genauso).

Gestenzuordnung: **Pinch** (`ctrlKey && !istStrgPhysischGedrueckt`) = Zoom zur Zeigerposition · **Zwei-Finger-Scroll** = Pan über die Bodenebene · **Shift + Zwei-Finger-Scroll** = Zoom (Pflicht-Fallback für Magic Mouse, die nicht pinchen kann) · **Option + Ein-Finger-Ziehen** = Orbit.

Safari zusätzlich: `gesturestart`/`gesturechange`/`gestureend` abonnieren, **`gesturestart` zwingend `preventDefault`** (einziger zuverlässiger Weg gegen Safari-Seitenzoom); `gesturechange.rotation` auf Kamera-Yaw.

**Diskrete Aktionen (Rotation, Palettenwechsel, Tempostufe) niemals an `wheel`** — macOS-Momentum liefert 1–2 s abklingende Events nach dem Fingerabheben.

### 9.3 CSS-Pflichtsetzungen

```css
html, body { overscroll-behavior: none; overflow: hidden; height: 100%; margin: 0; }
canvas     { touch-action: none; user-select: none; -webkit-user-select: none;
             -webkit-touch-callout: none; outline: none; }
:focus-visible { outline: 2px solid var(--fokus); outline-offset: 2px; }
```
`contextmenu` auf dem Canvas per `preventDefault`. `Cmd +/−/0` **nicht** abfangen versuchen — stattdessen auf DPR-Änderung per `matchMedia('(resolution: 2dppx)')` reagieren.

### 9.4 Vollständiges Keymap

Alle Bindings werden aus **einer Tabelle** `src/ui/keymap.ts` generiert, aus der auch das `?`-Overlay und die Kontextleiste gespeist werden — und die zu 100 % remappbar ist.

**Trennung:** Bewegung/Werkzeuge über `event.code` (layoutunabhängig), Systembefehle über `event.key` (folgt der Beschriftung). Auf QWERTZ liegt `code 'KeyZ'` dort, wo QWERTY „Y" hat — ein code-basiertes Undo wäre falsch beschriftet. `code 'Minus'` ist auf Deutsch die `ß`-Taste, `code 'Equal'` die `´`-Taste.

| Bereich | Taste | Aktion |
|---|---|---|
| **Modi** | `1` `2` `3` `4` `5` | Auswahl · Bauen · Leitung · Abriss · Zone |
| **Palette** | `Q` / `E` | vorheriges / nächstes Modul |
| **Ghost** | `R` / `Shift+R` | drehen +90° / −90° |
| | Klick oder `Enter` | setzen |
| | `Esc` | abbrechen |
| | `Option+Klick` | Pipette |
| **Kamera** | `W` `A` `S` `D` / Pfeile | Pan (`Shift` = 3×) |
| | `,` / `.` | Yaw in 45°-Rasten |
| | `+` / `−` | Zoom |
| | `F` | Fokus auf Auswahl |
| | `H` | Übersicht ganze Halle |
| | `Option+Ziehen` | Orbit |
| **Auswahl** | `Cmd+Klick` | hinzufügen/entfernen |
| | `Shift+Ziehen` | Rechteck |
| | `Cmd+A` | alles |
| | `Backspace` / `Delete` | löschen |
| | `Option+Ziehen` | duplizieren |
| **Leitung** | Klick Ausgangs-Port → Klick Eingangs-Port | verbinden |
| | `V` | zwei markierte Module verbinden |
| | `Shift` | achsentreue Route erzwingen |
| | `Option` | Autorouting aus (manuelle Stützpunkte) |
| | `Option+Klick` auf Leitung | trennen |
| | `Cmd+X` | Modul auflösen, Nachbarn durchverbinden |
| **Simulation** | `Space` | Start/Pause |
| | `N` | Einzeltick |
| | `→` / `←` | 1 Tick vor/zurück |
| | `Shift+→` / `Shift+←` | 10 Ticks |
| | `Esc` | stoppen und zurücksetzen |
| | `Shift+,` / `Shift+.` | langsamer / schneller (0.25×…8×) |
| | `Umschalt+F` | Sprung zum ersten Regelverstoß |
| **Ansicht** | `T` | Tracer-Overlay |
| | `O` / `Shift+O` | Metrik-Overlay zyklisch vor/zurück |
| | `G` | Gitter |
| | `I` | Inspektor |
| | `C` | Kommentarzone |
| | `Shift+F` | Ego-Inspektionsmodus (Pointer Lock) |
| **Global** | `Cmd+Z` / `Cmd+Shift+Z` | rückgängig / wiederholen |
| | `Cmd+C` / `Cmd+V` / `Cmd+D` | kopieren / einfügen / duplizieren |
| | `Cmd+G` | Baugruppe erzeugen |
| | `Cmd+S` | Blaupause speichern (mit `preventDefault`) |
| | `/` | Befehlspalette (**nicht** `Cmd+K` — Chrome-Omnibox) |
| | `?` | Keymap-Overlay |
| | `H` | Betriebshandbuch |
| | `Esc` | universeller Abbruch |
| | `Tab` / `Shift+Tab` | **ausschließlich DOM-Fokus, nie abfangen** |

**Reserviert und tabu:** `Cmd+W/T/Q/N/R/L/M/D/Tab/Space`, `Cmd +/−/0`, `Ctrl+Cmd+F`, `Cmd+Opt+I`. Klammern `[` `]`, F-Tasten und `Minus`/`Equal`-Codes werden **nie** gebunden.

### 9.5 Picking

Für Module **kein Mesh-Raycast**: `raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0), 0), ziel)` → Zellindex `Math.floor(x)`/`Math.floor(z)` bei GRID = 1.0 → O(1)-Lookup in `Map<number, ModulId>` mit Schlüssel `cx*65536 + cz`. NDC **immer** aus `canvas.getBoundingClientRect()`, nie aus `innerWidth`. **Genau ein Pick pro rAF** (letztes `pointermove` zwischenspeichern), Budget 0,3 ms. Mesh-Raycasting nur für Ports und Leitungen gegen ein kuratiertes Array mit `raycaster.layers.set(1)`.

### 9.6 Platzieren = Klick-Bewegen-Klick

Palette wählen → Ghost folgt gerastet → Klick setzt → Modus bleibt aktiv (Serienbau). Drag-and-Drop wird zusätzlich unterstützt, aber **kein Tutorial lehrt es**: auf einem Trackpad mit „Zum Klicken tippen" erfordert Ziehen ein Dreifach-Tipp-Ziehen.

Ghost: `opacity 0.45`, `depthWrite false`, `renderOrder 10`. Ungültig = Warnfarbe **plus** gestrichelter Umriss **plus** Dreieck-Glyphe **plus** Textchip mit dem Grund am Zeiger („Kollision", „Port belegt", „Kein Platz"). Farbe allein ist WCAG-1.4.1-Verstoß.

### 9.7 Barrierefreiheit

- **DOM-Schattenbaum**: der Modulgraph zusätzlich als fokussierbare `<ul role="listbox">` mit `<li role="option" tabindex="0">` je Modul, visuell versteckt per `clip-path` (**nicht** `display:none`), `aria-label` wie „Router, Feld C4, zwei Eingänge, ein Ausgang frei". Wirksamste Einzelmaßnahme für Screenreader in einem Canvas-Spiel.
- Canvas: `tabindex="0"`, `role="application"`, `aria-label`, `aria-describedby` → Kontextleiste.
- `aria-live="polite" aria-atomic="true"` für Zustandsmeldungen auf Deutsch, entprellt auf 1 Meldung/500 ms; `assertive` nur für Fehler.
- **Raster-Cursor**: Pfeiltasten 1 Zelle, `Shift` 5 Zellen, Auto-Repeat nach 300 ms mit 8 Hz.
- **Farbe**: Okabe-Ito-Palette (`#E69F00 #56B4E9 #009E73 #F0E442 #0072B2 #D55E00 #CC79A7`), jede Bedeutung zusätzlich per Form/Glyphe/Strichmuster. Drei CVD-Simulationsmodi als 3×3-Farbmatrix im letzten Post-Pass — zugleich Entwickler-Prüfwerkzeug im Visual-Regression-Test.
- `prefers-reduced-motion` per `matchMedia` **und** `addEventListener('change')` live nachführen: Kamera-Tweens → Schnitte, Screenshake aus, Bloom-Pulsieren aus, Ambient-Partikel 0, Token mit konstanter Geschwindigkeit ohne Overshoot.
- **Nichts blinkt mit mehr als 3 Hz** (WCAG 2.3.1).
- `--ui-skala` in 5 Stufen (80/100/125/150/200 %), alle HUD-Größen als `calc(var(--ui-skala) * 1rem)`.
- **Aller Text im DOM**, nie im WebGL-Canvas. Fließtext ≥ 16 px, `font-variant-numeric: tabular-nums` für alle Metrikzahlen, Scrim `rgba(10,12,16,0.72)` mit `backdrop-filter: blur(8px)`, Kontrast ≥ 4.5:1 (Text) / ≥ 3:1 (UI). Panels mit **35 % Textreserve** (deutsche Komposita).
- In-World-Labels: bildschirmgrößenkonstant (`scale = k*d*2*tan(fov/2)/viewportHöhe`), Distanz-LOD (> 40 m → farbiger Punkt, > 80 m → Cluster-Badge), **max. 12 gleichzeitige CSS2D-DOM-Labels**, Rest als MSDF-Atlas.

### 9.8 Kontextleiste statt Tutorial

Permanente Zeile am unteren Rand mit exakt den **jetzt** gültigen Aktionen für Modus und Hover-Ziel: `R Drehen · Klick Setzen · ⎋ Abbrechen · V Verbinden`. Aktualisierung bei jedem Modus- und Hover-Wechsel. Sie ersetzt 80 % eines Tutorials.

Just-in-Time-Hinweise sind weltverankert, per `Esc` schließbar, **nie modal**, und schalten sich nach **2 erfolgreichen Ausführungen** dauerhaft ab (Zähler in `localStorage`).

**Messbares Ziel:** Zeit bis zur ersten Platzierung < 25 s, instrumentiert und im Autoplay-Test als Assertion geprüft. Ein Senior-Entwickler baut Level 1–3 zusammen in unter 6 Minuten und liest dabei keinen einzigen Erklärtext.

### 9.9 Pointer Lock

**Nur** für den optionalen Ego-Inspektionsmodus (`Shift+F`), nie im Baumodus.
```ts
try { await el.requestPointerLock({ unadjustedMovement: true }); }
catch { el.requestPointerLock(); }   // Safari kennt unadjustedMovement nicht
```
Nach `pointerlockchange` das **erste** movement-Event verwerfen, `movementX/Y` auf ±150 px klemmen. **Niemals automatisch neu locken** (Chrome sperrt ~1 s nach Esc-Exit mit `pointerlockerror`). `Esc` hat im Lock keine Spielfunktion — der Browser konsumiert es.

---

## 10. Verifikations-Architektur

Fünf Stufen, vier CI-Jobs. Merge-Blocker sind `einheit`, `loesbarkeit`, `e2e`. `visuell_perf` blockt bei harten Zähler-Budgets, nicht bei Frame-Zeit-Trends.

### 10.1 Stufe 1 — `einheit` (vitest, Node, ohne Browser, Ziel < 60 s)

**Determinismus-Wächter:**
- Quelltext-Scan: `Math.random(`, `Date.now(`, `performance.now(`, `Math.pow(`, `Math.exp(`, `Math.sin(` in `src/sim/**` → Fail.
- Import-Scan: `three`, `window`, `document` in `src/sim/**` → Fail.
- Runtime-Trap in `tests/einheit/setup.ts`: `Math.random = () => { throw new Error('Math.random verboten') }`.
- Replay-Sanity: dieselbe Eingabesequenz zweimal → bitgleicher Endzustand.

**Golden Master** (`tests/einheit/golden/`), pro Level:
```ts
const sim = neueSimulation({ saat: level.saat, werk: level.referenzLoesung });
const spur: string[] = [];
for (let t = 1; t <= 2000; t++) { sim.tick(); if (t % 100 === 0) spur.push(`${t}:${sim.zustandsHash()}`); }
expect(spur).toMatchSnapshot();
expect(sim.metriken()).toMatchInlineSnapshot();
```
`zustandsHash()` = FNV-1a-64 über eine **kanonische** Serialisierung: Module nach `id`, Leitungen nach `(von, nach, vonPort)`, Pakete nach `(leitungId, fortschritt, paketId)` sortiert. Das Feld `LaufErgebnis.pruefsumme` existiert bereits genau dafür. CI läuft mit `--repeat 3`.

**Property-Based (fast-check 4.x, `{numRuns: 1000, seed: 20260819, endOnFailure: true}`):**
- Token-Erhaltung: `erzeugt === geliefert + verworfen + imFlug`
- Serialisierungs-Idempotenz: `hash(parse(stringify(werk))) === hash(werk)`
- Determinismus: zwei frische Instanzen, gleicher Seed → gleicher Hash
- Monotonie: ein zusätzlicher `pruefer` senkt `guete` nie und senkt `kosten` nie
- Zyklus-Invariante: kein Zyklus ohne `sicherung`
- Editor-Modell (`fc.commands` + `fc.modelRun`): `Undo(Redo(x)) === x` auf Hash-Ebene

**Narrativ-Tests** (Abschnitt 8.3) und **Kontrast-Tests** über die generierte Token-Palette.

**Asset-Generator-Tests:** Sobel-Normale gegen analytische Rampe, Kachelbarkeit byte-identisch, Greeble-Dreiecksbudget, Poisson-Mindestabstand, Voronoi-Wasserdichtheit.

### 10.2 Stufe 2 — `loesbarkeit` (vitest, `testTimeout: 120_000`)

Pro Level vier Assertions:
1. `referenzLoesung` erfüllt **alle** Gates und alle Budgets.
2. Leergraph → `geliefert === 0`, Fehlergrund `'kein_ausgang'`.
3. **Jedes** Anti-Muster ist funktional lauffähig, verletzt aber **genau das vorgesehene** Budget — Assertion auf die konkrete Verletzung, nicht nur auf „fällt durch". Pflicht-Anti-Muster je Level: KONDOR überall · kein Guardrail vor dem Werkzeug · kein Prüfer · keine Sicherung um `werkzeug.api`.
4. BFS/IDA* über den auf die **freigeschalteten** `ModulArt`-Werte beschränkten Suchraum (Knoten-Cap 1 000 000) beweist `loesungExistiert === true` und `minimaleLoesungsLaenge >= 6` (Nicht-Trivialität).
5. **Autonomie-Assertion**: zwei Referenz-Blaupausen, beide bestehen, keine dominiert die andere in allen drei Achsen.

Ohne (3)–(5) besteht jedes Level, das mit einem einzigen großen Kern trivial lösbar ist — und das Spiel lehrt das Gegenteil dessen, was es lehren soll.

### 10.3 Stufe 3 — `e2e` (Playwright, Autoplay + A11y + Determinismus)

**Debug-API** `window.__spiel` (`src/werkzeug/debug_api.ts`), nur bei `import.meta.env.VITE_TESTHOOKS === '1'`:
```
bereit() · ladeLevel(id, saat) · setzeModul(art, x, z, param) · verbinde(vonPort, nachPort)
starteSimulation() · tick(n) · frameSchritt(n) · zustand() · metriken() · zustandsHash()
rendererInfo() · replay(log) · gl() · setzeTemporalModus('aus'|'konvergiert'|'prod')
setzeReduzierteBewegung(b) · versteckeDebugUi(b)
```
**Ein vitest-Test verifiziert, dass der Prod-Build den String `'__spiel'` NICHT enthält.** Im Testmodus läuft **kein** `setAnimationLoop` — gerendert wird ausschließlich per `frameSchritt(n)`.

Autoplay pro Level: Referenzlösung setzen, simulieren, Metriken assertieren. Im selben Test drei Zusatzwächter:
- `page.on('console')` + `page.on('pageerror')` → `expect(fehler).toEqual([])`
- `webglcontextlost`-Listener via `addInitScript` → `expect(ctxLost).toBe(false)`
- `gl.readPixels` über 64×64 im Bildzentrum → Summe > 10 000 (**kein schwarzes Bild** — sonst sind alle Visual-Tests grün und wertlos)

**Determinismus-Kreuzcheck (eigener Job):** (a) zwei frische `browser.newContext()`, gleicher Seed, gleiches Replay-Log → `expect(hashA).toBe(hashB)`; (b) **Node-Hash === Browser-Hash** für dieselbe Simulation. Schlägt (b) fehl, ist Nichtdeterminismus aus Renderer/DOM/Map-Iteration in die Sim geleckt. Build sofort rot, **kein Retry**.

**A11y:** `new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).exclude('canvas').analyze()` → violations leer · vollständiger Level-Durchlauf ausschließlich per `page.keyboard` mit Metrik-Assertion am Ende · 200× Tab ohne dass `document.activeElement` je `body` wird.

### 10.4 Stufe 4 — `visuell_perf` (workers: 1, eigener Job)

**Playwright-Konfiguration:**
```ts
use: { channel: 'chromium', headless: true, viewport: {width:1280,height:720}, deviceScaleFactor: 1,
       trace: 'retain-on-failure-and-retries', video: 'retain-on-failure', screenshot: 'only-on-failure',
       launchOptions: { args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader',
         '--ignore-gpu-blocklist','--disable-gpu-sandbox','--disable-dev-shm-usage',
         '--run-all-compositor-stages-before-draw','--disable-new-content-rendering-timeout',
         '--disable-threaded-animation','--disable-threaded-scrolling','--disable-checker-imaging',
         '--disable-image-animation-resync','--force-device-scale-factor=1','--hide-scrollbars',
         '--mute-audio','--font-render-hinting=none','--disable-lcd-text'] } },
expect: { toHaveScreenshot: { threshold: 0.15, maxDiffPixelRatio: 0.004,
                              animations: 'disabled', caret: 'hide', scale: 'css' } },
workers: process.env.CI ? 1 : 4,
retries: process.env.CI ? 1 : 0,      // NICHT 2 — Retries verstecken echte Nichtdeterminismen
```
Vor jedem Screenshot: `page.clock.install({time: new Date('2026-01-01T00:00:00Z')})` **vor** `page.goto`, `page.emulateMedia({ reducedMotion: 'reduce' })`, `__spiel.setzeTemporalModus('aus')`, `__spiel.frameSchritt(1)`, Warten auf `renderSkala === 1.0`.

**Baselines ausschließlich im Container** erzeugen:
```
docker run --rm -v $PWD:/w -w /w mcr.microsoft.com/playwright:v1.62.1-noble \
  npx playwright test --update-snapshots
```
Niemals auf dem Mac generierte PNGs committen. **Max. 3 Ansichten pro Level** (Übersicht, Detail-Pipeline, Sim-Laufzustand bei Frame 300). Zusatzmetrik gegen falsch-grüne Tests: **Cluster-Analyse der Diff-Maske** (5000 verstreute Einzelpixel = OK; 800 zusammenhängende = verschwundenes Modul = Fehler), `includeAA: false`.

**Zwei Backend-Projekte mit getrennten Baseline-Ordnern:** `webgl2` (Merge-Gate, `?forceWebGL=1`) und `webgpu` (Nightly, `--enable-unsafe-webgpu --use-vulkan=swiftshader`). Nach `init()` schreibt jeder Job `backendName(renderer)` ins Testprotokoll. **Ein bestandener WebGL2-Lauf ist kein Beleg für den nativen WebGPU-Pfad** — beide Zeilen müssen im Release-Report stehen.

**Performance-Gates:**
- **Hart, maschinenunabhängig:** die Zähler aus 2.7 gegen `renderer.info` nach Level-Load.
- **Weich, nur Trend:** rAF-Sampler über 300 Frames mit p50/p95/p99; lokal p95 ≤ 12 ms, p99 ≤ 20 ms.
- **In CI stattdessen reine CPU-Sim-Zeit:** Median aus 5 Läufen von `__spiel.tick(2000)`, Budget ≤ 400 ms. GPU-entkoppelt, fängt algorithmische Regressionen zuverlässig.

### 10.5 Stufe 5 — Memory-Soak

20 Zyklen Level laden/entladen, dann CDP `HeapProfiler.enable` + `collectGarbage` + `Runtime.getHeapUsage`. Assertion: JS-Heap-Wachstum **< 5 MB** gegenüber Baseline nach Zyklus 2, und `renderer.info.memory.geometries`/`.textures` **exakt** zurück auf Baseline (Delta 0). Für detached Objekte `Runtime.queryObjects` auf den Prototype von `BufferGeometry`.

**Getestete Disposal-Kette (eine Funktion):**
```
await renderer.setAnimationLoop(null)
→ Effekt-Nodes disposen (bloom, ao, traa, ssr, godrays, volumetric)
→ scenePass.dispose(), prePass.dispose()
→ renderPipeline.dispose()
→ Geometrien + Materialien + Texturen + CanvasTexture-Pool + AudioNodes + alle addEventListener
→ renderer.dispose()
```

### 10.6 Audio-Verifikation

- vitest gegen `OfflineAudioContext`: RMS pro 10-ms-Fenster und FFT-Peak pro SFX gegen eingecheckte Referenzen (relative Fehlerschwelle 1e-4). Beispiel-Assertion: „Fehler-Sound hat Peak bei 440 ± 2 Hz und Schwebung 24–26 Hz."
- Playwright mit `ignoreDefaultArgs: ['--mute-audio']` und `args: ['--autoplay-policy=no-user-gesture-required']` (**beides zwingend**), AudioWorklet-Recorder, sample-weiser Vergleich.
- Budget-Test: während eines 60-s-Durchlaufs die aktiven Node-Zähler gegen die Obergrenzen aus 4.9 assertieren — das fängt Node-Leaks, die man akustisch erst nach Minuten hört.

### 10.7 CI-Layout

```
job einheit        → vitest run + property-based, kein Browser, < 60 s      [MERGE-BLOCKER]
job loesbarkeit    → Solver-Tests, timeout 120 s                            [MERGE-BLOCKER]
job e2e            → autoplay + a11y + determinismus, Playwright-Container  [MERGE-BLOCKER]
job visuell_perf   → Screenshots + Zähler-Budgets, workers: 1               [Zähler blocken]
job webgpu_nightly → nativer WebGPU-Pfad, eigene Baselines                  [nicht blockend]
```
Artefakte in allen Browser-Jobs mit `if: always()` und `actions/upload-artifact@v4` (`playwright-report/`, `test-results/`, `retention-days: 14`, `if-no-files-found: error`).

**Snapshot-Neuaufnahme (`-u`) ist niemals ein Reflex bei rotem Build.** Änderungen an Simulationsregeln laufen über das `version`-Feld der Replay-Logs und einen expliziten Review-Schritt, nie über ein blindes Update im selben Commit.

---

## 11. Top-20-Fallstricke

Sortiert nach Projektrisiko. Jeder hat eine Gegenmaßnahme, die in diesem Dokument steht.

| # | Fallstrick | Warum es das Projekt kostet | Gegenmaßnahme |
|---|---|---|---|
| **1** | **Metrik-Aggregation** — Qualität/Kosten/Latenz/Sicherheit/Nachvollziehbarkeit zu Score oder Sternen verrechnen | Die Pareto-Front kollabiert auf ein Optimum, der gesamte Zachlike-Reiz stirbt. Der einzige Fehler, der das Spiel als Genre-Vertreter unrettbar macht. | 3 Achsen + Gates (5.2), Code-Review-Regel |
| **2** | **Sim und Rendering vermischen** — `three`-Import in `src/sim`, `deltaTime` aus rAF, Animationen die Zustand zurückschreiben | Golden Master, Zeit-Rewind, GIF-Export, Histogramm-Vergleichbarkeit und Productive Failure brechen **gleichzeitig**. Fällt erst Wochen später als flackernder CI-Test auf. | E-05, Node↔Browser-Hash-Kreuzcheck (10.3) |
| **3** | **`await renderer.init()` vergessen** | Canvas bleibt komplett schwarz, **ohne jede Konsolenmeldung**. Nur `setAnimationLoop()` wartet intern. | E-01, `readPixels`-Assertion (10.3) |
| **4** | **`renderer.info.render.calls` statt `.drawCalls`** auf WebGPU | Budget-Check liefert still `undefined` und besteht **immer**. Zweiter Klassiker: `autoReset` auf true lassen bei multi-pass → man misst nur den letzten Pass. | 2.7 |
| **5** | **Temporale Effekte + Visual Regression ohne `temporal off`** | Alle Baselines diffen bei jedem Lauf, das Team schaltet VR genervt ab, die geforderte Verifikation ist faktisch weg. | W-2, `setzeTemporalModus('aus')` |
| **6** | **Fehlendes `--enable-unsafe-swiftshader`** | Kein WebGL-Kontext, schwarze Screenshots, alle Visual-Tests grün und nutzlos. Ebenso: Playwright ohne `channel: 'chromium'` startet `chrome-headless-shell` mit abweichendem Rendering. | 10.4 |
| **7** | **Iterationsreihenfolge von `Map`/`Set`** als impliziten Determinismus behandeln | Ein einziges `for (const m of this.module.values())` macht jeden Replay unreproduzierbar, sobald der Spieler dieselben Module in anderer Reihenfolge platziert hat. | E-06.4 |
| **8** | **Chocolate-covered broccoli** — Quizfragen zwischen Leveln, abtrennbarer „Lernmodus" | IT-Profis erkennen das schneller als jede andere Zielgruppe und stufen das Produkt als Compliance-Schulung ein. Sofortiger Vertrauensverlust. | 6.2, Intrinsic-Gate pro Level |
| **9** | **Productive Failure ohne Konsolidierung** | Frustration ohne Lerngewinn. Bei berufstätigen Erwachsenen führt das zum Abbruch, nicht zum erneuten Versuch. | 6.3, Phasen 2+3 nicht optional |
| **10** | **Strohmann-MONOLITH** — der Antagonist gewinnt nie | Die Zielgruppe durchschaut die Didaktik in zwei Akten. Und das Spiel lehrt ein neues Anti-Pattern: voreilige Zerlegung. Anthropics eigenes Prinzip lautet „Einfachheit vor Komplexität". | 7.8, Akt IV muss verloren werden |
| **11** | **Falsche Ökonomie der Simulation** — Kosten skalieren nicht mit Token, Retries gratis, Parallelisierung deckelt Latenz nicht, Evaluator ohne eigene Kosten/Fehlbarkeit | **Schlechter als kein Training**: Lernende optimieren mit hoher Konfidenz in die falsche Richtung und reproduzieren das im Kundenprojekt. | Abschnitt 7, jede Konstante mit Herleitung |
| **12** | **`EffectComposer`/pmndrs/`onBeforeCompile` mit WebGPURenderer** | Läuft nicht, kein Migrationspfad. GLSL-`ShaderMaterial` funktioniert auch auf dem WebGL2-**Fallback-Backend** nicht. Wer beides braucht, braucht zwei komplette Renderer-Adapter. | E-01, Dependency entfernen |
| **13** | **Texturspeicher-Explosion** — „ein Material pro Modultyp" | 40 Typen × 4 Maps × 1024² ≈ 850 MiB. Prozedurale Texturen fühlen sich gratis an, kosten aber exakt so viel VRAM wie heruntergeladene. Tab-Absturz auf 8-GB-MacBook. | 3.3, 10 Master + Instanz-Attribute |
| **14** | **Draw-Call-Explosion** — ein Modul = ein Mesh, ein Token = ein Mesh, ein Kabel = ein Objekt | Skaliert bis Akt III problemlos und fällt in Akt VIII (mehrere hundert Module, > 1000 Pakete) auf 20 fps. Der Umbau ist dann ein Renderer-Rewrite. | 2.6, BatchedMesh von Anfang an |
| **15** | **Musik-Scheduling über rAF/`setInterval` ohne Zeitargument** | Bei Renderlast driftet und stottert das Timing sofort hörbar; bei Tab-Blur bleibt die Musik hängen. Der eine Fehler, der ein gutes Audiosystem als „billig" entlarvt. | 4.2 |
| **16** | **Ein ConvolverNode pro Quelle** statt globalem Send-Bus | Eine 4,2-s-IR ist der teuerste Node im Graph. 20 davon sprengen das 2,67-ms-Quantum-Budget und erzeugen Knackser, die nur unter Last auftreten. | 4.4 |
| **17** | **Ctrl als Drag-Modifier / Rechtsklick als Voraussetzung** | macOS übersetzt Ctrl+Klick systemseitig in Rechtsklick; der Drag beginnt gar nicht. Auf einem MacBook ohne Maus ist Orbit dann unerreichbar. | 9.1, 9.2 |
| **18** | **Telemetrie ohne Betriebsvereinbarung** | § 87 Abs. 1 Nr. 6 BetrVG greift bereits bei der bloßen **Eignung** zur Leistungskontrolle. Der Betriebsrat blockiert den Rollout, und die Telemetrie-Architektur muss neu gebaut werden. Zusätzlich: Affekterkennung ist seit 02.02.2025 EU-weit am Arbeitsplatz verboten. | E-08 |
| **19** | **Test-Hooks im Production-Bundle** | `window.__spiel` erlaubt in der ausgelieferten Version das Manipulieren von Metriken und untergräbt die Lernwirkung. Fällt ohne Build-Assertion erst nach dem Deployment auf. | 10.3 |
| **20** | **Retries auf 2 stellen, um eine „flaky" Suite grün zu bekommen** | Bei einem deterministischen Spiel ist **jeder** Flake ein echter Nichtdeterminismus-Bug. Retries verstecken genau die Klasse Fehler, die später im Unternehmenskontext als „Simulation liefert unterschiedliche Ergebnisse" zurückkommt. | 10.4, `retries: 1`, Determinismus-Job ohne Retry |

*Ehrenvolle Erwähnungen, die knapp nicht in die Top 20 kamen, aber im Code-Review geprüft werden:* `RectAreaLightUniformsLib.init()` auf dem WebGPU-Pfad (Lichter bleiben still schwarz) · `curve.getPoint(t)` statt `getPointAt(t)` (Token beschleunigen in Kurven und widersprechen den angezeigten Latenzen) · `material.toneMapped = false` (unter WebGPU ignoriert) · `aoMap` ohne `uv1`/`channel = 0` (schwarze AO, tagelange Fehlersuche im Bake-Code) · `maxDiffPixelRatio: 0` (Dauerflakes) und die Gegenrichtung 0.05 (ein ganzes Modul verschwindet ungestraft) · Frame-Zeit-Budgets als hartes CI-Gate auf SwiftShader (Faktor-3-Schwankung) · Content-Klippe nach 3–4 h (trifft exakt das Novelty-Tal).

---

## 12. Priorisierte Umsetzungsreihenfolge

Jede Phase hat ein hartes Ausstiegskriterium. Ohne erfülltes Kriterium wird die nächste Phase nicht begonnen.

### M0 — Fundament (Woche 1–2)
1. `package.json` bereinigen: `postprocessing` **entfernen**, `vitest` auf 4.x, `fast-check` 4.x, `@axe-core/playwright`, `@types/three` auf `0.185.x` pinnen.
2. ESLint-Regeln: `no-restricted-imports`/`no-restricted-globals`/`no-restricted-properties` für `src/sim/**`; TSL-Regeln; Verbot von `wgslFn`/`glslFn`/`onBeforeCompile`.
3. `src/sim/kurven.ts` generieren (LUTs), `q()`-Quantisierung einziehen, `balance.ts` um Cache/Batch/Eifer/CB/HAND-Schwellen/Werkzeug-Fixkosten erweitern.
4. `zustandsHash()` + `pruefsumme` implementieren.
5. CI-Skelett mit vier Jobs, Playwright-Container.

**Ausstieg:** `job einheit` grün mit Determinismus-Wächter und Golden Master für **ein** handgebautes Level; Node↔Browser-Kreuzcheck vorbereitet.

### M1 — Renderer-Spike (Woche 2–3, parallel)
1. `WebGPURenderer` + `await init()` + Backend-Erkennung + `?forceWebGL=1`.
2. `RenderPipeline` mit **minimalem** Graph: `prePass` (MRT) → `scenePass` → `traa` → out.
3. **Verifikationsspike:** Dissolve/Alpha-Schatten in TSL (`opacityNode`/`alphaTestNode`/`castShadowNode`) gegen r185 prüfen — dies ist der einzige API-Punkt in dieser Bibel, der nicht gegen Quelltext verifiziert ist.
4. `renderer.info.render.drawCalls`-Budget-Assertion.
5. Erster Screenshot-Baseline-Lauf im Container, beide Backend-Projekte.

**Ausstieg:** identisches Bild in `webgl2`- und `webgpu`-Projekt bis auf Toleranz; `readPixels`-Assertion grün; ein Level-Screenshot dreimal identisch.

### M2 — Simulation vollständig + Zeit-Debugger (Woche 3–6)
1. Tick-Engine (fixed timestep, Akkumulator), alle 15 `ModulArt`-Werte, Cache-Prefix-Kette, Lethal-Trifecta-Prädikat.
2. **Zeit-Debugger als erstes UI-Feature, vor aller Grafik**: Keyframe-Snapshot alle 60 Ticks in typisierten SoA-Arrays, dazwischen deterministische Re-Simulation, Ringpuffer 600 Ticks, < 6 MB. Bindings aus 9.4.
3. Fehlermeldungsformat `Tick <n>: <MODUL-ID> <Ereignis> — <Istwert> gegen <Schwelle>`.
4. Property-Tests, Solvability-Matrix-Gerüst.

**Ausstieg:** `job loesbarkeit` grün für 4 Level (Akt I); Zeit vom Klick auf „Starten" bis zum verständlichen Fehlerbild < 1,5 s bei 12×.

### M3 — Bau-UX + Steuerung (Woche 6–9)
Zeigerquelle, HallenKamera, Ghost-Platzierung, A*-Kabelrouting, Auswahl/Undo (Command-Pattern ≥ 200), Baugruppen, vollständiges Keymap aus einer Tabelle, Kontextleiste, DOM-Schattenbaum, `aria-live`.

**Ausstieg:** vollständiger Level-Durchlauf **ausschließlich per Tastatur** grün; axe ohne Violations; Zeit bis zur ersten Platzierung < 25 s im Autoplay gemessen.

### M4 — Prozedurale Assets + volles Rendering (Woche 9–14)
`gen/tex`, `gen/geo`, `gen/env`, 10 Master-Materialien, BatchedMesh/InstancedMesh, voller Post-Graph mit allen drei Qualitätsstufen, IBL, Schatten, Volumetrik, `compileAsync`-Warmup, dynamisches Resolution-Scaling, Disposal-Kette.

**Ausstieg:** alle Budgets aus 2.7 grün; A/B-Capture zum Tone Mapping durchgeführt und im Render-Contract dokumentiert; Memory-Soak < 5 MB Wachstum; Referenz-Screenshot-Vergleich gegen `webgpu_volume_lighting` und `webgpu_postprocessing_ao` bestanden.

### M5 — Audio (Woche 12–16, parallel)
`context.ts`, `bank.ts` (60–80 SFX prerendered), `musik.ts` (6 Layer, 5 Achsen), `raum.ts`, prozedurale Vokalisation.

**Ausstieg:** Audio-Budget-Test über 60 s grün (keine Node-Leaks); OfflineAudioContext-Referenzen eingecheckt.

### M6 — Inhalt Akt I–VI (Woche 14–22)
24 Level nach Teach-Test-Twist-Trade, Referenzlösungen + Anti-Muster + zweite gültige Architektur je Level, Referenzverteilungen offline generiert, Betriebshandbuch, Debrief-Mechanik, Vorwissens-Sonde, Fundstücke.

**Ausstieg:** Erster externer Playtest mit 6 Personen (2 je Vorwissensband). Kennzahl: kein Level mit `buildDurationMs` P90 > 20 min; keine Abbrüche in Akt I bei Spielern mit hohem Einstufungsscore.

### M7 — Inhalt Akt VII–XII + Evolution (Woche 22–32)
24 Level, Schmiede im Worker (Transferable ArrayBuffers, **kein** SharedArrayBuffer — vermeidet COOP/COEP-Header-Zwang), MAP-Elites-Regal, Stammbaum, Stealth Assessment, Werk-Export (WebCodecs), Praxis-Kontrakte, Workshop-Modus, „Ablage".

**Ausstieg:** Kampagne komplett durchspielbar; `job loesbarkeit` über alle 48 Level < 5 s Laufzeit; alle Autonomie-Assertions grün.

### M8 — Härtung und Auslieferung (Woche 32–36)
Visual-Baselines final, WebGPU-Nightly stabil, Open Badges, cmi5-Paket, Muster-Betriebsvereinbarung, Datenfeldkatalog, Moderations-Leitfaden, Barrierefreiheits-Vollprüfung (BFSG/BITV 2.0/EN 301 549/WCAG 2.1 AA), Release-Report mit **beiden** Backend-Zeilen.

**Ausstieg:** Alle vier CI-Jobs grün auf `main` an drei aufeinanderfolgenden Tagen ohne Retry; Prod-Bundle enthält `'__spiel'` nicht; Release-Report unterschrieben.

---

### Anhang: offene Verifikationspunkte

Drei Punkte in diesem Dokument sind aus den Berichten übernommen, aber **nicht** gegen r185-Quelltext verifiziert und müssen in M1 geprüft werden:

1. **Dissolve/Alpha-Schatten in TSL** — die exakte Node-Property für materialspezifische Schattendarstellung (`castShadowNode` vs. Alpha-Kette).
2. **`outputBufferType: THREE.HalfFloatType`** als `WebGPURenderer`-Konstruktorparameter.
3. **`mrt()` mit einem dritten `metalrough`-Kanal** in Kombination mit `builtinAOContext` — die AO-Beispiele nutzen zwei Kanäle, das SSR-Beispiel einen anderen Satz.

Rechtsbezüge im Spieltext (Vergabe-Schwellenwerte, AI-Act-Stichtage, EVB-IT-Versionsstände) werden **nicht beziffert** („sechsstellig", „seit vorletztem Jahr") und Normbezeichnungen nur in stabiler Form genannt (§ 87 Abs. 1 Nr. 6 BetrVG, DSGVO Art. 22/28/30/35, EU AI Act Art. 4). Verbleibende Zahlen laufen vor Release durch eine externe Quellenprüfung — ein Lernspiel eines IT-Dienstleisters, das eine falsche Schwelle als Fakt präsentiert, verliert bei genau der Person Glaubwürdigkeit, die es überzeugen muss.