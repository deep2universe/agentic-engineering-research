/**
 * Faehrt den Renderer-Spike headless ueber alle Bisektionsstufen und meldet,
 * ab welcher Stufe das Bild schwarz wird oder ein Fehler auftritt.
 *
 * Aufruf: node spike/spike_lauf.mjs [webgl2|webgpu] [stufen...]
 */
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { startOptionen } from '../werkzeuge/browser.mjs';

const modus = process.argv[2] ?? 'webgl2';
const stufen = process.argv.slice(3).length
  ? process.argv.slice(3).map(Number)
  : [0, 1, 2, 3, 4, 5];

function helligkeit(pfad) {
  const p = PNG.sync.read(readFileSync(pfad));
  let summe = 0;
  let max = 0;
  let hell = 0;
  for (let i = 0; i < p.data.length; i += 4) {
    const v = (p.data[i] + p.data[i + 1] + p.data[i + 2]) / 3;
    summe += v;
    if (v > max) max = v;
    if (v > 12) hell++;
  }
  const n = p.width * p.height;
  return { mittel: +(summe / n).toFixed(2), max, hellAnteil: +(hell / n).toFixed(4) };
}

const server = await createServer({ root: process.cwd(), server: { port: 5199, strictPort: true } });
await server.listen();
const browser = await chromium.launch(startOptionen(modus));
mkdirSync('spike/ergebnis', { recursive: true });

const gesamt = [];
for (const stufe of stufen) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  const konsole = [];
  page.on('console', (m) => {
    const t = m.text();
    if (!konsole.some((k) => k.endsWith(t))) konsole.push(`${m.type()}: ${t}`);
  });
  page.on('pageerror', (e) => konsole.push(`pageerror: ${e.message}`));

  const url = `http://127.0.0.1:5199/spike/spike.html?stufe=${stufe}${modus === 'webgl2' ? '&forceWebGL=1' : ''}`;
  await page.goto(url, { waitUntil: 'load' });

  let bericht;
  try {
    await page.waitForFunction(() => window.__spikeFertig === true, null, { timeout: 90_000 });
    bericht = await page.evaluate(() => window.__spike);
  } catch (e) {
    bericht = (await page.evaluate(() => window.__spike)) ?? { schritt: 'kein_bericht' };
    bericht.timeout = String(e.message).slice(0, 160);
  }

  const png = `spike/ergebnis/spike_${modus}_s${stufe}.png`;
  await page.screenshot({ path: png });
  const h = helligkeit(png);
  const zeile = { stufe, backend: bericht.backend, schritt: bericht.schritt, ...h, drawCalls: bericht.drawCalls, fehler: bericht.fehler };
  gesamt.push(zeile);
  console.log(
    `Stufe ${stufe}: backend=${bericht.backend ?? '-'} schritt=${bericht.schritt} ` +
      `mittel=${h.mittel} max=${h.max} hell=${h.hellAnteil} calls=${bericht.drawCalls ?? '-'}` +
      (bericht.fehler ? `\n   FEHLER: ${bericht.fehler}` : '')
  );
  const auffaellig = konsole.filter((k) => !k.includes('[vite]')).slice(0, 6);
  if (auffaellig.length) console.log('   ' + auffaellig.join('\n   '));
  await page.close();
}

writeFileSync(`spike/ergebnis/bericht_${modus}.json`, JSON.stringify(gesamt, null, 2));
await browser.close();
await server.close();

const kaputt = gesamt.filter((g) => g.hellAnteil < 0.02 || g.fehler);
console.log(kaputt.length ? `\nBRUCHSTELLEN: Stufen ${kaputt.map((k) => k.stufe).join(', ')}` : '\nALLE STUFEN OK');
process.exit(kaputt.length ? 1 : 0);
