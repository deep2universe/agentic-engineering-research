/**
 * Die Halle: Backsteinbau von 1957, nachträglich mit Technik gefüllt.
 *
 * Diese Datei stellt die Bühne auf und beleuchtet sie. Die Formen kommen
 * vollständig aus `geometrie.ts`, die Oberflächen aus `materialien.ts` — hier
 * steht nur, WO etwas steht und WIE es beleuchtet wird.
 *
 * Gestaltungsleitsatz: kalt in der Fläche, warm nur dort, wo Technik arbeitet.
 * Das Auge soll ohne Anleitung zum Fundament in der Mitte gezogen werden.
 *
 * Zur Lichtsetzung: three.js rechnet seit r155 physikalisch. Punktlichter
 * stehen in Candela und fallen quadratisch ab — Werte um 50 brennen eine Halle
 * dieser Größe vollständig aus. Die Zahlen hier sind gemessen, nicht geschätzt:
 * `werkzeuge/schau.mjs` meldet die mittlere Bildhelligkeit, und die Halle soll
 * im Ruhezustand bei etwa 30 bis 45 von 255 liegen. Darunter verschwindet die
 * Architektur, darüber verlieren die leuchtenden Module ihren Kontrast.
 */

import * as THREE from 'three/webgpu';
import { erzeugeStrom } from '../sim/rng';
import { flaechenMaterial, fundamentForm, fundamentMaterial, hallenTeile, PALETTE } from './aussehen';
import { fundstueckGeometrie, type FundstueckArt } from './geometrie';

export interface HallenMasse {
  /** Felder des Baufundaments in X und Z. */
  readonly felderX: number;
  readonly felderZ: number;
  readonly hoehe: number;
  readonly saat: number;
}

export const STANDARD_MASSE: HallenMasse = { felderX: 16, felderZ: 10, hoehe: 11, saat: 1957 };

/**
 * Höhe des Baufundaments über dem Hallenboden.
 *
 * Es MUSS erhöht stehen. Auf Bodenniveau ist die Baufläche vom Hallenboden
 * nicht zu unterscheiden — und schlimmer: die Gitterstege der Platte und das
 * Fugenraster des Bodens liegen dann auf derselben Höhe und flimmern
 * gegeneinander. Das Podest löst beides auf einmal.
 */
export const PODESTHOEHE = 0.34;

/** Höhe, auf der die Module stehen: Podest plus Gitterrelief. */
export const BAUHOEHE = PODESTHOEHE + 0.014;

export class Halle {
  readonly wurzel = new THREE.Group();
  readonly fundament = new THREE.Group();
  /** Nur die geschlossene Decke. Sie wird ausgeblendet, sobald die Kamera darüber steht. */
  readonly decke = new THREE.Group();
  /** Das Fachwerk bleibt immer sichtbar — es trägt den Industriecharakter. */
  readonly fachwerk = new THREE.Group();
  readonly masse: HallenMasse;
  readonly sonne: THREE.DirectionalLight;

  private readonly entsorgbar: Array<{ dispose(): void }> = [];

  constructor(masse: Partial<HallenMasse> = {}) {
    this.masse = { ...STANDARD_MASSE, ...masse };
    this.wurzel.name = 'halle';
    this.sonne = new THREE.DirectionalLight(PALETTE.licht, 1.45);
    this.baue();
  }

  /** Weltkoordinate der Mitte des Gitterfelds (x, z). */
  feldZuWelt(x: number, z: number): THREE.Vector3 {
    const { felderX, felderZ } = this.masse;
    return new THREE.Vector3(x - (felderX - 1) / 2, BAUHOEHE, z - (felderZ - 1) / 2);
  }

  /** Gitterfeld unter einem Weltpunkt. Kann außerhalb des Fundaments liegen. */
  weltZuFeld(p: THREE.Vector3): { x: number; z: number } {
    const { felderX, felderZ } = this.masse;
    return {
      x: Math.round(p.x + (felderX - 1) / 2),
      z: Math.round(p.z + (felderZ - 1) / 2),
    };
  }

