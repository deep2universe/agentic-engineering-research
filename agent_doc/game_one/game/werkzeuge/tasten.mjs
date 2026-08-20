/** Prueft jede beworbene Taste: kommt sie an, und tut sie etwas? */
import { chromium } from '@playwright/test';
import { startOptionen } from './browser.mjs';

const browser = await chromium.launch(startOptionen('webgl2'));
const seite = await browser.newPage({ viewport: { width: 1440, height: 900 } });
seite.on('pageerror', (e) => console.log('[pageerror]', e.message));

await seite.goto('http://127.0.0.1:5178/?forceWebGL=1&schleife=1', { waitUntil: 'load' });
await seite.waitForTimeout(13000);
await seite.getByRole('button', { name: 'Halle betreten' }).click();
await seite.waitForTimeout(800);
await seite.locator('.blatt[aria-label="Auftrag"]').getByRole('button').first().click();
await seite.waitForTimeout(2000);

const zustand = () => seite.evaluate(() => ({
  kamera: window.__spiel.kameraZustand(),
  phase: window.__spiel.phase(),
  offeneTafeln: [...document.querySelectorAll('.blatt')].filter((e) => e.offsetParent !== null)
    .map((e) => e.getAttribute('aria-label') || e.className).join(','),
  kontext: (document.querySelector('#kontext')?.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 90),
  palette: [...document.querySelectorAll('#palette button, .palette button')]
    .map((b) => (b.getAttribute('aria-pressed') === 'true' || b.classList.contains('aktiv') ? '*' : '') + (b.textContent || '').trim()).join('|'),
  meldung: (document.querySelector('#meldung, .meldung')?.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 70),
  fokus: document.activeElement ? document.activeElement.tagName + (document.activeElement.className ? '.' + String(document.activeElement.className).split(' ')[0] : '') : '-',
}));

const rund = (o) => JSON.stringify({ ziel: o.kamera.ziel.map((v) => +v.toFixed(2)), abstand: +o.kamera.abstand.toFixed(2), gierung: +o.kamera.gierung.toFixed(3), neigung: +o.kamera.neigung.toFixed(3) });

const TASTEN = [
  ['KeyW', 'Kamera vor'], ['KeyS', 'Kamera zurueck'], ['KeyA', 'Kamera links'], ['KeyD', 'Kamera rechts'],
  ['KeyQ', 'Gierung links'], ['KeyE', 'Gierung rechts'],
  ['KeyL', 'Leitungsmodus'], ['KeyR', 'Abrissmodus'], ['KeyC', 'Auswahlmodus'],
  ['Escape', 'Abbrechen'], ['KeyF', 'Fokus'],
  ['Digit1', 'Modul 1'], ['Space', 'Simulation'], ['Slash', 'Tastenuebersicht'],
  ['KeyB', 'Briefing'], ['KeyM', 'Ton'], ['KeyG', 'Gitter'], ['KeyO', 'Uebersicht'],
  ['KeyN', 'Einzeltick'],
];

console.log('Anfangsfokus:', (await zustand()).fokus);
console.log('Offene Tafeln:', JSON.stringify((await zustand()).offeneTafeln));
if (process.env.KLICK === '1') {
  await seite.mouse.click(720, 500);
  await seite.waitForTimeout(500);
  console.log('Nach Klick auf die Leinwand — Fokus:', (await zustand()).fokus,
              '| Tafeln:', JSON.stringify((await zustand()).offeneTafeln));
}
console.log('');
for (const [code, was] of TASTEN) {
  const vor = await zustand();
  await seite.keyboard.press(code);
  await seite.waitForTimeout(450);
  const nach = await zustand();
  const kameraAnders = rund(vor) !== rund(nach);
  const tafelnAnders = vor.offeneTafeln !== nach.offeneTafeln;
  const kontextAnders = vor.kontext !== nach.kontext;
  const paletteAnders = vor.palette !== nach.palette;
  const meldungAnders = vor.meldung !== nach.meldung;
  const phaseAnders = vor.phase !== nach.phase;
  const wirkung = [kameraAnders && 'Kamera', tafelnAnders && 'Tafel', kontextAnders && 'Kontext',
                   paletteAnders && 'Palette', meldungAnders && 'Meldung', phaseAnders && 'Phase']
    .filter(Boolean).join('+') || 'KEINE WIRKUNG';
  console.log(`${code.padEnd(9)} ${was.padEnd(18)} → ${wirkung.padEnd(24)} kontext="${nach.kontext.slice(0, 46)}"`);
  // Tafeln wieder schliessen, damit die naechste Taste sauber misst.
  if (tafelnAnders) { await seite.keyboard.press('Escape'); await seite.waitForTimeout(350); }
}

// Halten die Bewegungstasten die Kamera in Bewegung (keydown/keyup statt press)?
console.log('\nGedrueckt halten:');
const v = await zustand();
await seite.keyboard.down('KeyW');
await seite.waitForTimeout(1200);
await seite.keyboard.up('KeyW');
await seite.waitForTimeout(300);
const nz = await zustand();
console.log('  W 1,2 s gehalten:', rund(v), '→', rund(nz), rund(v) !== rund(nz) ? 'BEWEGT' : 'STEHT');

await browser.close();
