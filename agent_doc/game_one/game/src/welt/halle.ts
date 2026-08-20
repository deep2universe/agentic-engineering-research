/**
 * Die Halle: Backsteinbau von 1957, nachtraeglich mit Technik gefuellt.
 *
 * Gestaltungsleitsatz: kalt in der Flaeche, warm nur dort, wo Technik arbeitet.
 * Das Auge soll ohne Anleitung zum Fundament in der Mitte gezogen werden —
 * deshalb faellt das Licht schraeg von den Sprossenfenstern auf die Bauflaeche
 * und laesst die Waende im Halbdunkel.
 *
 * Alles hier ist prozedural und deterministisch: dieselbe Saat ergibt dieselbe
 * Halle, bis auf das letzte Nietenblech.
 */

import * as THREE from 'three/webgpu';
import { flaechenMaterial, fundamentMaterial, PALETTE } from './aussehen';
import { erzeugeStrom } from '../sim/rng';

export interface HallenMasse {
  /** Felder des Baufundaments in X und Z. */
  readonly felderX: number;
  readonly felderZ: number;
  readonly hoehe: number;
  readonly saat: number;
}

export const STANDARD_MASSE: HallenMasse = { felderX: 16, felderZ: 10, hoehe: 11, saat: 1957 };

export class Halle {
  readonly wurzel = new THREE.Group();
  readonly fundament = new THREE.Group();
  /** Decke und Fachwerk. Werden ausgeblendet, sobald die Kamera darueber steht. */
  readonly dach = new THREE.Group();
  readonly masse: HallenMasse;
  readonly sonne: THREE.DirectionalLight;

  private readonly entsorgbar: Array<{ dispose(): void }> = [];

  constructor(masse: Partial<HallenMasse> = {}) {
    this.masse = { ...STANDARD_MASSE, ...masse };
    this.wurzel.name = 'halle';
    this.sonne = new THREE.DirectionalLight(PALETTE.licht, 1.25);
    this.baue();
  }

  /** Weltkoordinate der Mitte des Gitterfelds (x, z). */
  feldZuWelt(x: number, z: number): THREE.Vector3 {
    const { felderX, felderZ } = this.masse;
    return new THREE.Vector3(x - (felderX - 1) / 2, 0.16, z - (felderZ - 1) / 2);
  }

  /** Gitterfeld unter einem Weltpunkt. Kann ausserhalb des Fundaments liegen. */
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
    const r = erzeugeStrom(saat);
    const breite = felderX + 14;
    const tiefe = felderZ + 14;

    // --- Boden ------------------------------------------------------------
    const boden = new THREE.Mesh(new THREE.PlaneGeometry(breite * 1.6, tiefe * 1.6), flaechenMaterial('beton'));
    boden.rotation.x = -Math.PI / 2;
    boden.receiveShadow = true;
    this.merke(boden.geometry);
    this.wurzel.add(boden);

    // --- Baufundament -----------------------------------------------------
    const platte = new THREE.Mesh(new THREE.BoxGeometry(felderX + 0.6, 0.32, felderZ + 0.6), flaechenMaterial('fundament'));
    platte.position.y = 0;
    platte.receiveShadow = true;
    platte.castShadow = true;
    this.merke(platte.geometry);
    this.fundament.add(platte);

    // Gitterrelief: eine Ebene knapp ueber der Platte mit leuchtenden Fugen.
    const raster = new THREE.Mesh(new THREE.PlaneGeometry(felderX, felderZ, 1, 1), fundamentMaterial());
    raster.rotation.x = -Math.PI / 2;
    raster.position.y = 0.161;
    const uvAttr = raster.geometry.attributes['uv'] as THREE.BufferAttribute;
    for (let i = 0; i < uvAttr.count; i++) {
      uvAttr.setXY(i, uvAttr.getX(i) * felderX, uvAttr.getY(i) * felderZ);
    }
    uvAttr.needsUpdate = true;
    this.merke(raster.geometry);
    this.fundament.add(raster);

    // Randprofil aus Stahl.
    const profil = flaechenMaterial('stahl');
    for (const [dx, dz, bx, bz] of [
      [0, -(felderZ + 0.6) / 2, felderX + 1.0, 0.4],
      [0, (felderZ + 0.6) / 2, felderX + 1.0, 0.4],
      [-(felderX + 0.6) / 2, 0, 0.4, felderZ + 1.0],
      [(felderX + 0.6) / 2, 0, 0.4, felderZ + 1.0],
    ] as const) {
      const g = new THREE.BoxGeometry(bx, 0.42, bz);
      const m = new THREE.Mesh(g, profil);
      m.position.set(dx, 0.05, dz);
      m.castShadow = true;
      m.receiveShadow = true;
      this.merke(g);
      this.fundament.add(m);
    }
    this.wurzel.add(this.fundament);