  imFundament(x: number, z: number): boolean {
    return x >= 0 && z >= 0 && x < this.masse.felderX && z < this.masse.felderZ;
  }

  // -------------------------------------------------------------------------

  private baue(): void {
    const { felderX, felderZ, hoehe, saat } = this.masse;
    const breite = felderX + 15;
    const tiefe = felderZ + 15;

    const teile = hallenTeile(breite, tiefe, hoehe, saat);

    const boden = new THREE.Mesh(teile.boden, flaechenMaterial('beton'));
    boden.receiveShadow = true;
    this.merke(teile.boden);
    this.wurzel.add(boden);

    const waende = new THREE.Mesh(teile.waende, flaechenMaterial('ziegel'));
    waende.receiveShadow = true;
    waende.castShadow = true;
    this.merke(teile.waende);
    this.wurzel.add(waende);

    // Die Fenster sind die Lichtquelle der Halle. Sie leuchten selbst und
    // liefern der Umgebungsbeleuchtung ihre länglichen Reflexe.
    const fensterMaterial = new THREE.MeshStandardNodeMaterial();
    fensterMaterial.color = new THREE.Color(0x2c3a4e);
    fensterMaterial.roughness = 0.22;
    fensterMaterial.metalness = 0;
    fensterMaterial.emissive = new THREE.Color(0x9fc0ea);
    fensterMaterial.emissiveIntensity = 0.85;
    const fenster = new THREE.Mesh(teile.fenster, fensterMaterial);
    this.merke(teile.fenster);
    this.merke(fensterMaterial);
    this.wurzel.add(fenster);

    const traeger = new THREE.Mesh(teile.traeger, flaechenMaterial('stahl'));
    traeger.castShadow = true;
    this.merke(teile.traeger);
    this.fachwerk.add(traeger);
    this.wurzel.add(this.fachwerk);

    const gelaender = new THREE.Mesh(teile.gelaender, flaechenMaterial('stahlBlank'));
    gelaender.castShadow = true;
    this.merke(teile.gelaender);
    this.wurzel.add(gelaender);

    const deckenNetz = new THREE.Mesh(teile.decke, flaechenMaterial('beton'));
    this.merke(teile.decke);
    this.decke.add(deckenNetz);
    this.wurzel.add(this.decke);

    // Ruhiges, dunkles Podest. Die Gittertextur war hier falsch: sie erzeugt
    // Hunderte feiner Stege und liest sich aus der Bauperspektive als Rauschen.
    // Das Feldraster zeichnen wir stattdessen explizit — es ist Spielinformation
    // und darf nicht mit Materialstruktur konkurrieren.
    const platte = new THREE.Mesh(fundamentForm(felderX, felderZ), flaechenMaterial('beton'));
    platte.receiveShadow = true;
    platte.castShadow = true;
    this.fundament.add(platte);

    // Lichtkante rundum. Sie kostet vier schmale Quader und beantwortet die
    // wichtigste Frage der ersten Sekunde: wo darf ich bauen?
    const kantenMaterial = new THREE.MeshStandardNodeMaterial();
    kantenMaterial.color = new THREE.Color(0x0d1319);
    kantenMaterial.roughness = 0.5;
    kantenMaterial.metalness = 0.2;
    kantenMaterial.emissive = new THREE.Color(0x3f9fc4);
    kantenMaterial.emissiveIntensity = 1.15;
    this.merke(kantenMaterial);
    const kb = felderX + 0.72;
    const kt = felderZ + 0.72;
    for (const [bx, bz, x, z] of [
      [kb, 0.06, 0, -kt / 2],
      [kb, 0.06, 0, kt / 2],
      [0.06, kt, -kb / 2, 0],
      [0.06, kt, kb / 2, 0],
    ] as const) {
      const g = new THREE.BoxGeometry(bx, 0.045, bz);
      const netz = new THREE.Mesh(g, kantenMaterial);
      netz.position.set(x, -0.02, z);
      this.merke(g);
      this.fundament.add(netz);
    }

    this.fundament.add(this.baueFeldraster(felderX, felderZ));
    this.fundament.position.y = PODESTHOEHE;
    this.wurzel.add(this.fundament);

    this.streueFundstuecke(breite, tiefe, saat);
    this.baueLicht(breite, tiefe, hoehe);
  }

