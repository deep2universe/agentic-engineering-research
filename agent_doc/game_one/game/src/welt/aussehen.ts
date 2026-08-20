/**
 * Aussehen-Adapter: die EINZIGE Stelle, an der die Spielwelt Formen und
 * Materialien bezieht.
 *
 * Zweck der Indirektion: Die vollprozeduralen Generatoren (`texturen.ts`,
 * `materialien.ts`, `geometrie.ts`) entstehen parallel. Bis sie stehen, liefert
 * dieser Adapter eigene, bewusst schlichte, aber vollstaendige Umsetzungen.
 * Beim Zusammenfuehren aendert sich ausschliesslich diese Datei — die Halle,
 * die Werkansicht und die Tests bleiben unberuehrt.
 *
 * Zwei Regeln, die aus dem Renderer-Spike stammen und hier durchgesetzt werden:
 *  1. Emissive-Werte liegen STRENG im Band 0.05–0.35. Darueber brennt AgX plus
 *     Bloom das Bild aus.
 *  2. Zeitabhaengige Shader lesen ein von aussen gesetztes Uniform, niemals
 *     `time` — sonst sind Bilder nicht reproduzierbar.
 */

import * as THREE from 'three/webgpu';
import {
  color,
  float,
  Fn,
  mix,
  normalView,
  positionLocal,
  positionViewDirection,
  positionWorld,
  smoothstep,
  uniform,
  uv,
  vec3,
  vec4,
} from 'three/tsl';
import * as BGU from 'three/addons/utils/BufferGeometryUtils.js';
import type { ModulArt } from '../sim/typen';
import { KATALOG } from '../sim/katalog';
import { erzeugeStrom } from '../sim/rng';

// ---------------------------------------------------------------------------
// Gemeinsame Uniforms
// ---------------------------------------------------------------------------

/** Fortlaufende Zeit in Sekunden. Der Renderer setzt sie einmal pro Bild. */
export const uZeit = uniform(0);
/** 0 = Bewegungsreduktion (kein Pulsieren, kein Fliessen). */
export const uPuls = uniform(1);

// ---------------------------------------------------------------------------
// Farbwelt
// ---------------------------------------------------------------------------

/**
 * Grundpalette der Halle. Kalt in der Flaeche, warm nur dort, wo Technik
 * arbeitet. Die Modulfarben kommen aus dem Katalog und folgen der
 * Okabe-Ito-Logik: jede Bedeutung ist zusaetzlich an der Silhouette erkennbar,
 * niemals nur an der Farbe.
 */
export const PALETTE = {
  hintergrund: 0x080b11,
  nebel: 0x0d1219,
  beton: 0x242a31,
  betonDunkel: 0x1b1f26,
  ziegel: 0x37302c,
  stahl: 0x555f6b,
  stahlDunkel: 0x2f3640,
  messing: 0xb08d57,
  fundament: 0x1a1f26,
  gitter: 0x39424e,
  licht: 0xdfe9ff,
  lichtWarm: 0xffd9a0,
} as const;

// ---------------------------------------------------------------------------
// Materialien
// ---------------------------------------------------------------------------

const materialCache = new Map<string, THREE.MeshStandardNodeMaterial>();

function merke(schluessel: string, bauen: () => THREE.MeshStandardNodeMaterial): THREE.MeshStandardNodeMaterial {
  const vorhanden = materialCache.get(schluessel);
  if (vorhanden) return vorhanden;
  const neu = bauen();
  materialCache.set(schluessel, neu);
  return neu;
}

/**
 * Fresnel-Randaufhellung — laesst Kanten im Gegenlicht lesbar werden.
 * Bewusst eine gewoehnliche Funktion und kein TSL-`Fn`: sie wird nur beim
 * Materialbau aufgerufen, nicht je Bildpunkt, und bleibt so typsicher.
 */
function fresnel(staerke: number) {
  return normalView.dot(positionViewDirection).abs().oneMinus().pow(3).mul(staerke);
}

