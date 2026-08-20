/**
 * Prozedurale Geometrie fuer SCHWARMWERK.
 *
 * Jede sichtbare Form des Spiels entsteht hier aus Code — es gibt keine
 * externen Modelldateien. Gebaut wird ausschliesslich aus den Primitiven von
 * three.js (`BoxGeometry`, `CylinderGeometry`, `LatheGeometry`,
 * `ExtrudeGeometry`, `TubeGeometry`, `TorusGeometry`), zusammengefuehrt mit
 * `mergeGeometries`. Keine Boolean-Bibliothek, keine zusaetzliche
 * Abhaengigkeit.
 *
 * Zwei Entwurfsregeln durchziehen die Datei:
 *
 * 1. SILHOUETTE VOR FARBE. Jede der fuenfzehn Modularten muss aus der
 *    Vogelperspektive allein an ihrem Umriss erkennbar sein. Farbe ist eine
 *    Zugabe, kein Unterscheidungsmerkmal (Barrierefreiheit — rund acht Prozent
 *    der maennlichen Spieler sehen Rot und Gruen nicht zuverlaessig
 *    auseinander).
 *
 * 2. DETERMINISMUS. Alle Streuung stammt aus `erzeugeStrom(saat)` aus
 *    `src/sim/rng.ts`. `Math.random` kommt in dieser Datei nicht vor; ein Test
 *    prueft das per Quelltext-Scan.
 *
 * Koordinatenkonvention fuer Module und Fundstuecke: Fussabdruck genau eine
 * Gittereinheit, also -0.5 .. +0.5 in X und Z. Der Ursprung liegt in der Mitte
 * der Grundflaeche, die Unterkante auf y = 0. Damit kann der Aufbau ein Modul
 * ohne weitere Rechnung auf ein Gitterfeld setzen.
 */

import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { erzeugeStrom } from '../sim/rng';
import type { ModulArt } from '../sim/typen';

// ---------------------------------------------------------------------------
// Grundwerkzeug
// ---------------------------------------------------------------------------

/** Sicherheitsabstand zum Feldrand, damit Nachbarmodule sich nie beruehren. */
const RAND = 0.49;

/** Leere, aber vollstaendig gueltige Geometrie (position/normal/uv, kein Dreieck). */
function leereGeometrie(): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(0), 3));
  g.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(0), 3));
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(0), 2));
  // Von Hand gesetzt: `computeBoundingSphere` erzeugt fuer null Punkte NaN.
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 0);
  return g;
}

/**
 * Fuehrt Teilgeometrien zu EINER Geometrie zusammen.
 *
 * Entscheidung: alles wird vorher auf nicht-indiziert gebracht.
 * `ExtrudeGeometry` liefert grundsaetzlich keinen Index, alle anderen
 * Primitive liefern einen — `mergeGeometries` verweigert den Mischbetrieb.
 * Ein einheitlicher Pfad ist zuverlaessiger als Sonderfaelle, und bei
 * hoechstens 1200 Dreiecken je Modul ist der zusaetzliche Speicher belanglos.
 */
function vereine(teile: readonly THREE.BufferGeometry[]): THREE.BufferGeometry {
  if (teile.length === 0) return leereGeometrie();
  const flach = teile.map((g) => (g.index !== null ? g.toNonIndexed() : g));
  const zusammen = mergeGeometries(flach, false);
  if (zusammen === null) {
    throw new Error('Geometrien liessen sich nicht vereinen — unterschiedliche Attribute.');
  }
  for (const g of flach) g.dispose();
  zusammen.computeBoundingSphere();
  return zusammen;
}

/** Dreht eine Geometrie um ihren eigenen Ursprung (Reihenfolge X, Y, Z). */
function dreh(g: THREE.BufferGeometry, rx: number, ry: number, rz: number): THREE.BufferGeometry {
  if (rx !== 0) g.rotateX(rx);
  if (ry !== 0) g.rotateY(ry);
  if (rz !== 0) g.rotateZ(rz);
  return g;
}

/** Quader, `y` ist die MITTE. 12 Dreiecke. */
function kasten(
  b: number,
  h: number,
  t: number,
  x: number,
  y: number,
  z: number,
  rx = 0,
  ry = 0,
  rz = 0
): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(b, h, t);
  dreh(g, rx, ry, rz);
  g.translate(x, y, z);
  return g;
}

/** Quader, `y` ist die UNTERKANTE. Bequem fuer alles, was auf dem Boden steht. */
function block(b: number, h: number, t: number, x: number, y: number, z: number): THREE.BufferGeometry {
  return kasten(b, h, t, x, y + h / 2, z);
}

/** Zylinder, `y` ist die UNTERKANTE, Achse steht senkrecht. */
function zylinder(
  rOben: number,
  rUnten: number,
  h: number,
  seiten: number,
  x: number,
  y: number,
  z: number,
  offen = false
): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(rOben, rUnten, h, seiten, 1, offen);
  g.translate(x, y + h / 2, z);
  return g;
}

/** Liegender Zylinder (Achse entlang X oder Z), `y` ist die MITTE. */
function walze(
  r: number,
  laenge: number,
  seiten: number,
  achse: 'x' | 'z',
  x: number,
  y: number,
  z: number
): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(r, r, laenge, seiten, 1, false);
  if (achse === 'x') g.rotateZ(Math.PI / 2);
  else g.rotateX(Math.PI / 2);
  g.translate(x, y, z);
  return g;
}

/** Flach liegender Ring (Torus in der XZ-Ebene), `y` ist die MITTE. */
function ring(
  r: number,
  dicke: number,
  x: number,
  y: number,
  z: number,
  seiten = 6,
  roehren = 14
): THREE.BufferGeometry {
  const g = new THREE.TorusGeometry(r, dicke, seiten, roehren);
  g.rotateX(Math.PI / 2);
  g.translate(x, y, z);
  return g;
}

/** Rotationskoerper aus einem Profil `[radius, hoehe]`. */
function profil(
  punkte: readonly (readonly [number, number])[],
  seiten: number,
  x: number,
  y: number,
  z: number
): THREE.BufferGeometry {
  const v = punkte.map((p) => new THREE.Vector2(p[0], p[1]));
  const g = new THREE.LatheGeometry(v, seiten);
  g.translate(x, y, z);
  return g;
}

/** Flache Platte mit abgeschraegten Ecken (Extrusion) — z. B. Emailleschilder. */
function schildPlatte(
  breite: number,
  hoehe: number,
  tiefe: number,
  fase: number
): THREE.BufferGeometry {
  const form = new THREE.Shape();
  const b = breite / 2;
  const h = hoehe / 2;
  form.moveTo(-b + fase, -h);
  form.lineTo(b - fase, -h);
  form.lineTo(b, -h + fase);
  form.lineTo(b, h - fase);
  form.lineTo(b - fase, h);
  form.lineTo(-b + fase, h);
  form.lineTo(-b, h - fase);
  form.lineTo(-b, -h + fase);
  form.closePath();
  const g = new THREE.ExtrudeGeometry(form, { depth: tiefe, bevelEnabled: false, curveSegments: 1 });
  g.translate(0, 0, -tiefe / 2);
  return g;
}

/** Ganzzahl aus einem Strom, beide Grenzen einschliesslich. */
function ganz(w: () => number, von: number, bis: number): number {
  return von + Math.floor(w() * (bis - von + 1 - 1e-9));
}

/** Gleitkommazahl aus einem Strom. */
function spanne(w: () => number, von: number, bis: number): number {
  return von + (bis - von) * w();
}

/**
 * Nietenkranz. Steht in jedem Modul — dadurch reagiert jede Modulart
 * nachweisbar auf ihre Saat, und die Bauteile bekommen die Handschrift der
 * Fuenfzigerjahre.
 */
function nieten(
  w: () => number,
  anzahl: number,
  radius: number,
  y: number,
  hoehe = 0.02
): THREE.BufferGeometry[] {
  const raus: THREE.BufferGeometry[] = [];
  for (let i = 0; i < anzahl; i++) {
    const winkel = (i / anzahl) * Math.PI * 2 + spanne(w, -0.25, 0.25);
    const r = radius * spanne(w, 0.92, 1.0);
    raus.push(zylinder(0.014, 0.018, hoehe, 5, Math.cos(winkel) * r, y, Math.sin(winkel) * r));
  }
  return raus;
}