  /**
   * Das Feldraster: für jede Feldgrenze eine schmale, schwach leuchtende Linie.
   *
   * Es ist Spielinformation, keine Verzierung — man muss auf einen Blick sehen,
   * wo ein Modul hinpasst. Deshalb wird es als eigene Geometrie gezeichnet und
   * nicht der Materialstruktur überlassen.
   */
  private baueFeldraster(felderX: number, felderZ: number): THREE.Mesh {
    const teile: THREE.BufferGeometry[] = [];
    const staerke = 0.035;
    for (let i = 0; i <= felderX; i++) {
      const g = new THREE.BoxGeometry(staerke, 0.01, felderZ);
      g.translate(i - felderX / 2, 0.012, 0);
      teile.push(g);
    }
    for (let i = 0; i <= felderZ; i++) {
      const g = new THREE.BoxGeometry(felderX, 0.01, staerke);
      g.translate(0, 0.012, i - felderZ / 2);
      teile.push(g);
    }
    const zusammen = vereineTeile(teile);
    const material = new THREE.MeshStandardNodeMaterial();
    material.color = new THREE.Color(0x121820);
    material.roughness = 0.6;
    material.metalness = 0.1;
    material.emissive = new THREE.Color(0x2f6f8c);
    material.emissiveIntensity = 0.5;
    this.merke(zusammen);
    this.merke(material);
    const netz = new THREE.Mesh(zusammen, material);
    netz.receiveShadow = true;
    return netz;
  }

  /**
   * Verteilt Fundstücke am Rand der Halle. Sie stehen immer AUF dem Boden und
   * immer außerhalb des Fundaments: schwebende Kisten sehen sofort nach
   * Prototyp aus, und etwas mitten im Bauraum wäre schlicht im Weg.
   */
  private streueFundstuecke(breite: number, tiefe: number, saat: number): void {
    const r = erzeugeStrom(saat ^ 0x5c4a7711);
    const arten: readonly FundstueckArt[] = ['becher', 'aktenstapel', 'rollwagen', 'schild', 'kabelrolle', 'stuhl'];
    const material = flaechenMaterial('stahl');
    const { felderX, felderZ } = this.masse;

    for (let i = 0; i < 22; i++) {
      const art = arten[Math.min(arten.length - 1, Math.floor(r() * arten.length))]!;
      const laengsseite = r() < 0.55;
      const x = laengsseite
        ? (r() - 0.5) * breite * 0.78
        : (r() < 0.5 ? -1 : 1) * (felderX / 2 + 2 + r() * Math.max(1, breite / 2 - felderX / 2 - 3));
      const z = laengsseite
        ? (r() < 0.5 ? -1 : 1) * (felderZ / 2 + 2 + r() * Math.max(1, tiefe / 2 - felderZ / 2 - 3))
        : (r() - 0.5) * tiefe * 0.78;

      const g = fundstueckGeometrie(art, Math.floor(r() * 100000));
      const netz = new THREE.Mesh(g, material);
      netz.position.set(x, 0, z);
      netz.rotation.y = r() * Math.PI * 2;
      netz.castShadow = true;
      netz.receiveShadow = true;
      this.merke(g);
      this.wurzel.add(netz);
    }
  }