/** Beton, Stahl und Ziegel der Halle. */
export function flaechenMaterial(art: 'beton' | 'stahl' | 'ziegel' | 'fundament' | 'gitter'): THREE.MeshStandardNodeMaterial {
  return merke(`flaeche:${art}`, () => {
    const m = new THREE.MeshStandardNodeMaterial();
    switch (art) {
      case 'beton':
        m.color = new THREE.Color(PALETTE.beton);
        m.roughness = 0.92;
        m.metalness = 0.02;
        break;
      case 'stahl':
        // Lackierter Baustahl. Metalness bleibt niedrig: Lack ist ein
        // Dielektrikum. Nur blanke Teile bekommen echte Metallwerte.
        m.color = new THREE.Color(PALETTE.stahl);
        m.roughness = 0.58;
        m.metalness = 0.12;
        break;
      case 'ziegel':
        m.color = new THREE.Color(PALETTE.ziegel);
        m.roughness = 0.95;
        m.metalness = 0.0;
        break;
      case 'fundament':
        m.color = new THREE.Color(PALETTE.fundament);
        m.roughness = 0.66;
        m.metalness = 0.18;
        break;
      case 'gitter':
        m.color = new THREE.Color(PALETTE.gitter);
        m.roughness = 0.46;
        m.metalness = 0.55;
        break;
    }
    // Sehr dezente Hoehenschattierung: unten dunkler, oben heller. Ersetzt eine
    // Ambient-Occlusion-Textur und kostet nichts.
    m.colorNode = mix(
      color(m.color).mul(0.62),
      color(m.color),
      smoothstep(float(0), float(6), positionWorld.y)
    );
    return m;
  });
}

/** Das Gitterraster des Fundaments — leuchtende Fugen, sonst matt. */
export function fundamentMaterial(): THREE.MeshStandardNodeMaterial {
  return merke('fundament:raster', () => {
    const m = new THREE.MeshStandardNodeMaterial();
    m.color = new THREE.Color(PALETTE.fundament);
    m.roughness = 0.55;
    m.metalness = 0.4;
    const gitterUv = uv().mul(1).fract().sub(0.5).abs();
    const linie = smoothstep(float(0.5), float(0.47), gitterUv.x.max(gitterUv.y));
    m.emissiveNode = color(0x2b5f7a).mul(linie).mul(0.09);
    return m;
  });
}

/** Modulgehaeuse: Katalogfarbe, matt, mit leuchtender Signaturkante. */
export function modulMaterial(art: ModulArt): THREE.MeshStandardNodeMaterial {
  return merke(`modul:${art}`, () => {
    const leit = new THREE.Color(KATALOG[art].farbe);
    const koerper = leit.clone().multiplyScalar(0.16).lerp(new THREE.Color(PALETTE.stahlDunkel), 0.7);
    const m = new THREE.MeshStandardNodeMaterial();
    m.color = koerper;
    m.roughness = 0.44;
    m.metalness = 0.45;
    // Signaturkante: ein schmales Leuchtband knapp ueber der Grundflaeche plus
    // Fresnel-Rand. Beides bleibt weit unter der Ausbrenngrenze.
    const band = smoothstep(float(0.1), float(0.14), positionLocal.y)
      .sub(smoothstep(float(0.17), float(0.21), positionLocal.y))
      .clamp(0, 1);
    m.emissiveNode = color(leit).mul(band.mul(0.26).add(fresnel(0.1)));
    return m;
  });
}

/** Auswahl- und Hover-Hervorhebung als eigenstaendiges Huellmaterial. */
export function hervorhebung(art: 'auswahl' | 'zeiger' | 'fehler'): THREE.MeshBasicNodeMaterial {
  const schluessel = `hervor:${art}`;
  const vorhanden = materialCache.get(schluessel) as unknown as THREE.MeshBasicNodeMaterial | undefined;
  if (vorhanden) return vorhanden;
  const farbe = art === 'auswahl' ? 0x9dffb0 : art === 'zeiger' ? 0x7ee8fa : 0xff5c5c;
  const m = new THREE.MeshBasicNodeMaterial();
  m.color = new THREE.Color(farbe);
  m.transparent = true;
  m.opacity = 0.22;
  m.depthWrite = false;
  m.side = THREE.BackSide;
  materialCache.set(schluessel, m as unknown as THREE.MeshStandardNodeMaterial);
  return m;
}

/**
 * Leitungsmaterial mit fliessendem Energiemuster. `aktiv` blendet zwischen
 * ruhender (dunkler) und arbeitender (fliessender) Leitung.
 */
