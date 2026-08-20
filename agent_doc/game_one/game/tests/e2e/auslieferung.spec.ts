/**
 * Das AUSGELIEFERTE Bündel im Browser.
 *
 * Jeder andere Browsertest fährt gegen den Entwicklungsserver, weil er die
 * Debug-Schnittstelle braucht. Damit prüft keiner von ihnen das, was
 * tatsächlich beim Kunden ankommt.
 *
 * Ein Bündel kann sauber bauen, jede statische Prüfung bestehen und beim Laden
 * trotzdem abstürzen — weil etwas wegoptimiert wurde, das doch gebraucht wird,
 * weil ein dynamischer Import in einem anderen Chunk landet, weil eine
 * Umgebungsvariable in der Produktion anders aufgelöst wird. Diese Datei ist
 * die einzige Stelle, an der so ein Fehler auffällt, bevor ihn jemand meldet.
 *
 * Geprüft wird ohne jede Debug-Hilfe, ausschließlich über das, was eine
 * Besucherin sieht: startet es, zeichnet es, schweigt die Konsole.
 */

import { test, expect, type ConsoleMessage } from '@playwright/test';

const BUENDEL = 'http://127.0.0.1:5179/index.html?forceWebGL=1';

test.describe('Ausgeliefertes Bündel', () => {
  test('startet, zeichnet und schweigt', async ({ page }) => {
    const fehler: string[] = [];
    page.on('console', (m: ConsoleMessage) => {
      if (m.type() === 'error') fehler.push(`console.error: ${m.text()}`);
    });
    page.on('pageerror', (e) => fehler.push(`pageerror: ${e.message}`));

    await page.goto(BUENDEL, { waitUntil: 'load' });

    // Die Akttafel ist das Erste, was das Spiel zeigt. Steht sie, hat der
    // gesamte Startpfad funktioniert: Renderer, Halle, Kampagne, HUD.
    await expect(page.locator('.blatt.akttafel')).toBeVisible({ timeout: 90_000 });
    await expect(page.locator('.blatt.akttafel h1')).toHaveText('Die Kette');

    await page.locator('.blatt.akttafel').getByRole('button').click();
    await expect(page.locator('.blatt[aria-label="Auftrag"]')).toBeVisible();
    await page.locator('.blatt[aria-label="Auftrag"]').getByRole('button').click();

    // Jetzt muss die Halle zu sehen sein. Ein einfarbiges Bild wäre ein
    // schwarzer Bildschirm mit funktionierendem HUD — der klassische Fall,
    // in dem alles "läuft" und nichts zu sehen ist.
    const bild = await page.locator('#leinwand').screenshot();
    expect(bild.byteLength, 'Die Leinwand wirkt einfarbig').toBeGreaterThan(20_000);

    expect(fehler, `Fehler in der Konsole:\n${fehler.join('\n')}`).toEqual([]);
  });

  test('stellt KEINE Debug-Schnittstelle bereit', async ({ page }) => {
    await page.goto(BUENDEL, { waitUntil: 'load' });
    await expect(page.locator('.blatt.akttafel')).toBeVisible({ timeout: 90_000 });
    // Der statische Gegenbeweis steht in tests/einheit/auslieferung.test.ts;
    // hier wird er im laufenden Browser bestätigt.
    expect(await page.evaluate(() => typeof window.__spiel)).toBe('undefined');
  });

  test('lässt sich vollständig mit der Tastatur bedienen', async ({ page }) => {
    await page.goto(BUENDEL, { waitUntil: 'load' });
    await expect(page.locator('.blatt.akttafel')).toBeVisible({ timeout: 90_000 });

    // Enter schließt die Tafel, Enter schließt den Auftrag, "/" öffnet die
    // Tastenübersicht. Ohne Maus, im ausgelieferten Stand.
    await page.keyboard.press('Enter');
    await expect(page.locator('.blatt[aria-label="Auftrag"]')).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(page.locator('.blatt[aria-label="Auftrag"]')).toBeHidden();
    await page.keyboard.press('/');
    await expect(page.locator('.blatt').filter({ hasText: 'Tastenübersicht' })).toBeVisible();
  });
});