/**
 * Letzte Instanz vor der Rueckgabe: haelt den Fussabdruck ein, setzt die
 * Unterkante exakt auf y = 0 und deckelt die Hoehe. Die Formen sind so
 * entworfen, dass hier normalerweise nichts mehr zu tun ist — die Funktion ist
 * das Sicherheitsnetz, das den Gitteraufbau vor einem verrutschten Anbau
 * schuetzt.
 */
function passeEin(g: THREE.BufferGeometry, maxHoehe = 1.8): THREE.BufferGeometry {
  g.computeBoundingBox();
  const kasten1 = g.boundingBox;
  if (kasten1 === null) return g;
  const halbX = Math.max(Math.abs(kasten1.min.x), Math.abs(kasten1.max.x));
  const halbZ = Math.max(Math.abs(kasten1.min.z), Math.abs(kasten1.max.z));
  const hoehe = kasten1.max.y - kasten1.min.y;
  const sx = halbX > RAND ? RAND / halbX : 1;
  const sz = halbZ > RAND ? RAND / halbZ : 1;
  const sy = hoehe > maxHoehe ? maxHoehe / hoehe : 1;
  if (sx !== 1 || sy !== 1 || sz !== 1) g.scale(sx, sy, sz);
  g.computeBoundingBox();
  const kasten2 = g.boundingBox;
  if (kasten2 !== null && Math.abs(kasten2.min.y) > 1e-7) g.translate(0, -kasten2.min.y, 0);
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return g;
}

// ---------------------------------------------------------------------------
// Die fuenfzehn Modularten
// ---------------------------------------------------------------------------

/** quelle — offene Schuette: weiter Trichtermund ueber einer Stuetzbuehne. */
function bauQuelle(w: () => number): THREE.BufferGeometry[] {
  const t: THREE.BufferGeometry[] = [];
  t.push(block(0.9, 0.05, 0.9, 0, 0, 0));
  for (const [sx, sz] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ] as const) {
    t.push(block(0.07, 0.42, 0.07, sx * 0.33, 0.05, sz * 0.33));
  }
  // Trichtermantel, oben offen — von oben ein klarer Kreis im Quadrat.
  const trichter = new THREE.CylinderGeometry(0.42, 0.13, 0.55, 14, 1, true);
  trichter.translate(0, 0.47 + 0.275, 0);
  t.push(trichter);
  t.push(ring(0.42, 0.035, 0, 1.02, 0, 6, 16));
  t.push(zylinder(0.1, 0.1, 0.22, 8, 0, 0.26, 0));
  // Zulaufrutsche, leicht geneigt an der Nordkante.
  t.push(kasten(0.3, 0.03, 0.34, 0, 1.02, -0.3, spanne(w, 0.28, 0.38), 0, 0));
  t.push(kasten(0.03, 0.1, 0.34, -0.15, 1.05, -0.3, spanne(w, 0.28, 0.38), 0, 0));
  t.push(kasten(0.03, 0.1, 0.34, 0.15, 1.05, -0.3, spanne(w, 0.28, 0.38), 0, 0));
  t.push(...nieten(w, ganz(w, 5, 7), 0.36, 0.06));
  return t;
}

/** senke — Rollentor mit Rampe: Torrahmen, aufgerollte Lamellen, Auffahrt. */
function bauSenke(w: () => number): THREE.BufferGeometry[] {
  const t: THREE.BufferGeometry[] = [];
  t.push(block(0.92, 0.05, 0.92, 0, 0, 0));
  t.push(block(0.1, 1.05, 0.14, -0.39, 0.05, -0.24));
  t.push(block(0.1, 1.05, 0.14, 0.39, 0.05, -0.24));
  t.push(block(0.94, 0.13, 0.17, 0, 1.1, -0.24));
  t.push(walze(0.11, 0.76, 10, 'x', 0, 1.03, -0.24));
  // Halb heruntergelassenes Torblatt mit Lamellen.
  t.push(block(0.76, 0.26, 0.04, 0, 0.66, -0.24));
  for (let i = 0; i < 4; i++) {
    t.push(block(0.76, 0.045, 0.06, 0, 0.66 + i * 0.065, -0.2));
  }
  // Rampe, die zum Kunden hinausfuehrt.
  const neigung = spanne(w, 0.16, 0.22);
  t.push(kasten(0.66, 0.05, 0.58, 0, 0.12, 0.16, -neigung, 0, 0));
  t.push(kasten(0.05, 0.11, 0.58, -0.33, 0.15, 0.16, -neigung, 0, 0));
  t.push(kasten(0.05, 0.11, 0.58, 0.33, 0.15, 0.16, -neigung, 0, 0));
  t.push(schildPlatte(0.3, 0.1, 0.02, 0.02).translate(0, 1.22, -0.24));
  t.push(...nieten(w, ganz(w, 4, 6), 0.34, 0.055));
  return t;
}

/** kern — massiver Turm mit Kuehlrippen; der Aufsatz erzaehlt die Groesse. */
function bauKern(w: () => number): THREE.BufferGeometry[] {
  const t: THREE.BufferGeometry[] = [];
  t.push(block(0.88, 0.08, 0.88, 0, 0, 0));
  t.push(block(0.5, 0.85, 0.5, 0, 0.08, 0));
  const rippen = ganz(w, 6, 8);
  for (let i = 0; i < rippen; i++) {
    const y = 0.16 + (i / rippen) * 0.68;
    t.push(block(0.64, 0.03, 0.64, 0, y, 0));
  }
  t.push(block(0.1, 0.8, 0.07, 0, 0.1, -0.29));
  t.push(block(0.6, 0.06, 0.6, 0, 0.93, 0));
  t.push(schildPlatte(0.24, 0.12, 0.02, 0.02).translate(0, 0.72, 0.27));
  for (const sx of [-1, 1] as const) {
    t.push(kasten(0.05, 0.34, 0.05, sx * 0.3, 0.22, 0.3, 0, 0, sx * spanne(w, 0.22, 0.3)));
  }
  t.push(...nieten(w, ganz(w, 6, 8), 0.38, 0.09));
  return t;
}

/**
 * Aufsatz fuer die drei Kerngroessen. Der Ursprung liegt auf der Montageflaeche
 * (y = 0), damit der Aufbau ihn ohne Rechnung auf die Kopfplatte des Turms
 * setzen kann. Kolibri traegt eine flache Haube, Reiher zwei Ringe, Kondor
 * einen dreifach gestuften Aufbau mit Mast — die Bauhoehe erzaehlt den Preis.
 */
export function kernAufsatz(groesse: 'kolibri' | 'reiher' | 'kondor'): THREE.BufferGeometry {
  const t: THREE.BufferGeometry[] = [];
  if (groesse === 'kolibri') {
    t.push(profil(
      [
        [0.2, 0],
        [0.2, 0.05],
        [0.15, 0.12],
        [0.04, 0.16],
      ],
      12,
      0,
      0,
      0
    ));
    t.push(zylinder(0.012, 0.012, 0.05, 5, 0, 0.16, 0));
  } else if (groesse === 'reiher') {
    t.push(zylinder(0.22, 0.24, 0.1, 12, 0, 0, 0));
    t.push(ring(0.2, 0.025, 0, 0.14, 0, 6, 14));
    t.push(zylinder(0.16, 0.18, 0.12, 12, 0, 0.18, 0));
    t.push(ring(0.15, 0.022, 0, 0.32, 0, 6, 14));
    t.push(zylinder(0.03, 0.04, 0.1, 6, 0, 0.32, 0));
  } else {
    t.push(zylinder(0.24, 0.26, 0.12, 14, 0, 0, 0));
    t.push(zylinder(0.19, 0.21, 0.12, 14, 0, 0.12, 0));
    t.push(zylinder(0.14, 0.16, 0.12, 14, 0, 0.24, 0));
    t.push(ring(0.22, 0.028, 0, 0.06, 0, 6, 16));
    t.push(ring(0.17, 0.026, 0, 0.18, 0, 6, 16));
    t.push(zylinder(0.028, 0.035, 0.3, 6, 0, 0.36, 0));
    t.push(ring(0.06, 0.02, 0, 0.6, 0, 5, 12));
    t.push(zylinder(0.04, 0.05, 0.07, 8, 0, 0.63, 0));
  }
  const g = vereine(t);
  g.computeBoundingSphere();
  return g;
}

