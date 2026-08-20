/**
 * Materialbibliothek fuer SCHWARMWERK.
 *
 * Es gibt genau zehn Master-Materialien — eines je `MaterialArt` — und
 * daneben eine Handvoll Sondermaterialien fuer Module, Energieleitungen,
 * Pakete und die Bauvorschau. Alle Modulvarianten entstehen ueber
 * Instanz-Attribute und Uniforms, NIEMALS ueber zusaetzliche Texturen: ein
 * Satz aus Albedo, Normale und ORM kostet bei 512er Kanten rund 4 MiB, bei
 * 1024er rund 16 MiB. Zehn Master bleiben damit im Budget, "ein Material je
 * Modultyp" waere es nicht.
 *
 * ## TSL, nicht GLSL
 * Der Renderer ist `THREE.WebGPURenderer` aus `three/webgpu` (mit WebGL2 als
 * Fallback-Backend derselben Klasse). Auf diesem Pfad sind `onBeforeCompile`,
 * GLSL-`ShaderMaterial`, `wgslFn` und `glslFn` nicht lauffaehig. Jeder Effekt
 * hier ist deshalb ein Node-Graph aus `three/tsl`.
 *
 * ## Emissive-Band
 * `emissiveNode` bleibt in JEDEM Material im Band 0.05 bis 0.35. Der
 * Post-Graph faehrt Bloom mit Staerke 0.8–1.6 und AgX-Tonemapping bei
 * Exposure 1.0–1.2; hoehere Werte brennen das Bild aus. Das ist im
 * Renderer-Spike vom 19.08.2026 belegt (Stufe 5 mit `emissive * 1.2` war
 * vollstaendig ueberstrahlt). `EMISSIV_TIEF` und `EMISSIV_HOCH` halten die
 * Grenze an einer Stelle fest.
 *
 * ## Zeit
 * Kein Material liest `time`. Alles Animierte haengt an Uniforms, die der
 * Renderer je Bild setzt — nur so sind die Bilder der Visual-Regression
 * reproduzierbar (Rendermodus `TEST_OFF` friert die Uniforms schlicht ein).
 */

import * as THREE from 'three/webgpu';
import {
  attribute,
  color,
  float,
  fract,
  mix,
  normalMap,
  normalView,
  positionViewDirection,
  positionWorld,
  smoothstep,
  texture,
  uniform,
  uv,
  vec2,
  vec3,
} from 'three/tsl';

import type { ModulArt } from '../sim/typen';
import { KATALOG } from '../sim/katalog';
import { erzeugeTexturSatz, entsorgeAlleTexturen, type MaterialArt } from './texturen';

// ---------------------------------------------------------------------------
// Konstanten
// ---------------------------------------------------------------------------

/** Untergrenze des im Spike belegten Emissive-Bandes. */
export const EMISSIV_TIEF = 0.05;
/** Obergrenze des im Spike belegten Emissive-Bandes. Darueber brennt Bloom aus. */
export const EMISSIV_HOCH = 0.35;

/** Kantenlaenge aller Master-Texturen. */
const TEXTURGROESSE = 512;

/**
 * Name des Instanz-Attributs, das der Renderer auf der Paket-Geometrie als
 * `THREE.InstancedBufferAttribute` mit drei Komponenten anlegen muss.
 */
export const PAKET_FARB_ATTRIBUT = 'paketFarbe';

// ---------------------------------------------------------------------------
// Master-Materialien
// ---------------------------------------------------------------------------

interface MasterEinstellung {
  /** Saat des Texturs&auml;tzes — je Art eine eigene, damit sich nichts wiederholt. */
  readonly saat: number;
  /** Wie oft sich die Kachel ueber die Standard-UV wiederholt. */
  readonly kachel: number;
  /** Faktor auf den Rauheitskanal — feinjustiert den Glanz je Einsatzort. */
  readonly rauheit: number;
  /** Faktor auf den Metallkanal. */
  readonly metall: number;
  /** Staerke der Normal-Map. */
  readonly normale: number;
  /** Wie stark die gebackene Verdeckung ins indirekte Licht eingreift. */
  readonly verdeckung: number;
  /** Multiplikative Toenung der Albedo (Art Direction der Halle). */
  readonly tonung: number;
}

