/**
 * Pruefungen der prozeduralen Texturbibliothek.
 *
 * Alle Tests laufen in Node ohne WebGL. `THREE.DataTexture` ist ohne
 * GPU-Kontext konstruierbar; geprueft werden die erzeugten Bytes, nicht das
 * Hochladen auf die Grafikkarte.
 */

import { afterAll, describe, expect, it, vi } from 'vitest';

/**
 * `tests/einheit/setup.ts` macht `Math.random` zu einem Fehler. `three` braucht
 * es aber unvermeidbar: `generateUUID()` in `three.core.js` wuerfelt bei JEDEM
 * `new Texture()`, `new Material()` und `new Object3D()`. Die Falle laesst sich
 * hier also nicht scharf lassen, ohne die gesamte Renderschicht untestbar zu
 * machen.
 *
 * Statt die Falle einfach zu oeffnen, wird sie durch einen DETERMINISTISCHEN
 * Strom ersetzt: `three` bekommt seine UUIDs, der Testlauf bleibt aber
 * reproduzierbar. Zusaetzlich zaehlen wir die Aufrufe und weisen unten nach,
 * dass `erzeugeTexturSatz` genau so oft wuerfelt, wie `three` Objekte anlegt —
 * also kein einziges Mal selbst. Ein Quelltextscan sichert das doppelt ab.
 *
 * `vi.hoisted` wird vom Vitest-Transform ueber die Importe gezogen und greift
 * damit schon vor der Auswertung von `three/webgpu`.
 */
const wuerfel = vi.hoisted(() => {
  const falle = Math.random;
  let zustand = 0x9e3779b9;
  let zahl = 0;
  Math.random = (): number => {
    zahl++;
    zustand = (zustand + 0x6d2b79f5) >>> 0;
    let h = Math.imul(zustand ^ (zustand >>> 15), zustand | 1);
    h ^= h + Math.imul(h ^ (h >>> 7), h | 61);
    return ((h ^ (h >>> 14)) >>> 0) / 4294967296;
  };
  return {
    falle,
    stand: (): number => zahl,
  };
});

import { readFile } from 'node:fs/promises';
import * as THREE from 'three/webgpu';

import { zufall } from '../../src/sim/rng';
import {
  MATERIAL_ARTEN,
  HOECHSTZAHL_SAETZE,
  abtasteOberflaeche,
  berechneVerdeckung,
  entsorgeAlleTexturen,
  erzeugeTexturSatz,
  fbm,
  gitterZahl,
  gradientRauschen,
  kanalSaat,
  normaleAusHoehe,
  texturenBestand,
  worley,
  type MaterialArt,
  type Oberflaeche,
  type TexturSatz,
} from '../../src/welt/texturen';

afterAll(() => {
  entsorgeAlleTexturen();
  Math.random = wuerfel.falle;
});

const SAAT = 0x5c4a11;
const G = 256 as const;

/** Holt die Bytes einer DataTexture ohne `as any`. */
function bytes(t: THREE.DataTexture): Uint8Array {
  const d = t.image.data;
  if (!(d instanceof Uint8Array)) throw new Error('DataTexture ohne Uint8Array-Daten');
  return d;
}

/** Erster abweichender Index oder -1. */
function ersteAbweichung(a: Uint8Array, b: Uint8Array): number {
  if (a.length !== b.length) return 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return i;
  return -1;
}

/** Mittlerer Betragsunterschied zweier Spalten (oder Zeilen) einer RGBA-Textur. */
function spaltenAbstand(d: Uint8Array, groesse: number, x1: number, x2: number): number {
  let summe = 0;
  for (let y = 0; y < groesse; y++) {
    const a = (y * groesse + x1) * 4;
    const b = (y * groesse + x2) * 4;
    for (let c = 0; c < 3; c++) summe += Math.abs((d[a + c] ?? 0) - (d[b + c] ?? 0));
  }
  return summe / (groesse * 3);
}