/** weiche — Y-foermige Gleisverzweigung mit Stellhebel und Signalmast. */
function bauWeiche(w: () => number): THREE.BufferGeometry[] {
  const t: THREE.BufferGeometry[] = [];
  t.push(block(0.92, 0.06, 0.92, 0, 0, 0));
  for (let i = 0; i < 5; i++) {
    t.push(block(0.52, 0.03, 0.06, 0, 0.06, -0.4 + i * 0.14));
  }
  // Einlauf aus -Z.
  for (const sx of [-1, 1] as const) {
    t.push(block(0.035, 0.05, 0.44, sx * 0.09, 0.09, -0.23));
  }
  t.push(block(0.16, 0.06, 0.16, 0, 0.09, -0.01));
  // Zwei Zweige nach +Z.
  const winkel = spanne(w, 0.4, 0.48);
  for (const richtung of [-1, 1] as const) {
    const a = richtung * winkel;
    const mx = Math.sin(a) * 0.24;
    const mz = -0.01 + Math.cos(a) * 0.24;
    for (const seite of [-1, 1] as const) {
      const ox = Math.cos(a) * 0.085 * seite;
      const oz = -Math.sin(a) * 0.085 * seite;
      t.push(kasten(0.035, 0.05, 0.46, mx + ox, 0.115, mz + oz, 0, a, 0));
    }
  }
  // Stellhebel mit Gegengewicht.
  t.push(zylinder(0.03, 0.04, 0.26, 6, -0.35, 0.06, 0.02));
  t.push(kasten(0.04, 0.24, 0.04, -0.32, 0.38, 0.02, 0, 0, 0.5));
  t.push(zylinder(0.06, 0.06, 0.04, 8, -0.26, 0.46, 0.02));
  // Signalmast — gibt der Weiche eine hohe Marke im Umriss.
  t.push(zylinder(0.025, 0.032, 0.6, 6, 0.35, 0.06, -0.3));
  t.push(block(0.1, 0.18, 0.06, 0.35, 0.66, -0.3));
  t.push(zylinder(0.03, 0.03, 0.02, 6, 0.35, 0.78, -0.27));
  t.push(...nieten(w, ganz(w, 4, 6), 0.4, 0.07));
  return t;
}

/** schranke — Schlagbaum mit Gegengewicht und Warnstreifen. */
function bauSchranke(w: () => number): THREE.BufferGeometry[] {
  const t: THREE.BufferGeometry[] = [];
  t.push(block(0.9, 0.06, 0.9, 0, 0, 0));
  t.push(block(0.15, 0.68, 0.15, -0.2, 0.06, 0));
  t.push(block(0.22, 0.12, 0.2, -0.2, 0.74, 0));
  t.push(walze(0.06, 0.24, 8, 'x', -0.2, 0.79, 0));
  const neigung = spanne(w, -0.34, -0.24);
  const cos = Math.cos(neigung);
  const sin = Math.sin(neigung);
  // Baum quer ueber das Feld, das kurze Ende traegt das Gegengewicht.
  t.push(kasten(0.8, 0.055, 0.09, 0.06, 0.79, 0, 0, 0, neigung));
  for (let i = 0; i < 4; i++) {
    const d = -0.3 + i * 0.2;
    t.push(kasten(0.1, 0.062, 0.1, 0.06 + d * cos, 0.79 + d * sin, 0, 0, 0, neigung));
  }
  t.push(walze(0.09, 0.1, 8, 'x', 0.06 - 0.42 * cos, 0.79 - 0.42 * sin, 0));
  t.push(kasten(0.04, 0.3, 0.04, -0.28, 0.5, 0, 0, 0, -0.5));
  t.push(zylinder(0.035, 0.035, 0.05, 6, 0.06 + 0.36 * cos, 0.79 + 0.36 * sin, 0));
  t.push(...nieten(w, ganz(w, 4, 6), 0.33, 0.07));
  return t;
}

/** verteiler — Verteilerkamm: ein Sammelrohr, vier Auslaesse nach unten. */
function bauVerteiler(w: () => number): THREE.BufferGeometry[] {
  const t: THREE.BufferGeometry[] = [];
  t.push(block(0.92, 0.06, 0.8, 0, 0, 0));
  for (const sx of [-1, 1] as const) {
    t.push(block(0.08, 0.78, 0.08, sx * 0.39, 0.06, 0));
  }
  t.push(walze(0.1, 0.86, 10, 'x', 0, 0.88, 0));
  t.push(walze(0.07, 0.3, 8, 'z', 0, 0.88, -0.3));
  const auslaesse = [-0.3, -0.1, 0.1, 0.3] as const;
  for (const x of auslaesse) {
    t.push(zylinder(0.05, 0.05, 0.42, 8, x, 0.4, 0));
    t.push(zylinder(0.078, 0.05, 0.09, 8, x, 0.33, 0));
    t.push(zylinder(0.055, 0.055, 0.03, 8, x, spanne(w, 0.66, 0.72), 0.1));
  }
  t.push(block(0.86, 0.05, 0.05, 0, 0.3, -0.26));
  t.push(...nieten(w, ganz(w, 5, 7), 0.37, 0.07));
  return t;
}

/** sammler — Trichter, der nach unten in eine Sammeltrommel zusammenlaeuft. */
function bauSammler(w: () => number): THREE.BufferGeometry[] {
  const t: THREE.BufferGeometry[] = [];
  t.push(block(0.9, 0.05, 0.9, 0, 0, 0));
  t.push(zylinder(0.26, 0.28, 0.32, 12, 0, 0.05, 0));
  t.push(profil(
    [
      [0.2, 0.37],
      [0.3, 0.56],
      [0.4, 0.78],
      [0.45, 0.95],
    ],
    16,
    0,
    0,
    0
  ));
  t.push(ring(0.45, 0.03, 0, 0.95, 0, 6, 16));
  // Vier Einlaufrutschen laufen von den Ecken in den Trichter.
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const g = kasten(0.2, 0.025, 0.3, 0, 0.95, 0, spanne(w, 0.34, 0.44), 0, 0);
    g.rotateY(a);
    g.translate(Math.sin(a) * 0.3, 0.03, Math.cos(a) * 0.3);
    t.push(g);
  }
  t.push(walze(0.06, 0.2, 8, 'z', 0, 0.16, 0.3));
  for (const sx of [-1, 1] as const) {
    t.push(kasten(0.04, 0.6, 0.04, sx * 0.36, 0.5, 0, 0, 0, sx * 0.18));
  }
  t.push(...nieten(w, ganz(w, 6, 8), 0.3, 0.06));
  return t;
}

/** pruefer — Balkenwaage mit zwei Schalen und Skalenbogen. */
function bauPruefer(w: () => number): THREE.BufferGeometry[] {
  const t: THREE.BufferGeometry[] = [];
  t.push(profil(
    [
      [0.4, 0],
      [0.4, 0.05],
      [0.3, 0.09],
      [0.28, 0.12],
    ],
    14,
    0,
    0,
    0
  ));
  t.push(zylinder(0.05, 0.09, 0.85, 8, 0, 0.12, 0));
  const kippe = spanne(w, -0.1, 0.1);
  t.push(kasten(0.7, 0.05, 0.07, 0, 1.0, 0, 0, 0, kippe));
  t.push(kasten(0.03, 0.16, 0.03, 0, 1.09, 0, 0, 0, kippe));
  t.push(ring(0.11, 0.012, 0, 1.02, 0, 5, 12));
  for (const sx of [-1, 1] as const) {
    const yb = 1.0 + sx * Math.sin(kippe) * 0.33;
    t.push(zylinder(0.008, 0.008, 0.24, 5, sx * 0.33, yb - 0.26, 0));
    t.push(profil(
      [
        [0.02, 0],
        [0.09, 0.012],
        [0.15, 0.05],
        [0.16, 0.075],
      ],
      12,
      sx * 0.33,
      yb - 0.28,
      0
    ));
  }
  t.push(...nieten(w, ganz(w, 5, 7), 0.33, 0.05));
  return t;
}

