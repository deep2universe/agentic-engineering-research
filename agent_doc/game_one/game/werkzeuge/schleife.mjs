/** Laeuft die Bildschleife? Und liefert ein von Hand ausgeloestes Bild Pixel? */
import { chromium } from '@playwright/test';
import { startOptionen } from './browser.mjs';

const AUS = '/tmp/claude-0/-home-user-agentic-engineering-research/cc82a75b-d09e-53a1-9348-a9492ca49404/scratchpad/spiel';
const browser = await chromium.launch(startOptionen('webgl2'));
const seite = await browser.newPage({ viewport: { width: 1440, height: 900 } });
seite.on('pageerror', (e) => console.log('[pageerror]', e.message));
seite.on('console', (m) => { if (m.type() === 'error') console.log('[console.error]', m.text()); });

await seite.goto('http://127.0.0.1:5178/?forceWebGL=1', { waitUntil: 'load' });
await seite.waitForTimeout(11000);
const b = seite.getByRole('button', { name: 'Halle betreten' });
if (await b.count()) await b.first().click();
await seite.waitForTimeout(800);
const a = seite.locator('.blatt[aria-label="Auftrag"]');
if (await a.count()) await a.getByRole('button').first().click();
await seite.waitForTimeout(2500);

// 1. Laeuft die Schleife? rAF-Takt ueber 1 Sekunde zaehlen.
const takt = await seite.evaluate(() => new Promise((fertig) => {
  let n = 0;
  const start = performance.now();
  const tick = () => { n += 1; if (performance.now() - start < 1000) requestAnimationFrame(tick); else fertig(n); };
  requestAnimationFrame(tick);
}));
console.log('rAF-Takte pro Sekunde:', takt);

// 2. Zaehlt der Renderer zwischen zwei Messungen hoch?
const vorher = await seite.evaluate(() => window.__spiel.rendererInfo());
await seite.waitForTimeout(1500);
const nachher = await seite.evaluate(() => window.__spiel.rendererInfo());
console.log('Renderer vorher :', JSON.stringify(vorher));
console.log('Renderer nachher:', JSON.stringify(nachher));

// 3. Bild von Hand ausloesen und SOFORT im selben Zug lesen.
const beiHand = await seite.evaluate(() => {
  window.__spiel.frameSchritt(3);
  const c = document.querySelector('#leinwand');
  const t = document.createElement('canvas'); t.width = 200; t.height = 125;
  const x = t.getContext('2d'); x.drawImage(c, 0, 0, 200, 125);
  const d = x.getImageData(0, 0, 200, 125).data;
  let s = 0, max = 0; const f = new Set();
  for (let i = 0; i < d.length; i += 4) {
    const l = d[i] * .299 + d[i+1] * .587 + d[i+2] * .114;
    s += l; if (l > max) max = l;
    f.add((d[i] >> 3) << 10 | (d[i+1] >> 3) << 5 | (d[i+2] >> 3));
  }
  return { mittel: +(s / (d.length / 4)).toFixed(2), max, farben: f.size, info: window.__spiel.rendererInfo() };
});
console.log('Nach frameSchritt(3):', JSON.stringify(beiHand));
await seite.screenshot({ path: `${AUS}/nach_framschritt.png` });

// 4. Gibt es einen zweiten, verdeckenden Canvas oder ein Overlay ueber der Leinwand?
const schichten = await seite.evaluate(() => {
  const c = document.querySelector('#leinwand');
  const r = c.getBoundingClientRect();
  const mitte = document.elementsFromPoint(r.width / 2, r.height / 2).map((e) =>
    `${e.tagName.toLowerCase()}${e.id ? '#' + e.id : ''}${e.className ? '.' + String(e.className).split(' ').filter(Boolean).join('.') : ''} bg=${getComputedStyle(e).backgroundColor} op=${getComputedStyle(e).opacity}`);
  return { leinwaende: document.querySelectorAll('canvas').length, unterDemMauszeiger: mitte };
});
console.log('Schichten in der Bildmitte:', JSON.stringify(schichten, null, 2));

await browser.close();
