/**
 * Vertrag der prozeduralen Geometrie.
 *
 * Die Tests laufen in Node ohne GPU. Geometrie-Konstruktion in three.js
 * funktioniert dort vollstaendig — gerendert wird hier nichts.
 */

import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

// `tests/einheit/setup.ts` macht Math.random zu einem Fehler. three.js ruft
// Math.random jedoch bereits beim Laden auf: `generateUUID()` vergibt jedem
// Object3D und jeder BufferGeometry eine Kennung. Ohne Ersatz liesse sich
// three in dieser Suite nicht einmal importieren.
//
// Statt den echten Zufall zurueckzuholen, setzen wir einen DETERMINISTISCHEN
// Strom ein. Damit bleibt die Schutzwirkung erhalten: wuerde die Geometrie
// heimlich Math.random benutzen, liefen die Aufrufe im Strom weiter und zwei
// Aufrufe mit gleicher Saat lieferten verschiedene Ergebnisse — genau das
// faengt der Determinismus-Test unten. Zusaetzlich prueft ein Quelltext-Scan,
// dass `Math.random` im Modul ueberhaupt nicht vorkommt.
vi.hoisted(() => {
  let zustand = 0x9e37_79b9;
  Math.random = (): number => {
    zustand = (zustand + 0x6d2b_79f5) >>> 0;
    let h = Math.imul(zustand ^ (zustand >>> 15), 1 | zustand);
    h = (h + Math.imul(h ^ (h >>> 7), 61 | h)) ^ h;
    return ((h ^ (h >>> 14)) >>> 0) / 4_294_967_296;
  };
});

import * as THREE from 'three/webgpu';
import type { ModulArt } from '../../src/sim/typen';
import type { FundstueckArt, Halle } from '../../src/welt/geometrie';
import {
  fundamentGeometrie,
  fundstueckGeometrie,
  greeble,
  hallenGeometrie,
  kernAufsatz,
  leitungsGeometrie,
  modulGeometrie,
} from '../../src/welt/geometrie';

// ---------------------------------------------------------------------------
// Pruefmittel
// ---------------------------------------------------------------------------

const ALLE_ARTEN: readonly ModulArt[] = [
  'quelle',
  'senke',
  'kern',
  'weiche',
  'schranke',
  'verteiler',
  'sammler',
  'pruefer',
  'werkzeug',
  'speicher',
  'wall',
  'sicherung',
  'hand',
  'auge',
  'schmiede',
];

const ALLE_FUNDSTUECKE: readonly FundstueckArt[] = [
  'becher',
  'aktenstapel',
  'rollwagen',
  'schild',
  'kabelrolle',
  'stuhl',
];

const BUDGET_MODUL = 1200;
const BUDGET_FUNDSTUECK = 400;
const BUDGET_HALLE = 60_000;

function dreiecke(g: THREE.BufferGeometry): number {
  const anzahl = g.index !== null ? g.index.count : g.getAttribute('position').count;
  return anzahl / 3;
}

/** Rohbytes des Positionsattributs — Grundlage des byteweisen Vergleichs. */
function positionsBytes(g: THREE.BufferGeometry): Buffer {
  const feld = g.getAttribute('position').array;
  return Buffer.from(feld.buffer.slice(feld.byteOffset, feld.byteOffset + feld.byteLength));
}

function kasten(g: THREE.BufferGeometry): THREE.Box3 {
  g.computeBoundingBox();
  const b = g.boundingBox;
  if (b === null) throw new Error('keine Bounding Box');
  return b;
}