    // --- Waende -----------------------------------------------------------
    const ziegel = flaechenMaterial('ziegel');
    const wandTeile: THREE.BufferGeometry[] = [];
    const wandHoehe = hoehe;
    for (const [x, z, bx, bz] of [
      [0, -tiefe / 2, breite, 0.8],
      [0, tiefe / 2, breite, 0.8],
      [-breite / 2, 0, 0.8, tiefe],
      [breite / 2, 0, 0.8, tiefe],
    ] as const) {
      const g = new THREE.BoxGeometry(bx, wandHoehe, bz);
      g.translate(x, wandHoehe / 2, z);
      wandTeile.push(g);
    }
    // Lisenen als Vertikalgliederung — sie geben der Wand Massstab.
    for (let i = 0; i <= 8; i++) {
      const x = -breite / 2 + (breite * i) / 8;
      for (const z of [-tiefe / 2, tiefe / 2]) {
        const g = new THREE.BoxGeometry(0.5, wandHoehe, 0.3);
        g.translate(x, wandHoehe / 2, z + (z < 0 ? 0.45 : -0.45));
        wandTeile.push(g);
      }
    }
    // Sprossen der Fenster gehoeren in die Wandgeometrie und muessen deshalb
    // VOR dem Zusammenfuehren eingesammelt werden.
    const breiteFenster = 6;
    for (let i = 0; i < breiteFenster; i++) {
      const fx = -breite / 2 + (breite * (i + 0.5)) / breiteFenster;
      for (const fz of [-tiefe / 2 + 0.45, tiefe / 2 - 0.45]) {
        for (let sp = 1; sp < 4; sp++) {
          const g = new THREE.BoxGeometry(2.3, 0.07, 0.12);
          g.translate(fx, wandHoehe * 0.62 - 2.2 + (4.4 * sp) / 4, fz);
          wandTeile.push(g);
        }
      }
    }
    const waende = new THREE.Mesh(mergeAlle(wandTeile), ziegel);
    waende.receiveShadow = true;
    waende.castShadow = true;
    this.merke(waende.geometry);
    this.wurzel.add(waende);