function zeilenAbstand(d: Uint8Array, groesse: number, y1: number, y2: number): number {
  let summe = 0;
  for (let x = 0; x < groesse; x++) {
    const a = (y1 * groesse + x) * 4;
    const b = (y2 * groesse + x) * 4;
    for (let c = 0; c < 3; c++) summe += Math.abs((d[a + c] ?? 0) - (d[b + c] ?? 0));
  }
  return summe / (groesse * 3);
}

/** Der Cache haelt alle zehn Arten gleichzeitig, der Aufruf ist also billig. */
function hole(art: MaterialArt): TexturSatz {
  return erzeugeTexturSatz(art, SAAT, G);
}

// ---------------------------------------------------------------------------

describe('Zufallsquelle', () => {
  it('ist bitgleich mit zufall() aus src/sim/rng.ts', () => {
    for (const kanal of ['beton.gross', 'ziegel.stein', 'x']) {
      for (const saat of [0, 1, 4711, 0x7fffffff]) {
        const basis = kanalSaat(saat, kanal);
        for (const [a, b] of [
          [0, 0],
          [3, 7],
          [-5, 12],
          [1023, 4095],
        ] as const) {
          expect(gitterZahl(basis, a, b)).toBe(zufall(saat, kanal, a, b));
        }
      }
    }
  });

  it('liefert Werte in [0, 1)', () => {
    const basis = kanalSaat(17, 'probe');
    for (let i = 0; i < 5000; i++) {
      const w = gitterZahl(basis, i, i * 3 - 7);
      expect(w).toBeGreaterThanOrEqual(0);
      expect(w).toBeLessThan(1);
    }
  });
});

describe('Rauschfunktionen', () => {
  const basis = kanalSaat(99, 'rauschen.probe');

  it('Gradientenrauschen ist auf dyadischen Stellen bitgenau periodisch', () => {
    // Bei Zweierbruechen bleibt der Nachkommaanteil beim Verschieben um die
    // ganzzahlige Periode exakt erhalten — hier muss die Gleichheit bitgenau
    // sein. Genau dieser Fall tritt beim Abtasten der Kachel auf, denn
    // `u = x / groesse` ist immer ein Zweierbruch.
    for (let i = 0; i < 160; i++) {
      const x = (i / 8) % 5;
      const y = (i / 16) % 3;
      const a = gradientRauschen(x, y, 5, 3, basis);
      expect(gradientRauschen(x + 5, y, 5, 3, basis)).toBe(a);
      expect(gradientRauschen(x, y + 3, 5, 3, basis)).toBe(a);
      expect(gradientRauschen(x - 10, y + 6, 5, 3, basis)).toBe(a);
    }
  });

  it('Gradientenrauschen ist auch auf beliebigen Stellen periodisch', () => {
    // Auf nicht-dyadischen Stellen kostet die Verschiebung ein paar Bits
    // Genauigkeit (`x + 5 - floor(x + 5)` ist nicht bitgleich zu
    // `x - floor(x)`). Sichtbar ist das nie, deshalb reicht hier eine sehr
    // enge Schranke.
    for (let i = 0; i < 200; i++) {
      const x = (i * 0.137) % 5;
      const y = (i * 0.291) % 3;
      const a = gradientRauschen(x, y, 5, 3, basis);
      expect(gradientRauschen(x + 5, y, 5, 3, basis)).toBeCloseTo(a, 12);
      expect(gradientRauschen(x, y + 3, 5, 3, basis)).toBeCloseTo(a, 12);
    }
  });

  it('Gradientenrauschen bleibt im erwarteten Wertebereich', () => {
    let min = 9;
    let max = -9;
    for (let i = 0; i < 20000; i++) {
      const w = gradientRauschen(i * 0.0173, i * 0.0411, 8, 8, basis);
      expect(Number.isFinite(w)).toBe(true);
      if (w < min) min = w;
      if (w > max) max = w;
    }
    expect(min).toBeGreaterThan(-1.05);
    expect(max).toBeLessThan(1.05);
    // Ein Rauschen, das nie stark ausschlaegt, waere unbrauchbar.
    expect(max - min).toBeGreaterThan(1.0);
  });

  it('fBm ist ueber die Kachelgrenze hinweg stetig fortsetzbar', () => {
    for (let i = 0; i < 100; i++) {
      const v = i / 100;
      expect(fbm(0, v, 4, 4, 5, 0.5, basis)).toBe(fbm(1, v, 4, 4, 5, 0.5, basis));
      expect(fbm(v, 0, 4, 4, 5, 0.5, basis)).toBe(fbm(v, 1, 4, 4, 5, 0.5, basis));
      expect(fbm(0, v, 3, 5, 4, 0.5, basis)).toBe(fbm(1, v, 3, 5, 4, 0.5, basis));
    }
  });

  it('Worley liefert f1 <= f2 und ist periodisch', () => {
    for (let i = 0; i < 300; i++) {
      const u = (i * 0.0137) % 1;
      const v = (i * 0.0291) % 1;
      const a = worley(u, v, 7, 7, basis);
      const f1 = a.f1;
      const f2 = a.f2;
      const zelle = a.zelle;
      expect(f1).toBeLessThanOrEqual(f2);
      expect(f1).toBeGreaterThanOrEqual(0);
      expect(f1).toBeLessThan(2);
      const b = worley(u + 1, v + 1, 7, 7, basis);
      expect(b.f1).toBeCloseTo(f1, 12);
      expect(b.zelle).toBe(zelle);
    }
  });
});

