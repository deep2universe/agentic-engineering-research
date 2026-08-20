/**
 * Startet das Spiel headless, spielt eine Referenzloesung durch und legt
 * Screenshots ab. Das ist das Werkzeug, mit dem das Spiel begutachtet wird —
 * es beantwortet die Frage "sieht das gut aus und funktioniert es",
 * bevor irgendjemand einen Browser oeffnet.
 *
 * Aufruf: node werkzeuge/schau.mjs [levelId] [--webgpu]
 */
import { chromium } from '@playwright/test';
import { createServer } from 'vite';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { startOptionen } from './browser.mjs';

const levelId = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'I-1';
const modus = process.argv.includes('--webgpu') ? 'webgpu' : 'webgl2';
const AUS = 'werkzeuge/bilder';

function analyse(pfad) {
  const p = PNG.sync.read(readFileSync(pfad));
  let summe = 0;
  let hell = 0;
  let max = 0;
  for (let i = 0; i < p.data.length; i += 4) {
    const v = (p.data[i] + p.data[i + 1] + p.data[i + 2]) / 3;
    summe += v;
    if (v > 14) hell++;
    if (v > max) max = v;
  }
  const n = p.width * p.height;
  return { mittel: +(summe / n).toFixed(2), max: Math.round(max), hellAnteil: +(hell / n).toFixed(3) };
}

process.env.VITE_TESTHOOKS = '1';
const server = await createServer({
  root: process.cwd(),
  server: { port: 5201, strictPort: true },
  define: { __TEST__: 'true', __VERSION__: '"1.0.0"' },
});
await server.listen();

const browser = await chromium.launch(startOptionen(modus));
const page = await browser.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
mkdirSync(AUS, { recursive: true });

const meldungen = [];
page.on('console', (m) => {
  const t = `${m.type()}: ${m.text()}`;
  if (!meldungen.includes(t)) meldungen.push(t);
});
page.on('pageerror', (e) => meldungen.push(`pageerror: ${e.message}\n${String(e.stack).slice(0, 400)}`));

const url = `http://127.0.0.1:5201/index.html${modus === 'webgl2' ? '?forceWebGL=1' : ''}`;
await page.goto(url, { waitUntil: 'load' });

const bilder = [];
async function schuss(name, beschreibung) {
  const pfad = `${AUS}/${name}.png`;
  await page.screenshot({ path: pfad });
  const a = analyse(pfad);
  bilder.push({ name, beschreibung, ...a });
  console.log(`  ${name.padEnd(24)} mittel=${String(a.mittel).padStart(6)} hell=${String(a.hellAnteil).padStart(5)} max=${a.max}  ${beschreibung}`);
}

try {
  await page.waitForFunction(() => window.__spiel?.bereit() === true, null, { timeout: 60_000 });
  console.log('Debug-API bereit.');

  const info = await page.evaluate(() => {
    window.__spiel.frameSchritt(3);
    return window.__spiel.rendererInfo();
  });
  console.log('Backend:', info.backend, '| Draw Calls:', info.drawCalls, '| Dreiecke:', info.dreiecke);

  await schuss('01_briefing', 'Briefing beim Betreten des Levels');

  // Briefing schliessen, Level laden.
  await page.evaluate((id) => {
    window.__spiel.ladeLevel(id);
    window.__spiel.frameSchritt(3);
  }, levelId);
  await schuss('02_leeres_werk', 'Leeres Fundament, Auftragseingang und Auslieferung');

  // Referenzloesung laden.
  const geladen = await page.evaluate(() => {
    const ok = window.__spiel.ladeReferenz(0);
    window.__spiel.frameSchritt(3);
    return { ok, befunde: window.__spiel.befunde(), werk: window.__spiel.werk().module.length };
  });
  console.log('Referenz geladen:', geladen.ok, '| Module:', geladen.werk, '| Befunde:', JSON.stringify(geladen.befunde));
  await schuss('03_gebautes_werk', 'Referenzloesung steht');

  // Kamera nah heran.
  await page.evaluate(() => {
    window.__spiel.setzeKamera(0, 0, 16, -35, 46);
    window.__spiel.frameSchritt(3);
  });
  await schuss('04_nahaufnahme', 'Nahaufnahme der Pipeline');

  // Simulation starten und ein paar Ticks laufen lassen.
  const lauf = await page.evaluate(() => {
    window.__spiel.setzeKamera(0, 0, 26, -35, 52);
    window.__spiel.starteSimulation();
    for (let i = 0; i < 14; i++) {
      window.__spiel.tick(1);
      window.__spiel.frameSchritt(1);
    }
    return { phase: window.__spiel.phase(), metriken: window.__spiel.metriken() };
  });
  console.log('Simulation:', lauf.phase, '| geliefert:', lauf.metriken.geliefert, '| Kosten:', Math.round(lauf.metriken.kosten ?? 0));
  await schuss('05_simulation', 'Auftraege fliessen durch das Werk');

  // Bis zum Ende laufen.
  const ergebnis = await page.evaluate(() => {
    window.__spiel.laufeDurch();
    window.__spiel.frameSchritt(3);
    return { phase: window.__spiel.phase(), metriken: window.__spiel.metriken(), bewertung: window.__spiel.bewertung() };
  });
  console.log('Ergebnis:', JSON.stringify(ergebnis.bewertung));
  console.log('Metriken:', JSON.stringify({
    guete: +(ergebnis.metriken.guete ?? 0).toFixed(3),
    kosten: Math.round(ergebnis.metriken.kosten ?? 0),
    p95: ergebnis.metriken.latenzP95,
    geliefert: ergebnis.metriken.geliefert,
  }));
  await schuss('06_auswertung', 'Auswertung nach dem Lauf');

  // Ohne HUD, fuer die reine Bildbeurteilung.
  await page.evaluate(() => {
    window.__spiel.versteckeHud(true);
    window.__spiel.setzeKamera(0, 1, 22, -52, 38);
    window.__spiel.frameSchritt(4);
  });
  await schuss('07_ohne_hud', 'Nur die Halle, ohne Oberflaeche');

  await page.evaluate(() => {
    window.__spiel.setzeKamera(-3, 2, 11, -18, 24);
    window.__spiel.frameSchritt(4);
  });
  await schuss('08_flach', 'Flacher Blickwinkel');
} catch (e) {
  console.error('FEHLER:', e.message);
  await page.screenshot({ path: `${AUS}/99_fehler.png` }).catch(() => undefined);
}

writeFileSync(`${AUS}/bericht.json`, JSON.stringify({ levelId, modus, bilder, meldungen }, null, 2));
if (meldungen.length) {
  console.log('\n--- Konsole ---');
  for (const m of meldungen.slice(0, 20)) console.log(' ', m.slice(0, 240));
}

await browser.close();
await server.close();