export function leitungsMaterial(): {
  material: THREE.MeshStandardNodeMaterial;
  aktiv: ReturnType<typeof uniform>;
} {
  const aktiv = uniform(0);
  const m = merke('leitung', () => {
    const mat = new THREE.MeshStandardNodeMaterial();
    mat.color = new THREE.Color(0x1b2028);
    mat.roughness = 0.38;
    mat.metalness = 0.55;
    // Laufendes Band entlang der V-Koordinate. `uPuls` schaltet es bei
    // Bewegungsreduktion vollstaendig ab.
    const lauf = uv().y.mul(6).sub(uZeit.mul(1.4).mul(uPuls)).fract();
    const welle = smoothstep(float(0.0), float(0.12), lauf).mul(smoothstep(float(0.34), float(0.22), lauf));
    mat.emissiveNode = color(0x66e0ff).mul(welle.mul(0.3).add(0.035)).mul(aktiv.mul(0.85).add(0.15));
    return mat;
  });
  return { material: m, aktiv };
}

/** Leuchtendes Auftragspaket. Farbe kommt aus dem Instanzattribut `farbe`. */
export function paketMaterial(): THREE.MeshStandardNodeMaterial {
  return merke('paket', () => {
    const m = new THREE.MeshStandardNodeMaterial();
    m.color = new THREE.Color(0x0d1016);
    m.roughness = 0.2;
    m.metalness = 0.1;
    const puls = uZeit.mul(3.1).sin().mul(0.5).add(0.5).mul(uPuls).mul(0.08).add(0.22);
    m.emissiveNode = vec3(1, 1, 1).mul(puls);
    return m;
  });
}

/** Geist-Vorschau beim Platzieren: halbtransparent, Scanlines, Fresnel-Rand. */
export function geistMaterial(gueltig: boolean): THREE.MeshStandardNodeMaterial {
  return merke(`geist:${gueltig}`, () => {
    const m = new THREE.MeshStandardNodeMaterial();
    const farbe = gueltig ? 0x7ee8fa : 0xff5c5c;
    m.color = new THREE.Color(farbe);
    m.transparent = true;
    m.opacity = 0.45;
    m.depthWrite = false;
    m.roughness = 0.5;
    m.metalness = 0.0;
    const scan = positionWorld.y.mul(26).sin().mul(0.5).add(0.5).mul(0.16);
    m.emissiveNode = color(farbe).mul(scan.add(fresnel(0.18)).add(0.06));
    return m;
  });
}

export function entsorgeMaterialien(): void {
  for (const m of materialCache.values()) m.dispose();
  materialCache.clear();
}

// ---------------------------------------------------------------------------
// Geometrie
// ---------------------------------------------------------------------------

const formCache = new Map<string, THREE.BufferGeometry>();

function vereinige(teile: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const g = BGU.mergeGeometries(teile, false);
  for (const t of teile) t.dispose();
  if (!g) throw new Error('Geometrien liessen sich nicht zusammenfuehren');
  g.computeBoundingSphere();
  g.computeBoundingBox();
  return g;
}

function kasten(bx: number, by: number, bz: number, x = 0, y = 0, z = 0): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(bx, by, bz);
  g.translate(x, y + by / 2, z);
  return g;
}

function zylinder(r: number, h: number, seiten = 12, x = 0, y = 0, z = 0): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(r, r, h, seiten);
  g.translate(x, y + h / 2, z);
  return g;
}

/**
 * Silhouette eines Moduls. Fussabdruck genau 1x1, Ursprung mittig auf der
 * Grundflaeche. Jede Art muss aus der Vogelperspektive an ihrer FORM erkennbar
 * sein — Farbe allein ist kein Unterscheidungsmerkmal (WCAG 1.4.1).
 */
