/**
 * Materialbibliothek für SCHWARMWERK.
 *
 * Es gibt genau zehn Master-Materialien — eines je `MaterialArt` — und
 * daneben eine Handvoll Sondermaterialien für Module, Energieleitungen,
 * Pakete und die Bauvorschau. Alle Modulvarianten entstehen über
 * Instanz-Attribute und Uniforms, NIEMALS über zusätzliche Texturen: ein
 * Satz aus Albedo, Normale und ORM kostet bei 512er Kanten rund 4 MiB, bei
 * 1024er rund 16 MiB. Zehn Master bleiben damit im Budget, "ein Material je
 * Modultyp" wäre es nicht.
 *
 * ## TSL, nicht GLSL
 * Der Renderer ist `THREE.WebGPURenderer` aus `three/webgpu` (mit WebGL2 als
 * Fallback-Backend derselben Klasse). Auf diesem Pfad sind `onBeforeCompile`,
 * GLSL-`ShaderMaterial`, `wgslFn` und `glslFn` nicht lauffähig. Jeder Effekt
 * hier ist deshalb ein Node-Graph aus `three/tsl`.
 *
 * ## Emissive-Band
 * `emissiveNode` bleibt in JEDEM Material im Band 0.05 bis 0.35. Der
 * Post-Graph fährt Bloom mit Stärke 0.8–1.6 und AgX-Tonemapping bei
 * Exposure 1.0–1.2; höhere Werte brennen das Bild aus. Das ist im
 * Renderer-Spike vom 19.08.2026 belegt (Stufe 5 mit `emissive * 1.2` war
 * vollständig überstrahlt). `EMISSIV_TIEF` und `EMISSIV_HOCH` halten die
 * Grenze an einer Stelle fest.
 *
 * ## Zeit
 * Kein Material liest `time`. Alles Animierte hängt an Uniforms, die der
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
} from 'three/tsl';

import type { ModulArt } from '../sim/typen';
import { KATALOG } from '../sim/katalog';
import { erzeugeTexturSatz, entsorgeAlleTexturen, type MaterialArt } from './texturen';

// ---------------------------------------------------------------------------
// Konstanten
// ---------------------------------------------------------------------------

/**
 * Untergrenze des im Spike belegten Emissive-Bandes. Sie gilt für das
 * LEUCHTENDE MERKMAL (Band, Puls, Paketkern) — ein aktives Leuchtelement
 * darunter ist im Nebel der Halle nicht mehr zu erkennen.
 */
export const EMISSIV_TIEF = 0.05;

/** Obergrenze des Bandes. Darüber brennt Bloom das Bild aus (Spike, Stufe 5). */
export const EMISSIV_HOCH = 0.35;

/**
 * Ruhewert für große, gerade NICHT arbeitende Flächen.
 *
 * Bewusst unterhalb von `EMISSIV_TIEF`: linear 0.05 über ein ganzes Gehäuse
 * gelegt ergibt nach AgX bei Exposure 1.1 bereits rund 25 % Anzeigehelligkeit —
 * die Module leuchten dann wie lackiertes Plastik statt wie dunkler Stahl mit
 * einer Leuchtblende. Das Band 0.05–0.35 begrenzt das Merkmal, nicht den
 * Untergrund. Nachgewiesen an einer Testszene mit AgX, Exposure 1.1 und
 * Bloom 1.2.
 */
export const EMISSIV_RUHE = 0.012;

/** Kantenlänge aller Master-Texturen. */
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
  /** Saat des Textursatzes — je Art eine eigene, damit sich nichts wiederholt. */
  readonly saat: number;
  /**
   * Wiederholungen je UV-Einheit.
   *
   * Fuer die Master-Materialien ist die UV-Einheit EIN METER: die Weltgeometrie
   * (Boden, Wand, Verkleidung) legt ihre UVs in Metern an, `holeMaterial()`
   * skaliert sie dann auf die physikalische Kachelgröße des Materials.
   * `kachelung = 0.5` heißt also "die Kachel ist zwei Meter breit".
   *
   * `modulMaterial()` weicht bewusst davon ab: Modulgehäuse tragen normierte
   * UVs von 0 bis 1, weil das Leuchtband bei v ≈ 0.5 sitzen muss. Dort zählt
   * der Wert als Wiederholungen je Gehäuseseite.
   */
  readonly kachelung: number;
  /** Faktor auf den Rauheitskanal — feinjustiert den Glanz je Einsatzort. */
  readonly rauheit: number;
  /** Faktor auf den Metallkanal. */
  readonly metall: number;
  /** Stärke der Normal-Map. */
  readonly normale: number;
  /** Wie stark die gebackene Verdeckung ins indirekte Licht eingreift. */
  readonly verdeckung: number;
  /** Multiplikative Tönung der Albedo (Art Direction der Halle). */
  readonly tonung: number;
}

