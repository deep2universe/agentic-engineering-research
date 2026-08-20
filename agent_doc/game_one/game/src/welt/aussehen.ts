/**
 * Aussehen-Adapter: die EINZIGE Stelle, an der die Spielwelt Formen und
 * Materialien bezieht.
 *
 * Er reicht inzwischen an die vollprozeduralen Generatoren durch
 * (`texturen.ts`, `materialien.ts`, `geometrie.ts`). Die Indirektion bleibt
 * trotzdem, und zwar aus einem handfesten Grund: Halle, Werkansicht und Tests
 * kennen nur diese Namen. Als die Generatoren ausgetauscht wurden, war genau
 * eine Datei zu ändern.
 *
 * Zwei Regeln aus der Messung, die hier durchgesetzt werden:
 *
 *  1. **Leuchtwerte richten sich nach der Bloom-Technik, nicht umgekehrt.**
 *     Die ursprüngliche Vorgabe (Emissive 0,05–0,35) galt für selektiven Bloom
 *     über einen eigenen MRT-Kanal. Dieser Weg erwies sich auf dem
 *     WebGL2-Fallback als unbrauchbar; das Spiel blüht jetzt über eine
 *     Helligkeitsschwelle im fertigen Bild. Damit ein Leuchtband überhaupt
 *     blüht, muss es ÜBER dieser Schwelle liegen.
 *  2. **Zeitabhängige Shader lesen ein von außen gesetztes Uniform**, niemals
 *     `time`. Sonst sind Vergleichsbilder nicht reproduzierbar.
 */

import * as THREE from 'three/webgpu';
import { color, normalView, positionViewDirection, uniform } from 'three/tsl';
import type { ModulArt } from '../sim/typen';
import {
  entsorgeAlleMaterialien,
  geistMaterial as materialGeist,
  holeMaterial,
  leitungsMaterial as materialLeitung,
  modulMaterial as materialModul,
  paketMaterial as materialPaket,
  PAKET_FARB_ATTRIBUT,
  type LeitungsMaterial,
} from './materialien';
import { entsorgeAlleTexturen, type MaterialArt } from './texturen';
import {
  fundamentGeometrie,
  hallenGeometrie,
  kernAufsatz as geometrieKernAufsatz,
  leitungsGeometrie,
  modulGeometrie,
  type Halle as HallenTeile,
} from './geometrie';

export { PAKET_FARB_ATTRIBUT };
export type { LeitungsMaterial, HallenTeile };

// ---------------------------------------------------------------------------
// Gemeinsame Uniforms
// ---------------------------------------------------------------------------

/** Fortlaufende Zeit in Sekunden. Der Renderer setzt sie einmal je Bild. */
export const uZeit = uniform(0);
/** 0 = Bewegungsreduktion (kein Pulsieren, kein Fließen). */
export const uPuls = uniform(1);

// ---------------------------------------------------------------------------
// Farbwelt
// ---------------------------------------------------------------------------

/**
 * Grundpalette der Halle: kalt in der Fläche, warm nur dort, wo Technik
 * arbeitet. Die Modulfarben kommen aus dem Katalog; jede Bedeutung ist
 * zusätzlich an der Silhouette erkennbar, niemals nur an der Farbe.
 */
export const PALETTE = {
  hintergrund: 0x080b11,
  nebel: 0x0e141c,
  beton: 0x242a31,
  betonDunkel: 0x1b1f26,
  ziegel: 0x37302c,
  stahl: 0x555f6b,
  stahlDunkel: 0x2f3640,
  messing: 0xb08d57,
  fundament: 0x141920,
  gitter: 0x39424e,
  licht: 0xdfe9ff,
  lichtWarm: 0xffd9a0,
} as const;

// ---------------------------------------------------------------------------
// Materialien
// ---------------------------------------------------------------------------

/** Rollen der Weltgeometrie, abgebildet auf die zehn Master-Materialien. */
const FLAECHEN = {
  beton: 'beton',
  stahl: 'stahl_lackiert',
  stahlBlank: 'stahl_gebuerstet',
  ziegel: 'ziegel',
  fundament: 'beton',
  gitter: 'bodengitter',
  glas: 'glas',
  messing: 'messing',
} as const satisfies Record<string, MaterialArt>;

export function flaechenMaterial(art: keyof typeof FLAECHEN): THREE.MeshStandardNodeMaterial {
  return holeMaterial(FLAECHEN[art]);
}

