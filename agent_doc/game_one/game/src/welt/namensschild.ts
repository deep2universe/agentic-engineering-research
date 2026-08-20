/**
 * Namensschilder über den Modulen.
 *
 * Anlass: Auf dem Spielfeld standen dunkle Klötze unterschiedlicher Form, und
 * eine Spielerin konnte nicht erkennen, welcher davon der Auftragseingang, der
 * Modell-Kern oder die Auslieferung war. Das Briefing sagt „setz einen Kern
 * dazwischen" — wenn nicht sichtbar ist, wozwischen, ist die Aufgabe nicht
 * lösbar, egal wie gut die Simulation darunter rechnet.
 *
 * Form und Farbe bleiben die erste Auskunft; die Schrift ist die zweite. Das
 * ist Absicht: Wer die Halle kennt, liest die Silhouette, wer sie neu sieht,
 * liest den Namen. Farbe allein trägt nie eine Bedeutung (Farbfehlsichtigkeit).
 *
 * Technisch: eine `CanvasTexture` je Beschriftung, gecacht, auf einem Sprite.
 * Sprites stehen immer zur Kamera, brauchen also keine Nachführung, und ein
 * Sprite je Modul ist bei den hier üblichen Modulzahlen kein Draw-Call-Problem.
 * Es gibt keine externen Schriftdateien — gezeichnet wird mit der Systemschrift
 * auf ein `OffscreenCanvas`, mit Rückfall auf ein DOM-Canvas.
 */

import * as THREE from 'three/webgpu';

/** Höhe der Schrift in Bildpunkten der Textur. Genug für scharfe Kanten. */
const SCHRIFTHOEHE = 44;
const RAND = 16;

const zwischenspeicher = new Map<string, THREE.SpriteMaterial>();

function zeichenflaeche(breite: number, hoehe: number): {
  flaeche: OffscreenCanvas | HTMLCanvasElement;
  ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;
} {
  if (typeof OffscreenCanvas !== 'undefined') {
    const f = new OffscreenCanvas(breite, hoehe);
    const c = f.getContext('2d');
    if (c) return { flaeche: f, ctx: c };
  }
  const f = document.createElement('canvas');
  f.width = breite;
  f.height = hoehe;
  const c = f.getContext('2d');
  if (!c) throw new Error('Kein 2D-Kontext für die Beschriftung verfügbar.');
  return { flaeche: f, ctx: c };
}

/**
 * Erzeugt das Material einer Beschriftung.
 *
 * `farbe` ist der Farbleitwert des Moduls: Der schmale Balken links greift ihn
 * auf und verknüpft Schild und Gehäuse, ohne dass die Schrift selbst farbig
 * wird — farbige Schrift auf dunklem Grund liest sich schlecht.
 */
function schildMaterial(text: string, farbe: number): THREE.SpriteMaterial {
  const schluessel = `${text}|${farbe}`;
  const vorhanden = zwischenspeicher.get(schluessel);
  if (vorhanden) return vorhanden;

  const schrift = `600 ${SCHRIFTHOEHE}px ui-sans-serif, system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`;
  const { ctx: messer } = zeichenflaeche(8, 8);
  messer.font = schrift;
  const textBreite = Math.ceil(messer.measureText(text).width);

  const balken = 8;
  const breite = textBreite + RAND * 2 + balken + 10;
  const hoehe = SCHRIFTHOEHE + RAND * 2;
  const { flaeche, ctx } = zeichenflaeche(breite, hoehe);

  // Dunkle, leicht durchscheinende Tafel — sie soll sich vor die Halle legen,
  // ohne sie zuzudecken.
  ctx.fillStyle = 'rgba(9, 13, 20, 0.82)';
  ctx.beginPath();
  const r = 10;
  ctx.moveTo(r, 0);
  ctx.arcTo(breite, 0, breite, hoehe, r);
  ctx.arcTo(breite, hoehe, 0, hoehe, r);
  ctx.arcTo(0, hoehe, 0, 0, r);
  ctx.arcTo(0, 0, breite, 0, r);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#' + farbe.toString(16).padStart(6, '0');
  ctx.fillRect(RAND * 0.5, RAND * 0.6, balken, hoehe - RAND * 1.2);

  ctx.font = schrift;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(233, 240, 250, 0.96)';
  ctx.fillText(text, RAND * 0.5 + balken + 10, hoehe / 2 + 1);

  const textur = new THREE.CanvasTexture(flaeche as HTMLCanvasElement);
  textur.colorSpace = THREE.SRGBColorSpace;
  textur.anisotropy = 4;
  textur.needsUpdate = true;

  const material = new THREE.SpriteMaterial({
    map: textur,
    transparent: true,
    // Ohne Tiefenschreiben, aber MIT Tiefentest: Das Schild verdeckt nichts
    // dauerhaft, verschwindet aber korrekt hinter Trägern und Wänden.
    depthWrite: false,
    depthTest: true,
  });
  material.userData['breite'] = breite;
  material.userData['hoehe'] = hoehe;

  zwischenspeicher.set(schluessel, material);
  return material;
}

/**
 * Ein Schild über einem Modul.
 *
 * `hoeheUeberBoden` richtet sich nach der Bauhöhe des Moduls, damit das Schild
 * über dem Gehäuse steht und nicht darin.
 */
export function erzeugeNamensschild(
  text: string,
  farbe: number,
  hoeheUeberBoden: number
): THREE.Sprite {
  const material = schildMaterial(text, farbe);
  const sprite = new THREE.Sprite(material);

  // Weltmaß aus dem Texturmaß: 0,42 Welteinheiten Schrifthöhe wirken auf
  // Spielabstand wie eine Beschriftung an der Maschine, nicht wie ein Banner.
  const breite = material.userData['breite'] as number;
  const hoehe = material.userData['hoehe'] as number;
  const massstab = 0.42 / SCHRIFTHOEHE;
  sprite.scale.set(breite * massstab, hoehe * massstab, 1);
  sprite.position.set(0, hoeheUeberBoden, 0);
  sprite.renderOrder = 3;
  // Das Schild ist Beschriftung, kein Bauteil: Es darf nie einen Klick fangen.
  sprite.raycast = () => undefined;
  return sprite;
}

/** Gibt alle zwischengespeicherten Schilder frei. */
export function entsorgeNamensschilder(): void {
  for (const m of zwischenspeicher.values()) {
    m.map?.dispose();
    m.dispose();
  }
  zwischenspeicher.clear();
}