const MASTER: Record<MaterialArt, MasterEinstellung> = {
  // Waende und Stuetzen der Halle — grosse Flaechen, also kraeftig gekachelt.
  beton: { saat: 0x1957_01, kachel: 6, rauheit: 1.0, metall: 1, normale: 1.0, verdeckung: 1.0, tonung: 0xffffff },
  ziegel: { saat: 0x1957_02, kachel: 4, rauheit: 1.0, metall: 1, normale: 1.15, verdeckung: 1.0, tonung: 0xf2eee8 },
  bodengitter: { saat: 0x1957_03, kachel: 8, rauheit: 1.0, metall: 1, normale: 1.0, verdeckung: 1.0, tonung: 0xffffff },
  // Technik.
  stahl_gebuerstet: { saat: 0x1957_04, kachel: 2, rauheit: 1.0, metall: 1, normale: 0.85, verdeckung: 0.7, tonung: 0xe8eef5 },
  stahl_lackiert: { saat: 0x1957_05, kachel: 2, rauheit: 1.0, metall: 1, normale: 0.9, verdeckung: 0.8, tonung: 0xffffff },
  messing: { saat: 0x1957_06, kachel: 1, rauheit: 1.0, metall: 1, normale: 0.7, verdeckung: 0.7, tonung: 0xffffff },
  glas: { saat: 0x1957_07, kachel: 1, rauheit: 1.0, metall: 1, normale: 0.5, verdeckung: 0.4, tonung: 0xffffff },
  gummi: { saat: 0x1957_08, kachel: 3, rauheit: 1.0, metall: 1, normale: 1.0, verdeckung: 1.0, tonung: 0xffffff },
  leiterplatte: { saat: 0x1957_09, kachel: 1, rauheit: 1.0, metall: 1, normale: 1.0, verdeckung: 0.9, tonung: 0xffffff },
  emaille: { saat: 0x1957_0a, kachel: 1, rauheit: 1.0, metall: 1, normale: 0.8, verdeckung: 0.6, tonung: 0xffffff },
};

const masterCache = new Map<MaterialArt, THREE.MeshStandardNodeMaterial>();

/**
 * Baut den gemeinsamen Teil eines Master-Materials: Albedo, Normale und die
 * drei aus dem gepackten ORM gezogenen Kanaele.
 */
function bestueckeAusTexturen(
  material: THREE.MeshStandardNodeMaterial,
  art: MaterialArt,
  e: MasterEinstellung
): void {
  const satz = erzeugeTexturSatz(art, e.saat, TEXTURGROESSE);
  // Die Kachelung steckt im Node-Graphen, nicht in `texture.repeat`: so bleibt
  // die Texturinstanz teilbar, falls ein zweites Material sie mitbenutzt.
  const uvK = uv().mul(e.kachel);

  material.colorNode = texture(satz.albedo, uvK).rgb.mul(color(e.tonung));
  material.normalNode = normalMap(texture(satz.normal, uvK), vec2(e.normale, e.normale));

  const orm = texture(satz.orm, uvK);
  material.roughnessNode = orm.r.mul(e.rauheit).clamp(0.02, 1);
  material.metalnessNode = orm.g.mul(e.metall).clamp(0, 1);
  material.aoNode = mix(float(1), orm.b, e.verdeckung);
}

/**
 * Liefert eines der zehn Master-Materialien. Das Ergebnis ist gecacht — es
 * gibt je Art genau eine Instanz und genau einen Texturs&auml;tz.
 */
export function holeMaterial(art: MaterialArt): THREE.MeshStandardNodeMaterial {
  const vorhanden = masterCache.get(art);
  if (vorhanden !== undefined) return vorhanden;

  const e = MASTER[art];
  // Glas braucht Transmission. `MeshPhysicalNodeMaterial` erweitert
  // `MeshStandardNodeMaterial`, der zugesagte Rueckgabetyp bleibt also gueltig.
  const material: THREE.MeshStandardNodeMaterial =
    art === 'glas' ? new THREE.MeshPhysicalNodeMaterial() : new THREE.MeshStandardNodeMaterial();
  material.name = 'master_' + art;
  bestueckeAusTexturen(material, art, e);

  if (art === 'glas' && material instanceof THREE.MeshPhysicalNodeMaterial) {
    material.transmission = 0.92;
    material.thickness = 0.012;
    material.ior = 1.52;
    material.attenuationDistance = 0.5;
    material.attenuationColor = new THREE.Color(0xdfeee6);
  }

  const satz = erzeugeTexturSatz(art, e.saat, TEXTURGROESSE);
  if (satz.emission !== undefined) {
    // Die Leuchtdioden der Leiterplatte — dezent, sonst blueht die Platine.
    material.emissiveNode = texture(satz.emission, uv().mul(e.kachel)).rgb.mul(EMISSIV_HOCH * 0.8);
  }

  masterCache.set(art, material);
  return material;
}

