/**
 * Playwright-Konfiguration.
 *
 * Drei Dinge sind hier nicht verhandelbar:
 *
 * 1. `--enable-unsafe-swiftshader`. Ohne dieses Flag gibt es ab Chrome 130
 *    ueberhaupt keinen WebGL-Kontext — die Bilder waeren schwarz und alle
 *    Bildvergleiche bestuenden stillschweigend.
 * 2. Das VOLLE Chromium, nicht `chrome-headless-shell`. Beide rendern
 *    unterschiedlich; Baselines aus dem einen taugen nicht fuer das andere.
 * 3. `retries: 1`, niemals mehr. Bei einem deterministischen Spiel ist jeder
 *    Wackler ein echter Nichtdeterminismus-Fehler. Wiederholungen verstecken
 *    genau die Fehlerklasse, die im Unternehmenseinsatz als "die Simulation
 *    liefert unterschiedliche Ergebnisse" zurueckkommt.
 */

import { defineConfig, devices } from '@playwright/test';
import { chromiumPfad, FLAGS_WEBGL2 } from './werkzeuge/browser.mjs';

const pfad = chromiumPfad();

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 120_000,
  expect: {
    timeout: 20_000,
    toHaveScreenshot: {
      threshold: 0.15,
      maxDiffPixelRatio: 0.004,
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
    },
  },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: process.env['CI'] ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://127.0.0.1:5178',
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
    trace: 'retain-on-failure',
    video: 'off',
    screenshot: 'only-on-failure',
    launchOptions: {
      args: FLAGS_WEBGL2,
      ...(pfad ? { executablePath: pfad } : {}),
    },
  },
  /*
   * Der ENTWICKLUNGSSERVER, nicht `vite preview`.
   *
   * Grund: `vite preview` liefert das fertige Produktionsbündel — und in dem
   * ist die Debug-Schnittstelle absichtlich wegoptimiert. Ein Browsertest, der
   * das Spiel steuern soll, braucht sie. Dass sie im ausgelieferten Bündel
   * fehlt, prüft dafür `tests/einheit/auslieferung.test.ts` gegen die echten
   * gebauten Dateien.
   */
  webServer: {
    command: 'VITE_TESTHOOKS=1 npx vite --port 5178 --strictPort',
    url: 'http://127.0.0.1:5178',
    reuseExistingServer: !process.env['CI'],
    timeout: 180_000,
  },
});