/** werkzeug — Werkbank mit Schraubstock und Werkzeugtafel. */
function bauWerkzeug(w: () => number): THREE.BufferGeometry[] {
  const t: THREE.BufferGeometry[] = [];
  for (const sx of [-1, 1] as const) {
    for (const sz of [-1, 1] as const) {
      t.push(block(0.07, 0.6, 0.07, sx * 0.38, 0, sz * 0.24));
    }
    t.push(block(0.07, 0.05, 0.46, sx * 0.38, 0.16, 0));
  }
  t.push(block(0.9, 0.08, 0.62, 0, 0.6, -0.04));
  t.push(block(0.86, 0.5, 0.04, 0, 0.68, -0.33));
  for (let i = 0; i < 5; i++) {
    const h = spanne(w, 0.1, 0.24);
    t.push(block(0.045, h, 0.035, -0.34 + i * 0.17, 0.86, -0.29));
  }
  // Schraubstock auf der Platte.
  t.push(zylinder(0.09, 0.11, 0.05, 8, 0.16, 0.68, 0.12));
  t.push(block(0.2, 0.11, 0.05, 0.16, 0.73, 0.03));
  t.push(block(0.2, 0.11, 0.05, 0.16, 0.73, 0.19));
  t.push(walze(0.02, 0.24, 6, 'z', 0.16, 0.78, 0.14));
  t.push(walze(0.045, 0.03, 8, 'z', 0.16, 0.78, 0.27));
  t.push(block(0.3, 0.12, 0.03, -0.2, 0.46, 0.26));
  t.push(block(0.14, 0.025, 0.03, -0.2, 0.51, 0.29));
  t.push(...nieten(w, ganz(w, 4, 6), 0.32, 0.665));
  return t;
}

/** speicher — Regal mit acht Schubfaechern. */
function bauSpeicher(w: () => number): THREE.BufferGeometry[] {
  const t: THREE.BufferGeometry[] = [];
  t.push(block(0.92, 0.08, 0.76, 0, 0, 0));
  for (const sx of [-1, 1] as const) {
    t.push(block(0.05, 1.32, 0.7, sx * 0.42, 0.08, 0));
  }
  t.push(block(0.8, 1.32, 0.04, 0, 0.08, -0.33));
  t.push(block(0.9, 0.06, 0.72, 0, 1.34, 0));
  for (let i = 0; i < 5; i++) {
    t.push(block(0.8, 0.025, 0.66, 0, 0.14 + i * 0.29, 0));
  }
  for (let r = 0; r < 4; r++) {
    for (const sx of [-1, 1] as const) {
      const y = 0.19 + r * 0.29;
      const vor = spanne(w, 0, 0.03);
      t.push(block(0.37, 0.23, 0.03, sx * 0.2, y, 0.32 + vor));
      t.push(block(0.14, 0.025, 0.025, sx * 0.2, y + 0.1, 0.35 + vor));
    }
  }
  t.push(schildPlatte(0.26, 0.09, 0.015, 0.015).translate(0, 1.28, 0.34));
  t.push(...nieten(w, ganz(w, 4, 6), 0.38, 0.045));
  return t;
}

/** wall — massiver Riegel mit waagerechtem Sichtschlitz. */
function bauWall(w: () => number): THREE.BufferGeometry[] {
  const t: THREE.BufferGeometry[] = [];
  t.push(block(0.96, 0.1, 0.5, 0, 0, 0));
  t.push(block(0.9, 0.6, 0.36, 0, 0.1, 0));
  t.push(block(0.9, 0.44, 0.36, 0, 0.84, 0));
  for (const x of [-0.3, 0, 0.3] as const) {
    t.push(block(0.06, 0.14, 0.36, x, 0.7, 0));
  }
  for (const sx of [-1, 1] as const) {
    t.push(block(0.16, 0.88, 0.16, sx * 0.36, 0.1, 0.22));
    t.push(kasten(0.1, 0.5, 0.1, sx * 0.36, 0.5, -0.2, spanne(w, 0.1, 0.2), 0, 0));
  }
  t.push(block(0.98, 0.08, 0.44, 0, 1.28, 0));
  t.push(schildPlatte(0.22, 0.1, 0.02, 0.02).translate(0, 0.36, 0.19));
  t.push(...nieten(w, ganz(w, 7, 9), 0.4, 0.115));
  return t;
}

/** sicherung — Schmelzsicherung: Keramiksockel, Glaszylinder, Meldekopf. */
function bauSicherung(w: () => number): THREE.BufferGeometry[] {
  const t: THREE.BufferGeometry[] = [];
  t.push(block(0.82, 0.05, 0.82, 0, 0, 0));
  t.push(profil(
    [
      [0.34, 0.05],
      [0.34, 0.11],
      [0.26, 0.15],
      [0.24, 0.26],
    ],
    14,
    0,
    0,
    0
  ));
  t.push(zylinder(0.16, 0.17, 0.14, 12, 0, 0.26, 0));
  const glas = new THREE.CylinderGeometry(0.13, 0.13, 0.5, 14, 1, true);
  glas.translate(0, 0.4 + 0.25, 0);
  t.push(glas);
  t.push(zylinder(0.012, 0.012, 0.5, 5, 0, 0.4, 0));
  t.push(zylinder(0.17, 0.16, 0.14, 12, 0, 0.9, 0));
  t.push(zylinder(0.05, 0.06, 0.06, 8, 0, 1.04, 0));
  for (const sx of [-1, 1] as const) {
    t.push(block(0.08, 0.3, 0.1, sx * 0.3, 0.05, 0));
    t.push(kasten(0.16, 0.04, 0.06, sx * 0.26, 0.33, 0, 0, 0, sx * spanne(w, 0.1, 0.2)));
  }
  t.push(...nieten(w, ganz(w, 5, 7), 0.3, 0.055));
  return t;
}

/** hand — Pult mit Stempelkissen, Stempel und Aktenfach. */
function bauHand(w: () => number): THREE.BufferGeometry[] {
  const t: THREE.BufferGeometry[] = [];
  t.push(block(0.9, 0.06, 0.86, 0, 0, 0));
  t.push(block(0.58, 0.56, 0.44, 0, 0.06, -0.06));
  for (const sx of [-1, 1] as const) {
    t.push(block(0.05, 0.62, 0.5, sx * 0.36, 0.06, -0.04));
  }
  const neigung = spanne(w, -0.28, -0.2);
  const cos = Math.cos(neigung);
  const sin = Math.sin(neigung);
  t.push(kasten(0.84, 0.05, 0.52, 0, 0.68, 0.02, neigung, 0, 0));
  t.push(kasten(0.84, 0.04, 0.05, 0, 0.68 - 0.26 * sin - 0.03, 0.02 + 0.26 * cos, neigung, 0, 0));
  // Stempelkissen und Stempel liegen auf der geneigten Platte.
  const px = -0.24;
  const pz = 0.02 + 0.08 * cos;
  const py = 0.71 - 0.08 * sin;
  t.push(kasten(0.17, 0.035, 0.13, px, py, pz, neigung, 0, 0));
  t.push(kasten(0.1, 0.05, 0.08, 0.16, py + 0.03, pz, neigung, 0, 0));
  t.push(zylinder(0.025, 0.032, 0.11, 8, 0.16, py + 0.05, pz));
  t.push(zylinder(0.055, 0.045, 0.03, 8, 0.16, py + 0.16, pz));
  t.push(kasten(0.24, 0.035, 0.18, 0.05, py + 0.02, pz - 0.24, neigung, 0, 0));
  // Pultlampe.
  t.push(zylinder(0.02, 0.025, 0.34, 6, -0.34, 0.68, -0.2));
  t.push(zylinder(0.1, 0.03, 0.09, 8, -0.34, 0.98, -0.2));
  t.push(...nieten(w, ganz(w, 4, 6), 0.36, 0.055));
  return t;
}

