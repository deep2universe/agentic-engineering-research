/**
 * Prozedurale Texturen fuer SCHWARMWERK — Halle 3 der KONTUR Digital GmbH.
 *
 * Dieses Modul erzeugt die gesamte Oberflaechenqualitaet des Spiels rein
 * arithmetisch. Es gibt KEINE externen Assets, kein Canvas2D, keinen
 * GPU-Kontext. Alles, was hier entsteht, ist ein `Uint8Array`, das in eine
 * `THREE.DataTexture` gelegt wird — damit laeuft der Generator identisch im
 * Browser und in Node (vitest), und die Ergebnisse sind byteweise pruefbar.
 *
 * ## Determinismus
 * Es wird ausschliesslich der hashbasierte Zufall aus `src/sim/rng.ts`
 * verwendet. Kohaerentes Rauschen braucht aber Millionen von Gitterabfragen;
 * `zufall(saat, kanal, ix, iy)` wuerde bei jedem Aufruf den Kanalnamen neu
 * hashen. Deshalb wird der Kanalanteil einmal pro Rauschschicht in
 * `kanalSaat()` vorberechnet und danach mit `gitterZahl()` genau so
 * weiterverrechnet, wie `zufall()` es tut. Das Ergebnis ist bitgleich mit
 * `zufall()` — `tests/einheit/texturen.test.ts` weist das nach.
 *
 * Es werden nur `Math.floor`, `Math.round`, `Math.abs`, `Math.min`,
 * `Math.max`, `Math.imul` und `Math.sqrt` benutzt. Alle davon sind nach
 * IEEE-754 exakt bzw. korrekt gerundet und damit ueber alle Laufzeiten hinweg
 * identisch. Transzendente Funktionen (`sin`, `cos`, `pow`, `exp`) kommen
 * bewusst NICHT vor.
 *
 * ## Kachelbarkeit
 * Jede Rauschschicht arbeitet auf einem Gitter mit ganzzahliger Periode und
 * schlaegt die Gitterindizes modulo dieser Periode um. Dadurch gilt exakt
 * `feld(0, v) === feld(1, v)` und `feld(u, 0) === feld(u, 1)`. Es wird nirgends
 * gespiegelt.
 */

import * as THREE from 'three/webgpu';
import { hashText } from '../sim/rng';

// ---------------------------------------------------------------------------
// Oeffentliche Typen
// ---------------------------------------------------------------------------

export type MaterialArt =
  | 'beton'
  | 'stahl_gebuerstet'
  | 'stahl_lackiert'
  | 'messing'
  | 'glas'
  | 'gummi'
  | 'leiterplatte'
  | 'bodengitter'
  | 'ziegel'
  | 'emaille';

/** Alle Materialarten in fester Reihenfolge — fuer Tests und Vorwaermen. */
export const MATERIAL_ARTEN: readonly MaterialArt[] = [
  'beton',
  'stahl_gebuerstet',
  'stahl_lackiert',
  'messing',
  'glas',
  'gummi',
  'leiterplatte',
  'bodengitter',
  'ziegel',
  'emaille',
];

export type TexturGroesse = 256 | 512 | 1024;

export interface TexturSatz {
  readonly albedo: THREE.DataTexture;
  readonly normal: THREE.DataTexture;
  /** Rot = Rauheit, Gruen = Metallgrad, Blau = Umgebungsverdeckung (ORM-artig gepackt). */
  readonly orm: THREE.DataTexture;
  readonly emission?: THREE.DataTexture;
  entsorge(): void;
}

/**
 * Der Zustand eines einzelnen Texels, bevor er in Bytes zerlegt wird.
 * Bewusst veraenderlich: pro Textur wird genau ein Objekt wiederverwendet,
 * damit im Pixelloop nichts alloziert wird.
 */
export interface Oberflaeche {
  /** Albedo als Anzeigewerte (sRGB) im Bereich 0..1. */
  r: number;
  g: number;
  b: number;
  /** Hoehenfeld 0..1 — Grundlage fuer Normale und Verdeckung. */
  hoehe: number;
  /** Rauheit 0..1. */
  rauheit: number;
  /** Metallgrad 0..1. */
  metall: number;
  /** Musterbedingte Verdeckung 0..1 (wird mit der berechneten Sweep-AO multipliziert). */
  verdeckung: number;
  /** Eigenleuchten als Anzeigewerte 0..1. */
  er: number;
  eg: number;
  eb: number;
}

// ---------------------------------------------------------------------------
// Zufall — bitgleich zu src/sim/rng.ts
// ---------------------------------------------------------------------------

/** 32-Bit-Mischfunktion, identisch zur privaten `mische()` in `src/sim/rng.ts`. */
function mische(x: number): number {
  let h = x | 0;
  h = Math.imul(h ^ (h >>> 16), 0x21f0aaad);
  h = Math.imul(h ^ (h >>> 15), 0x735a2d97);
  h = h ^ (h >>> 15);
  return h >>> 0;
}

/** Ein weiterer Diskriminator wird eingemischt — identisch zur Schleife in `zufall()`. */
function mischeEin(h: number, wert: number): number {
  return mische(h ^ ((wert | 0) + 0x9e3779b9 + ((h << 6) | 0) + (h >>> 2)));
}

/**
 * Vorberechneter Kanalanteil von `zufall(saat, kanal, ...)`.
 * `gitterZahl(kanalSaat(s, k), a, b) === zufall(s, k, a, b)`.
 */
export function kanalSaat(saat: number, kanal: string): number {
  return mische(saat ^ hashText(kanal));
}

/** Rohe 32-Bit-Gitterabfrage. */
function gitterRoh(basis: number, ix: number, iy: number): number {
  return mischeEin(mischeEin(basis, ix), iy);
}

/** Gitterabfrage als Gleitkommazahl in [0, 1). */
export function gitterZahl(basis: number, ix: number, iy: number): number {
  return (gitterRoh(basis, ix, iy) >>> 8) / 0x01000000;
}

// ---------------------------------------------------------------------------
// Kleine Mathematik
// ---------------------------------------------------------------------------

function klemme(x: number, tief: number, hoch: number): number {
  return x < tief ? tief : x > hoch ? hoch : x;
}