// ---------------------------------------------------------------------------
// Modulgehaeuse
// ---------------------------------------------------------------------------

/** Fresnel-Rand: 0 in der Flaechenmitte, 1 an der Silhouette. */
function randLeuchten(): ReturnType<typeof float> {
  return normalView.dot(positionViewDirection).abs().oneMinus().pow(3);
}

const modulCache = new Map<ModulArt, THREE.MeshStandardNodeMaterial>();

/**
 * Das Material eines Modulgehaeuses: lackierter Stahl mit einem
 * Leuchtstreifen und einem Fresnel-Rand im Farbleitwert des Moduls.
 *
 * Der Streifen sitzt bei `uv().y ≈ 0.5`; die Gehaeusegeometrie legt ihre
 * Frontplatte so aus, dass das Band dort ueber die Blende laeuft.
 */
export function modulMaterial(art: ModulArt): THREE.MeshStandardNodeMaterial {
  const vorhanden = modulCache.get(art);
  if (vorhanden !== undefined) return vorhanden;

  const leitwert = KATALOG[art].farbe;
  const e = MASTER.stahl_lackiert;
  const material = new THREE.MeshStandardNodeMaterial();
  material.name = 'modul_' + art;
  bestueckeAusTexturen(material, 'stahl_lackiert', e);

  // Das Gehaeuse bleibt dunkel; der Farbleitwert kommt nur als Hauch dazu,
  // damit sich zwoelf Modularten im Halbdunkel unterscheiden lassen.
  const albedo = texture(erzeugeTexturSatz('stahl_lackiert', e.saat, TEXTURGROESSE).albedo, uv().mul(e.kachel)).rgb;
  material.colorNode = mix(albedo, albedo.mul(color(leitwert)), 0.45);

  // Leuchtband quer ueber die Blende.
  const band = smoothstep(0.455, 0.478, uv().y).sub(smoothstep(0.522, 0.545, uv().y)).saturate();
  material.emissiveNode = color(leitwert).mul(
    band.mul(0.17).add(randLeuchten().mul(0.13)).add(EMISSIV_TIEF).clamp(0, EMISSIV_HOCH)
  );

  modulCache.set(art, material);
  return material;
}

// ---------------------------------------------------------------------------
// Energieleitung
// ---------------------------------------------------------------------------

export interface LeitungsMaterial {
  readonly material: THREE.MeshStandardNodeMaterial;
  /**
   * Laufender Versatz des Energiemusters. Der Renderer erhoeht ihn je Bild um
   * `geschwindigkeit * dt`; nur der Nachkommaanteil zaehlt.
   */
  readonly fluss: { value: number };
  /** 0 = Leitung liegt tot, 1 = es fliesst ein Auftrag. Weich ueberblenden. */
  readonly aktiv: { value: number };
}

/**
 * Energieleitung mit fliessendem Muster.
 *
 * Die Leitung ist ein `TubeGeometry`; `uv().x` laeuft entlang der Roehre. Das
 * Muster ist eine schmale Pulswelle, die per Uniform verschoben wird — kein
 * `time`, damit die Visual-Regression reproduzierbar bleibt.
 */
export function leitungsMaterial(): LeitungsMaterial {
  const fluss = uniform(0);
  const aktiv = uniform(0);

  const material = new THREE.MeshStandardNodeMaterial();
  material.name = 'leitung';

  // Dunkler Mantel mit der Mikrostruktur des Gummis.
  const gummi = MASTER.gummi;
  const satz = erzeugeTexturSatz('gummi', gummi.saat, TEXTURGROESSE);
  const uvMantel = uv().mul(vec2(6, 2));
  material.colorNode = texture(satz.albedo, uvMantel).rgb.mul(color(0x9fb2c4));
  material.normalNode = normalMap(texture(satz.normal, uvMantel), vec2(0.6, 0.6));
  material.roughnessNode = texture(satz.orm, uvMantel).r.mul(0.85).clamp(0.15, 1);
  material.metalnessNode = float(0.12);

  // Sechs Pulse je Leitungslaenge, um `fluss` verschoben.
  const wandern = fract(uv().x.mul(6).sub(fluss));
  const puls = smoothstep(0.11, 0.0, wandern.sub(0.5).abs());
  // Ein schwacher Nachlauf gibt dem Puls Richtung.
  const schweif = smoothstep(0.34, 0.0, wandern.sub(0.5).abs()).mul(0.35);

  material.emissiveNode = color(0x66e0ff).mul(
    float(EMISSIV_TIEF)
      .add(aktiv.mul(0.035))
      .add(puls.add(schweif).mul(aktiv).mul(0.22))
      .clamp(0, EMISSIV_HOCH)
  );

  return { material, fluss, aktiv };
}