/** auge — Kamerakopf auf Schwenkarm ueber einem Mast. */
function bauAuge(w: () => number): THREE.BufferGeometry[] {
  const t: THREE.BufferGeometry[] = [];
  t.push(profil(
    [
      [0.34, 0],
      [0.34, 0.05],
      [0.24, 0.08],
      [0.1, 0.1],
    ],
    14,
    0,
    0,
    0
  ));
  t.push(zylinder(0.05, 0.07, 0.78, 8, 0, 0.1, 0));
  t.push(zylinder(0.09, 0.09, 0.1, 8, 0, 0.88, 0));
  const schwenk = spanne(w, -0.3, 0.3);
  t.push(kasten(0.52, 0.07, 0.07, 0.14, 0.97, 0));
  t.push(kasten(0.2, 0.17, 0.3, 0.34, 0.97, 0, 0, schwenk, 0));
  t.push(walze(0.075, 0.14, 10, 'z', 0.34 + Math.sin(schwenk) * 0.2, 0.97, Math.cos(schwenk) * 0.2));
  const blende = new THREE.CylinderGeometry(0.11, 0.095, 0.1, 10, 1, true);
  blende.rotateX(Math.PI / 2);
  blende.rotateY(schwenk);
  blende.translate(0.34 + Math.sin(schwenk) * 0.26, 0.97, Math.cos(schwenk) * 0.26);
  t.push(blende);
  t.push(zylinder(0.025, 0.025, 0.02, 6, 0.34, 1.07, 0));
  t.push(walze(0.075, 0.1, 8, 'x', -0.14, 0.97, 0));
  t.push(block(0.05, 0.3, 0.05, -0.3, 0.1, -0.28));
  t.push(...nieten(w, ganz(w, 6, 8), 0.28, 0.045));
  return t;
}

/** schmiede — Amboss auf Hackklotz neben einer Esse mit Rauchrohr. */
function bauSchmiede(w: () => number): THREE.BufferGeometry[] {
  const t: THREE.BufferGeometry[] = [];
  t.push(block(0.92, 0.05, 0.92, 0, 0, 0));
  // Amboss.
  t.push(zylinder(0.17, 0.2, 0.3, 10, -0.2, 0.05, 0.18));
  t.push(block(0.3, 0.06, 0.16, -0.2, 0.35, 0.18));
  t.push(block(0.36, 0.08, 0.19, -0.2, 0.41, 0.18));
  t.push(walze(0.06, 0.14, 8, 'x', -0.44, 0.45, 0.18));
  // Esse mit Feuerschale und Haube.
  t.push(block(0.44, 0.36, 0.42, 0.24, 0.05, -0.16));
  t.push(zylinder(0.16, 0.11, 0.1, 10, 0.24, 0.41, -0.16));
  const haube = new THREE.CylinderGeometry(0.07, 0.24, 0.26, 10, 1, true);
  haube.translate(0.24, 0.64, -0.16);
  t.push(haube);
  t.push(zylinder(0.06, 0.06, 0.55, 8, 0.24, 0.77, -0.16));
  t.push(ring(0.07, 0.018, 0.24, 1.1, -0.16, 5, 12));
  // Blasebalgrohr und Werkzeug an der Wand der Esse.
  t.push(walze(0.035, 0.24, 6, 'x', 0.02, 0.28, -0.16));
  for (let i = 0; i < 2; i++) {
    t.push(kasten(0.03, 0.3, 0.03, 0.44, 0.4, 0.16 + i * 0.1, 0, 0, spanne(w, -0.16, 0.16)));
  }
  t.push(...nieten(w, ganz(w, 5, 7), 0.36, 0.055));
  return t;
}

/**
 * Silhouette eines Moduls. Fussabdruck genau 1x1 Gittereinheit (also -0.5..+0.5
 * in X und Z), Ursprung in der Mitte der Grundflaeche (y = 0 unten), Hoehe 0.5
 * bis 1.8. Jede Modulart ist aus der Vogelperspektive an ihrer SILHOUETTE
 * erkennbar, nicht nur an der Farbe.
 */
export function modulGeometrie(art: ModulArt, saat: number): THREE.BufferGeometry {
  const w = erzeugeStrom(saat ^ 0x5c47_0000);
  let teile: THREE.BufferGeometry[];
  switch (art) {
    case 'quelle':
      teile = bauQuelle(w);
      break;
    case 'senke':
      teile = bauSenke(w);
      break;
    case 'kern':
      teile = bauKern(w);
      break;
    case 'weiche':
      teile = bauWeiche(w);
      break;
    case 'schranke':
      teile = bauSchranke(w);
      break;
    case 'verteiler':
      teile = bauVerteiler(w);
      break;
    case 'sammler':
      teile = bauSammler(w);
      break;
    case 'pruefer':
      teile = bauPruefer(w);
      break;
    case 'werkzeug':
      teile = bauWerkzeug(w);
      break;
    case 'speicher':
      teile = bauSpeicher(w);
      break;
    case 'wall':
      teile = bauWall(w);
      break;
    case 'sicherung':
      teile = bauSicherung(w);
      break;
    case 'hand':
      teile = bauHand(w);
      break;
    case 'auge':
      teile = bauAuge(w);
      break;
    case 'schmiede':
      teile = bauSchmiede(w);
      break;
  }
  return passeEin(vereine(teile), 1.8);
}

// ---------------------------------------------------------------------------
// Greeble
// ---------------------------------------------------------------------------

/**
 * Kleine Anbauten fuer Detailreichtum (Kuehlrippen, Kabelkanaele, Schilder,
 * Nieten).
 *
 * Die Teile liegen auf einer Platte in der XY-Ebene, mittig um den Ursprung,
 * und wachsen nach +Z. Der Aufrufer dreht und setzt das Ergebnis auf die
 * Flaeche, die er beleben will. `dichte` ist die Anzahl Teile je
 * Quadrateinheit; hoechstens 240 Teile werden erzeugt, damit ein
 * Aufrufversehen nie das Dreiecksbudget sprengt.
 */
export function greeble(saat: number, dichte: number, flaeche: THREE.Vector2): THREE.BufferGeometry {
  const w = erzeugeStrom(saat ^ 0x67_2b1e);
  const bx = Math.max(0, flaeche.x);
  const by = Math.max(0, flaeche.y);
  const anzahl = Math.min(240, Math.max(0, Math.round(dichte * bx * by)));
  if (anzahl === 0 || bx <= 0 || by <= 0) return leereGeometrie();

  const teile: THREE.BufferGeometry[] = [];
  for (let i = 0; i < anzahl; i++) {
    const art = ganz(w, 0, 3);
    const x = spanne(w, -bx / 2, bx / 2);
    const y = spanne(w, -by / 2, by / 2);
    if (art === 0) {
      // Kuehlrippe: schmal, hoch, flach herausstehend.
      const h = Math.min(by * 0.5, spanne(w, by * 0.15, by * 0.45));
      const d = spanne(w, 0.02, 0.06);
      teile.push(kasten(spanne(w, 0.015, 0.035), h, d, x, y, d / 2));
    } else if (art === 1) {
      // Kabelkanal: lang, niedrig, waagerecht.
      const b = Math.min(bx * 0.6, spanne(w, bx * 0.2, bx * 0.5));
      const d = spanne(w, 0.015, 0.04);
      teile.push(kasten(b, spanne(w, 0.02, 0.05), d, x, y, d / 2));
    } else if (art === 2) {
      // Schild: Platte mit Fase, darauf ein duenneres Feld.
      const b = spanne(w, 0.1, 0.24);
      const h = spanne(w, 0.05, 0.11);
      const p = schildPlatte(b, h, 0.014, Math.min(b, h) * 0.18);
      p.translate(x, y, 0.007);
      teile.push(p);
      const f = schildPlatte(b * 0.78, h * 0.66, 0.008, Math.min(b, h) * 0.12);
      f.translate(x, y, 0.018);
      teile.push(f);
    } else {
      // Niete.
      const r = spanne(w, 0.008, 0.016);
      const g = new THREE.CylinderGeometry(r * 0.8, r, spanne(w, 0.008, 0.018), 5);
      g.rotateX(Math.PI / 2);
      g.translate(x, y, 0.008);
      teile.push(g);
    }
  }
  const g = vereine(teile);
  g.computeBoundingSphere();
  return g;
}

