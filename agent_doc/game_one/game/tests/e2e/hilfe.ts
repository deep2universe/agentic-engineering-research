/**
 * Gemeinsame Hilfen der Browser-Tests.
 *
 * Grundsatz: Es wird gegen den ZUSTAND geprüft, nicht gegen Pixel. Bilder sind
 * ein zusätzliches Netz, kein Ersatz für Zusicherungen — ein Bildvergleich sagt
 * nur, dass sich etwas geändert hat, nie ob es richtig ist.
 */

import { inflateSync } from 'node:zlib';
import type { Page, ConsoleMessage } from '@playwright/test';
import { expect } from '@playwright/test';
import type { DebugApi } from '../../src/werkzeug/debug_api';

declare global {
  interface Window {
    __spiel?: DebugApi;
    __ctxVerloren?: boolean;
    __meldungen?: string[];
  }
}

export interface Sitzung {
  readonly page: Page;
  readonly fehler: string[];
}

/** Öffnet das Spiel, wartet auf die Debug-Schnittstelle und sammelt Fehler ein. */
export async function oeffne(page: Page, abfrage = ''): Promise<Sitzung> {
  const fehler: string[] = [];

  page.on('console', (m: ConsoleMessage) => {
    if (m.type() === 'error') fehler.push(`console.error: ${m.text()}`);
  });
  page.on('pageerror', (e) => fehler.push(`pageerror: ${e.message}`));

  // Kontextverlust ist ein stiller Killer: das Bild bleibt stehen, alles
  // scheint zu laufen, und jeder Bildvergleich ist ab da wertlos.
  await page.addInitScript(() => {
    window.__ctxVerloren = false;
    globalThis.addEventListener(
      'webglcontextlost',
      () => {
        window.__ctxVerloren = true;
      },
      true
    );
  });

  await page.goto(`/index.html?forceWebGL=1${abfrage}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__spiel?.bereit() === true, null, { timeout: 90_000 });
  return { page, fehler };
}

/** Bereitet einen reproduzierbaren Bildzustand vor: ohne Zeitachse, ohne HUD-Dialoge. */
export async function stelleBildRuhig(page: Page): Promise<void> {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(() => {
    const s = window.__spiel!;
    s.setzeTemporalModus('aus');
    s.setzeReduzierteBewegung(true);
    s.frameSchritt(2);
  });
}

/** Spielt ein Level mit einer Referenzlösung durch und liefert die Bewertung. */
export async function spieleReferenz(
  page: Page,
  levelId: string,
  referenz = 0
): Promise<{ bestanden: boolean; metriken: Record<string, number>; hash: string }> {
  return page.evaluate(
    ({ levelId: id, referenz: n }) => {
      const s = window.__spiel!;
      s.ladeLevel(id);
      const geladen = s.ladeReferenz(n);
      if (!geladen) throw new Error(`Level ${id} hat keine Referenzlösung ${n}`);
      s.starteSimulation();
      s.laufeDurch();
      return { bestanden: s.bewertung().bestanden, metriken: s.metriken(), hash: s.zustandsHash() };
    },
    { levelId, referenz }
  );
}

/** Zusicherungen, die nach JEDEM Browser-Test gelten müssen. */
export async function pruefeSauberkeit(s: Sitzung): Promise<void> {
  expect(s.fehler, `Fehler in der Konsole:\n${s.fehler.join('\n')}`).toEqual([]);
  const verloren = await s.page.evaluate(() => window.__ctxVerloren === true);
  expect(verloren, 'Der WebGL-Kontext ist verloren gegangen').toBe(false);
}

/**
 * Bildstatistik der Leinwand, aus dem FERTIGEN Bildschirmfoto gerechnet.
 *
 * Warum nicht im Browser über `drawImage` auf die Leinwand: Ein WebGL-Kontext
 * ohne `preserveDrawingBuffer` gibt seinen Zeichenpuffer nach dem Compositing
 * frei. Wer ihn außerhalb des Zeichenbildes ausliest, bekommt ein schwarzes
 * Bild zurück — und zwar auch dann, wenn auf dem Schirm alles richtig steht.
 * Genau diese Messung hat hier zeitweise ein funktionierendes Spiel als tot
 * gemeldet. Das Bildschirmfoto des Compositors kennt das Problem nicht.
 */
export interface Bildstatistik {
  readonly mittlereHelligkeit: number;
  readonly maxHelligkeit: number;
  readonly anteilSichtbar: number;
  readonly distinkteFarben: number;
}

export async function bildstatistik(page: Page): Promise<Bildstatistik> {
  const png = await page.locator('#leinwand').screenshot();
  return statistikAusPng(png);
}

/**
 * Zerlegt ein PNG ohne fremde Abhängigkeit.
 *
 * Playwright liefert immer echtes PNG; entpackt wird mit `zlib`, das in Node
 * ohnehin vorhanden ist. Der Aufwand lohnt: nur mit echten Bildpunkten lässt
 * sich "schwarz" von "dunkel, aber lesbar" unterscheiden, und genau diese
 * Unterscheidung hat hier gefehlt.
 */
export function statistikAusPng(png: Buffer): Bildstatistik {
  const { breite, hoehe, pixel } = entpackePng(png);
  let summe = 0;
  let max = 0;
  let sichtbar = 0;
  const farben = new Set<number>();
  const anzahl = breite * hoehe;
  for (let i = 0; i < anzahl; i++) {
    const r = pixel[i * 4] ?? 0;
    const g = pixel[i * 4 + 1] ?? 0;
    const b = pixel[i * 4 + 2] ?? 0;
    const l = r * 0.299 + g * 0.587 + b * 0.114;
    summe += l;
    if (l > max) max = l;
    if (l > 16) sichtbar += 1;
    farben.add(((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3));
  }
  return {
    mittlereHelligkeit: summe / anzahl,
    maxHelligkeit: max,
    anteilSichtbar: sichtbar / anzahl,
    distinkteFarben: farben.size,
  };
}

function entpackePng(png: Buffer): { breite: number; hoehe: number; pixel: Buffer } {
  let pos = 8; // PNG-Signatur
  let breite = 0;
  let hoehe = 0;
  let tiefe = 0;
  let farbtyp = 0;
  const daten: Buffer[] = [];
  while (pos < png.length) {
    const laenge = png.readUInt32BE(pos);
    const art = png.toString('ascii', pos + 4, pos + 8);
    const inhalt = png.subarray(pos + 8, pos + 8 + laenge);
    if (art === 'IHDR') {
      breite = inhalt.readUInt32BE(0);
      hoehe = inhalt.readUInt32BE(4);
      tiefe = inhalt.readUInt8(8);
      farbtyp = inhalt.readUInt8(9);
    } else if (art === 'IDAT') daten.push(inhalt);
    else if (art === 'IEND') break;
    pos += 12 + laenge;
  }
  if (tiefe !== 8 || (farbtyp !== 6 && farbtyp !== 2)) {
    throw new Error(`Unerwartetes PNG-Format: Tiefe ${tiefe}, Farbtyp ${farbtyp}`);
  }
  const kanaele = farbtyp === 6 ? 4 : 3;
  const roh = inflateSync(Buffer.concat(daten));
  const zeile = breite * kanaele;
  const aus = Buffer.alloc(breite * hoehe * 4);
  const vorige = Buffer.alloc(zeile);
  const aktuell = Buffer.alloc(zeile);
  for (let y = 0; y < hoehe; y++) {
    const filter = roh[y * (zeile + 1)] ?? 0;
    roh.copy(aktuell, 0, y * (zeile + 1) + 1, y * (zeile + 1) + 1 + zeile);
    entfiltere(filter, aktuell, vorige, kanaele, zeile);
    for (let x = 0; x < breite; x++) {
      const q = x * kanaele;
      const z = (y * breite + x) * 4;
      aus[z] = aktuell[q] ?? 0;
      aus[z + 1] = aktuell[q + 1] ?? 0;
      aus[z + 2] = aktuell[q + 2] ?? 0;
      aus[z + 3] = kanaele === 4 ? (aktuell[q + 3] ?? 255) : 255;
    }
    aktuell.copy(vorige);
  }
  return { breite, hoehe, pixel: aus };
}

/** Die fuenf PNG-Zeilenfilter nach RFC 2083, in place. */
function entfiltere(filter: number, z: Buffer, vorige: Buffer, bpp: number, laenge: number): void {
  for (let i = 0; i < laenge; i++) {
    const a = i >= bpp ? (z[i - bpp] ?? 0) : 0;
    const b = vorige[i] ?? 0;
    const c = i >= bpp ? (vorige[i - bpp] ?? 0) : 0;
    const x = z[i] ?? 0;
    let wert = x;
    if (filter === 1) wert = x + a;
    else if (filter === 2) wert = x + b;
    else if (filter === 3) wert = x + ((a + b) >> 1);
    else if (filter === 4) {
      const p = a + b - c;
      const pa = Math.abs(p - a);
      const pb = Math.abs(p - b);
      const pc = Math.abs(p - c);
      wert = x + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
    }
    z[i] = wert & 0xff;
  }
}

/**
 * Prüft, dass überhaupt etwas SICHTBARES gerendert wurde.
 *
 * Die Vorgängerversion verglich die PNG-Dateigröße gegen 20 kB. Diese
 * Zusicherung konnte nicht scheitern: ein durchgehend schwarzes Bild mit einem
 * Hauch Rauschen liegt darüber. Das Spiel war über längere Zeit schwarz,
 * ohne dass ein einziger Test etwas gemeldet hätte. Jetzt werden echte
 * Bildpunkte gezählt.
 */
export async function pruefeNichtSchwarz(page: Page): Promise<void> {
  const s = await bildstatistik(page);
  expect(
    s.anteilSichtbar,
    `Die Leinwand ist praktisch schwarz: nur ${(s.anteilSichtbar * 100).toFixed(1)} % der Bildpunkte ` +
      `liegen über der Sichtbarkeitsschwelle (mittlere Helligkeit ${s.mittlereHelligkeit.toFixed(1)}).`
  ).toBeGreaterThan(0.2);
  // 400 und nicht 200: ein schwarzes Spielfeld mit HUD kam auf 205 Farben, ein
  // gerendertes auf 582. Eine Schwelle dazwischen muss deutlich über dem
  // gemessenen Fehlerfall liegen, sonst ist sie nur Zierde.
  expect(
    s.distinkteFarben,
    `Die Leinwand zeigt nur ${s.distinkteFarben} verschiedene Farben — das ist kein gerendertes Bild.`
  ).toBeGreaterThan(400);
}

// ---------------------------------------------------------------------------
// Bedienung von Hand
// ---------------------------------------------------------------------------

/*
 * Alles ab hier bedient das Spiel AUSSCHLIESSLICH über echte Maus- und
 * Tastaturereignisse.
 *
 * Das ist der Kern der Lehre aus dem Rückschlag: Jeder bisherige Browsertest
 * hat das Werk über `window.__spiel` zusammengesetzt und dann die Simulation
 * geprüft. Damit war belegt, dass der Simulationskern rechnet — und nichts
 * darüber hinaus. Ob eine Spielerin ein Modul setzen, eine Leitung ziehen und
 * ein Level abschließen kann, hat kein einziger Test je beruehrt. Das Spiel
 * war in genau dieser Luecke unspielbar.
 *
 * Die Testschnittstelle darf hier nur noch HINSEHEN: Gitterfelder auf
 * Bildpunkte umrechnen, Zustand auslesen. Sobald eine Hilfe unten etwas SETZT,
 * ist die Prüflinie wieder durchbrochen.
 */

/** Klickt durch Akttafel und Auftragstafel ins Spielfeld — wie beim Start. */
export async function betreteHalle(page: Page): Promise<void> {
  const akttafel = page.locator('.blatt.akttafel');
  if (await akttafel.count()) await akttafel.getByRole('button').first().click();
  const auftrag = page.locator('.blatt[aria-label="Auftrag"]');
  await auftrag.waitFor({ state: 'visible', timeout: 20_000 });
  await auftrag.getByRole('button').first().click();
  await auftrag.waitFor({ state: 'hidden', timeout: 20_000 });
}

/** Bildpunkt der Mitte eines Gitterfelds, in CSS-Pixeln. */
export async function feldPunkt(page: Page, x: number, z: number): Promise<{ x: number; y: number }> {
  const p = await page.evaluate(([a, b]) => window.__spiel!.feldZuBildschirm(a, b), [x, z] as const);
  expect(p.imBild, `Feld (${x},${z}) liegt außerhalb des Bildes — der Test kann es nicht anklicken`).toBe(true);
  return { x: p.x, y: p.y };
}

/** Klickt auf ein Gitterfeld. Echter Mausklick auf die Leinwand. */
export async function klickeFeld(page: Page, x: number, z: number): Promise<void> {
  const p = await feldPunkt(page, x, z);
  await page.mouse.move(p.x, p.y);
  await page.mouse.click(p.x, p.y);
}

/** Wählt ein Modul über seine Zifferntaste — so, wie es die Palette anbietet. */
export async function waehleModulPerTaste(page: Page, taste: string): Promise<void> {
  await page.keyboard.press(taste);
}

/** Der aktuelle Bauzustand, nur zum Hinsehen. */
export async function werkstand(page: Page): Promise<{ module: string[]; leitungen: string[] }> {
  return page.evaluate(() => {
    const w = window.__spiel!.werk();
    return {
      module: w.module.map((m) => `${m.art}@${m.x},${m.z}`),
      leitungen: w.leitungen.map((l) => `${l.von}.${l.vonPort}→${l.nach}.${l.nachPort}`),
    };
  });
}

/** Text der Kontextleiste — sie ist das Versprechen des Spiels an die Bedienung. */
export async function kontextleiste(page: Page): Promise<string> {
  return page.evaluate(() => (document.querySelector('#kontext') as HTMLElement | null)?.innerText ?? '');
}