function saettige(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

function mischen(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Smoothstep, funktioniert auch mit `k0 > k1` (dann fallend). */
function glatteStufe(k0: number, k1: number, x: number): number {
  if (k0 === k1) return x < k0 ? 0 : 1;
  const t = klemme((x - k0) / (k1 - k0), 0, 1);
  return t * t * (3 - 2 * t);
}

/** Quintische Ueberblendung nach Perlin — stetige zweite Ableitung, keine Gitterartefakte. */
function glatt(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

/** Positiver Modulo fuer Gitterindizes. */
function umschlag(v: number, periode: number): number {
  const m = v % periode;
  return m < 0 ? m + periode : m;
}

// ---------------------------------------------------------------------------
// Rauschen
// ---------------------------------------------------------------------------

const W = 0.7071067811865476;

/**
 * Acht Gradientenrichtungen auf dem Einheitskreis (Achteck). Alle Eintraege
 * sind exakt darstellbare Doubles, damit das Rauschen bitstabil bleibt.
 */
const GRADIENTEN: readonly number[] = [
  1, 0, -1, 0, 0, 1, 0, -1, W, W, -W, W, W, -W, -W, -W,
];

function gitterPunkt(basis: number, ix: number, iy: number, dx: number, dy: number): number {
  const g = (gitterRoh(basis, ix, iy) & 7) * 2;
  const gx = GRADIENTEN[g] ?? 0;
  const gy = GRADIENTEN[g + 1] ?? 0;
  return gx * dx + gy * dy;
}

/**
 * Periodisches Gradientenrauschen (Perlin) mit getrennter Periode je Achse.
 * Ergebnis liegt praktisch in [-1, 1].
 *
 * @param x  Koordinate in Gitterzellen (0..perX entspricht einer vollen Kachel).
 * @param y  Koordinate in Gitterzellen (0..perY).
 */
export function gradientRauschen(
  x: number,
  y: number,
  perX: number,
  perY: number,
  basis: number
): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const ix0 = umschlag(x0, perX);
  const ix1 = umschlag(x0 + 1, perX);
  const iy0 = umschlag(y0, perY);
  const iy1 = umschlag(y0 + 1, perY);
  const u = glatt(fx);
  const v = glatt(fy);
  const n00 = gitterPunkt(basis, ix0, iy0, fx, fy);
  const n10 = gitterPunkt(basis, ix1, iy0, fx - 1, fy);
  const n01 = gitterPunkt(basis, ix0, iy1, fx, fy - 1);
  const n11 = gitterPunkt(basis, ix1, iy1, fx - 1, fy - 1);
  return mischen(mischen(n00, n10, u), mischen(n01, n11, u), v) * 1.4;
}

/**
 * Fraktales Rauschen (fBm) ueber (u, v) in [0, 1). Die Periode verdoppelt sich
 * je Oktave, bleibt also ganzzahlig — die Kachel bleibt nahtlos.
 * Ergebnis praktisch in [-1, 1].
 */
export function fbm(
  u: number,
  v: number,
  perX: number,
  perY: number,
  oktaven: number,
  verstaerkung: number,
  basis: number
): number {
  let summe = 0;
  let amplitude = 1;
  let norm = 0;
  let px = perX;
  let py = perY;
  for (let o = 0; o < oktaven; o++) {
    summe += amplitude * gradientRauschen(u * px, v * py, px, py, mischeEin(basis, o));
    norm += amplitude;
    amplitude *= verstaerkung;
    px *= 2;
    py *= 2;
  }
  return norm === 0 ? 0 : summe / norm;
}

/**
 * Gratrauschen (ridged fBm) — liefert schmale, helle Grate. Ideal fuer Kratzer,
 * Risse und Schleifspuren. Ergebnis in [0, 1].
 */
export function gratRauschen(
  u: number,
  v: number,
  perX: number,
  perY: number,
  oktaven: number,
  verstaerkung: number,
  basis: number
): number {
  let summe = 0;
  let amplitude = 1;
  let norm = 0;
  let px = perX;
  let py = perY;
  for (let o = 0; o < oktaven; o++) {
    const n = 1 - Math.abs(gradientRauschen(u * px, v * py, px, py, mischeEin(basis, o)));
    summe += amplitude * n * n;
    norm += amplitude;
    amplitude *= verstaerkung;
    px *= 2;
    py *= 2;
  }
  return norm === 0 ? 0 : saettige(summe / norm);
}

export interface WorleyErgebnis {
  /** Abstand zum naechsten Merkmalspunkt, in Zellbreiten. */
  f1: number;
  /** Abstand zum zweitnaechsten Merkmalspunkt. */
  f2: number;
  /** Kennwert der Gewinnerzelle in [0, 1) — erlaubt Variation je Zelle. */
  zelle: number;
}

const worleyPuffer: WorleyErgebnis = { f1: 0, f2: 0, zelle: 0 };

/**
 * Periodisches Worley-/Voronoi-Rauschen. Schreibt in einen gemeinsamen Puffer,
 * um im Pixelloop keine Objekte zu erzeugen — das Ergebnis muss also sofort
 * ausgelesen werden.
 */
export function worley(
  u: number,
  v: number,
  zellenX: number,
  zellenY: number,
  basis: number
): WorleyErgebnis {
  const basisJitter = mischeEin(basis, 0x51ed);
  const basisWert = mischeEin(basis, 0x2f9d);
  const x = u * zellenX;
  const y = v * zellenY;
  const cx = Math.floor(x);
  const cy = Math.floor(y);
  let f1 = 9;
  let f2 = 9;
  let zelle = 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const gx = cx + dx;
      const gy = cy + dy;
      const wx = umschlag(gx, zellenX);
      const wy = umschlag(gy, zellenY);
      const jitter = gitterRoh(basisJitter, wx, wy);
      const jx = ((jitter >>> 8) & 0xfff) / 4096;
      const jy = ((jitter >>> 20) & 0xfff) / 4096;
      const ddx = gx + jx - x;
      const ddy = gy + jy - y;
      const d = Math.sqrt(ddx * ddx + ddy * ddy);
      if (d < f1) {
        f2 = f1;
        f1 = d;
        zelle = gitterZahl(basisWert, wx, wy);
      } else if (d < f2) {
        f2 = d;
      }
    }
  }
  worleyPuffer.f1 = f1;
  worleyPuffer.f2 = f2;
  worleyPuffer.zelle = zelle;
  return worleyPuffer;
}

/** Abstand eines Punktes zu einer Strecke — fuer die Leiterbahnen. */
function abstandStrecke(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number
): number {
  const vx = bx - ax;
  const vy = by - ay;
  const wx = px - ax;
  const wy = py - ay;
  const laenge = vx * vx + vy * vy;
  const t = laenge === 0 ? 0 : klemme((wx * vx + wy * vy) / laenge, 0, 1);
  const dx = wx - vx * t;
  const dy = wy - vy * t;
  return Math.sqrt(dx * dx + dy * dy);
}

// ---------------------------------------------------------------------------
// Materialfelder
// ---------------------------------------------------------------------------

interface Feld {
  /** Wertet die Oberflaeche an (u, v) in [0, 1) aus. */
  readonly abtaste: (u: number, v: number, ziel: Oberflaeche) => void;
  /**
   * Reliefhoehe in Texeln (bezogen auf 512), die `hoehe = 1` fuer die
   * NORMAL-Map bedeutet. Der Wert ist bewusst groesser als die physikalische
   * Hoehe: eine Normal-Map soll die Mikrostruktur sichtbar machen, die bei
   * massstabsgetreuer Hoehe unter einem Texel verschwinden wuerde.
   */
  readonly relief: number;
  /**
   * Reliefhoehe in Texeln fuer die Verdeckungsrechnung. Hier zaehlt die
   * tatsaechliche Makrogeometrie (Fugen, Loecher, Noppen) — mit dem
   * ueberhoehten Normalenrelief wuerde jede Kachel zulaufen.
   */
  readonly aoRelief: number;
  readonly hatEmission: boolean;
}

