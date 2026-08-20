/**
 * Misst die Bildrate ueber mehrere Einstellungen.
 *
 * Wichtig fuer die Bewertung: Hier laeuft SwiftShader, ein reiner
 * Software-Rasterisierer ohne Grafikkarte. Absolute Zahlen sagen deshalb nichts
 * ueber das Geraet einer Spielerin. Aussagekraeftig sind die VERHAELTNISSE
 * zwischen den Einstellungen — sie zeigen, was die Last verursacht.
 */
import { chromium } from '@playwright/test';
import { startOptionen } from './browser.mjs';

const browser = await chromium.launch(startOptionen('webgl2'));

async function miss(name, query, breite = 1440, hoehe = 900) {
  const seite = await browser.newPage({ viewport: { width: breite, height: hoehe } });
  await seite.goto(`http://127.0.0.1:5178/?schleife=1&${query}`, { waitUntil: 'load' });
  await seite.waitForTimeout(13000);
  const b = seite.getByRole('button', { name: 'Halle betreten' });
  if (await b.count()) await b.first().click();
  await seite.waitForTimeout(700);
  const a = seite.locator('.blatt[aria-label="Auftrag"]');
  if (await a.count()) await a.getByRole('button').first().click();
  await seite.waitForTimeout(2500);

  const v = await seite.evaluate(() => window.__spiel.bilder());
  await seite.waitForTimeout(5000);
  const n = await seite.evaluate(() => window.__spiel.bilder());
  const info = await seite.evaluate(() => window.__spiel.rendererInfo());
  const fps = (n - v) / 5;
  console.log(
    `${name.padEnd(30)} ${fps.toFixed(1).padStart(6)} B/s   ${String(info.drawCalls).padStart(4)} Draws  ${String(info.dreiecke).padStart(6)} Dreiecke  ${info.backend}`
  );
  await seite.close();
  return fps;
}

console.log('Bildrate unter SwiftShader (Software, ohne Grafikkarte):\n');
await miss('voll, 1440x900', 'forceWebGL=1');
await miss('ohne Nachbearbeitung', 'forceWebGL=1&post=0');
await miss('Guete niedrig', 'forceWebGL=1&guete=niedrig');
await miss('Guete niedrig, ohne Post', 'forceWebGL=1&post=0&guete=niedrig');
await miss('voll, 720x450', 'forceWebGL=1', 720, 450);
await miss('ohne Post, 720x450', 'forceWebGL=1&post=0', 720, 450);
await browser.close();