export function modulForm(art: ModulArt, saat = 1): THREE.BufferGeometry {
  const schluessel = `${art}:${saat}`;
  const vorhanden = formCache.get(schluessel);
  if (vorhanden) return vorhanden;
  const r = erzeugeStrom(saat * 7919 + art.length * 131);
  const teile: THREE.BufferGeometry[] = [];
  const sockel = kasten(0.92, 0.12, 0.92);
  teile.push(sockel);

  switch (art) {
    case 'quelle': {
      // Offener Trichter auf Stuetzen.
      const t = new THREE.CylinderGeometry(0.44, 0.16, 0.5, 12, 1, true);
      t.translate(0, 0.12 + 0.25, 0);
      teile.push(t, zylinder(0.06, 0.28, 8, 0, 0.12), kasten(0.7, 0.06, 0.7, 0, 0.62));
      break;
    }
    case 'senke': {
      // Rollentor mit Rampe.
      teile.push(kasten(0.86, 0.62, 0.16, 0, 0.12, -0.34));
      for (let i = 0; i < 4; i++) teile.push(kasten(0.8, 0.03, 0.02, 0, 0.2 + i * 0.13, -0.25));
      const rampe = kasten(0.8, 0.04, 0.5, 0, 0.12, 0.16);
      rampe.rotateX(-0.16);
      teile.push(rampe);
      break;
    }
    case 'kern': {
      // Massiver Turm mit Kuehlrippen.
      teile.push(kasten(0.62, 0.78, 0.62, 0, 0.12));
      for (let i = 0; i < 6; i++) teile.push(kasten(0.74, 0.035, 0.08, 0, 0.2 + i * 0.11, 0.3));
      teile.push(zylinder(0.1, 0.16, 8, 0, 0.9));
      break;
    }
    case 'weiche': {
      // Y-foermige Gleisverzweigung.
      teile.push(kasten(0.16, 0.14, 0.5, 0, 0.12, 0.2));
      const a = kasten(0.14, 0.12, 0.44, 0, 0.12, -0.16);
      a.rotateY(0.5);
      const b = kasten(0.14, 0.12, 0.44, 0, 0.12, -0.16);
      b.rotateY(-0.5);
      teile.push(a, b, zylinder(0.13, 0.34, 10, 0, 0.12));
      break;
    }
    case 'schranke': {
      // Schlagbaum mit Gegengewicht.
      teile.push(zylinder(0.09, 0.5, 8, -0.3, 0.12));
      const baum = kasten(0.72, 0.06, 0.06, 0.08, 0.56);
      teile.push(baum, zylinder(0.12, 0.12, 8, -0.38, 0.5));
      for (let i = 0; i < 3; i++) teile.push(kasten(0.1, 0.065, 0.065, -0.1 + i * 0.22, 0.556));
      break;
    }
    case 'verteiler': {
      // Verteilerkamm mit vier Auslaessen.
      teile.push(kasten(0.8, 0.2, 0.2, 0, 0.12, -0.22));
      for (let i = 0; i < 4; i++) teile.push(kasten(0.1, 0.14, 0.42, -0.3 + i * 0.2, 0.12, 0.16));
      break;
    }
    case 'sammler': {
      // Trichter, der nach unten zusammenlaeuft.
      const t = new THREE.CylinderGeometry(0.42, 0.12, 0.46, 10, 1, true);
      t.translate(0, 0.12 + 0.23, 0);
      teile.push(t, zylinder(0.13, 0.2, 8, 0, 0.12), kasten(0.86, 0.05, 0.12, 0, 0.56, 0));
      break;
    }
    case 'pruefer': {
      // Waage mit zwei Schalen.
      teile.push(zylinder(0.07, 0.62, 8, 0, 0.12), kasten(0.78, 0.045, 0.045, 0, 0.7));
      const schaleL = new THREE.CylinderGeometry(0.15, 0.13, 0.05, 10);
      schaleL.translate(-0.32, 0.6, 0);
      const schaleR = schaleL.clone();
      schaleR.translate(0.64, 0.04, 0);
      teile.push(schaleL, schaleR);
      break;
    }
    case 'werkzeug': {
      // Werkbank mit Schraubstock.
      teile.push(kasten(0.86, 0.32, 0.56, 0, 0.12));
      teile.push(kasten(0.2, 0.16, 0.2, -0.22, 0.44), kasten(0.1, 0.1, 0.26, 0.16, 0.44));
      teile.push(zylinder(0.03, 0.22, 6, 0.3, 0.44));
      break;
    }
    case 'speicher': {
      // Regal mit Schubfaechern.
      teile.push(kasten(0.86, 0.86, 0.5, 0, 0.12));
      for (let i = 0; i < 4; i++) {
        teile.push(kasten(0.76, 0.02, 0.02, 0, 0.24 + i * 0.19, 0.26));
        teile.push(kasten(0.14, 0.05, 0.03, (r() - 0.5) * 0.4, 0.3 + i * 0.19, 0.28));
      }
      break;
    }
    case 'wall': {
      // Massiver Riegel mit Sichtschlitz.
      teile.push(kasten(0.92, 0.9, 0.34, 0, 0.12));
      teile.push(kasten(0.6, 0.06, 0.06, 0, 0.62, 0.16));
      teile.push(kasten(0.14, 0.5, 0.42, -0.34, 0.12), kasten(0.14, 0.5, 0.42, 0.34, 0.12));
      break;
    }
    case 'sicherung': {
      // Schmelzsicherung mit Glaszylinder.
      teile.push(kasten(0.5, 0.16, 0.5, 0, 0.12));
      teile.push(zylinder(0.17, 0.46, 12, 0, 0.28), zylinder(0.2, 0.06, 12, 0, 0.24), zylinder(0.2, 0.06, 12, 0, 0.7));
      teile.push(kasten(0.03, 0.4, 0.03, 0, 0.3));
      break;
    }
    case 'hand': {
      // Pult mit Stempelkissen.
      const pult = kasten(0.86, 0.34, 0.6, 0, 0.12);
      teile.push(pult);
      const platte = kasten(0.8, 0.04, 0.5, 0, 0.46);
      platte.rotateX(-0.22);
      teile.push(platte, zylinder(0.09, 0.14, 10, 0.24, 0.5), kasten(0.22, 0.03, 0.16, -0.2, 0.5));
      break;
    }
    case 'auge': {
      // Kamerakopf auf Schwenkarm.
      teile.push(zylinder(0.08, 0.5, 8, -0.18, 0.12));
      const arm = kasten(0.4, 0.05, 0.05, 0.02, 0.6);
      teile.push(arm, kasten(0.2, 0.16, 0.24, 0.2, 0.52));
      const linse = new THREE.CylinderGeometry(0.07, 0.09, 0.1, 12);
      linse.rotateX(Math.PI / 2);
      linse.translate(0.2, 0.6, 0.16);
      teile.push(linse);
      break;
    }
    case 'schmiede': {
      // Amboss mit Esse.
      teile.push(kasten(0.5, 0.2, 0.34, -0.1, 0.12));
      const amboss = kasten(0.44, 0.14, 0.26, -0.1, 0.32);
      teile.push(amboss);
      const horn = new THREE.ConeGeometry(0.1, 0.26, 8);
      horn.rotateZ(Math.PI / 2);
      horn.translate(0.2, 0.39, 0);
      teile.push(horn, kasten(0.3, 0.6, 0.3, 0.28, 0.12), zylinder(0.08, 0.3, 8, 0.28, 0.72));
      break;
    }
  }

  const g = vereinige(teile);
  formCache.set(schluessel, g);
  return g;
}