type FeldBauer = (saat: number) => Feld;

/** Erzeugt die Basis-Ableitung fuer einen benannten Kanal eines Materials. */
function kanaele(saat: number, art: MaterialArt): (kanal: string) => number {
  return (kanal: string) => kanalSaat(saat, art + '.' + kanal);
}

// --- Beton -----------------------------------------------------------------

const baueBeton: FeldBauer = (saat) => {
  const k = kanaele(saat, 'beton');
  const bGross = k('gross');
  const bMittel = k('mittel');
  const bFein = k('fein');
  const bZuschlag = k('zuschlag');
  const bPoren = k('poren');
  const bSchlieren = k('schlieren');
  const bKorn = k('korn');

  return {
    relief: 26,
    aoRelief: 7,
    hatEmission: false,
    abtaste(u, v, z) {
      const gross = fbm(u, v, 3, 3, 4, 0.5, bGross);
      const mittel = fbm(u, v, 11, 11, 4, 0.5, bMittel);
      const fein = fbm(u, v, 61, 61, 3, 0.55, bFein);
      // Sandkorn: nur im Hoehenfeld, damit die Normal-Map die Zementhaut zeigt.
      const korn = fbm(u, v, 157, 157, 2, 0.5, bKorn);

      // Zuschlagkoerner: helle Kiesel, die knapp unter der Schalhaut liegen.
      const zu = worley(u, v, 23, 23, bZuschlag);
      const kies = glatteStufe(0.34, 0.12, zu.f1) * glatteStufe(0.35, 0.55, zu.zelle);

      // Luftporen: kleine, dunkle Krater. Nur etwa jede zweite Zelle traegt eine.
      const po = worley(u, v, 83, 83, bPoren);
      const pore = glatteStufe(0.20, 0.04, po.f1) * glatteStufe(0.58, 0.72, po.zelle);

      // Wasserschlieren laufen senkrecht: schnelle Variation in u, traege in v.
      const schliere = glatteStufe(0.10, 0.62, fbm(u, v, 47, 3, 3, 0.5, bSchlieren));

      let h = 0.365 + gross * 0.055 + mittel * 0.028 + fein * 0.016;
      h += kies * 0.045;
      h -= pore * 0.16;
      h *= 1 - schliere * 0.16;

      // Kalter, leicht blauer Grauton — feuchter Beton unter Hallenlicht.
      z.r = h * 0.975;
      z.g = h;
      z.b = h * 1.055;

      z.hoehe = saettige(
        0.52 + gross * 0.14 + mittel * 0.10 + fein * 0.075 + korn * 0.055 + kies * 0.05 - pore * 0.55
      );
      z.rauheit = klemme(0.84 + fein * 0.05 - kies * 0.10 - schliere * 0.20 + pore * 0.04, 0.42, 0.99);
      z.metall = 0;
      z.verdeckung = 1 - pore * 0.45 - schliere * 0.08;
      z.er = 0;
      z.eg = 0;
      z.eb = 0;
    },
  };
};

// --- Gebuerstetes Edelstahlblech -------------------------------------------

const baueStahlGebuerstet: FeldBauer = (saat) => {
  const k = kanaele(saat, 'stahl_gebuerstet');
  const bBuerste = k('buerste');
  const bFein = k('fein');
  const bWolke = k('wolke');
  const bOel = k('oel');

  return {
    relief: 11,
    aoRelief: 1.6,
    hatEmission: false,
    abtaste(u, v, z) {
      // Schleifrichtung laeuft entlang u: traege in u, sehr schnell in v.
      const buerste = fbm(u, v, 5, 128, 3, 0.55, bBuerste);
      const fein = gradientRauschen(u * 3, v * 384, 3, 384, bFein);
      const wolke = fbm(u, v, 4, 4, 4, 0.5, bWolke);

      // Handschmier und Oelfilm in unregelmaessigen Flecken.
      const oelZelle = worley(u, v, 5, 5, bOel);
      const oel = glatteStufe(0.44, 0.10, oelZelle.f1) * glatteStufe(0.58, 0.82, oelZelle.zelle);

      const h = 0.565 + buerste * 0.055 + fein * 0.036 + wolke * 0.014 - oel * 0.022;
      z.r = h * 0.972;
      z.g = h * 0.995;
      z.b = h * 1.035;

      z.hoehe = saettige(0.5 + buerste * 0.34 + fein * 0.26);
      z.rauheit = klemme(0.27 + buerste * 0.10 + fein * 0.05 + oel * 0.20 + wolke * 0.03, 0.10, 0.62);
      z.metall = 1 - oel * 0.18;
      z.verdeckung = 1 - oel * 0.06;
      z.er = 0;
      z.eg = 0;
      z.eb = 0;
    },
  };
};

// --- Lackiertes Stahlgehaeuse ----------------------------------------------

const baueStahlLackiert: FeldBauer = (saat) => {
  const k = kanaele(saat, 'stahl_lackiert');
  const bHaut = k('orangenhaut');
  const bStaub = k('staub');
  const bKratzer = k('kratzer');
  const bPlatzer = k('abplatzer');

  return {
    relief: 15,
    aoRelief: 3,
    hatEmission: false,
    abtaste(u, v, z) {
      const haut = fbm(u, v, 37, 37, 3, 0.5, bHaut);
      const staub = fbm(u, v, 6, 6, 4, 0.5, bStaub);
      const kratzer = glatteStufe(0.86, 0.98, gratRauschen(u, v, 23, 77, 2, 0.5, bKratzer));

      // Abplatzer: wenige, kleine Stellen, an denen der Grundwerkstoff durchkommt.
      const ab = worley(u, v, 8, 8, bPlatzer);
      const auswahl = glatteStufe(0.895, 0.925, ab.zelle);
      const kern = glatteStufe(0.20, 0.07, ab.f1) * auswahl;
      const saum = glatteStufe(0.30, 0.17, ab.f1) * auswahl - kern;

      // Dunkler, kuehler Industrielack (RAL-7016-nah).
      const tonung = 1 + staub * 0.10 + haut * 0.04;
      let r = 0.102 * tonung;
      let g = 0.118 * tonung;
      let b = 0.134 * tonung;

      // Grundwerkstoff: helles, unbehandeltes Blech.
      r = mischen(r, 0.310, kern);
      g = mischen(g, 0.318, kern);
      b = mischen(b, 0.332, kern);
      // Der Saum um den Abplatzer ist dunkler als der Lack.
      r *= 1 - saum * 0.45;
      g *= 1 - saum * 0.45;
      b *= 1 - saum * 0.45;
      // Kratzer polieren den Lack an: heller und glatter.
      r = mischen(r, r + 0.075, kratzer);
      g = mischen(g, g + 0.075, kratzer);
      b = mischen(b, b + 0.075, kratzer);

      z.r = r;
      z.g = g;
      z.b = b;
      z.hoehe = saettige(0.58 + haut * 0.16 + staub * 0.05 - kern * 0.45 - saum * 0.12 - kratzer * 0.08);
      z.rauheit = klemme(
        0.31 + haut * 0.05 + staub * 0.04 + kern * 0.22 + saum * 0.10 - kratzer * 0.12,
        0.14,
        0.85
      );
      z.metall = kern * 0.92;
      z.verdeckung = 1 - kern * 0.30 - saum * 0.15;
      z.er = 0;
      z.eg = 0;
      z.eb = 0;
    },
  };
};