describe('Determinismus', () => {
  it('liefert bei gleicher Saat byteweise identische Daten', () => {
    entsorgeAlleTexturen();
    const erst = erzeugeTexturSatz('beton', 20260820, G);
    const albedoA = Uint8Array.from(bytes(erst.albedo));
    const normalA = Uint8Array.from(bytes(erst.normal));
    const ormA = Uint8Array.from(bytes(erst.orm));

    entsorgeAlleTexturen();
    const zweit = erzeugeTexturSatz('beton', 20260820, G);

    expect(zweit).not.toBe(erst);
    expect(ersteAbweichung(bytes(zweit.albedo), albedoA)).toBe(-1);
    expect(ersteAbweichung(bytes(zweit.normal), normalA)).toBe(-1);
    expect(ersteAbweichung(bytes(zweit.orm), ormA)).toBe(-1);
  });

  it('trennt verschiedene Saaten und verschiedene Arten', () => {
    entsorgeAlleTexturen();
    const a = Uint8Array.from(bytes(erzeugeTexturSatz('beton', 1, G).albedo));
    const b = Uint8Array.from(bytes(erzeugeTexturSatz('beton', 2, G).albedo));
    const c = Uint8Array.from(bytes(erzeugeTexturSatz('ziegel', 1, G).albedo));
    expect(ersteAbweichung(a, b)).not.toBe(-1);
    expect(ersteAbweichung(a, c)).not.toBe(-1);
    entsorgeAlleTexturen();
  });

  it('wuerfelt nie selbst — jeder Math.random-Aufruf stammt aus three', () => {
    entsorgeAlleTexturen();

    // `three` wuerfelt beim Anlegen einer DataTexture eine feste Anzahl Male
    // (UUID der Textur und ihrer Source). Wir messen sie, statt sie zu raten.
    const vorProbe = wuerfel.stand();
    const probe = new THREE.DataTexture(new Uint8Array(4), 1, 1);
    const jeTextur = wuerfel.stand() - vorProbe;
    probe.dispose();
    expect(jeTextur).toBeGreaterThan(0);

    const vorher = wuerfel.stand();
    const ohneEmission = erzeugeTexturSatz('messing', 5, G);
    expect(ohneEmission.emission).toBeUndefined();
    // Genau drei Texturen — Albedo, Normale, ORM. Kein Wurf darueber hinaus.
    expect(wuerfel.stand() - vorher).toBe(3 * jeTextur);

    const zwischen = wuerfel.stand();
    const mitEmission = erzeugeTexturSatz('leiterplatte', 5, G);
    expect(mitEmission.emission).toBeDefined();
    expect(wuerfel.stand() - zwischen).toBe(4 * jeTextur);

    // Der Cache wuerfelt gar nicht.
    const nochmal = wuerfel.stand();
    erzeugeTexturSatz('messing', 5, G);
    expect(wuerfel.stand() - nochmal).toBe(0);
    entsorgeAlleTexturen();
  });

  it('enthaelt im Quelltext keinen Aufruf von Math.random oder Date.now', async () => {
    const quelle = await readFile(new URL('../../src/welt/texturen.ts', import.meta.url), 'utf8');
    expect(quelle).not.toMatch(/Math\s*\.\s*random\s*\(/);
    expect(quelle).not.toMatch(/Date\s*\.\s*now\s*\(/);
    expect(quelle).not.toMatch(/performance\s*\.\s*now\s*\(/);
    // Transzendente Funktionen sind plattformabhaengig gerundet und deshalb
    // in einem bitdeterministischen Generator verboten.
    expect(quelle).not.toMatch(/Math\s*\.\s*(sin|cos|tan|pow|exp|log|atan2)\s*\(/);
  });
});

describe('Kachelbarkeit', () => {
  const felder: readonly (keyof Oberflaeche)[] = [
    'r',
    'g',
    'b',
    'hoehe',
    'rauheit',
    'metall',
    'verdeckung',
    'er',
    'eg',
    'eb',
  ];

  it('das Materialfeld ist an den Kachelraendern exakt gleich', () => {
    for (const art of MATERIAL_ARTEN) {
      for (let i = 0; i < 16; i++) {
        const t = i / 16 + 0.013;
        const links = abtasteOberflaeche(art, SAAT, 0, t);
        const rechts = abtasteOberflaeche(art, SAAT, 1, t);
        const oben = abtasteOberflaeche(art, SAAT, t, 0);
        const unten = abtasteOberflaeche(art, SAAT, t, 1);
        for (const f of felder) {
          expect(rechts[f], `${art}.${f} bei v=${t} (u-Naht)`).toBe(links[f]);
          expect(unten[f], `${art}.${f} bei u=${t} (v-Naht)`).toBe(oben[f]);
        }
      }
    }
  });

  it('Albedo und Normale zeigen an der Naht keinen Bruch', () => {
    for (const art of MATERIAL_ARTEN) {
      for (const karte of ['albedo', 'normal'] as const) {
        const d = bytes(hole(art)[karte]);

        // Ein Texelschritt ueber die Naht darf nicht auffaelliger sein als
        // der Texelschritt unmittelbar daneben. Ein Vergleich gegen die
        // Kachelmitte waere falsch: Muster wie das Gitterrost legen ihre
        // Staebe absichtlich genau auf die Naht.
        const naht = spaltenAbstand(d, G, G - 1, 0);
        const daneben = Math.max(spaltenAbstand(d, G, 0, 1), spaltenAbstand(d, G, G - 2, G - 1));
        expect(naht, `${art}/${karte}: senkrechte Naht`).toBeLessThanOrEqual(daneben * 2 + 2);

        const nahtZ = zeilenAbstand(d, G, G - 1, 0);
        const danebenZ = Math.max(zeilenAbstand(d, G, 0, 1), zeilenAbstand(d, G, G - 2, G - 1));
        expect(nahtZ, `${art}/${karte}: waagerechte Naht`).toBeLessThanOrEqual(danebenZ * 2 + 2);
      }
    }
  });
});

describe('Normal-Map', () => {
  it('bildet eine ebene Flaeche exakt auf (128, 128, 255) ab', () => {
    const groesse = 32;
    const eben = new Float32Array(groesse * groesse).fill(0.37);
    const n = normaleAusHoehe(eben, groesse, 24);
    for (let i = 0; i < n.length; i += 4) {
      expect(n[i]).toBe(128);
      expect(n[i + 1]).toBe(128);
      expect(n[i + 2]).toBe(255);
      expect(n[i + 3]).toBe(255);
    }
  });

  it('zeigt bei einer Rampe in +x genau in -x', () => {
    const groesse = 32;
    const rampe = new Float32Array(groesse * groesse);
    for (let y = 0; y < groesse; y++) {
      for (let x = 0; x < groesse; x++) rampe[y * groesse + x] = x / groesse;
    }
    const n = normaleAusHoehe(rampe, groesse, groesse);
    // Mitte der Rampe, weit weg von der Umbruchspalte.
    const i = (16 * groesse + 16) * 4;
    expect(n[i] ?? 0).toBeLessThan(120); // Rot deutlich unter 128 => Normale nach -x
    expect(n[i + 1]).toBe(128); // keine Neigung in y
    expect(n[i + 2] ?? 0).toBeGreaterThanOrEqual(128);
  });

  it('hat einen Mittelwert nahe (128, 128, 255) und einen Blaukanal >= 128', () => {
    for (const art of MATERIAL_ARTEN) {
      const d = bytes(hole(art).normal);
      let sr = 0;
      let sg = 0;
      let sb = 0;
      let minB = 255;
      const n = d.length / 4;
      for (let i = 0; i < d.length; i += 4) {
        const b = d[i + 2] ?? 0;
        sr += d[i] ?? 0;
        sg += d[i + 1] ?? 0;
        sb += b;
        if (b < minB) minB = b;
        expect(d[i + 3]).toBe(255);
      }
      expect(sr / n, `${art}: Mittel Rot`).toBeGreaterThan(124);
      expect(sr / n, `${art}: Mittel Rot`).toBeLessThan(132);
      expect(sg / n, `${art}: Mittel Gruen`).toBeGreaterThan(124);
      expect(sg / n, `${art}: Mittel Gruen`).toBeLessThan(132);
      expect(sb / n, `${art}: Mittel Blau`).toBeGreaterThan(190);
      expect(minB, `${art}: kleinster Blauwert`).toBeGreaterThanOrEqual(128);
    }
  });

  it('ist nicht flach — jede Art traegt sichtbares Relief', () => {
    for (const art of MATERIAL_ARTEN) {
      if (art === 'glas') continue; // Floatglas ist absichtlich fast eben.
      const d = bytes(hole(art).normal);
      let abweichend = 0;
      for (let i = 0; i < d.length; i += 4) {
        if (Math.abs((d[i] ?? 128) - 128) > 6 || Math.abs((d[i + 1] ?? 128) - 128) > 6) abweichend++;
      }
      expect(abweichend / (d.length / 4), `${art}: Anteil geneigter Texel`).toBeGreaterThan(0.02);
    }
  });
});

describe('Wertebereiche', () => {
  it('liefert nur ganzzahlige Bytes zwischen 0 und 255, ohne NaN', () => {
    for (const art of MATERIAL_ARTEN) {
      const satz = hole(art);
      const karten: THREE.DataTexture[] = [satz.albedo, satz.normal, satz.orm];
      if (satz.emission !== undefined) karten.push(satz.emission);
      for (const karte of karten) {
        const d = bytes(karte);
        expect(d.length).toBe(G * G * 4);
        for (let i = 0; i < d.length; i++) {
          const w = d[i] ?? Number.NaN;
          if (!Number.isInteger(w) || w < 0 || w > 255) {
            throw new Error(`${art}/${karte.name}: ungueltiges Byte ${w} an ${i}`);
          }
        }
      }
    }
  });

  it('das Materialfeld liefert ausschliesslich endliche Werte in [0, 1]', () => {
    for (const art of MATERIAL_ARTEN) {
      for (let i = 0; i < 64; i++) {
        const o = abtasteOberflaeche(art, SAAT, (i * 7) % 64 / 64, (i * 13) % 64 / 64);
        for (const [name, wert] of Object.entries(o)) {
          expect(Number.isFinite(wert), `${art}.${name}`).toBe(true);
          if (name !== 'r' && name !== 'g' && name !== 'b') {
            expect(wert, `${art}.${name}`).toBeGreaterThanOrEqual(0);
            expect(wert, `${art}.${name}`).toBeLessThanOrEqual(1);
          }
        }
      }
    }
  });

  it('die Verdeckung liegt in [0, 1] und dunkelt Vertiefungen ab', () => {
    const groesse = 64;
    const feld = new Float32Array(groesse * groesse).fill(1);
    // Ein Graben quer durch die Kachel.
    for (let y = 0; y < groesse; y++) {
      for (let x = 30; x < 34; x++) feld[y * groesse + x] = 0;
    }
    const ao = berechneVerdeckung(feld, groesse, 12);
    for (const w of ao) {
      expect(Number.isFinite(w)).toBe(true);
      expect(w).toBeGreaterThanOrEqual(0);
      expect(w).toBeLessThanOrEqual(1);
    }
    const imGraben = ao[32 * groesse + 32] ?? 1;
    const aufDerFlaeche = ao[32 * groesse + 5] ?? 0;
    expect(imGraben).toBeLessThan(aufDerFlaeche);
    expect(aufDerFlaeche).toBe(1);
  });
});

describe('Texturparameter', () => {
  it('setzt Wiederholung, Farbraum und Filter korrekt', () => {
    for (const art of MATERIAL_ARTEN) {
      const satz = hole(art);
      for (const karte of [satz.albedo, satz.normal, satz.orm]) {
        expect(karte.wrapS).toBe(THREE.RepeatWrapping);
        expect(karte.wrapT).toBe(THREE.RepeatWrapping);
        expect(karte.generateMipmaps).toBe(true);
        expect(karte.minFilter).toBe(THREE.LinearMipmapLinearFilter);
        expect(karte.anisotropy).toBeGreaterThanOrEqual(4);
        expect(karte.image.width).toBe(G);
        expect(karte.image.height).toBe(G);
      }
      expect(satz.albedo.colorSpace, `${art}: Albedo`).toBe(THREE.SRGBColorSpace);
      expect(satz.normal.colorSpace, `${art}: Normale`).toBe(THREE.NoColorSpace);
      expect(satz.orm.colorSpace, `${art}: ORM`).toBe(THREE.NoColorSpace);
    }
  });

  it('packt ORM als Rauheit / Metallgrad / Verdeckung', () => {
    const mittel = (art: MaterialArt, kanal: 0 | 1 | 2): number => {
      const d = bytes(hole(art).orm);
      let s = 0;
      for (let i = kanal; i < d.length; i += 4) s += d[i] ?? 0;
      return s / (d.length / 4);
    };
    // Gruen ist der Metallgrad: Dielektrika nahe 0, Metalle nahe 255.
    expect(mittel('beton', 1)).toBeLessThan(10);
    expect(mittel('ziegel', 1)).toBeLessThan(10);
    expect(mittel('gummi', 1)).toBeLessThan(10);
    expect(mittel('glas', 1)).toBeLessThan(10);
    expect(mittel('stahl_gebuerstet', 1)).toBeGreaterThan(200);
    expect(mittel('messing', 1)).toBeGreaterThan(200);
    // Rot ist die Rauheit: Beton ist rau, Glas ist glatt.
    expect(mittel('beton', 0)).toBeGreaterThan(mittel('glas', 0) + 60);
    // Blau ist die Verdeckung: das Gitterrost hat Loecher, Glas nicht.
    expect(mittel('glas', 2)).toBeGreaterThan(mittel('bodengitter', 2) + 60);
  });

  it('gibt nur der Leiterplatte eine Emissionskarte, streng im Bloom-Band', () => {
    for (const art of MATERIAL_ARTEN) {
      const satz = hole(art);
      if (art === 'leiterplatte') {
        expect(satz.emission).toBeDefined();
      } else {
        expect(satz.emission, `${art} braucht keine Emission`).toBeUndefined();
      }
    }
    const emission = hole('leiterplatte').emission;
    expect(emission).toBeDefined();
    if (emission === undefined) return;
    expect(emission.colorSpace).toBe(THREE.SRGBColorSpace);
    const d = bytes(emission);
    let leuchtend = 0;
    for (let i = 0; i < d.length; i += 4) {
      if ((d[i] ?? 0) + (d[i + 1] ?? 0) + (d[i + 2] ?? 0) > 24) leuchtend++;
    }
    const anteil = leuchtend / (d.length / 4);
    // Ein paar Leuchtdioden, aber keine leuchtende Flaeche.
    expect(anteil).toBeGreaterThan(0.0002);
    expect(anteil).toBeLessThan(0.05);
  });
});

describe('Cache', () => {
  it('liefert bei gleichen Parametern dieselbe Instanz', () => {
    entsorgeAlleTexturen();
    const a = erzeugeTexturSatz('emaille', 7, G);
    const b = erzeugeTexturSatz('emaille', 7, G);
    expect(b).toBe(a);
    expect(b.albedo).toBe(a.albedo);
    expect(texturenBestand()).toBe(1);
  });

  it('unterscheidet nach Art, Saat und Groesse', () => {
    entsorgeAlleTexturen();
    const a = erzeugeTexturSatz('emaille', 7, 256);
    expect(erzeugeTexturSatz('emaille', 8, 256)).not.toBe(a);
    expect(erzeugeTexturSatz('messing', 7, 256)).not.toBe(a);
    expect(erzeugeTexturSatz('emaille', 7, 512)).not.toBe(a);
    expect(texturenBestand()).toBe(4);
    entsorgeAlleTexturen();
  });

  it('liefert nach entsorgeAlleTexturen eine neue Instanz', () => {
    entsorgeAlleTexturen();
    const a = erzeugeTexturSatz('emaille', 7, G);
    entsorgeAlleTexturen();
    expect(texturenBestand()).toBe(0);
    const b = erzeugeTexturSatz('emaille', 7, G);
    expect(b).not.toBe(a);
    // Aber inhaltlich identisch.
    expect(ersteAbweichung(bytes(b.albedo), bytes(a.albedo))).toBe(-1);
    entsorgeAlleTexturen();
  });

  it('nimmt einen einzelnen Satz per entsorge() aus dem Cache', () => {
    entsorgeAlleTexturen();
    const a = erzeugeTexturSatz('gummi', 3, G);
    expect(texturenBestand()).toBe(1);
    a.entsorge();
    expect(texturenBestand()).toBe(0);
    expect(erzeugeTexturSatz('gummi', 3, G)).not.toBe(a);
    entsorgeAlleTexturen();
  });

  it('haelt hoechstens HOECHSTZAHL_SAETZE Saetze und verdraengt den aeltesten', () => {
    entsorgeAlleTexturen();
    const erster = erzeugeTexturSatz('glas', 1000, G);
    for (let i = 1; i <= HOECHSTZAHL_SAETZE; i++) erzeugeTexturSatz('glas', 1000 + i, G);
    expect(texturenBestand()).toBe(HOECHSTZAHL_SAETZE);
    expect(erzeugeTexturSatz('glas', 1000, G)).not.toBe(erster);
    entsorgeAlleTexturen();
    // Die zehn Master-Materialien passen samt Reserve in den Cache.
    expect(MATERIAL_ARTEN.length).toBeLessThanOrEqual(HOECHSTZAHL_SAETZE);
  });
});
