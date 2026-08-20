/**
 * Spielt Level I-0 wie ein Mensch: nur echte Maus- und Tastaturereignisse.
 *
 * Die Testschnittstelle wird ausschliesslich zum HINSEHEN benutzt — Projektion
 * von Gitterfeldern auf Bildpunkte, Auslesen des Zustands. Kein einziger
 * Spielzustand wird ueber sie gesetzt. Alles, was das Werk veraendert, geht
 * durch dieselben Ereignisse, die auch eine Spielerin ausloest.
 */
import { chromium } from '@playwright/test';
import { startOptionen } from './browser.mjs';

const AUS = '/tmp/claude-0/-home-user-agentic-engineering-research/cc82a75b-d09e-53a1-9348-a9492ca49404/scratchpad/spiel';
const browser = await chromium.launch(startOptionen('webgl2'));
const seite = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const fehler = [];
seite.on('pageerror', (e) => fehler.push('pageerror: ' + e.message));
seite.on('console', (m) => { if (m.type() === 'error') fehler.push('console: ' + m.text()); });

let n = 0;
const schuss = async (name) => {
  n += 1;
  await seite.screenshot({ path: `${AUS}/p${String(n).padStart(2, '0')}_${name}.png` });
  console.log(`   [bild ${String(n).padStart(2, '0')}_${name}]`);
};
const werk = () => seite.evaluate(() => {
  const w = window.__spiel.werk();
  return {
    module: w.module.map((m) => `${m.id}:${m.art}@${m.x},${m.z}`),
    leitungen: w.leitungen.map((l) => `${l.von}.${l.vonPort}→${l.nach}.${l.nachPort}`),
  };
});
const feld = (x, z) => seite.evaluate(([a, b]) => window.__spiel.feldZuBildschirm(a, b), [x, z]);

// Die Schleife MUSS laufen — sonst pruefen wir wieder nur Standbilder.
await seite.goto('http://127.0.0.1:5178/?forceWebGL=1&schleife=1', { waitUntil: 'load' });
await seite.waitForTimeout(13000);

await seite.getByRole('button', { name: 'Halle betreten' }).click();
await seite.waitForTimeout(900);
await seite.locator('.blatt[aria-label="Auftrag"]').getByRole('button').first().click();
await seite.waitForTimeout(2200);
await schuss('spielfeld');
console.log('Werk zu Beginn:', JSON.stringify(await werk()));

// --- 1. Modul waehlen: Klick auf die Palette (wie eine Spielerin) ---
console.log('\n1) Klick auf die Modulpalette');
await seite.locator('.palette button, button:has-text("MODELL-KERN")').first().click();
await seite.waitForTimeout(600);
await schuss('modul_gewaehlt');

// --- 2. Kern auf ein Feld setzen ---
const zielfeld = { x: 7, z: 5 };
const pkt = await feld(zielfeld.x, zielfeld.z);
console.log(`2) Klick auf Feld (${zielfeld.x},${zielfeld.z}) → Bildpunkt ${Math.round(pkt.x)},${Math.round(pkt.y)} imBild=${pkt.imBild}`);
await seite.mouse.move(pkt.x, pkt.y);
await seite.waitForTimeout(400);
await schuss('mauszeiger_auf_feld');
await seite.mouse.click(pkt.x, pkt.y);
await seite.waitForTimeout(800);
await schuss('nach_setzen');
console.log('   Werk danach:', JSON.stringify(await werk()));

// --- 3. Leitungsmodus, dann Quelle → Kern → Senke ---
console.log('\n3) Taste L (Leitungsmodus)');
await seite.keyboard.press('KeyL');
await seite.waitForTimeout(500);
await schuss('leitungsmodus');

const kette = [{ x: 0, z: 5 }, { x: 7, z: 5 }, { x: 7, z: 5 }, { x: 15, z: 5 }];
for (let i = 0; i < kette.length; i++) {
  const f = kette[i];
  const p = await feld(f.x, f.z);
  console.log(`   Klick ${i + 1}/4 auf (${f.x},${f.z}) → ${Math.round(p.x)},${Math.round(p.y)} imBild=${p.imBild}`);
  await seite.mouse.move(p.x, p.y);
  await seite.waitForTimeout(300);
  await seite.mouse.click(p.x, p.y);
  await seite.waitForTimeout(700);
  await schuss(`k_leitung_${i + 1}`);
  console.log('     Werk:', JSON.stringify(await werk()));
}

// --- 4. Simulation starten ---
console.log('\n4) Simulation starten');
await seite.getByRole('button', { name: 'Simulation starten' }).click();
await seite.waitForTimeout(1500);
await schuss('simulation_laeuft');
for (let i = 0; i < 12; i++) {
  await seite.waitForTimeout(1200);
  const p = await seite.evaluate(() => window.__spiel.phase());
  if (p === 'auswertung') { console.log(`   Auswertung nach ${i + 1} Wartezyklen`); break; }
}
await schuss('ergebnis');
const ergebnis = await seite.evaluate(() => ({
  phase: window.__spiel.phase(),
  bewertung: window.__spiel.bewertung(),
  metriken: window.__spiel.metriken(),
}));
console.log('\nERGEBNIS:', JSON.stringify(ergebnis, null, 2));

if (fehler.length) { console.log('\nFEHLER:'); fehler.slice(0, 8).forEach((f) => console.log('  ' + f)); }
await browser.close();