// --- Messing (Schilder, Beschlaege) ----------------------------------------

const baueMessing: FeldBauer = (saat) => {
  const k = kanaele(saat, 'messing');
  const bPolitur = k('politur');
  const bPatina = k('patina');
  const bSpan = k('gruenspan');
  const bFein = k('fein');

  return {
    relief: 10,
    aoRelief: 2,
    hatEmission: false,
    abtaste(u, v, z) {
      const politur = fbm(u, v, 4, 96, 2, 0.5, bPolitur);
      const fein = gradientRauschen(u * 5, v * 320, 5, 320, bFein);
      const patina = glatteStufe(-0.05, 0.70, fbm(u, v, 7, 7, 5, 0.5, bPatina));

      const sp = worley(u, v, 9, 9, bSpan);
      const span = glatteStufe(0.19, 0.05, sp.f1) * glatteStufe(0.885, 0.945, sp.zelle);

      // Poliertes Messing.
      const glanz = 1 + politur * 0.07 + fein * 0.035;
      let r = 0.508 * glanz;
      let g = 0.418 * glanz;
      let b = 0.238 * glanz;

      // Anlauffarben: dunkler, matter, ins Braungruene.
      r = mischen(r, 0.268, patina * 0.55);
      g = mischen(g, 0.232, patina * 0.55);
      b = mischen(b, 0.158, patina * 0.55);
      // Gruenspan sitzt nur in wenigen Vertiefungen.
      r = mischen(r, 0.196, span);
      g = mischen(g, 0.254, span);
      b = mischen(b, 0.176, span);

      z.r = r;
      z.g = g;
      z.b = b;
      z.hoehe = saettige(0.5 + politur * 0.22 + fein * 0.16 + patina * 0.06 - span * 0.10);
      z.rauheit = klemme(0.23 + politur * 0.05 + patina * 0.26 + span * 0.32, 0.12, 0.90);
      z.metall = 1 - span * 0.62 - patina * 0.08;
      z.verdeckung = 1 - span * 0.20;
      z.er = 0;
      z.eg = 0;
      z.eb = 0;
    },
  };
};

// --- Glas ------------------------------------------------------------------

const baueGlas: FeldBauer = (saat) => {
  const k = kanaele(saat, 'glas');
  const bWelle = k('welle');
  const bSchmier = k('schmier');
  const bStaub = k('staub');

  return {
    relief: 6,
    aoRelief: 1,
    hatEmission: false,
    abtaste(u, v, z) {
      // Floatglas ist nie ganz eben — sehr flache, langwellige Welligkeit.
      const welle = fbm(u, v, 3, 3, 3, 0.5, bWelle);

      const sm = worley(u, v, 5, 5, bSchmier);
      const schmier = glatteStufe(0.60, 0.20, sm.f1) * glatteStufe(0.45, 0.75, sm.zelle);

      const st = worley(u, v, 97, 97, bStaub);
      const staub = glatteStufe(0.10, 0.02, st.f1) * glatteStufe(0.90, 0.96, st.zelle);

      // Leichter Gruenstich durch den Eisenanteil im Glas.
      const grund = 0.885 - schmier * 0.06;
      z.r = grund * 0.965;
      z.g = grund;
      z.b = grund * 0.975;

      z.hoehe = saettige(0.5 + welle * 0.30 + staub * 0.35);
      z.rauheit = klemme(0.045 + schmier * 0.26 + staub * 0.45, 0.02, 0.75);
      z.metall = 0;
      z.verdeckung = 1;
      z.er = 0;
      z.eg = 0;
      z.eb = 0;
    },
  };
};

// --- Gummi (Daempfer, Kabelmaentel, Trittstufen) ---------------------------

const baueGummi: FeldBauer = (saat) => {
  const k = kanaele(saat, 'gummi');
  const bNoppen = k('noppen');
  const bKorn = k('korn');
  const bVerschleiss = k('verschleiss');

  return {
    relief: 34,
    aoRelief: 11,
    hatEmission: false,
    abtaste(u, v, z) {
      const no = worley(u, v, 31, 31, bNoppen);
      const noppe = glatteStufe(0.44, 0.20, no.f1);
      const korn = fbm(u, v, 89, 89, 2, 0.5, bKorn);
      const verschleiss = fbm(u, v, 5, 5, 4, 0.5, bVerschleiss);

      // Sehr dunkel, matt, leicht staubig.
      const h = 0.052 + verschleiss * 0.013 + korn * 0.008 + noppe * 0.014;
      z.r = h * 1.03;
      z.g = h;
      z.b = h * 0.985;

      z.hoehe = saettige(0.34 + noppe * 0.46 + korn * 0.07 + verschleiss * 0.04);
      z.rauheit = klemme(0.90 - noppe * 0.07 + korn * 0.03 - verschleiss * 0.04, 0.60, 0.99);
      z.metall = 0;
      z.verdeckung = 1 - (1 - noppe) * 0.22;
      z.er = 0;
      z.eg = 0;
      z.eb = 0;
    },
  };
};

// --- Leiterplatte ----------------------------------------------------------

/** Zellen je Kachelkante fuer das Leiterbahnnetz. */
const PLATINE_ZELLEN = 18;