/**
 * Die zehn Master. `kachelung` ist der Kehrwert der physikalischen
 * Kachelgröße — die Kommentare nennen sie in Metern, damit beim Nachjustieren
 * niemand raten muss.
 */
const MASTER: Record<MaterialArt, MasterEinstellung> = {
  // Hallenhülle: große Flächen, Kachel in Bauteilgröße.
  beton: { saat: 0x1957_01, kachelung: 0.5, rauheit: 1.0, metall: 1, normale: 1.0, verdeckung: 1.0, tonung: 0xffffff }, // 2,0 m Schaltafel
  ziegel: { saat: 0x1957_02, kachelung: 1.0, rauheit: 1.0, metall: 1, normale: 1.15, verdeckung: 1.0, tonung: 0xf2eee8 }, // 1,0 m: 4 Steine x 12 Schichten
  bodengitter: { saat: 0x1957_03, kachelung: 2.0, rauheit: 1.0, metall: 1, normale: 1.0, verdeckung: 1.0, tonung: 0xffffff }, // 0,5 m: 14 Tragstäbe
  // Technik und Beschlag.
  stahl_gebuerstet: { saat: 0x1957_04, kachelung: 2.0, rauheit: 1.0, metall: 1, normale: 0.85, verdeckung: 0.7, tonung: 0xe8eef5 }, // 0,5 m Blechtafel
  stahl_lackiert: { saat: 0x1957_05, kachelung: 1.6, rauheit: 1.0, metall: 1, normale: 0.9, verdeckung: 0.8, tonung: 0xffffff }, // 0,63 m Gehäuseblech
  messing: { saat: 0x1957_06, kachelung: 3.2, rauheit: 1.0, metall: 1, normale: 0.7, verdeckung: 0.7, tonung: 0xffffff }, // 0,31 m Schild
  glas: { saat: 0x1957_07, kachelung: 1.0, rauheit: 1.0, metall: 1, normale: 0.5, verdeckung: 0.4, tonung: 0xffffff }, // 1,0 m Scheibe
  gummi: { saat: 0x1957_08, kachelung: 4.0, rauheit: 1.0, metall: 1, normale: 1.0, verdeckung: 1.0, tonung: 0xffffff }, // 0,25 m Noppenmatte
  leiterplatte: { saat: 0x1957_09, kachelung: 5.5, rauheit: 1.0, metall: 1, normale: 1.0, verdeckung: 0.9, tonung: 0xffffff }, // 0,18 m: 18 Zellen à 1 cm
  emaille: { saat: 0x1957_0a, kachelung: 2.5, rauheit: 1.0, metall: 1, normale: 0.8, verdeckung: 0.6, tonung: 0xffffff }, // 0,4 m Emailletafel
};

/**
 * Kachelung des Gehäuseblechs auf einem Modulgehäuse. Modulgehäuse tragen
 * normierte UVs, hier zählt der Wert deshalb je Gehäuseseite.
 */
const MODUL_KACHELUNG = 1.7;

const masterCache = new Map<MaterialArt, THREE.MeshStandardNodeMaterial>();

/**
 * Baut den gemeinsamen Teil eines Master-Materials: Albedo, Normale und die
 * drei aus dem gepackten ORM gezogenen Kanäle.
 */