/** Aufsatz, der die drei Kerngroessen ohne Beschriftung unterscheidbar macht. */
export function kernAufsatz(groesse: 'kolibri' | 'reiher' | 'kondor'): THREE.BufferGeometry {
  const schluessel = `kernaufsatz:${groesse}`;
  const vorhanden = formCache.get(schluessel);
  if (vorhanden) return vorhanden;
  const n = groesse === 'kolibri' ? 1 : groesse === 'reiher' ? 2 : 3;
  const teile: THREE.BufferGeometry[] = [];
  for (let i = 0; i < n; i++) {
    teile.push(zylinder(0.07, 0.1 + i * 0.06, 8, -0.18 + i * 0.18, 1.0));
  }
  const g = vereinige(teile);
  formCache.set(schluessel, g);
  return g;
}

/** Rohrfoermige Leitung entlang einer Punktfolge. */
export function leitungsForm(punkte: readonly THREE.Vector3[], radius = 0.045): THREE.BufferGeometry {
  const kurve = new THREE.CatmullRomCurve3([...punkte], false, 'centripetal', 0.4);
  const segmente = Math.max(8, Math.min(96, punkte.length * 8));
  return new THREE.TubeGeometry(kurve, segmente, radius, 6, false);
}

export function entsorgeFormen(): void {
  for (const g of formCache.values()) g.dispose();
  formCache.clear();
}

/** Alles freigeben — wird von der Speicher-Soak-Pruefung erwartet. */
export function entsorgeAussehen(): void {
  entsorgeMaterialien();
  entsorgeFormen();
}

// Ungenutzte Importe bewusst referenzieren, damit TSL-Helfer verfuegbar bleiben,
// sobald die vollprozeduralen Generatoren eingehaengt werden.
void vec4;