/** position/normal/uv vorhanden, kein NaN, alle Normalen auf Laenge 1. */
function pruefeAttribute(g: THREE.BufferGeometry, name: string): void {
  for (const attribut of ['position', 'normal', 'uv'] as const) {
    expect(g.getAttribute(attribut), `${name}: Attribut ${attribut} fehlt`).toBeDefined();
  }
  const pos = g.getAttribute('position');
  const nor = g.getAttribute('normal');
  const uv = g.getAttribute('uv');
  expect(pos.itemSize, `${name}: position ist nicht dreikomponentig`).toBe(3);
  expect(nor.itemSize, `${name}: normal ist nicht dreikomponentig`).toBe(3);
  expect(uv.itemSize, `${name}: uv ist nicht zweikomponentig`).toBe(2);
  expect(nor.count, `${name}: normal passt nicht zu position`).toBe(pos.count);
  expect(uv.count, `${name}: uv passt nicht zu position`).toBe(pos.count);

  let schlechteZahl = 0;
  let schlechteNormale = 0;
  for (let i = 0; i < pos.count; i++) {
    if (!Number.isFinite(pos.getX(i)) || !Number.isFinite(pos.getY(i)) || !Number.isFinite(pos.getZ(i))) {
      schlechteZahl++;
    }
    if (!Number.isFinite(uv.getX(i)) || !Number.isFinite(uv.getY(i))) schlechteZahl++;
    const nx = nor.getX(i);
    const ny = nor.getY(i);
    const nz = nor.getZ(i);
    if (!Number.isFinite(nx) || !Number.isFinite(ny) || !Number.isFinite(nz)) {
      schlechteZahl++;
      continue;
    }
    if (Math.abs(Math.hypot(nx, ny, nz) - 1) > 1e-3) schlechteNormale++;
  }
  expect(schlechteZahl, `${name}: NaN oder Unendlich in den Attributen`).toBe(0);
  expect(schlechteNormale, `${name}: nicht normierte Normalen`).toBe(0);
}

/** Fussabdruck, Bodenhaftung und Bauhoehe. */
function pruefeFussabdruck(
  g: THREE.BufferGeometry,
  name: string,
  minHoehe: number,
  maxHoehe: number
): void {
  const b = kasten(g);
  expect(b.min.x, `${name}: ragt in -X aus dem Feld`).toBeGreaterThanOrEqual(-0.52);
  expect(b.max.x, `${name}: ragt in +X aus dem Feld`).toBeLessThanOrEqual(0.52);
  expect(b.min.z, `${name}: ragt in -Z aus dem Feld`).toBeGreaterThanOrEqual(-0.52);
  expect(b.max.z, `${name}: ragt in +Z aus dem Feld`).toBeLessThanOrEqual(0.52);
  expect(b.min.y, `${name}: sinkt in den Boden ein`).toBeGreaterThanOrEqual(-0.02);
  const hoehe = b.max.y - b.min.y;
  expect(hoehe, `${name}: zu flach`).toBeGreaterThanOrEqual(minHoehe);
  expect(hoehe, `${name}: zu hoch`).toBeLessThanOrEqual(maxHoehe);
}

// ---------------------------------------------------------------------------
// Module
// ---------------------------------------------------------------------------