function bestueckeAusTexturen(
  material: THREE.MeshStandardNodeMaterial,
  art: MaterialArt,
  e: MasterEinstellung
): void {
  const satz = erzeugeTexturSatz(art, e.saat, TEXTURGROESSE);
  // Die Kachelung steckt im Node-Graphen, nicht in `texture.repeat`: so bleibt
  // die Texturinstanz teilbar, falls ein zweites Material sie mitbenutzt.
  const uvK = uv().mul(e.kachelung);

  material.colorNode = texture(satz.albedo, uvK).rgb.mul(color(e.tonung));
  material.normalNode = normalMap(texture(satz.normal, uvK), vec2(e.normale, e.normale));

  const orm = texture(satz.orm, uvK);
  material.roughnessNode = orm.r.mul(e.rauheit).clamp(0.02, 1);
  material.metalnessNode = orm.g.mul(e.metall).clamp(0, 1);
  material.aoNode = mix(float(1), orm.b, e.verdeckung);
}

/**
 * Liefert eines der zehn Master-Materialien. Das Ergebnis ist gecacht — es
 * gibt je Art genau eine Instanz und genau einen Textursatz.
 */
export function holeMaterial(art: MaterialArt): THREE.MeshStandardNodeMaterial {
  const vorhanden = masterCache.get(art);
  if (vorhanden !== undefined) return vorhanden;

  const e = MASTER[art];
  // Glas braucht Transmission. `MeshPhysicalNodeMaterial` erweitert
  // `MeshStandardNodeMaterial`, der zugesagte Rückgabetyp bleibt also gültig.
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
    // Die Leuchtdioden der Leiterplatte — dezent, sonst blüht die Platine.
    material.emissiveNode = texture(satz.emission, uv().mul(e.kachelung)).rgb.mul(EMISSIV_HOCH);
  }

  masterCache.set(art, material);
  return material;
}

// ---------------------------------------------------------------------------
// Modulgehäuse
// ---------------------------------------------------------------------------

/** Fresnel-Rand: 0 in der Flächenmitte, 1 an der Silhouette. */
function randLeuchten() {
  return normalView.dot(positionViewDirection).abs().oneMinus().pow(3);
}

const modulCache = new Map<ModulArt, THREE.MeshStandardNodeMaterial>();

/**
 * Das Material eines Modulgehäuses: lackierter Stahl mit einem
 * Leuchtstreifen und einem Fresnel-Rand im Farbleitwert des Moduls.
 *
 * Der Streifen sitzt bei `uv().y ≈ 0.5`; die Gehäusegeometrie legt ihre
 * Frontplatte so aus, dass das Band dort über die Blende läuft.
 */
