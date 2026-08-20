/**
 * Handbetrieb: startet das Spiel und bedient es wie ein Mensch.
 * Nur echte Maus- und Tastaturereignisse, kein window.__spiel.
 */
import { chromium } from '@playwright/test';
import { startOptionen } from './browser.mjs';
import { writeFileSync } from 'node:fs';

const AUS = '/tmp/claude-0/-home-user-agentic-engineering-research/cc82a75b-d09e-53a1-9348-a9492ca49404/scratchpad/spiel';
const URL = 'http://127.0.0.1:5178/?forceWebGL=1';

const browser = await chromium.launch(startOptionen('webgl2'));
const seite = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });

const protokoll = [];
seite.on('console', (m) => protokoll.push(`[${m.type()}] ${m.text()}`));
seite.on('pageerror', (e) => protokoll.push(`[pageerror] ${e.message}`));

let n = 0;
async function schuss(name) {
  n += 1;
  const datei = `${AUS}/${String(n).padStart(2, '0')}_${name}.png`;
  await seite.screenshot({ path: datei });
  console.log(`  → ${datei}`);
}

await seite.goto(URL, { waitUntil: 'load' });
await seite.waitForTimeout(12000);
await schuss('nach_dem_laden');

// Was ist ueberhaupt im DOM?
const dom = await seite.evaluate(() => {
  const sichtbar = (el) => {
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden';
  };
  const knoten = [...document.querySelectorAll('body *')]
    .filter((el) => sichtbar(el) && el.children.length === 0 && (el.textContent || '').trim())
    .slice(0, 60)
    .map((el) => {
      const r = el.getBoundingClientRect();
      return `${el.tagName.toLowerCase()}${el.className ? '.' + String(el.className).split(' ').join('.') : ''} @${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)} :: ${(el.textContent || '').trim().slice(0, 90)}`;
    });
  const knoepfe = [...document.querySelectorAll('button')].map((b) => {
    const r = b.getBoundingClientRect();
    return `BUTTON @${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)} "${(b.textContent || '').trim().slice(0, 50)}" ${b.disabled ? 'DISABLED' : ''}`;
  });
  return { knoten, knoepfe, titel: document.title };
});

writeFileSync(`${AUS}/dom.txt`, JSON.stringify(dom, null, 2));

// --- Durch die Tafeln ins Spielfeld ---
async function klickeText(text) {
  const b = seite.getByRole('button', { name: text });
  if (await b.count()) { await b.first().click(); await seite.waitForTimeout(1200); return true; }
  return false;
}
await klickeText('Halle betreten');
await schuss('nach_halle_betreten');
const auftrag = seite.locator('.blatt[aria-label="Auftrag"]');
if (await auftrag.count()) {
  const t = await auftrag.innerText();
  writeFileSync(`${AUS}/auftragstafel.txt`, t);
  console.log('\n--- AUFTRAGSTAFEL ---\n' + t.slice(0, 1500));
  await auftrag.getByRole('button').first().click();
  await seite.waitForTimeout(1500);
}
await schuss('spielfeld');

console.log('TITEL:', dom.titel);
console.log('\n--- KNOEPFE ---');
dom.knoepfe.forEach((b) => console.log(' ', b));
console.log('\n--- TEXTKNOTEN ---');
dom.knoten.slice(0, 40).forEach((k) => console.log(' ', k));
console.log('\n--- KONSOLE ---');
protokoll.slice(0, 40).forEach((p) => console.log(' ', p));

await browser.close();