describe('modulGeometrie', () => {
  it.each(ALLE_ARTEN)('%s ist bei gleicher Saat byteweise identisch', (art) => {
    const a = modulGeometrie(art, 20_260_820);
    const b = modulGeometrie(art, 20_260_820);
    expect(positionsBytes(a).equals(positionsBytes(b)), `${art}: nicht deterministisch`).toBe(true);
  });

  it.each(ALLE_ARTEN)('%s reagiert auf die Saat', (art) => {
    // Jede Modulart traegt saatabhaengige Details (Nietenkranz, Neigungen,
    // Rippenzahl). Wuerde eine Art die Saat ignorieren, waere die Halle
    // steril — und ein spaeterer Umbau koennte die Determinismus-Pruefung
    // oben unbemerkt trivial machen.
    const a = modulGeometrie(art, 11);
    const b = modulGeometrie(art, 12);
    expect(positionsBytes(a).equals(positionsBytes(b)), `${art}: Saat wirkungslos`).toBe(false);
  });

  it.each(ALLE_ARTEN)('%s haelt Fussabdruck, Bodenhaftung und Bauhoehe ein', (art) => {
    // Der Fussabdruck ist genau ein Gitterfeld (-0.5..+0.5, Toleranz 0.02),
    // die Unterkante liegt auf dem Fundament, die Bauhoehe bleibt im Band, in
    // dem die Kamera alle Module gleichzeitig lesbar zeigt.
    pruefeFussabdruck(modulGeometrie(art, 7), art, 0.4, 1.9);
  });

  it.each(ALLE_ARTEN)('%s bleibt im Dreiecksbudget', (art) => {
    const g = modulGeometrie(art, 3);
    expect(dreiecke(g), `${art}: Dreiecksbudget gerissen`).toBeLessThanOrEqual(BUDGET_MODUL);
    expect(dreiecke(g), `${art}: leer`).toBeGreaterThan(0);
  });

  it.each(ALLE_ARTEN)('%s hat saubere Attribute', (art) => {
    pruefeAttribute(modulGeometrie(art, 5), art);
  });

  it('liefert eine Bounding Sphere', () => {
    for (const art of ALLE_ARTEN) {
      const g = modulGeometrie(art, 1);
      expect(g.boundingSphere, `${art}: keine Bounding Sphere`).not.toBeNull();
      expect(g.boundingSphere?.radius ?? 0).toBeGreaterThan(0);
    }
  });

  it('unterscheidet die fuenfzehn Arten an der Silhouette, nicht an der Farbe', () => {
    // Begruendung des Kriteriums: Farbenblindheit macht den Farbleitwert aus
    // `src/sim/katalog.ts` als alleiniges Erkennungsmerkmal unbrauchbar. Ein
    // Modul muss deshalb schon an seinem Umriss erkennbar sein. Der Umriss
    // laesst sich im Test nicht bildlich pruefen, wohl aber sein Fingerabdruck:
    // die auf zwei Stellen gerundeten Kantenlaengen der Bounding Box (Breite,
    // Hoehe, Tiefe) zusammen mit der Dreieckszahl, die die Gliederung der Form
    // widerspiegelt. Sind alle fuenfzehn Fingerabdruecke paarweise
    // verschieden, unterscheiden sich die Formen nachweislich in ihrer
    // Grundgestalt — nicht nur in der Farbe.
    const kennwerte = new Map<string, ModulArt>();
    for (const art of ALLE_ARTEN) {
      const g = modulGeometrie(art, 42);
      const b = kasten(g);
      const kennwert = [
        (b.max.x - b.min.x).toFixed(2),
        (b.max.y - b.min.y).toFixed(2),
        (b.max.z - b.min.z).toFixed(2),
        dreiecke(g),
      ].join('|');
      const doppelt = kennwerte.get(kennwert);
      expect(doppelt, `${art} und ${String(doppelt)} sehen gleich aus: ${kennwert}`).toBeUndefined();
      kennwerte.set(kennwert, art);
    }
    expect(kennwerte.size).toBe(15);
  });

  it('unterscheidet die Arten auch allein an den Umrissmassen', () => {
    // Schaerfere Fassung: schon die reinen Kantenmasse der Bounding Box (ohne
    // Dreieckszahl) trennen mindestens zwoelf der fuenfzehn Arten. Der Rest
    // teilt sich zwar ein Huellmass, unterscheidet sich aber in der
    // Binnengliederung — dafuer steht die Dreieckszahl im Test darueber.
    const masse = new Set<string>();
    for (const art of ALLE_ARTEN) {
      const b = kasten(modulGeometrie(art, 42));
      masse.add(
        [
          (b.max.x - b.min.x).toFixed(2),
          (b.max.y - b.min.y).toFixed(2),
          (b.max.z - b.min.z).toFixed(2),
        ].join('|')
      );
    }
    expect(masse.size).toBeGreaterThanOrEqual(12);
  });

  it('enthaelt kein Math.random im Quelltext', () => {
    // Der Laufzeitschutz aus `setup.ts` ist in dieser Suite durch einen
    // deterministischen Strom ersetzt (siehe Kopf der Datei) — deshalb prueft
    // hier zusaetzlich der Quelltext-Scan. Kommentare werden vorher entfernt,
    // sonst schlaegt die Erklaerung des Verbots selbst an.
    const quelle = readFileSync(new URL('../../src/welt/geometrie.ts', import.meta.url), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');
    const treffer = quelle.split('\n').filter((zeile) => /Math\s*\.\s*random/.test(zeile));
    expect(treffer, 'Math.random ist in SCHWARMWERK verboten').toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Kernaufsatz
// ---------------------------------------------------------------------------

describe('kernAufsatz', () => {
  const GROESSEN = ['kolibri', 'reiher', 'kondor'] as const;

  it.each(GROESSEN)('%s ist deterministisch und sauber', (groesse) => {
    const a = kernAufsatz(groesse);
    const b = kernAufsatz(groesse);
    expect(positionsBytes(a).equals(positionsBytes(b))).toBe(true);
    pruefeAttribute(a, `kernAufsatz:${groesse}`);
    expect(dreiecke(a)).toBeLessThanOrEqual(BUDGET_MODUL);
  });

  it('bleibt im Fussabdruck des Kerns', () => {
    for (const groesse of GROESSEN) {
      const b = kasten(kernAufsatz(groesse));
      expect(Math.max(Math.abs(b.min.x), Math.abs(b.max.x))).toBeLessThanOrEqual(0.5);
      expect(Math.max(Math.abs(b.min.z), Math.abs(b.max.z))).toBeLessThanOrEqual(0.5);
      // Der Aufsatz sitzt auf der Montageflaeche, waechst also ab y = 0.
      expect(b.min.y).toBeGreaterThanOrEqual(-0.02);
    }
  });

  it('erzaehlt die Kerngroesse ueber die Bauhoehe', () => {
    // Die drei Groessen muessen ohne Beschriftung unterscheidbar sein: der
    // Kondor baut hoeher als der Reiher, der Reiher hoeher als der Kolibri.
    const hoehen = GROESSEN.map((g) => {
      const b = kasten(kernAufsatz(g));
      return b.max.y - b.min.y;
    });
    const [kolibri, reiher, kondor] = hoehen as [number, number, number];
    expect(reiher).toBeGreaterThan(kolibri + 0.1);
    expect(kondor).toBeGreaterThan(reiher + 0.1);
    // Turm (rund 1.0) plus Aufsatz bleibt unter der Bauhoehengrenze 1.8.
    const turm = kasten(modulGeometrie('kern', 1));
    expect(turm.max.y + kondor).toBeLessThanOrEqual(1.8);
  });
});

// ---------------------------------------------------------------------------
// Fundstuecke
// ---------------------------------------------------------------------------

describe('fundstueckGeometrie', () => {
  it.each(ALLE_FUNDSTUECKE)('%s ist bei gleicher Saat byteweise identisch', (art) => {
    const a = fundstueckGeometrie(art, 4711);
    const b = fundstueckGeometrie(art, 4711);
    expect(positionsBytes(a).equals(positionsBytes(b)), `${art}: nicht deterministisch`).toBe(true);
  });

  it.each(ALLE_FUNDSTUECKE)('%s reagiert auf die Saat', (art) => {
    const a = fundstueckGeometrie(art, 101);
    const b = fundstueckGeometrie(art, 102);
    expect(positionsBytes(a).equals(positionsBytes(b)), `${art}: Saat wirkungslos`).toBe(false);
  });

  it.each(ALLE_FUNDSTUECKE)('%s haelt Fussabdruck und Bodenhaftung ein', (art) => {
    // Abweichung vom Modulmass mit Absicht: Fundstuecke sind Requisiten, keine
    // Maschinen. Ein Kaffeebecher, der die Mindestbauhoehe eines Moduls von
    // 0.4 Gittereinheiten erfuellte, waere ein Eimer. Geprueft wird deshalb
    // dieselbe Fussabdruck- und Bodenregel, aber ein Hoehenband, das von der
    // Tasse bis zum Rollwagen reicht.
    pruefeFussabdruck(fundstueckGeometrie(art, 9), art, 0.04, 0.9);
  });

  it.each(ALLE_FUNDSTUECKE)('%s bleibt im Dreiecksbudget', (art) => {
    const g = fundstueckGeometrie(art, 2);
    expect(dreiecke(g), `${art}: Dreiecksbudget gerissen`).toBeLessThanOrEqual(BUDGET_FUNDSTUECK);
    expect(dreiecke(g), `${art}: leer`).toBeGreaterThan(0);
  });

  it.each(ALLE_FUNDSTUECKE)('%s hat saubere Attribute', (art) => {
    pruefeAttribute(fundstueckGeometrie(art, 6), art);
  });

  it('unterscheidet die sechs Fundstuecke an der Silhouette', () => {
    const kennwerte = new Set<string>();
    for (const art of ALLE_FUNDSTUECKE) {
      const g = fundstueckGeometrie(art, 42);
      const b = kasten(g);
      kennwerte.add(
        [
          (b.max.x - b.min.x).toFixed(2),
          (b.max.y - b.min.y).toFixed(2),
          (b.max.z - b.min.z).toFixed(2),
          dreiecke(g),
        ].join('|')
      );
    }
    expect(kennwerte.size).toBe(ALLE_FUNDSTUECKE.length);
  });
});

// ---------------------------------------------------------------------------
// Halle
// ---------------------------------------------------------------------------

describe('hallenGeometrie', () => {
  const TEILE = ['boden', 'waende', 'traeger', 'decke', 'fenster', 'gelaender'] as const;

  function gesamt(halle: Halle): number {
    return TEILE.reduce((summe, teil) => summe + dreiecke(halle[teil]), 0);
  }

  it('liefert alle sechs Teile, gefuellt und sauber', () => {
    const halle = hallenGeometrie(60, 44, 12, 1957);
    for (const teil of TEILE) {
      const g = halle[teil];
      expect(dreiecke(g), `${teil}: leer`).toBeGreaterThan(0);
      pruefeAttribute(g, `halle.${teil}`);
      expect(g.boundingSphere, `${teil}: keine Bounding Sphere`).not.toBeNull();
    }
  });

  it('haelt das Gesamtbudget der Halle ein', () => {
    for (const [b, t, h] of [
      [40, 30, 10],
      [60, 44, 12],
      [80, 60, 16],
    ] as const) {
      const summe = gesamt(hallenGeometrie(b, t, h, 1957));
      expect(summe, `Halle ${b}x${t}x${h}: Dreiecksbudget gerissen`).toBeLessThanOrEqual(BUDGET_HALLE);
    }
  });

  it('ist deterministisch', () => {
    const a = hallenGeometrie(60, 44, 12, 1957);
    const b = hallenGeometrie(60, 44, 12, 1957);
    for (const teil of TEILE) {
      expect(positionsBytes(a[teil]).equals(positionsBytes(b[teil])), `${teil}`).toBe(true);
    }
  });

  it('umschliesst den Bauraum: Boden unten, Decke oben, Waende aussen', () => {
    const halle = hallenGeometrie(60, 44, 12, 1957);
    const boden = kasten(halle.boden);
    const decke = kasten(halle.decke);
    const waende = kasten(halle.waende);
    // Die Fugenstege und die Entwaesserungsrinne stehen wenige Millimeter
    // ueber die Betonoberflaeche — mehr darf der Boden nicht auftragen.
    expect(boden.max.y).toBeGreaterThan(0);
    expect(boden.max.y).toBeLessThanOrEqual(0.05);
    expect(decke.min.y).toBeGreaterThan(10);
    expect(waende.min.x).toBeLessThan(-30);
    expect(waende.max.x).toBeGreaterThan(30);
    expect(waende.min.z).toBeLessThan(-22);
    expect(waende.max.z).toBeGreaterThan(22);
  });

  it('setzt die Sprossenfenster in das Band zwischen Bruestung und Sturz', () => {
    const halle = hallenGeometrie(60, 44, 12, 1957);
    const f = kasten(halle.fenster);
    expect(f.min.y).toBeGreaterThan(1.5);
    expect(f.max.y).toBeLessThan(12);
  });
});

// ---------------------------------------------------------------------------
// Fundament
// ---------------------------------------------------------------------------

describe('fundamentGeometrie', () => {
  it('traegt das Gitter und liegt unter der Bauflaeche', () => {
    const felderX = 12;
    const felderZ = 9;
    const g = fundamentGeometrie(felderX, felderZ);
    pruefeAttribute(g, 'fundament');
    const b = kasten(g);
    expect(b.min.y).toBeLessThan(-0.2);
    expect(b.max.x - b.min.x).toBeGreaterThan(felderX);
    expect(b.max.z - b.min.z).toBeGreaterThan(felderZ);
    expect(dreiecke(g)).toBeGreaterThan(0);

    // Entscheidend ist nicht die Huelle, sondern die BAUFLAECHE: ueber dem
    // Feldraster darf nichts hoeher als das flache Gitterrelief aufragen,
    // sonst stuende ein Modul auf einem Bolzen. Der Randbereich ausserhalb
    // des Rasters darf dagegen als Kerb ueberstehen — er rahmt das Werk.
    const pos = g.getAttribute('position');
    let hoechstesInDerFlaeche = -Infinity;
    let hoechstesAmRand = -Infinity;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      if (Math.abs(x) <= felderX / 2 && Math.abs(z) <= felderZ / 2) {
        hoechstesInDerFlaeche = Math.max(hoechstesInDerFlaeche, y);
      } else {
        hoechstesAmRand = Math.max(hoechstesAmRand, y);
      }
    }
    expect(hoechstesInDerFlaeche).toBeLessThanOrEqual(0.02);
    expect(hoechstesInDerFlaeche).toBeGreaterThan(0);
    expect(hoechstesAmRand).toBeGreaterThan(hoechstesInDerFlaeche);
  });

  it('ist deterministisch und skaliert mit der Feldzahl', () => {
    expect(positionsBytes(fundamentGeometrie(12, 9)).equals(positionsBytes(fundamentGeometrie(12, 9)))).toBe(true);
    expect(dreiecke(fundamentGeometrie(20, 20))).toBeGreaterThan(dreiecke(fundamentGeometrie(6, 6)));
  });
});

// ---------------------------------------------------------------------------
// Greeble
// ---------------------------------------------------------------------------

describe('greeble', () => {
  it('ist deterministisch und bleibt auf seiner Flaeche', () => {
    const flaeche = new THREE.Vector2(1.2, 0.8);
    const a = greeble(77, 30, flaeche);
    const b = greeble(77, 30, flaeche);
    expect(positionsBytes(a).equals(positionsBytes(b))).toBe(true);
    pruefeAttribute(a, 'greeble');
    const k = kasten(a);
    expect(k.min.x).toBeGreaterThanOrEqual(-flaeche.x / 2 - 0.2);
    expect(k.max.x).toBeLessThanOrEqual(flaeche.x / 2 + 0.2);
    expect(k.min.y).toBeGreaterThanOrEqual(-flaeche.y / 2 - 0.3);
    expect(k.max.y).toBeLessThanOrEqual(flaeche.y / 2 + 0.3);
    // Die Anbauten wachsen nach +Z, damit sie auf eine Flaeche gesetzt werden koennen.
    expect(k.min.z).toBeGreaterThanOrEqual(-0.01);
  });

  it('waechst mit der Dichte und wird bei Dichte 0 leer', () => {
    const flaeche = new THREE.Vector2(1, 1);
    expect(dreiecke(greeble(1, 40, flaeche))).toBeGreaterThan(dreiecke(greeble(1, 5, flaeche)));
    const leer = greeble(1, 0, flaeche);
    expect(dreiecke(leer)).toBe(0);
    pruefeAttribute(leer, 'greeble leer');
    expect(leer.boundingSphere?.radius).toBe(0);
  });

  it('deckelt die Teilezahl, damit ein Aufrufversehen kein Budget sprengt', () => {
    const viel = greeble(3, 100_000, new THREE.Vector2(4, 4));
    // 240 Teile, das teuerste davon ein Schild aus zwei Extrusionen.
    expect(dreiecke(viel)).toBeLessThan(20_000);
  });
});

// ---------------------------------------------------------------------------
// Leitungen
// ---------------------------------------------------------------------------

describe('leitungsGeometrie', () => {
  const punkte = [
    new THREE.Vector3(0, 0.4, 0),
    new THREE.Vector3(0.6, 0.7, 0.2),
    new THREE.Vector3(1.4, 0.5, 0.9),
    new THREE.Vector3(2, 0.4, 1),
  ];

  it('ist deterministisch und sauber', () => {
    const a = leitungsGeometrie(punkte, 0.05);
    const b = leitungsGeometrie(punkte, 0.05);
    expect(positionsBytes(a).equals(positionsBytes(b))).toBe(true);
    pruefeAttribute(a, 'leitung');
    expect(dreiecke(a)).toBeGreaterThan(0);
  });

  it('verjuengt sich zu den Enden hin', () => {
    const radius = 0.05;
    const g = leitungsGeometrie(punkte, radius);
    const pos = g.getAttribute('position');
    const proRing = 9;
    const ringe = pos.count / proRing;
    const mitte = new THREE.Vector3();
    const v = new THREE.Vector3();

    function ringRadius(index: number): number {
      mitte.set(0, 0, 0);
      for (let j = 0; j < proRing; j++) {
        v.fromBufferAttribute(pos, index * proRing + j);
        mitte.add(v);
      }
      mitte.divideScalar(proRing);
      let summe = 0;
      for (let j = 0; j < proRing; j++) {
        v.fromBufferAttribute(pos, index * proRing + j);
        summe += v.distanceTo(mitte);
      }
      return summe / proRing;
    }

    const erster = ringRadius(0);
    const mittlerer = ringRadius(Math.floor(ringe / 2));
    const letzter = ringRadius(ringe - 1);
    expect(mittlerer).toBeCloseTo(radius, 2);
    expect(erster).toBeLessThan(mittlerer * 0.8);
    expect(letzter).toBeLessThan(mittlerer * 0.8);
  });

  it('vertraegt entartete Eingaben', () => {
    expect(dreiecke(leitungsGeometrie([], 0.05))).toBe(0);
    expect(dreiecke(leitungsGeometrie([new THREE.Vector3(0, 0, 0)], 0.05))).toBe(0);
    // Doppelte Stuetzpunkte wuerden im Frenet-Rahmen NaN erzeugen.
    const doppelt = leitungsGeometrie(
      [
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(1, 0, 0),
        new THREE.Vector3(1, 0, 0),
      ],
      0.04
    );
    pruefeAttribute(doppelt, 'leitung doppelt');
    expect(dreiecke(doppelt)).toBeGreaterThan(0);
    expect(dreiecke(leitungsGeometrie(punkte, 0))).toBe(0);
  });
});