// ---------------------------------------------------------------------------
// Leitungen
// ---------------------------------------------------------------------------

/** Aufeinanderliegende Punkte entfernen — sonst erzeugt der Frenet-Rahmen NaN. */
function entdopple(punkte: readonly THREE.Vector3[]): THREE.Vector3[] {
  const raus: THREE.Vector3[] = [];
  for (const p of punkte) {
    const letzter = raus[raus.length - 1];
    if (letzter !== undefined && letzter.distanceTo(p) < 1e-4) continue;
    raus.push(p.clone());
  }
  return raus;
}

/** Weiche Blende 0..1. */
function glatt(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

/**
 * Rohrfoermige Leitung entlang einer Punktfolge, mit Radien-Verjuengung an den
 * Enden.
 *
 * Umsetzung: `TubeGeometry` liefert den Schlauch mit konstantem Radius; danach
 * werden die Ringe an den Enden auf den Mittelpunkt ihrer Kurvenposition hin
 * zusammengezogen. Das ist exakt, weil `TubeGeometry` seine Ringe genau an
 * `kurve.getPointAt(i / segmente)` aufspannt.
 */
export function leitungsGeometrie(
  punkte: readonly THREE.Vector3[],
  radius: number
): THREE.BufferGeometry {
  const stuetzen = entdopple(punkte);
  if (stuetzen.length < 2 || radius <= 0) return leereGeometrie();

  const kurve = new THREE.CatmullRomCurve3(stuetzen, false, 'catmullrom', 0.5);
  const laenge = kurve.getLength();
  const segmente = Math.min(200, Math.max(8, Math.round(laenge * 8)));
  const seiten = 8;
  const g = new THREE.TubeGeometry(kurve, segmente, radius, seiten, false);

  const pos = g.getAttribute('position') as THREE.BufferAttribute;
  const proRing = seiten + 1;
  const mitte = new THREE.Vector3();
  const v = new THREE.Vector3();
  const blende = 0.14;
  for (let i = 0; i <= segmente; i++) {
    const t = i / segmente;
    const naehe = Math.min(t, 1 - t) / blende;
    if (naehe >= 1) continue;
    const f = 0.45 + 0.55 * glatt(naehe);
    kurve.getPointAt(t, mitte);
    for (let j = 0; j < proRing; j++) {
      const idx = i * proRing + j;
      v.fromBufferAttribute(pos, idx);
      v.sub(mitte).multiplyScalar(f).add(mitte);
      pos.setXYZ(idx, v.x, v.y, v.z);
    }
  }
  pos.needsUpdate = true;
  // Die Verjuengung hat die Mantelneigung veraendert — Normalen neu bilden.
  g.computeVertexNormals();
  g.computeBoundingSphere();
  return g;
}

// ---------------------------------------------------------------------------
// Halle 3
// ---------------------------------------------------------------------------

export interface Halle {
  readonly boden: THREE.BufferGeometry;
  readonly waende: THREE.BufferGeometry;
  readonly traeger: THREE.BufferGeometry; // Stahlfachwerk unter der Decke
  readonly decke: THREE.BufferGeometry;
  readonly fenster: THREE.BufferGeometry; // hohe Sprossenfenster fuer Lichtschaechte
  readonly gelaender: THREE.BufferGeometry;
}

/** Ein hohes Sprossenfenster: Rahmen, Kaempfer, Pfosten, Glasflaeche. */
function sprossenFenster(
  breite: number,
  hoehe: number,
  x: number,
  yUnten: number,
  z: number
): THREE.BufferGeometry[] {
  const t: THREE.BufferGeometry[] = [];
  const rahmen = 0.12;
  const yMitte = yUnten + hoehe / 2;
  t.push(kasten(breite, rahmen, 0.16, x, yUnten, z));
  t.push(kasten(breite, rahmen, 0.16, x, yUnten + hoehe, z));
  t.push(kasten(rahmen, hoehe, 0.16, x - breite / 2, yMitte, z));
  t.push(kasten(rahmen, hoehe, 0.16, x + breite / 2, yMitte, z));
  // Pfosten (senkrecht).
  const pfosten = 2;
  for (let i = 1; i <= pfosten; i++) {
    t.push(kasten(0.06, hoehe, 0.1, x - breite / 2 + (i * breite) / (pfosten + 1), yMitte, z));
  }
  // Kaempfer (waagerecht).
  const kaempfer = Math.max(2, Math.min(7, Math.round(hoehe / 1.1)));
  for (let i = 1; i <= kaempfer; i++) {
    t.push(kasten(breite, 0.05, 0.1, x, yUnten + (i * hoehe) / (kaempfer + 1), z));
  }
  // Glasflaeche als eigenes Blatt — das Material bekommt sie spaeter getrennt.
  t.push(kasten(breite - 0.04, hoehe - 0.04, 0.02, x, yMitte, z));
  return t;
}

/**
 * Eine Wand in Ortskoordinaten: laeuft entlang X, Dicke in Z, Aussenseite nach
 * -Z, Unterkante auf y = 0. Der Aufrufer dreht sie an ihren Platz.
 */
function wandRoh(
  laenge: number,
  hoehe: number,
  dicke: number,
  w: () => number
): { wand: THREE.BufferGeometry[]; fenster: THREE.BufferGeometry[] } {
  const wand: THREE.BufferGeometry[] = [];
  const fenster: THREE.BufferGeometry[] = [];

  const sockel = 0.9;
  const bruestung = 2.2;
  const sturz = Math.max(bruestung + 2, Math.min(hoehe - 1.4, bruestung + 6));
  const achsen = Math.max(3, Math.min(16, Math.round(laenge / 5.5)));
  const teilung = laenge / achsen;
  const pfeiler = Math.min(1.7, teilung * 0.42);
  const oeffnung = teilung - pfeiler;

  wand.push(kasten(laenge, sockel, dicke + 0.3, 0, sockel / 2, 0));
  wand.push(kasten(laenge, bruestung - sockel, dicke, 0, (sockel + bruestung) / 2, 0));
  wand.push(kasten(laenge, hoehe - sturz, dicke, 0, (sturz + hoehe) / 2, 0));
  wand.push(kasten(laenge, 0.4, dicke + 0.4, 0, hoehe + 0.15, 0));

  for (let i = 0; i <= achsen; i++) {
    const x = -laenge / 2 + i * teilung;
    wand.push(kasten(pfeiler, sturz - bruestung, dicke, x, (bruestung + sturz) / 2, 0));
    // Lisene auf der Aussenseite — gibt der Fassade ihren Rhythmus.
    wand.push(kasten(pfeiler * 0.8, hoehe - 0.4, 0.3, x, (hoehe - 0.4) / 2 + 0.2, -dicke / 2 - 0.15));
    // Kragstein fuer die alte Kranbahn.
    wand.push(kasten(0.5, 0.3, 0.7, x, sturz + 0.6, dicke / 2 + 0.3));
  }
  for (let i = 0; i < achsen; i++) {
    const x = -laenge / 2 + (i + 0.5) * teilung;
    fenster.push(...sprossenFenster(oeffnung, sturz - bruestung, x, bruestung, 0));
  }
  // Ziegelbaender im unteren Bereich, leicht vorstehend.
  const baender = 4;
  for (let i = 0; i < baender; i++) {
    const y = 0.35 + i * 0.42 + spanne(w, -0.03, 0.03);
    wand.push(kasten(laenge, 0.09, dicke + 0.07, 0, y, 0));
  }
  return { wand, fenster };
}

/** Ein Fachwerkbinder, spannt entlang X, Unterkante bei `yUnten`. */
function binder(spannweite: number, yUnten: number, hoehe: number): THREE.BufferGeometry[] {
  const t: THREE.BufferGeometry[] = [];
  t.push(kasten(spannweite, 0.14, 0.14, 0, yUnten, 0));
  t.push(kasten(spannweite, 0.16, 0.16, 0, yUnten + hoehe, 0));
  const felder = Math.max(6, Math.min(20, Math.round(spannweite / 3.5)));
  const schritt = spannweite / felder;
  for (let i = 0; i <= felder; i++) {
    const x = -spannweite / 2 + i * schritt;
    t.push(kasten(0.1, hoehe, 0.1, x, yUnten + hoehe / 2, 0));
    if (i < felder) {
      const diagonale = Math.hypot(schritt, hoehe);
      const winkel = Math.atan2(hoehe, schritt) * (i % 2 === 0 ? 1 : -1);
      t.push(kasten(diagonale, 0.08, 0.08, x + schritt / 2, yUnten + hoehe / 2, 0, 0, 0, winkel));
    }
    // Knotenblech mit Nieten.
    t.push(kasten(0.26, 0.26, 0.03, x, yUnten, 0.09));
    t.push(kasten(0.26, 0.26, 0.03, x, yUnten + hoehe, 0.09));
  }
  return t;
}

/** Backsteinhalle von 1957: Fachwerktraeger, Sprossenfenster, Betonboden mit Fugenraster. */
export function hallenGeometrie(breite: number, tiefe: number, hoehe: number, saat: number): Halle {
  const w = erzeugeStrom(saat ^ 0x1957_0003);
  const b = Math.max(8, breite);
  const ti = Math.max(8, tiefe);
  const h = Math.max(5, hoehe);
  const dicke = 0.6;

  // --- Boden -------------------------------------------------------------
  const bodenTeile: THREE.BufferGeometry[] = [];
  bodenTeile.push(kasten(b + 2 * dicke, 0.5, ti + 2 * dicke, 0, -0.25, 0));
  const raster = 2.5;
  const nx = Math.floor(b / raster);
  const nz = Math.floor(ti / raster);
  for (let i = 0; i <= nx; i++) {
    const x = -b / 2 + (i * b) / Math.max(1, nx);
    bodenTeile.push(kasten(0.05, 0.02, ti, x, 0, 0));
  }
  for (let i = 0; i <= nz; i++) {
    const z = -ti / 2 + (i * ti) / Math.max(1, nz);
    bodenTeile.push(kasten(b, 0.02, 0.05, 0, 0, z));
  }
  // Entwaesserungsrinne laengs durch die Halle.
  bodenTeile.push(kasten(0.34, 0.06, ti - 2, 0, -0.02, 0));
  for (let i = 0; i < 6; i++) {
    bodenTeile.push(kasten(0.34, 0.03, 0.06, 0, 0.015, -ti / 2 + 1.5 + (i * (ti - 3)) / 5));
  }
  const boden = vereine(bodenTeile);

  // --- Waende und Fenster ------------------------------------------------
  const wandTeile: THREE.BufferGeometry[] = [];
  const fensterTeile: THREE.BufferGeometry[] = [];
  const seiten: readonly (readonly [number, number, number, number])[] = [
    [b, 0, -ti / 2 - dicke / 2, 0],
    [b, Math.PI, ti / 2 + dicke / 2, 0],
    [ti, Math.PI / 2, 0, 0],
    [ti, -Math.PI / 2, 0, 0],
  ];
  for (let s = 0; s < seiten.length; s++) {
    const seite = seiten[s];
    if (seite === undefined) continue;
    const [laenge, drehung] = seite;
    const roh = wandRoh(laenge, h, dicke, w);
    const versatzX = s === 2 ? -b / 2 - dicke / 2 : s === 3 ? b / 2 + dicke / 2 : 0;
    const versatzZ = s === 0 ? -ti / 2 - dicke / 2 : s === 1 ? ti / 2 + dicke / 2 : 0;
    for (const g of roh.wand) {
      g.rotateY(drehung);
      g.translate(versatzX, 0, versatzZ);
      wandTeile.push(g);
    }
    for (const g of roh.fenster) {
      g.rotateY(drehung);
      g.translate(versatzX, 0, versatzZ);
      fensterTeile.push(g);
    }
  }
  const waende = vereine(wandTeile);
  const fenster = vereine(fensterTeile);

  // --- Traeger -----------------------------------------------------------
  const traegerTeile: THREE.BufferGeometry[] = [];
  const binderZahl = Math.max(3, Math.min(14, Math.round(ti / 5)));
  const binderHoehe = Math.min(1.6, h * 0.14);
  const untergurt = h - binderHoehe - 0.5;
  for (let i = 0; i < binderZahl; i++) {
    const z = -ti / 2 + ((i + 0.5) * ti) / binderZahl;
    for (const g of binder(b, untergurt, binderHoehe)) {
      g.translate(0, 0, z);
      traegerTeile.push(g);
    }
    // Stuetzen an beiden Wandseiten.
    for (const sx of [-1, 1] as const) {
      traegerTeile.push(kasten(0.3, untergurt - 2.2, 0.3, sx * (b / 2 - 0.2), (untergurt + 2.2) / 2, z));
    }
  }
  // Pfetten laengs.
  const pfetten = 7;
  for (let i = 0; i < pfetten; i++) {
    const x = -b / 2 + ((i + 0.5) * b) / pfetten;
    traegerTeile.push(kasten(0.12, 0.12, ti, x, untergurt + binderHoehe + 0.14, 0));
  }
  // Kranbahn beidseits.
  for (const sx of [-1, 1] as const) {
    traegerTeile.push(kasten(0.24, 0.3, ti, sx * (b / 2 - 0.6), untergurt - 0.9, 0));
    traegerTeile.push(kasten(0.12, 0.1, ti, sx * (b / 2 - 0.6), untergurt - 0.7, 0));
  }
  const traeger = vereine(traegerTeile);

  // --- Decke -------------------------------------------------------------
  const deckeTeile: THREE.BufferGeometry[] = [];
  deckeTeile.push(kasten(b + 2 * dicke, 0.3, ti + 2 * dicke, 0, h + 0.15, 0));
  const rippen = Math.max(4, Math.min(18, Math.round(ti / 3)));
  for (let i = 0; i < rippen; i++) {
    const z = -ti / 2 + ((i + 0.5) * ti) / rippen;
    deckeTeile.push(kasten(b, 0.16, 0.2, 0, h - 0.08, z));
  }
  // Oberlichter — die schraegen Lichtschaechte der Halle.
  const oberlichter = Math.max(2, Math.min(8, Math.round(ti / 8)));
  for (let i = 0; i < oberlichter; i++) {
    const z = -ti / 2 + ((i + 0.5) * ti) / oberlichter;
    deckeTeile.push(kasten(b * 0.34, 0.06, 1.6, 0, h - 0.02, z));
    deckeTeile.push(kasten(b * 0.34 + 0.2, 0.16, 0.18, 0, h + 0.02, z - 0.85));
    deckeTeile.push(kasten(b * 0.34 + 0.2, 0.16, 0.18, 0, h + 0.02, z + 0.85));
    deckeTeile.push(kasten(0.18, 0.16, 1.7, -(b * 0.34) / 2, h + 0.02, z));
    deckeTeile.push(kasten(0.18, 0.16, 1.7, (b * 0.34) / 2, h + 0.02, z));
  }
  const decke = vereine(deckeTeile);

  // --- Gelaender ---------------------------------------------------------
  const gelaenderTeile: THREE.BufferGeometry[] = [];
  const galerie = 3.4;
  for (const sx of [-1, 1] as const) {
    const x = sx * (b / 2 - 1.3);
    gelaenderTeile.push(kasten(0.06, 0.06, ti - 1, x, galerie + 1.05, 0));
    gelaenderTeile.push(kasten(0.05, 0.05, ti - 1, x, galerie + 0.6, 0));
    gelaenderTeile.push(kasten(0.16, 0.02, ti - 1, x, galerie + 0.09, 0));
    const pfosten = Math.max(4, Math.min(48, Math.round((ti - 1) / 1.8)));
    for (let i = 0; i <= pfosten; i++) {
      const z = -(ti - 1) / 2 + (i * (ti - 1)) / pfosten;
      gelaenderTeile.push(kasten(0.06, 1.1, 0.06, x, galerie + 0.55, z));
    }
  }
  // Zwei Treppenlaeufe mit Handlauf an der Nordwand.
  for (const sx of [-1, 1] as const) {
    const x = sx * (b / 2 - 1.6);
    const z0 = -ti / 2 + 2;
    gelaenderTeile.push(kasten(0.9, 0.08, 4.4, x, galerie / 2, z0 + 2.2, -0.66, 0, 0));
    for (const sz of [-1, 1] as const) {
      gelaenderTeile.push(
        kasten(0.06, 0.06, 4.6, x + sz * 0.45, galerie / 2 + 0.95, z0 + 2.2, -0.66, 0, 0)
      );
    }
  }
  const gelaender = vereine(gelaenderTeile);

  return { boden, waende, traeger, decke, fenster, gelaender };
}

// ---------------------------------------------------------------------------
// Fundament
// ---------------------------------------------------------------------------

/**
 * Das Fundament, auf dem gebaut wird: erhoehte Platte mit Gitterrelief und
 * Randprofil. Die Bauflaeche liegt auf y = 0, damit Module ohne Versatz
 * daraufstehen; die Platte selbst reicht nach unten.
 */
export function fundamentGeometrie(felderX: number, felderZ: number): THREE.BufferGeometry {
  const fx = Math.max(1, Math.round(felderX));
  const fz = Math.max(1, Math.round(felderZ));
  const b = fx + 0.5;
  const t = fz + 0.5;
  const teile: THREE.BufferGeometry[] = [];

  teile.push(kasten(b, 0.2, t, 0, -0.1, 0));
  teile.push(kasten(b + 0.36, 0.16, t + 0.36, 0, -0.28, 0));
  teile.push(kasten(b + 0.18, 0.06, t + 0.18, 0, -0.19, 0));

  // Gitterrelief: die Feldgrenzen als flach erhabene Stege. Die Grundplatten
  // der Module sind dicker als 0.012 und decken sie sauber ab.
  for (let i = 0; i <= fx; i++) {
    const x = -fx / 2 + i;
    teile.push(kasten(0.03, 0.012, fz, x, 0.006, 0));
  }
  for (let i = 0; i <= fz; i++) {
    const z = -fz / 2 + i;
    teile.push(kasten(fx, 0.012, 0.03, 0, 0.006, z));
  }
  // Eckbolzen und Kabelkanal am Rand.
  for (const sx of [-1, 1] as const) {
    for (const sz of [-1, 1] as const) {
      teile.push(zylinder(0.07, 0.09, 0.08, 8, (sx * b) / 2 - sx * 0.14, 0, (sz * t) / 2 - sz * 0.14));
    }
    teile.push(kasten(0.22, 0.1, t - 0.6, (sx * b) / 2 - sx * 0.14, -0.05, 0));
  }
  const g = vereine(teile);
  g.computeBoundingSphere();
  return g;
}

// ---------------------------------------------------------------------------
// Fundstuecke der Umgebungserzaehlung
// ---------------------------------------------------------------------------

/** Kleine Fundstuecke der Umgebungserzaehlung. */
export type FundstueckArt = 'becher' | 'aktenstapel' | 'rollwagen' | 'schild' | 'kabelrolle' | 'stuhl';

export function fundstueckGeometrie(art: FundstueckArt, saat: number): THREE.BufferGeometry {
  const w = erzeugeStrom(saat ^ 0x0f_a17d);
  const t: THREE.BufferGeometry[] = [];

  switch (art) {
    case 'becher': {
      t.push(profil(
        [
          [0.0, 0.0],
          [0.036, 0.0],
          [0.04, 0.012],
          [0.046, 0.085],
          [0.041, 0.088],
          [0.035, 0.012],
        ],
        12,
        0,
        0,
        0
      ));
      const henkel = new THREE.TorusGeometry(0.026, 0.006, 5, 10);
      henkel.rotateY(Math.PI / 2);
      henkel.translate(0.05, 0.05, 0);
      t.push(henkel);
      t.push(kasten(0.062, 0.004, 0.062, 0, 0.077, 0, 0, spanne(w, 0, 1.5), 0));
      break;
    }
    case 'aktenstapel': {
      const blaetter = ganz(w, 5, 8);
      let y = 0;
      for (let i = 0; i < blaetter; i++) {
        const h = spanne(w, 0.016, 0.03);
        t.push(kasten(spanne(w, 0.2, 0.26), h, spanne(w, 0.15, 0.19), spanne(w, -0.02, 0.02), y + h / 2, spanne(w, -0.02, 0.02), 0, spanne(w, -0.12, 0.12), 0));
        y += h;
      }
      // Schnellhefter obenauf, leicht verrutscht.
      t.push(kasten(0.24, 0.012, 0.17, spanne(w, -0.03, 0.03), y + 0.006, 0, 0, spanne(w, -0.2, 0.2), 0));
      t.push(kasten(0.03, 0.014, 0.17, 0.1, y + 0.007, 0, 0, spanne(w, -0.2, 0.2), 0));
      break;
    }
    case 'rollwagen': {
      t.push(kasten(0.4, 0.03, 0.3, 0, 0.14, 0));
      t.push(kasten(0.4, 0.03, 0.3, 0, 0.3, 0));
      for (const sx of [-1, 1] as const) {
        for (const sz of [-1, 1] as const) {
          t.push(kasten(0.025, 0.32, 0.025, sx * 0.18, 0.16, sz * 0.13));
          t.push(walze(0.045, 0.03, 8, 'x', sx * 0.18, 0.045, sz * 0.13));
          t.push(kasten(0.02, 0.06, 0.02, sx * 0.18, 0.1, sz * 0.13));
        }
      }
      t.push(kasten(0.025, 0.22, 0.025, 0.18, 0.42, -0.13));
      t.push(kasten(0.025, 0.22, 0.025, 0.18, 0.42, 0.13));
      t.push(walze(0.018, 0.28, 6, 'z', 0.18, 0.52, 0));
      t.push(kasten(0.18, 0.02, 0.12, spanne(w, -0.06, 0.06), 0.325, spanne(w, -0.04, 0.04), 0, spanne(w, -0.3, 0.3), 0));
      break;
    }
    case 'schild': {
      t.push(zylinder(0.02, 0.028, 0.44, 8, 0, 0, 0));
      t.push(zylinder(0.09, 0.11, 0.02, 10, 0, 0, 0));
      const platte = schildPlatte(0.3, 0.16, 0.014, 0.02);
      platte.rotateY(spanne(w, -0.12, 0.12));
      platte.translate(0, 0.5, 0);
      t.push(platte);
      const feld = schildPlatte(0.24, 0.1, 0.008, 0.014);
      feld.rotateY(spanne(w, -0.12, 0.12));
      feld.translate(0, 0.5, 0.011);
      t.push(feld);
      break;
    }
    case 'kabelrolle': {
      // Kabeltrommel liegt auf der Kante, Achse waagerecht in X.
      const r = 0.16;
      t.push(walze(r, 0.03, 14, 'x', -0.08, r, 0));
      t.push(walze(r, 0.03, 14, 'x', 0.08, r, 0));
      t.push(walze(0.06, 0.16, 10, 'x', 0, r, 0));
      const wicklung = new THREE.TorusGeometry(0.1, 0.045, 6, 14);
      wicklung.rotateY(Math.PI / 2);
      wicklung.translate(0, r, 0);
      t.push(wicklung);
      t.push(kasten(0.03, 0.03, 0.14, spanne(w, -0.1, 0.1), r + 0.05, 0.14, spanne(w, -0.4, 0.4), 0, 0));
      break;
    }
    case 'stuhl': {
      for (const sx of [-1, 1] as const) {
        for (const sz of [-1, 1] as const) {
          t.push(kasten(0.022, 0.26, 0.022, sx * 0.14, 0.13, sz * 0.13));
        }
        t.push(kasten(0.022, 0.022, 0.26, sx * 0.14, 0.1, 0));
      }
      t.push(kasten(0.32, 0.025, 0.3, 0, 0.27, 0));
      const lehne = spanne(w, -0.14, -0.06);
      t.push(kasten(0.3, 0.3, 0.022, 0, 0.43, -0.14, lehne, 0, 0));
      t.push(kasten(0.3, 0.05, 0.03, 0, 0.57, -0.16, lehne, 0, 0));
      break;
    }
  }
  return passeEin(vereine(t), 1.2);
}