const baueLeiterplatte: FeldBauer = (saat) => {
  const k = kanaele(saat, 'leiterplatte');
  const bAktivX = k('aktiv_x');
  const bAktivY = k('aktiv_y');
  const bKanteX = k('kante_x');
  const bKanteY = k('kante_y');
  const bKnoten = k('knoten');
  const bPad = k('pad');
  const bLed = k('led');
  const bLack = k('lack');

  const n = PLATINE_ZELLEN;
  const breite = 0.075; // halbe Bahnbreite in Zellbreiten
  // Die Farben der Leuchtdioden folgen der Art Direction der Halle.
  const LED_FARBEN: readonly (readonly [number, number, number])[] = [
    [0.40, 0.88, 1.0], // Cyan
    [1.0, 0.70, 0.28], // Bernstein
    [0.78, 0.57, 0.92], // Violett
  ];

  return {
    relief: 24,
    aoRelief: 7,
    hatEmission: true,
    abtaste(u, v, z) {
      const x = u * n;
      const y = v * n;
      const cx = Math.floor(x);
      const cy = Math.floor(y);
      const lx = x - cx;
      const ly = y - cy;
      const wx = umschlag(cx, n);
      const wy = umschlag(cy, n);
      const wxL = umschlag(cx - 1, n);
      const wyU = umschlag(cy - 1, n);

      // Der Knotenpunkt der Zelle sitzt leicht versetzt — sonst wirkt das Netz
      // wie kariertes Papier.
      const jx = 0.32 + gitterZahl(bKnoten, wx, wy) * 0.36;
      const jy = 0.32 + gitterZahl(mischeEin(bKnoten, 1), wx, wy) * 0.36;

      // Eine Kante gehoert beiden Nachbarzellen: derselbe Hash, also perfekt
      // verbundene Bahnen ueber die Kachelgrenze hinweg.
      const aktivR = gitterZahl(bAktivX, wx, wy) < 0.60;
      const aktivL = gitterZahl(bAktivX, wxL, wy) < 0.60;
      const aktivO = gitterZahl(bAktivY, wx, wy) < 0.60;
      const aktivUn = gitterZahl(bAktivY, wx, wyU) < 0.60;
      const yR = 0.22 + gitterZahl(bKanteX, wx, wy) * 0.56;
      const yL = 0.22 + gitterZahl(bKanteX, wxL, wy) * 0.56;
      const xO = 0.22 + gitterZahl(bKanteY, wx, wy) * 0.56;
      const xU = 0.22 + gitterZahl(bKanteY, wx, wyU) * 0.56;

      // Manhattan-Fuehrung: erst quer, dann laengs zum Kantenmittelpunkt.
      let d = 9;
      if (aktivR) {
        d = Math.min(d, abstandStrecke(lx, ly, jx, jy, jx, yR));
        d = Math.min(d, abstandStrecke(lx, ly, jx, yR, 1, yR));
      }
      if (aktivL) {
        d = Math.min(d, abstandStrecke(lx, ly, jx, jy, jx, yL));
        d = Math.min(d, abstandStrecke(lx, ly, jx, yL, 0, yL));
      }
      if (aktivO) {
        d = Math.min(d, abstandStrecke(lx, ly, jx, jy, xO, jy));
        d = Math.min(d, abstandStrecke(lx, ly, xO, jy, xO, 1));
      }
      if (aktivUn) {
        d = Math.min(d, abstandStrecke(lx, ly, jx, jy, xU, jy));
        d = Math.min(d, abstandStrecke(lx, ly, xU, jy, xU, 0));
      }
      const bahn = glatteStufe(breite + 0.012, breite, d);
      const angeschlossen = aktivR || aktivL || aktivO || aktivUn;

      // Loetauge mit Bohrung am Knotenpunkt.
      const dKnoten = Math.sqrt((lx - jx) * (lx - jx) + (ly - jy) * (ly - jy));
      const hatPad = angeschlossen && gitterZahl(bPad, wx, wy) < 0.27;
      const padRing = hatPad ? glatteStufe(0.155, 0.140, dKnoten) : 0;
      const bohrung = hatPad ? glatteStufe(0.070, 0.055, dKnoten) : 0;
      const pad = saettige(padRing - bohrung);

      // Leuchtdiode: kleines, quadratisches Bauteil neben dem Knoten.
      const ledWahl = gitterZahl(bLed, wx, wy);
      const hatLed = ledWahl < 0.034;
      const ledD = Math.max(Math.abs(lx - jx), Math.abs(ly - jy));
      const led = hatLed ? glatteStufe(0.115, 0.085, ledD) : 0;
      const ledFarbe = LED_FARBEN[Math.floor(ledWahl * 40) % 3] ?? LED_FARBEN[0] ?? [1, 1, 1];

      const lack = fbm(u, v, 29, 29, 3, 0.5, bLack);

      // Loetstopplack: dunkles Tannengruen.
      let r = 0.050 + lack * 0.012;
      let g = 0.135 + lack * 0.022;
      let b = 0.108 + lack * 0.016;
      let rau = 0.44 + lack * 0.07;
      let met = 0.0;

      // Bahn unter dem Lack: gleiche Farbe, nur heller und glatter.
      r = mischen(r, r + 0.030, bahn);
      g = mischen(g, g + 0.070, bahn);
      b = mischen(b, b + 0.050, bahn);
      rau = mischen(rau, 0.33, bahn);

      // Loetauge: chemisch vergoldet.
      r = mischen(r, 0.640, pad);
      g = mischen(g, 0.515, pad);
      b = mischen(b, 0.252, pad);
      rau = mischen(rau, 0.28, pad);
      met = mischen(met, 0.95, pad);

      // Bohrung: fast schwarz.
      r = mischen(r, 0.022, bohrung);
      g = mischen(g, 0.026, bohrung);
      b = mischen(b, 0.028, bohrung);
      rau = mischen(rau, 0.80, bohrung);
      met = mischen(met, 0.0, bohrung);

      // Gehaeuse der Leuchtdiode.
      const lr = ledFarbe[0] ?? 1;
      const lg = ledFarbe[1] ?? 1;
      const lb = ledFarbe[2] ?? 1;
      r = mischen(r, 0.30 + lr * 0.30, led);
      g = mischen(g, 0.30 + lg * 0.30, led);
      b = mischen(b, 0.30 + lb * 0.30, led);
      rau = mischen(rau, 0.22, led);
      met = mischen(met, 0.0, led);

      z.r = r;
      z.g = g;
      z.b = b;
      z.hoehe = saettige(0.5 + bahn * 0.17 + pad * 0.23 + led * 0.36 - bohrung * 0.52 + lack * 0.03);
      z.rauheit = klemme(rau, 0.15, 0.92);
      z.metall = klemme(met + bahn * 0.10, 0, 1);
      z.verdeckung = 1 - bohrung * 0.75;

      // Nur die Diode leuchtet — und zwar im vorgegebenen Band.
      z.er = lr * led;
      z.eg = lg * led;
      z.eb = lb * led;
    },
  };
};

// --- Bodengitter (Gitterrost) ----------------------------------------------