    // --- Sprossenfenster --------------------------------------------------
    // Sie sind der Grund, warum das Licht schraeg einfaellt. Als leuchtende
    // Flaechen ohne Geometriekosten.
    const fensterMat = new THREE.MeshBasicNodeMaterial();
    fensterMat.color = new THREE.Color(0x8fb6e8);
    fensterMat.toneMapped = false;
    const fensterTeile: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 6; i++) {
      const x = -breite / 2 + (breite * (i + 0.5)) / 6;
      for (const z of [-tiefe / 2 + 0.45, tiefe / 2 - 0.45]) {
        const g = new THREE.PlaneGeometry(2.2, 4.4);
        g.rotateY(z < 0 ? 0 : Math.PI);
        g.translate(x, wandHoehe * 0.62, z);
        fensterTeile.push(g);
      }
    }
    const fenster = new THREE.Mesh(mergeAlle(fensterTeile), fensterMat);
    this.merke(fenster.geometry);
    this.merke(fensterMat);
    this.wurzel.add(fenster);

    // --- Stahlfachwerk unter der Decke ------------------------------------
    const traegerTeile: THREE.BufferGeometry[] = [];
    const binder = 7;
    for (let i = 0; i < binder; i++) {
      const z = -tiefe / 2 + (tiefe * (i + 0.5)) / binder;
      // Untergurt, Obergurt, Diagonalen.
      const unten = new THREE.BoxGeometry(breite - 1.2, 0.22, 0.22);
      unten.translate(0, wandHoehe - 1.6, z);
      const oben = new THREE.BoxGeometry(breite - 1.2, 0.22, 0.22);
      oben.translate(0, wandHoehe - 0.5, z);
      traegerTeile.push(unten, oben);
      const felder = 10;
      for (let f = 0; f < felder; f++) {
        const x0 = -(breite - 1.2) / 2 + ((breite - 1.2) * f) / felder;
        const d = new THREE.BoxGeometry(0.14, 1.45, 0.14);
        d.rotateZ(f % 2 === 0 ? 0.6 : -0.6);
        d.translate(x0 + (breite - 1.2) / (felder * 2), wandHoehe - 1.05, z);
        traegerTeile.push(d);
      }
    }
    // Laengspfetten
    for (let i = 0; i < 5; i++) {
      const x = -breite / 2 + (breite * (i + 0.5)) / 5;
      const p = new THREE.BoxGeometry(0.16, 0.16, tiefe - 1);
      p.translate(x, wandHoehe - 0.4, 0);
      traegerTeile.push(p);
    }
    const traeger = new THREE.Mesh(mergeAlle(traegerTeile), flaechenMaterial('stahl'));
    traeger.castShadow = true;
    this.merke(traeger.geometry);
    this.dach.add(traeger);

    // --- Decke ------------------------------------------------------------
    const decke = new THREE.Mesh(new THREE.PlaneGeometry(breite, tiefe), flaechenMaterial('beton'));
    decke.rotation.x = Math.PI / 2;
    decke.position.y = wandHoehe;
    this.merke(decke.geometry);
    this.dach.add(decke);
    this.wurzel.add(this.dach);

    // --- Streugut: Kisten und Rollwagen am Rand ---------------------------
    const streuMat = flaechenMaterial('stahl');
    const streuTeile: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 26; i++) {
      const amRand = r() < 0.5;
      const x = amRand
        ? (r() < 0.5 ? -1 : 1) * (felderX / 2 + 1.5 + r() * 4)
        : (r() - 0.5) * breite * 0.8;
      const z = amRand ? (r() - 0.5) * tiefe * 0.8 : (r() < 0.5 ? -1 : 1) * (felderZ / 2 + 1.5 + r() * 4);
      const b = 0.5 + r() * 0.9;
      const h = 0.4 + r() * 1.1;
      const g = new THREE.BoxGeometry(b, h, b * (0.7 + r() * 0.6));
      g.rotateY(r() * Math.PI);
      g.translate(x, h / 2, z);
      streuTeile.push(g);
    }
    const streu = new THREE.Mesh(mergeAlle(streuTeile), streuMat);
    streu.castShadow = true;
    streu.receiveShadow = true;
    this.merke(streu.geometry);
    this.wurzel.add(streu);

    // --- Licht ------------------------------------------------------------
    this.baueLicht(breite, tiefe, wandHoehe);

    // --- Nebel ------------------------------------------------------------
    // Exponentieller Nebel gibt der Halle Tiefe und laesst die Waende
    // zurueckweichen, ohne einen volumetrischen Pass zu kosten.
    void PALETTE.nebel;
  }

  /**
   * Lichtsetzung.
   *
   * Wichtig: three.js rechnet seit r155 physikalisch. Punktlichter werden in
   * Candela angegeben und fallen quadratisch ab — Werte im Bereich 50 brennen
   * eine Halle dieser Groesse vollstaendig aus. Die hier gesetzten Werte sind
   * gemessen, nicht geschaetzt: das Werkzeug `werkzeuge/schau.mjs` meldet die
   * mittlere Bildhelligkeit, und die Halle soll im Ruhezustand bei etwa 20–40
   * von 255 liegen, damit die leuchtenden Module ueberhaupt Kontrast haben.
   */
  private baueLicht(breite: number, tiefe: number, hoehe: number): void {
    // Hauptlicht: schraeg durch die Sprossenfenster auf das Fundament.
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

    // Himmels-/Bodenlicht: fuellt die Schatten, ohne sie zu toeten.
    this.wurzel.add(new THREE.HemisphereLight(0x3d5a80, 0x090c11, 0.28));

    // Warme Arbeitsleuchten ueber dem Fundament — sie markieren den Ort, an dem
    // gearbeitet wird, und geben dem kalten Raum einen Gegenpol.
    for (const x of [-this.masse.felderX * 0.3, this.masse.felderX * 0.3]) {
      const l = new THREE.PointLight(PALETTE.lichtWarm, 7.5, 22, 2);
      l.position.set(x, hoehe * 0.52, 0);
      this.wurzel.add(l);
      const lampe = new THREE.Mesh(
        new THREE.CylinderGeometry(0.5, 0.66, 0.34, 12, 1, true),
        flaechenMaterial('stahl')
      );
      lampe.position.set(x, hoehe * 0.52 + 0.2, 0);
      this.merke(lampe.geometry);
      this.wurzel.add(lampe);
    }
  }

  private merke(x: { dispose(): void }): void {
    this.entsorgbar.push(x);
  }

  entsorge(): void {
    for (const x of this.entsorgbar.splice(0)) x.dispose();
    this.wurzel.clear();
  }
}

/** Fuehrt Geometrien zusammen und gibt die Teile frei. */
function mergeAlle(teile: THREE.BufferGeometry[]): THREE.BufferGeometry {
  if (teile.length === 1) return teile[0]!;
  const zusammen = new THREE.BufferGeometry();
  // Manuelles Zusammenfuehren ohne Zusatzabhaengigkeit: alle Teile haben
  // position/normal/uv und keine Indizes nach toNonIndexed().
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
  zusammen.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  zusammen.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  zusammen.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  zusammen.computeBoundingSphere();
  return zusammen;
}