// ---------------------------------------------------------------------------
// Pakete
// ---------------------------------------------------------------------------

let paketZwischenspeicher: THREE.MeshStandardNodeMaterial | null = null;

/**
 * Leuchtendes Auftragspaket fuer eine `InstancedMesh`.
 *
 * Die Geometrie muss ein `THREE.InstancedBufferAttribute` namens
 * `PAKET_FARB_ATTRIBUT` mit drei Komponenten (linearer RGB) tragen. Ueber das
 * Attribut faerbt der Renderer Domaene, Alarmzustand und Guete ein, ohne je
 * ein zweites Material zu bauen.
 */
export function paketMaterial(): THREE.MeshStandardNodeMaterial {
  if (paketZwischenspeicher !== null) return paketZwischenspeicher;

  const material = new THREE.MeshStandardNodeMaterial();
  material.name = 'paket';

  const farbe = attribute(PAKET_FARB_ATTRIBUT, 'vec3');
  const rand = randLeuchten();

  // Der Koerper ist dunkel; was man sieht, ist fast nur das Eigenleuchten.
  material.colorNode = farbe.mul(0.16);
  material.roughnessNode = float(0.22);
  material.metalnessNode = float(0);
  // Kern gleichmaessig, Silhouette heller — das laesst das Paket schweben.
  material.emissiveNode = farbe.mul(
    float(0.11).add(rand.mul(0.21)).clamp(EMISSIV_TIEF, EMISSIV_HOCH)
  );

  paketZwischenspeicher = material;
  return material;
}

// ---------------------------------------------------------------------------
// Bauvorschau (Hologramm)
// ---------------------------------------------------------------------------

const geistCache = new Map<boolean, THREE.MeshStandardNodeMaterial>();

/**
 * Halbtransparente Vorschau beim Platzieren eines Moduls: Fresnel-Rand,
 * waagerechte Scanlinien und ein leichtes Grundleuchten.
 *
 * @param gueltig `true` = Platz ist frei (Cyan), `false` = belegt (Rot).
 */
export function geistMaterial(gueltig: boolean): THREE.MeshStandardNodeMaterial {
  const vorhanden = geistCache.get(gueltig);
  if (vorhanden !== undefined) return vorhanden;

  const grundfarbe = gueltig ? 0x66e0ff : 0xff5c5c;
  const material = new THREE.MeshStandardNodeMaterial();
  material.name = gueltig ? 'geist_gueltig' : 'geist_gesperrt';
  material.transparent = true;
  material.depthWrite = false;
  material.side = THREE.DoubleSide;

  const rand = randLeuchten();
  // Scanlinien in Weltkoordinaten: sie stehen still, waehrend das Modul
  // einrastet — das liest sich als Projektion, nicht als Bemalung.
  const scan = positionWorld.y.mul(46).sin().mul(0.5).add(0.5);
  const linien = mix(float(0.30), float(1.0), scan);

  material.colorNode = color(grundfarbe).mul(0.22);
  material.roughnessNode = float(0.4);
  material.metalnessNode = float(0);
  material.emissiveNode = color(grundfarbe).mul(
    float(0.07).add(rand.mul(0.17)).add(scan.mul(0.07)).clamp(EMISSIV_TIEF, EMISSIV_HOCH)
  );
  material.opacityNode = rand.mul(0.5).add(linien.mul(0.17)).add(0.08).clamp(0, 0.85);

  geistCache.set(gueltig, material);
  return material;
}

// ---------------------------------------------------------------------------
// Aufraeumen
// ---------------------------------------------------------------------------

/**
 * Entsorgt alle Materialien und die von ihnen gehaltenen Texturs&auml;tze.
 *
 * Die Master-Materialien sind die einzigen Nutzer des Texturcaches; sie
 * gemeinsam freizugeben ist deshalb der einzige leckfreie Weg. Nach dem Aufruf
 * bauen `holeMaterial()` und Verwandte alles neu und byteweise identisch auf.
 */
export function entsorgeAlleMaterialien(): void {
  for (const m of masterCache.values()) m.dispose();
  masterCache.clear();
  for (const m of modulCache.values()) m.dispose();
  modulCache.clear();
  for (const m of geistCache.values()) m.dispose();
  geistCache.clear();
  if (paketZwischenspeicher !== null) {
    paketZwischenspeicher.dispose();
    paketZwischenspeicher = null;
  }
  entsorgeAlleTexturen();
}