const baueBodengitter: FeldBauer = (saat) => {
  const k = kanaele(saat, 'bodengitter');
  const bZink = k('zink');
  const bRost = k('rost');
  const bSchmutz = k('schmutz');

  const tragZellen = 14; // Tragstaebe laengs v
  const fuellZellen = 7; // Fuellstaebe laengs u, doppelter Abstand
  const kerbZellen = 28; // Kerbung der Tragstaboberkante

  return {
    relief: 54,
    aoRelief: 26,
    hatEmission: false,
    abtaste(u, v, z) {
      // Abstand zur naechsten Zellgrenze, auf der die Staebe sitzen.
      const fu = u * tragZellen - Math.floor(u * tragZellen);
      const fv = v * fuellZellen - Math.floor(v * fuellZellen);
      const du = Math.min(fu, 1 - fu);
      const dv = Math.min(fv, 1 - fv);

      const tragBreite = 0.150;
      const fuellBreite = 0.042;
      const trag = glatteStufe(tragBreite, tragBreite - 0.026, du);
      const fuell = glatteStufe(fuellBreite, fuellBreite - 0.014, dv);

      // Gekerbte Oberkante der Tragstaebe (Rutschsicherung).
      const fk = v * kerbZellen - Math.floor(v * kerbZellen);
      const kerbe = glatteStufe(0.34, 0.44, Math.min(fk, 1 - fk));
      const tragHoehe = trag * (0.80 + kerbe * 0.20);
      const fuellHoehe = fuell * 0.66;
      const balken = Math.max(tragHoehe, fuellHoehe);
      const material = Math.max(trag, fuell);

      const zink = fbm(u, v, 33, 33, 3, 0.5, bZink);
      const ro = worley(u, v, 17, 17, bRost);
      const rost = glatteStufe(0.50, 0.16, ro.f1) * glatteStufe(0.72, 0.88, ro.zelle) * material;
      const schmutz = glatteStufe(-0.1, 0.6, fbm(u, v, 9, 9, 4, 0.5, bSchmutz));

      // Feuerverzinkter Stahl: kuehl, fleckig, mit sichtbaren Zinkblumen.
      const grund = 0.415 + zink * 0.075 - schmutz * 0.07;
      let r = grund * 0.985;
      let g = grund;
      let b = grund * 1.045;

      // Flugrost in den Zwickeln.
      r = mischen(r, 0.245, rost);
      g = mischen(g, 0.120, rost);
      b = mischen(b, 0.058, rost);

      // Unter dem Rost liegt Dunkelheit, kein Material.
      const loch = 1 - material;
      r = mischen(r, 0.020, loch);
      g = mischen(g, 0.023, loch);
      b = mischen(b, 0.026, loch);

      z.r = r;
      z.g = g;
      z.b = b;
      z.hoehe = saettige(0.04 + balken * 0.94 + zink * 0.02);
      z.rauheit = klemme(0.46 + zink * 0.08 + rost * 0.40 + schmutz * 0.12 + loch * 0.30, 0.20, 0.99);
      z.metall = material * (0.92 - rost * 0.55);
      z.verdeckung = klemme(0.10 + material * 0.90 - rost * 0.06, 0, 1);
      z.er = 0;
      z.eg = 0;
      z.eb = 0;
    },
  };
};

// --- Ziegel (Backsteinwand von 1957) ---------------------------------------

const ZIEGEL_REIHEN = 12;
const ZIEGEL_SPALTEN = 4;

const baueZiegel: FeldBauer = (saat) => {
  const k = kanaele(saat, 'ziegel');
  const bStein = k('stein');
  const bFlaeche = k('flaeche');
  const bMoertel = k('moertel');
  const bRuss = k('russ');
  const bAusblueh = k('ausblueh');
  const bSchlag = k('schlag');

  // Fugenbreite in Kacheleinheiten, umgerechnet in Anteile der Steinzelle.
  const fugeAbsolut = 0.0115;
  const fugeX = fugeAbsolut * ZIEGEL_SPALTEN;
  const fugeY = fugeAbsolut * ZIEGEL_REIHEN;

  return {
    relief: 46,
    aoRelief: 17,
    hatEmission: false,
    abtaste(u, v, z) {
      const yy = v * ZIEGEL_REIHEN;
      const ry = Math.floor(yy);
      const fy = yy - ry;
      // Laeuferverband: jede zweite Reihe um einen halben Stein versetzt.
      const versatz = (umschlag(ry, 2) === 1) ? 0.5 : 0;
      const xx = u * ZIEGEL_SPALTEN + versatz;
      const rx = Math.floor(xx);
      const fx = xx - rx;

      const wx = umschlag(rx, ZIEGEL_SPALTEN);
      const wy = umschlag(ry, ZIEGEL_REIHEN);
      const steinA = gitterZahl(bStein, wx, wy);
      const steinB = gitterZahl(mischeEin(bStein, 1), wx, wy);
      const steinC = gitterZahl(mischeEin(bStein, 2), wx, wy);

      const randX = Math.min(fx, 1 - fx);
      const randY = Math.min(fy, 1 - fy);
      // 1 in der Fuge, 0 auf dem Stein.
      const fuge =
        1 -
        Math.min(
          glatteStufe(fugeX, fugeX + 0.035, randX),
          glatteStufe(fugeY, fugeY + 0.075, randY)
        );

      const flaeche = fbm(u, v, 67, 67, 3, 0.5, bFlaeche);
      const moertelKorn = fbm(u, v, 121, 121, 2, 0.5, bMoertel);
      const russ = glatteStufe(-0.55, 0.65, fbm(u, v, 3, 3, 4, 0.5, bRuss));
      const ausblueh =
        glatteStufe(0.55, 0.95, gratRauschen(u, v, 37, 5, 3, 0.5, bAusblueh)) * (1 - fuge);

      // Abgeplatzte Steinkanten.
      const sch = worley(u, v, 23, 23, bSchlag);
      const schlag = glatteStufe(0.26, 0.09, sch.f1) * glatteStufe(0.915, 0.955, sch.zelle);

      // Steinfarbe: von dunkelrot bis fast schwarzblau (Klinker).
      const klinker = steinC < 0.14 ? 1 : 0;
      const basis = 0.132 + steinA * 0.062;
      let r = basis;
      let g = basis * (0.560 + steinB * 0.055);
      let b = basis * (0.470 + steinB * 0.055);
      if (klinker === 1) {
        r = mischen(r, 0.072, 0.85);
        g = mischen(g, 0.070, 0.85);
        b = mischen(b, 0.082, 0.85);
      }
      const steinTon = 1 + flaeche * 0.085;
      r *= steinTon;
      g *= steinTon;
      b *= steinTon;

      // Moertel: kaltes, helles Grau mit Korn.
      const mo = 0.196 + moertelKorn * 0.036;
      r = mischen(r, mo * 0.98, fuge);
      g = mischen(g, mo, fuge);
      b = mischen(b, mo * 1.05, fuge);

      // Russ aus 68 Jahren Halle.
      const dunkel = 1 - russ * 0.50;
      r *= dunkel;
      g *= dunkel;
      b *= dunkel;

      // Salzausblueh: matter, heller Schleier.
      r = mischen(r, r + 0.105, ausblueh);
      g = mischen(g, g + 0.110, ausblueh);
      b = mischen(b, b + 0.118, ausblueh);

      // Abplatzer zeigen frischen, helleren Scherben.
      const frisch = schlag * (1 - fuge);
      r = mischen(r, 0.238, frisch);
      g = mischen(g, 0.136, frisch);
      b = mischen(b, 0.102, frisch);

      z.r = r;
      z.g = g;
      z.b = b;
      z.hoehe = saettige(
        0.86 - fuge * 0.42 + flaeche * 0.05 - frisch * 0.16 + fuge * moertelKorn * 0.07
      );
      z.rauheit = klemme(
        0.80 + fuge * 0.12 + flaeche * 0.05 + ausblueh * 0.10 + frisch * 0.06 - klinker * 0.22,
        0.45,
        0.99
      );
      z.metall = 0;
      z.verdeckung = 1 - fuge * 0.42 - frisch * 0.15;
      z.er = 0;
      z.eg = 0;
      z.eb = 0;
    },
  };
};

// --- Emaille (Beschriftungsschilder) ---------------------------------------

