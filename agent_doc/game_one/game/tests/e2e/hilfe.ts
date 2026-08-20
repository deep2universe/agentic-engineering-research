/**
 * Gemeinsame Hilfen der Browser-Tests.
 *
 * Grundsatz: Es wird gegen den ZUSTAND geprüft, nicht gegen Pixel. Bilder sind
 * ein zusätzliches Netz, kein Ersatz für Zusicherungen — ein Bildvergleich sagt
 * nur, dass sich etwas geändert hat, nie ob es richtig ist.
 */

import type { Page, ConsoleMessage } from '@playwright/test';
import { expect } from '@playwright/test';
import type { DebugApi } from '../../src/werkzeug/debug_api';

declare global {
  interface Window {
    __spiel?: DebugApi;
    __ctxVerloren?: boolean;
    __meldungen?: string[];
  }
}

export interface Sitzung {
  readonly page: Page;
  readonly fehler: string[];
}

/** Öffnet das Spiel, wartet auf die Debug-Schnittstelle und sammelt Fehler ein. */
export async function oeffne(page: Page, abfrage = ''): Promise<Sitzung> {
  const fehler: string[] = [];

  page.on('console', (m: ConsoleMessage) => {
    if (m.type() === 'error') fehler.push(`console.error: ${m.text()}`);
  });
  page.on('pageerror', (e) => fehler.push(`pageerror: ${e.message}`));

  // Kontextverlust ist ein stiller Killer: das Bild bleibt stehen, alles
  // scheint zu laufen, und jeder Bildvergleich ist ab da wertlos.
  await page.addInitScript(() => {
    window.__ctxVerloren = false;
    globalThis.addEventListener(
      'webglcontextlost',
      () => {
        window.__ctxVerloren = true;
      },
      true
    );
  });

  await page.goto(`/index.html?forceWebGL=1${abfrage}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__spiel?.bereit() === true, null, { timeout: 90_000 });
  return { page, fehler };
}

/** Bereitet einen reproduzierbaren Bildzustand vor: ohne Zeitachse, ohne HUD-Dialoge. */
export async function stelleBildRuhig(page: Page): Promise<void> {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(() => {
    const s = window.__spiel!;
    s.setzeTemporalModus('aus');
    s.setzeReduzierteBewegung(true);
    s.frameSchritt(2);
  });
}

/** Spielt ein Level mit einer Referenzlösung durch und liefert die Bewertung. */
export async function spieleReferenz(
  page: Page,
  levelId: string,
  referenz = 0
): Promise<{ bestanden: boolean; metriken: Record<string, number>; hash: string }> {
  return page.evaluate(
    ({ levelId: id, referenz: n }) => {
      const s = window.__spiel!;
      s.ladeLevel(id);
      const geladen = s.ladeReferenz(n);
      if (!geladen) throw new Error(`Level ${id} hat keine Referenzlösung ${n}`);
      s.starteSimulation();
      s.laufeDurch();
      return { bestanden: s.bewertung().bestanden, metriken: s.metriken(), hash: s.zustandsHash() };
    },
    { levelId, referenz }
  );
}

/** Zusicherungen, die nach JEDEM Browser-Test gelten müssen. */
export async function pruefeSauberkeit(s: Sitzung): Promise<void> {
  expect(s.fehler, `Fehler in der Konsole:\n${s.fehler.join('\n')}`).toEqual([]);
  const verloren = await s.page.evaluate(() => window.__ctxVerloren === true);
  expect(verloren, 'Der WebGL-Kontext ist verloren gegangen').toBe(false);
}

/**
 * Prüft, dass überhaupt etwas gerendert wurde. Ohne diese Zusicherung sind alle
 * Bildvergleiche grün und wertlos, sobald die Leinwand schwarz bleibt.
 */
export async function pruefeNichtSchwarz(page: Page): Promise<void> {
  const bild = await page.locator('#leinwand').screenshot();
  // Ein PNG von 1280x720 hat immer Inhalt; entscheidend ist die Dateigröße als
  // grober, aber sehr zuverlässiger Indikator für "nicht einfarbig".
  expect(bild.byteLength, 'Die Leinwand wirkt einfarbig — vermutlich schwarz').toBeGreaterThan(20_000);
}