/** Das Gitterraster des Fundaments. */
export function fundamentMaterial(): THREE.MeshStandardNodeMaterial {
  return holeMaterial('bodengitter');
}

export function modulMaterial(art: ModulArt): THREE.MeshStandardNodeMaterial {
  return materialModul(art);
}

export function leitungsMaterial(): LeitungsMaterial {
  return materialLeitung();
}

export function paketMaterial(): THREE.MeshStandardNodeMaterial {
  return materialPaket();
}

export function geistMaterial(gueltig: boolean): THREE.MeshStandardNodeMaterial {
  return materialGeist(gueltig);
}

const hervorhebungsCache = new Map<string, THREE.MeshBasicNodeMaterial>();

/**
 * Auswahl- und Zeigerhervorhebung als eigenständige Hülle. Bewusst einfach: sie
 * liegt als leicht vergrößerte Rückseite um das Modul und soll die Silhouette
 * betonen, nicht überstrahlen.
 */
export function hervorhebung(art: 'auswahl' | 'zeiger' | 'fehler'): THREE.MeshBasicNodeMaterial {
  const vorhanden = hervorhebungsCache.get(art);
  if (vorhanden) return vorhanden;
  const farbe = art === 'auswahl' ? 0x9dffb0 : art === 'zeiger' ? 0x7ee8fa : 0xff5c5c;
  const m = new THREE.MeshBasicNodeMaterial();
  m.colorNode = color(farbe).mul(
    normalView.dot(positionViewDirection).abs().oneMinus().pow(2).mul(0.9).add(0.25)
  );
  m.transparent = true;
  m.opacity = 0.3;
  m.depthWrite = false;
  m.side = THREE.BackSide;
  hervorhebungsCache.set(art, m);
  return m;
}

// ---------------------------------------------------------------------------
// Geometrie
// ---------------------------------------------------------------------------

const formCache = new Map<string, THREE.BufferGeometry>();

/**
 * Silhouette eines Moduls. Fußabdruck genau 1×1, Ursprung mittig auf der
 * Grundfläche. Der Cache ist notwendig: dieselbe Modulart kommt in einem Werk
 * mehrfach vor, und jede Geometrie doppelt zu halten wäre reine Verschwendung.
 */
export function modulForm(art: ModulArt, saat = 1): THREE.BufferGeometry {
  const schluessel = `${art}:${saat}`;
  const vorhanden = formCache.get(schluessel);
  if (vorhanden) return vorhanden;
  const g = modulGeometrie(art, saat);
  formCache.set(schluessel, g);
  return g;
}

export function kernAufsatz(groesse: 'kolibri' | 'reiher' | 'kondor'): THREE.BufferGeometry {
  const schluessel = `kernaufsatz:${groesse}`;
  const vorhanden = formCache.get(schluessel);
  if (vorhanden) return vorhanden;
  const g = geometrieKernAufsatz(groesse);
  formCache.set(schluessel, g);
  return g;
}

/** Rohrförmige Leitung entlang einer Punktfolge, an den Enden verjüngt. */
export function leitungsForm(punkte: readonly THREE.Vector3[], radius = 0.05): THREE.BufferGeometry {
  return leitungsGeometrie(punkte, radius);
}

export function hallenTeile(breite: number, tiefe: number, hoehe: number, saat: number): HallenTeile {
  return hallenGeometrie(breite, tiefe, hoehe, saat);
}

export function fundamentForm(felderX: number, felderZ: number): THREE.BufferGeometry {
  const schluessel = `fundament:${felderX}x${felderZ}`;
  const vorhanden = formCache.get(schluessel);
  if (vorhanden) return vorhanden;
  const g = fundamentGeometrie(felderX, felderZ);
  formCache.set(schluessel, g);
  return g;
}

export function entsorgeFormen(): void {
  for (const g of formCache.values()) g.dispose();
  formCache.clear();
}

/**
 * Gibt alles frei. Die Speicherprüfung erwartet, dass Geometrie-, Material- und
 * Texturzähler des Renderers danach wieder auf ihrem Ausgangswert stehen.
 */
export function entsorgeAussehen(): void {
  for (const m of hervorhebungsCache.values()) m.dispose();
  hervorhebungsCache.clear();
  entsorgeFormen();
  entsorgeAlleMaterialien();
  entsorgeAlleTexturen();
}