export function modulMaterial(art: ModulArt): THREE.MeshStandardNodeMaterial {
  const vorhanden = modulCache.get(art);
  if (vorhanden !== undefined) return vorhanden;

  const leitwert = KATALOG[art].farbe;
  const e: MasterEinstellung = { ...MASTER.stahl_lackiert, kachelung: MODUL_KACHELUNG };
  const material = new THREE.MeshStandardNodeMaterial();
  material.name = 'modul_' + art;
  bestueckeAusTexturen(material, 'stahl_lackiert', e);

  // Das Gehäuse bleibt dunkel; der Farbleitwert kommt nur als Hauch dazu,
  // damit sich zwölf Modularten im Halbdunkel unterscheiden lassen.
  const albedo = texture(
    erzeugeTexturSatz('stahl_lackiert', e.saat, TEXTURGROESSE).albedo,
    uv().mul(e.kachelung)
  ).rgb;
  material.colorNode = mix(albedo, albedo.mul(color(leitwert)), 0.45);

  // Leuchtband quer über die Blende. Es allein trägt die Farbkennung —
  // das Gehäuse bleibt dunkler Stahl.
  const band = smoothstep(0.455, 0.478, uv().y).sub(smoothstep(0.522, 0.545, uv().y)).saturate();
  material.emissiveNode = color(leitwert).mul(
    band.mul(EMISSIV_HOCH - EMISSIV_RUHE)
      .add(randLeuchten().mul(0.09))
      .add(EMISSIV_RUHE)
      .clamp(0, EMISSIV_HOCH)
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
   * Laufender Versatz des Energiemusters. Der Renderer erhöht ihn je Bild um
   * `geschwindigkeit * dt`; nur der Nachkommaanteil zählt.
   */
  readonly fluss: { value: number };
  /** 0 = Leitung liegt tot, 1 = es fließt ein Auftrag. Weich überblenden. */
  readonly aktiv: { value: number };
}

/**
 * Energieleitung mit fließendem Muster.
 *
 * Die Leitung ist ein `TubeGeometry`; `uv().x` läuft entlang der Röhre. Das
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

  // Sechs Pulse je Leitungslänge, um `fluss` verschoben.
  //
  // WICHTIG: `smoothstep` wird nur mit AUFSTEIGENDEN Kanten aufgerufen und bei
  // Bedarf per `oneMinus()` gedreht. Ein Aufruf mit `kante0 > kante1` ist in
  // GLSL undefiniert; auf dem WebGL2-Fallback-Backend (ANGLE/SwiftShader) fiel
  // das Muster dabei komplett aus — im Browsertest nachgestellt.
  const wandern = fract(uv().x.mul(6).sub(fluss));
  const abstand = wandern.sub(0.5).abs();
  const puls = smoothstep(0.0, 0.11, abstand).oneMinus();
  // Ein schwacher Nachlauf gibt dem Puls Richtung.
  const schweif = smoothstep(0.0, 0.34, abstand).oneMinus().mul(0.35);

  // Tote Leitung glimmt nur; unter Last läuft der Puls durch das ganze Band.
  material.emissiveNode = color(0x66e0ff).mul(
    float(EMISSIV_RUHE)
      .add(aktiv.mul(0.022))
      .add(puls.add(schweif).mul(aktiv).mul(0.24))
      .clamp(0, EMISSIV_HOCH)
  );

  return { material, fluss, aktiv };
}

// ---------------------------------------------------------------------------
// Pakete
// ---------------------------------------------------------------------------

let paketZwischenspeicher: THREE.MeshStandardNodeMaterial | null = null;

/**
 * Leuchtendes Auftragspaket für eine `InstancedMesh`.
 *
 * Die Geometrie muss ein `THREE.InstancedBufferAttribute` namens
 * `PAKET_FARB_ATTRIBUT` mit drei Komponenten (linearer RGB) tragen. Über das
 * Attribut färbt der Renderer Domäne, Alarmzustand und Güte ein, ohne je
 * ein zweites Material zu bauen.
 */
export function paketMaterial(): THREE.MeshStandardNodeMaterial {
  if (paketZwischenspeicher !== null) return paketZwischenspeicher;

  const material = new THREE.MeshStandardNodeMaterial();
  material.name = 'paket';

  const farbe = attribute<'vec3'>(PAKET_FARB_ATTRIBUT, 'vec3');
  const rand = randLeuchten();

  // Der Körper ist dunkel; was man sieht, ist fast nur das Eigenleuchten.
  material.colorNode = farbe.mul(0.16);
  material.roughnessNode = float(0.22);
  material.metalnessNode = float(0);
  // Kern gleichmäßig, Silhouette heller — das lässt das Paket schweben.
  material.emissiveNode = farbe.mul(
    float(0.10).add(rand.mul(0.22)).clamp(EMISSIV_TIEF, EMISSIV_HOCH)
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
 * @param gültig `true` = Platz ist frei (Cyan), `false` = belegt (Rot).
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
  // Scanlinien in Weltkoordinaten: sie stehen still, während das Modul
  // einrastet — das liest sich als Projektion, nicht als Bemalung.
  const scan = positionWorld.y.mul(46).sin().mul(0.5).add(0.5);
  const linien = mix(float(0.30), float(1.0), scan);

  material.colorNode = color(grundfarbe).mul(0.22);
  material.roughnessNode = float(0.4);
  material.metalnessNode = float(0);
  material.emissiveNode = color(grundfarbe).mul(
    float(EMISSIV_RUHE).add(rand.mul(0.20)).add(scan.mul(0.07)).clamp(0, EMISSIV_HOCH)
  );
  material.opacityNode = rand.mul(0.5).add(linien.mul(0.17)).add(0.08).clamp(0, 0.85);

  geistCache.set(gueltig, material);
  return material;
}

// ---------------------------------------------------------------------------
// Aufräumen
// ---------------------------------------------------------------------------

/**
 * Entsorgt alle Materialien und die von ihnen gehaltenen Textursätze.
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