const baueEmaille: FeldBauer = (saat) => {
  const k = kanaele(saat, 'emaille');
  const bHaut = k('orangenhaut');
  const bAbsplitter = k('absplitter');
  const bKratzer = k('kratzer');
  const bWolke = k('wolke');

  return {
    relief: 10,
    aoRelief: 2.5,
    hatEmission: false,
    abtaste(u, v, z) {
      const haut = fbm(u, v, 53, 53, 3, 0.5, bHaut);
      const wolke = fbm(u, v, 4, 4, 3, 0.5, bWolke);
      const kratzer = glatteStufe(0.88, 0.99, gratRauschen(u, v, 27, 71, 2, 0.5, bKratzer));

      const ab = worley(u, v, 9, 9, bAbsplitter);
      const auswahl = glatteStufe(0.925, 0.955, ab.zelle);
      const kern = glatteStufe(0.150, 0.055, ab.f1) * auswahl;
      const rostSaum = (glatteStufe(0.265, 0.140, ab.f1) * auswahl - kern) * 0.9;

      // Tiefes Emailleblau der KONTUR-Schilder.
      const ton = 1 + wolke * 0.07 + haut * 0.03;
      let r = 0.070 * ton;
      let g = 0.128 * ton;
      let b = 0.222 * ton;

      // Abplatzer: blankes Blech, darum ein Rostsaum.
      r = mischen(r, 0.365, kern);
      g = mischen(g, 0.372, kern);
      b = mischen(b, 0.380, kern);
      r = mischen(r, 0.330, rostSaum);
      g = mischen(g, 0.163, rostSaum);
      b = mischen(b, 0.072, rostSaum);
      // Kratzer im Glasfluss.
      r = mischen(r, r + 0.055, kratzer);
      g = mischen(g, g + 0.058, kratzer);
      b = mischen(b, b + 0.062, kratzer);

      z.r = r;
      z.g = g;
      z.b = b;
      z.hoehe = saettige(0.62 + haut * 0.10 - kern * 0.50 - rostSaum * 0.14 - kratzer * 0.06);
      z.rauheit = klemme(0.105 + haut * 0.025 + kern * 0.50 + rostSaum * 0.42 + kratzer * 0.10, 0.05, 0.92);
      z.metall = kern * 0.75;
      z.verdeckung = 1 - kern * 0.28 - rostSaum * 0.10;
      z.er = 0;
      z.eg = 0;
      z.eb = 0;
    },
  };
};

const FELDER: Record<MaterialArt, FeldBauer> = {
  beton: baueBeton,
  stahl_gebuerstet: baueStahlGebuerstet,
  stahl_lackiert: baueStahlLackiert,
  messing: baueMessing,
  glas: baueGlas,
  gummi: baueGummi,
  leiterplatte: baueLeiterplatte,
  bodengitter: baueBodengitter,
  ziegel: baueZiegel,
  emaille: baueEmaille,
};

/**
 * Wertet ein Materialfeld an einer beliebigen Stelle aus — ohne eine Textur zu
 * bauen. Wird von den Kachelbarkeitstests benutzt, um `feld(0, v)` gegen
 * `feld(1, v)` exakt zu vergleichen.
 */
export function abtasteOberflaeche(
  art: MaterialArt,
  saat: number,
  u: number,
  v: number
): Readonly<Oberflaeche> {
  const ziel: Oberflaeche = {
    r: 0,
    g: 0,
    b: 0,
    hoehe: 0,
    rauheit: 0,
    metall: 0,
    verdeckung: 1,
    er: 0,
    eg: 0,
    eb: 0,
  };
  FELDER[art](saat).abtaste(u, v, ziel);
  return ziel;
}

// ---------------------------------------------------------------------------
// Hoehenfeld -> Normale und Verdeckung
// ---------------------------------------------------------------------------

/** Liest ein Hoehenfeld mit Umschlag an den Kachelraendern. */
function hoeheAn(hoehe: Float32Array, groesse: number, x: number, y: number): number {
  const maske = groesse - 1;
  return hoehe[((y & maske) * groesse + (x & maske))] ?? 0;
}

/**
 * Normal-Map aus dem Hoehenfeld per Sobel-3x3.
 *
 * `n = normalize(vec3(-gx, -gy, 1))`, Ausgabe `n * 0.5 + 0.5`. Eine flache
 * Stelle liefert damit exakt (128, 128, 255): `Math.round(127.5) === 128`.
 * Weil `nz` immer positiv ist, ist der Blaukanal ueberall >= 128.
 */
export function normaleAusHoehe(
  hoehe: Float32Array,
  groesse: number,
  reliefTexel: number
): Uint8Array {
  const daten = new Uint8Array(groesse * groesse * 4);
  for (let y = 0; y < groesse; y++) {
    for (let x = 0; x < groesse; x++) {
      const hLO = hoeheAn(hoehe, groesse, x - 1, y - 1);
      const hMO = hoeheAn(hoehe, groesse, x, y - 1);
      const hRO = hoeheAn(hoehe, groesse, x + 1, y - 1);
      const hLM = hoeheAn(hoehe, groesse, x - 1, y);
      const hRM = hoeheAn(hoehe, groesse, x + 1, y);
      const hLU = hoeheAn(hoehe, groesse, x - 1, y + 1);
      const hMU = hoeheAn(hoehe, groesse, x, y + 1);
      const hRU = hoeheAn(hoehe, groesse, x + 1, y + 1);

      const gx = ((hRO + 2 * hRM + hRU - (hLO + 2 * hLM + hLU)) / 8) * reliefTexel;
      const gy = ((hLU + 2 * hMU + hRU - (hLO + 2 * hMO + hRO)) / 8) * reliefTexel;

      const nx = -gx;
      const ny = -gy;
      const laenge = Math.sqrt(nx * nx + ny * ny + 1);
      const i = (y * groesse + x) * 4;
      daten[i] = Math.round((nx / laenge) * 127.5 + 127.5);
      daten[i + 1] = Math.round((ny / laenge) * 127.5 + 127.5);
      daten[i + 2] = Math.round((1 / laenge) * 127.5 + 127.5);
      daten[i + 3] = 255;
    }
  }
  return daten;
}

/** Acht Abtastrichtungen fuer den Horizont-Sweep (Achteck). */
const SWEEP_X: readonly number[] = [1, W, 0, -W, -1, -W, 0, W];
const SWEEP_Y: readonly number[] = [0, W, 1, W, 0, -W, -1, -W];

/**
 * Umgebungsverdeckung per Line-Sweep-Horizon (Produktions-Bibel 3.2).
 * Fuer acht Richtungen wird der maximale Horizontwinkel gesucht;
 * `ao = 1 - mittel(sin(horizont))`.
 */