  private baueLicht(breite: number, tiefe: number, hoehe: number): void {
    // Hauptlicht: schräg durch die Sprossenfenster auf das Fundament.
    const s = this.sonne;
    s.position.set(breite * 0.42, hoehe * 1.5, -tiefe * 0.36);
    s.target.position.set(0, 0, 0);
    s.castShadow = true;
    s.shadow.mapSize.set(2048, 2048);
    s.shadow.camera.near = 2;
    s.shadow.camera.far = hoehe * 5;
    const k = s.shadow.camera as THREE.OrthographicCamera;
    const spanne = Math.max(breite, tiefe) * 0.62;
    k.left = -spanne;
    k.right = spanne;
    k.top = spanne;
    k.bottom = -spanne;
    k.updateProjectionMatrix();
    s.shadow.bias = -0.0009;
    s.shadow.normalBias = 0.035;
    this.wurzel.add(s, s.target);

    // Gegenlicht von hinten links. Es beleuchtet kaum, sondern zeichnet Kanten
    // nach — der billigste Weg, Silhouetten lesbar zu machen.
    const gegen = new THREE.DirectionalLight(0x6f9bd4, 0.7);
    gegen.position.set(-breite * 0.5, hoehe * 0.7, tiefe * 0.55);
    gegen.target.position.set(0, 0, 0);
    this.wurzel.add(gegen, gegen.target);

    // Himmels-/Bodenlicht: füllt die Schatten, ohne sie zu töten.
    this.wurzel.add(new THREE.HemisphereLight(0x35506f, 0x090c11, 0.22));

    // Warme Arbeitsleuchten über dem Fundament. Sie markieren den Ort, an dem
    // gearbeitet wird, und geben dem kalten Raum einen Gegenpol.
    const schirm = flaechenMaterial('stahlBlank');
    for (const x of [-this.masse.felderX * 0.28, this.masse.felderX * 0.28]) {
      const l = new THREE.PointLight(PALETTE.lichtWarm, 34, 20, 2);
      l.position.set(x, hoehe * 0.52, 0);
      this.wurzel.add(l);

      const schirmG = new THREE.CylinderGeometry(0.5, 0.72, 0.36, 14, 1, true);
      const lampe = new THREE.Mesh(schirmG, schirm);
      lampe.position.set(x, hoehe * 0.52 + 0.22, 0);
      this.merke(schirmG);
      this.wurzel.add(lampe);

      const kabelG = new THREE.CylinderGeometry(0.03, 0.03, hoehe * 0.44, 6);
      const kabel = new THREE.Mesh(kabelG, schirm);
      kabel.position.set(x, hoehe * 0.52 + 0.22 + (hoehe * 0.44) / 2, 0);
      this.merke(kabelG);
      this.wurzel.add(kabel);
    }
  }

  private merke(x: { dispose(): void }): void {
    this.entsorgbar.push(x);
  }

  entsorge(): void {
    for (const x of this.entsorgbar.splice(0)) x.dispose();
    this.wurzel.clear();
    this.fundament.clear();
    this.decke.clear();
    this.fachwerk.clear();
  }
}

/** Führt Geometrien zusammen und gibt die Einzelteile frei. */
function vereineTeile(teile: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const pos: number[] = [];
  const nor: number[] = [];
  const uvs: number[] = [];
  for (const t of teile) {
    const nicht = t.index ? t.toNonIndexed() : t;
    const p = nicht.attributes['position'] as THREE.BufferAttribute;
    const n = nicht.attributes['normal'] as THREE.BufferAttribute | undefined;
    const u = nicht.attributes['uv'] as THREE.BufferAttribute | undefined;
    for (let i = 0; i < p.count; i++) {
      pos.push(p.getX(i), p.getY(i), p.getZ(i));
      if (n) nor.push(n.getX(i), n.getY(i), n.getZ(i));
      else nor.push(0, 1, 0);
      if (u) uvs.push(u.getX(i), u.getY(i));
      else uvs.push(0, 0);
    }
    if (nicht !== t) nicht.dispose();
    t.dispose();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.computeBoundingSphere();
  return g;
}
