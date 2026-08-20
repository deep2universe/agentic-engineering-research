/**
 * Baut Level I-0 von Hand fertig und macht Bilder — zum Hinsehen.
 * Zusaetzlich eine nahe Einstellung, weil Lesbarkeit auf Spielabstand zaehlt.
 */
import { chromium } from '@playwright/test';
import { startOptionen } from './browser.mjs';
import { statistik } from './bildmass.mjs';

const AUS = '/tmp/claude-0/-home-user-agentic-engineering-research/cc82a75b-d09e-53a1-9348-a9492ca49404/scratchpad/spiel';
const MARKE = process.env.MARKE ?? 'neu';

const browser = await chromium.launch(startOptionen('webgl2'));
const seite = await browser.newPage({ viewport: { width: 1440, height: 900 } });
seite.on('pageerror', (e) => console.log('[pageerror]', e.message));
seite.on('console', (m) => { if (m.type() === 'error') console.log('[console]', m.text()); });

await seite.goto('http://127.0.0.1:5178/?forceWebGL=1&schleife=1', { waitUntil: 'load' });
await seite.waitForTimeout(13000);
await seite.getByRole('button', { name: 'Halle betreten' }).click();
await seite.waitForTimeout(800);
await seite.locator('.blatt[aria-label="Auftrag"]').getByRole('button').first().click();
await seite.waitForTimeout(2500);

const feld = (x, z) => seite.evaluate(([a, b]) => window.__spiel.feldZuBildschirm(a, b), [x, z]);
const klick = async (x, z) => {
  const p = await feld(x, z);
  await seite.mouse.move(p.x, p.y);
  await seite.waitForTimeout(200);
  await seite.mouse.click(p.x, p.y);
  await seite.waitForTimeout(700);
};

// Kern setzen und Kette schliessen — drei Klicks, wie es sein soll.
await seite.keyboard.press('Digit1');
await klick(7, 5);
await seite.keyboard.press('KeyL');
await klick(0, 5);
await klick(7, 5);
await klick(15, 5);
console.log('Werk:', JSON.stringify(await seite.evaluate(() => {
  const w = window.__spiel.werk();
  return { m: w.module.length, l: w.leitungen.map((x) => `${x.von}→${x.nach}`) };
})));

await seite.waitForTimeout(1500);
await seite.screenshot({ path: `${AUS}/${MARKE}_01_kette.png` });
console.log('Bildmass weit :', JSON.stringify(await statistik(seite)));

// Nahe Einstellung — ueber die Zoomtaste des Spiels, nicht per Debug-Aufruf.
// Nur so ist belegt, dass eine Spielerin diesen Blick auch bekommen kann.
for (let i = 0; i < 5; i++) { await seite.keyboard.press('Equal'); await seite.waitForTimeout(500); }
await seite.waitForTimeout(2500);
await seite.screenshot({ path: `${AUS}/${MARKE}_02_nah.png` });
console.log('Bildmass nah  :', JSON.stringify(await statistik(seite)));

// Zurueck auf Uebersicht und laufen lassen.
await seite.keyboard.press('KeyO');
await seite.waitForTimeout(2500);
await seite.keyboard.press('Space');
await seite.waitForTimeout(6000);
await seite.screenshot({ path: `${AUS}/${MARKE}_03_lauf.png` });
console.log('Bildmass Lauf :', JSON.stringify(await statistik(seite)));

await browser.close();
