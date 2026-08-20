/** Diagnose: was steckt zur Laufzeit in Szene, Kamera und Renderer? */
import { chromium } from '@playwright/test';
import { startOptionen } from './browser.mjs';

const browser = await chromium.launch(startOptionen('webgl2'));
const seite = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const log = [];
seite.on('console', (m) => log.push(`[${m.type()}] ${m.text()}`));
seite.on('pageerror', (e) => log.push(`[pageerror] ${e.message}`));

await seite.goto('http://127.0.0.1:5178/?forceWebGL=1', { waitUntil: 'load' });
await seite.waitForTimeout(12000);
const b1 = seite.getByRole('button', { name: 'Halle betreten' });
if (await b1.count()) await b1.first().click();
await seite.waitForTimeout(1000);
const auftrag = seite.locator('.blatt[aria-label="Auftrag"]');
if (await auftrag.count()) await auftrag.getByRole('button').first().click();
await seite.waitForTimeout(3000);

const befund = await seite.evaluate(() => {
  const s = window.__spiel;
  const out = { hatSpiel: !!s, schluessel: s ? Object.keys(s) : [] };
  const c = document.querySelector('#leinwand');
  if (c) {
    out.leinwand = { w: c.width, h: c.height, cssW: c.clientWidth, cssH: c.clientHeight,
                     stil: getComputedStyle(c).cssText.slice(0, 0) || undefined,
                     opacity: getComputedStyle(c).opacity, display: getComputedStyle(c).display,
                     zIndex: getComputedStyle(c).zIndex, hintergrund: getComputedStyle(c).backgroundColor };
  } else out.leinwand = null;
  if (s && s.rendererInfo) { try { out.renderer = s.rendererInfo(); } catch (e) { out.rendererFehler = String(e); } }
  if (s && s.szenenBefund) { try { out.szenenBefund = s.szenenBefund(); } catch (e) { out.szenenFehler = String(e); } }
  if (false) {
    const sz = s.szene();
    let netze = 0, sichtbar = 0, instanzen = 0;
    const arten = {};
    sz.traverse((o) => {
      if (o.isMesh || o.isInstancedMesh || o.isBatchedMesh) {
        netze++;
        if (o.visible) sichtbar++;
        if (o.isInstancedMesh) instanzen += o.count;
        arten[o.type] = (arten[o.type] || 0) + 1;
      }
    });
    out.szene = { netze, sichtbar, instanzen, arten, kinder: sz.children.length,
                  hintergrund: sz.background ? String(sz.background.getHexString?.() ?? sz.background) : null };
  }
  if (s && s.kamera) {
    const k = s.kamera();
    out.kamera = { pos: k.position.toArray().map(n=>+n.toFixed(2)), fov: k.fov, near: k.near, far: k.far };
  }
  return out;
});

console.log(JSON.stringify(befund, null, 2));

// Pixelstatistik der Leinwand
const stat = await seite.evaluate(() => {
  const c = document.querySelector('#leinwand');
  if (!c) return null;
  const tmp = document.createElement('canvas');
  tmp.width = 200; tmp.height = 120;
  const ctx = tmp.getContext('2d');
  ctx.drawImage(c, 0, 0, 200, 120);
  const d = ctx.getImageData(0, 0, 200, 120).data;
  let summe = 0, max = 0, ueber10 = 0, ueber30 = 0;
  const farben = new Set();
  for (let i = 0; i < d.length; i += 4) {
    const l = (d[i] * 0.299 + d[i+1] * 0.587 + d[i+2] * 0.114);
    summe += l; if (l > max) max = l;
    if (l > 10) ueber10++; if (l > 30) ueber30++;
    farben.add((d[i] >> 3) << 10 | (d[i+1] >> 3) << 5 | (d[i+2] >> 3));
  }
  const n = d.length / 4;
  return { mittlereHelligkeit: +(summe / n).toFixed(2), maxHelligkeit: max,
           anteilUeber10: +(ueber10 / n).toFixed(3), anteilUeber30: +(ueber30 / n).toFixed(3),
           distinkteFarben: farben.size };
});
console.log('\nPIXELSTATISTIK LEINWAND:', JSON.stringify(stat));
console.log('\nKONSOLE:'); log.slice(0, 30).forEach((l) => console.log(' ', l));
await browser.close();