export function berechneVerdeckung(
  hoehe: Float32Array,
  groesse: number,
  reliefTexel: number
): Float32Array {
  const ergebnis = new Float32Array(groesse * groesse);
  const grund = groesse / 256;
  const schritte: number[] = [];
  for (let s = 1; s <= 32; s *= 2) schritte.push(Math.round(s * grund));

  for (let y = 0; y < groesse; y++) {
    for (let x = 0; x < groesse; x++) {
      const i = y * groesse + x;
      const h0 = (hoehe[i] ?? 0) * reliefTexel;
      let summe = 0;
      for (let d = 0; d < 8; d++) {
        const rx = SWEEP_X[d] ?? 0;
        const ry = SWEEP_Y[d] ?? 0;
        let horizont = 0;
        for (const s of schritte) {
          const sx = x + Math.round(rx * s);
          const sy = y + Math.round(ry * s);
          const dh = hoeheAn(hoehe, groesse, sx, sy) * reliefTexel - h0;
          if (dh > 0) {
            const sinus = dh / Math.sqrt(dh * dh + s * s);
            if (sinus > horizont) horizont = sinus;
          }
        }
        summe += horizont;
      }
      ergebnis[i] = saettige(1 - summe / 8);
    }
  }
  return ergebnis;
}

// ---------------------------------------------------------------------------
// Texturbau
// ---------------------------------------------------------------------------

function inByte(x: number): number {
  const b = Math.round(saettige(x) * 255);
  return b < 0 ? 0 : b > 255 ? 255 : b;
}

function baueTextur(
  daten: Uint8Array,
  groesse: number,
  farbraum: THREE.ColorSpace,
  anisotropie: number
): THREE.DataTexture {
  const t = new THREE.DataTexture(daten, groesse, groesse, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = farbraum;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = anisotropie;
  t.flipY = false;
  t.needsUpdate = true;
  return t;
}

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

/**
 * Obergrenze fuer gleichzeitig lebende Texturs&auml;tze. Das Spiel kennt zehn
 * Master-Materialien; die Reserve faengt Sonderfaelle ab. Wird sie
 * ueberschritten, faellt der am laengsten unbenutzte Satz heraus und wird
 * entsorgt.
 */
export const HOECHSTZAHL_SAETZE = 12;

const cache = new Map<string, TexturSatz>();

function schluessel(art: MaterialArt, saat: number, groesse: number): string {
  return art + '|' + (saat >>> 0) + '|' + groesse;
}

/** Anzahl der aktuell im Cache gehaltenen Texturs&auml;tze (Diagnose, Tests). */
export function texturenBestand(): number {
  return cache.size;
}

/**
 * Erzeugt einen vollstaendigen Texturs&auml;tz (Albedo, Normale, gepacktes ORM
 * und optional Emission) fuer eine Materialart.
 *
 * Gleiche Parameter liefern dieselbe Instanz aus dem Cache; ein Neuaufbau nach
 * `entsorgeAlleTexturen()` ist byteweise identisch.
 */
export function erzeugeTexturSatz(
  art: MaterialArt,
  saat: number,
  groesse: TexturGroesse = 512
): TexturSatz {
  const key = schluessel(art, saat, groesse);
  const vorhanden = cache.get(key);
  if (vorhanden !== undefined) {
    // Zugriff erneuern, damit die LRU-Ordnung stimmt.
    cache.delete(key);
    cache.set(key, vorhanden);
    return vorhanden;
  }

  const feld = FELDER[art](saat >>> 0);
  const anzahl = groesse * groesse;
  const albedoDaten = new Uint8Array(anzahl * 4);
  const ormDaten = new Uint8Array(anzahl * 4);
  const emissionDaten = feld.hatEmission ? new Uint8Array(anzahl * 4) : null;
  const hoehenfeld = new Float32Array(anzahl);
  const musterAo = new Float32Array(anzahl);

  const ziel: Oberflaeche = {
    r: 0,
    g: 0,
    b: 0,
    hoehe: 0,
    rauheit: 0,
    metall: 0,
    verdeckung: 1,
    er: 0,
    eg: 0,
    eb: 0,
  };

  for (let y = 0; y < groesse; y++) {
    const v = y / groesse;
    for (let x = 0; x < groesse; x++) {
      const u = x / groesse;
      ziel.r = 0;
      ziel.g = 0;
      ziel.b = 0;
      ziel.hoehe = 0;
      ziel.rauheit = 0.5;
      ziel.metall = 0;
      ziel.verdeckung = 1;
      ziel.er = 0;
      ziel.eg = 0;
      ziel.eb = 0;
      feld.abtaste(u, v, ziel);

      const i = y * groesse + x;
      const j = i * 4;
      albedoDaten[j] = inByte(ziel.r);
      albedoDaten[j + 1] = inByte(ziel.g);
      albedoDaten[j + 2] = inByte(ziel.b);
      albedoDaten[j + 3] = 255;

      ormDaten[j] = inByte(ziel.rauheit);
      ormDaten[j + 1] = inByte(ziel.metall);
      ormDaten[j + 3] = 255;

      if (emissionDaten !== null) {
        emissionDaten[j] = inByte(ziel.er);
        emissionDaten[j + 1] = inByte(ziel.eg);
        emissionDaten[j + 2] = inByte(ziel.eb);
        emissionDaten[j + 3] = 255;
      }

      hoehenfeld[i] = saettige(ziel.hoehe);
      musterAo[i] = saettige(ziel.verdeckung);
    }
  }

  const massstab = groesse / 512;
  const reliefTexel = feld.relief * massstab;
  const sweepAo = berechneVerdeckung(hoehenfeld, groesse, feld.aoRelief * massstab);
  for (let i = 0; i < anzahl; i++) {
    ormDaten[i * 4 + 2] = inByte((sweepAo[i] ?? 1) * (musterAo[i] ?? 1));
  }

  const normalDaten = normaleAusHoehe(hoehenfeld, groesse, reliefTexel);

  const albedo = baueTextur(albedoDaten, groesse, THREE.SRGBColorSpace, 8);
  const normal = baueTextur(normalDaten, groesse, THREE.NoColorSpace, 8);
  const orm = baueTextur(ormDaten, groesse, THREE.NoColorSpace, 4);
  const emission =
    emissionDaten !== null ? baueTextur(emissionDaten, groesse, THREE.SRGBColorSpace, 4) : null;

  albedo.name = art + '_albedo';
  normal.name = art + '_normal';
  orm.name = art + '_orm';
  if (emission !== null) emission.name = art + '_emission';

  const grund = {
    albedo,
    normal,
    orm,
    entsorge(): void {
      if (cache.get(key) === satz) cache.delete(key);
      albedo.dispose();
      normal.dispose();
      orm.dispose();
      if (emission !== null) emission.dispose();
    },
  };
  const satz: TexturSatz = emission !== null ? { ...grund, emission } : grund;

  cache.set(key, satz);
  while (cache.size > HOECHSTZAHL_SAETZE) {
    const aeltester = cache.keys().next();
    if (aeltester.done === true) break;
    const raus = cache.get(aeltester.value);
    cache.delete(aeltester.value);
    if (raus !== undefined) raus.entsorge();
  }
  return satz;
}

/** Entsorgt alle gecachten Texturs&auml;tze und leert den Cache. */
export function entsorgeAlleTexturen(): void {
  const alle = Array.from(cache.values());
  cache.clear();
  for (const satz of alle) satz.entsorge();
}
