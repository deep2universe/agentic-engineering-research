/**
 * Die Schmiede im Browser.
 *
 * Geprüft wird die vollständige Kette: Werk mit einer SCHMIEDE laden →
 * Werkbank öffnen → Ziel setzen → suchen → eine Anlage übernehmen → sie
 * laufen lassen. Das ist der einzige Ort im Projekt, an dem eine evolutionäre
 * Suche im echten Browser läuft, und damit auch die einzige Stelle, an der
 * auffiele, dass sie dort zu langsam ist.
 *
 * Die eigentliche Zusicherung steht am Ende: **Was die Werkbank verspricht,
 * hält die Simulation.** Die Kennzahlen, die in der Auswahltabelle stehen,
 * müssen exakt die sein, die beim Durchlaufen herauskommen. Wäre das nicht so,
 * würde das Spiel bei der Lektion des Akts selbst schummeln.
 */

import { test, expect } from '@playwright/test';
import { oeffne, pruefeSauberkeit } from './hilfe';

/**
 * Ein Werk mit echtem Suchraum und einer SCHMIEDE daneben.
 *
 * Die Schmiede hängt bewusst NICHT im Auftragsfluss — sie kostet einen
 * Bauplatz und sonst nichts. Der Suchapparat ist Gemeinkosten.
 */
const WERK = {
  module: [
    { id: 'q', art: 'quelle', x: 0, z: 5, param: {} },
    { id: 'w1', art: 'weiche', x: 2, z: 5, param: { kriterium: 'schwierigkeit', schwelle: 0.5 } },
    { id: 'k1', art: 'kern', x: 5, z: 3, param: { groesse: 'kondor' } },
    { id: 'k2', art: 'kern', x: 5, z: 7, param: { groesse: 'kondor' } },
    { id: 'p1', art: 'pruefer', x: 9, z: 5, param: { schwelle: 0.5, runden: 2 } },
    { id: 'sm', art: 'schmiede', x: 12, z: 8, param: { population: 12, generationen: 8 } },
    { id: 's', art: 'senke', x: 14, z: 5, param: {} },
  ],
  leitungen: [
    { id: 'l1', von: 'q', vonPort: 'aus', nach: 'w1', nachPort: 'ein' },
    { id: 'l2', von: 'w1', vonPort: 'a', nach: 'k1', nachPort: 'ein' },
    { id: 'l3', von: 'w1', vonPort: 'b', nach: 'k2', nachPort: 'ein' },
    { id: 'l4', von: 'k1', vonPort: 'aus', nach: 'p1', nachPort: 'ein' },
    { id: 'l5', von: 'k2', vonPort: 'aus', nach: 'p1', nachPort: 'ein' },
    { id: 'l6', von: 'p1', vonPort: 'frei', nach: 's', nachPort: 'ein' },
    { id: 'l7', von: 'p1', vonPort: 'zurueck', nach: 'k2', nachPort: 'ein' },
  ],
} as const;

test.describe('Die Schmiede', () => {
  test('verweigert sich, solange keine SCHMIEDE im Werk steht', async ({ page }) => {
    const s = await oeffne(page);
    const auf = await page.evaluate(() => {
      const g = window.__spiel!;
      g.ladeLevel('I-1');
      g.ladeReferenz(0);
      return g.oeffneSchmiede();
    });
    expect(auf, 'Ohne SCHMIEDE darf sich die Werkbank nicht öffnen').toBe(false);
    await pruefeSauberkeit(s);
  });

  test('sucht, schlägt Anlagen vor und hält, was sie anzeigt', async ({ page }) => {
    const s = await oeffne(page);

    await page.evaluate((werk) => {
      const g = window.__spiel!;
      g.ladeLevel('I-1');
      g.ladeWerk(werk as never);
    }, WERK);

    expect(await page.evaluate(() => window.__spiel!.oeffneSchmiede())).toBe(true);
    const werkbank = page.locator('.blatt.schmiede');
    await expect(werkbank).toBeVisible();

    // Ohne gesetztes Ziel darf nicht gesucht werden — und das Spiel muss
    // sagen, warum. Eine Suche ohne Maßstab findet alles gleich gut.
    await werkbank.getByRole('button', { name: 'Suche starten' }).click();
    await expect(page.locator('#meldung')).toContainText('Maßstab');
    await expect(werkbank.locator('table')).toHaveCount(0);

    // Ein Ziel setzen: Token je Auftrag runter.
    await werkbank.getByRole('button', { name: /Token je Auftrag/ }).click();
    await expect(werkbank.getByRole('button', { name: /Token je Auftrag/ })).toHaveAttribute(
      'aria-pressed',
      'true'
    );

    await werkbank.getByRole('button', { name: 'Suche starten' }).click();
    await expect(werkbank.locator('table')).toBeVisible({ timeout: 60_000 });
    const zeilen = werkbank.locator('table tr');
    // Kopfzeile, Ausgangszeile und mindestens ein Fund.
    expect(await zeilen.count()).toBeGreaterThanOrEqual(3);

    /*
     * Die harte Zusicherung: Was in der Tabelle steht, kommt auch heraus.
     *
     * Die Werkbank zeigt Kennzahlen, die sie aus der Suche hat. Übernimmt man
     * die Anlage und lässt sie laufen, muss dasselbe herauskommen — sonst
     * wäre die Auswahl eine Illusion.
     */
    const angezeigt = await werkbank
      .locator('table tr:not(.ausgang) td.zahl')
      .nth(0)
      .textContent();

    await werkbank.getByRole('button', { name: 'übernehmen' }).first().click();
    // Der Schleier wird versteckt, nicht geleert — das Blatt bleibt im DOM.
    await expect(werkbank).toBeHidden();

    const gemessen = await page.evaluate(() => {
      const g = window.__spiel!;
      g.starteSimulation();
      g.laufeDurch();
      return g.metriken()['kostenJeAuftrag'];
    });

    const erwartet = Number((angezeigt ?? '').replace(/\./g, '').replace(',', '.'));
    expect(Number.isFinite(erwartet), `Unlesbare Anzeige: "${angezeigt}"`).toBe(true);
    expect(
      Math.abs(Math.round(gemessen ?? 0) - erwartet),
      `Werkbank zeigte ${erwartet}, gemessen wurden ${gemessen}`
    ).toBeLessThanOrEqual(1);

    await pruefeSauberkeit(s);
  });

  test('liefert bei gleicher Einrichtung zweimal dieselbe Auswahl', async ({ page }) => {
    const s = await oeffne(page);

    const lauf = async (): Promise<string> => {
      return page.evaluate((werk) => {
        const g = window.__spiel!;
        g.ladeLevel('I-1');
        g.ladeWerk(werk as never);
        g.oeffneSchmiede();
        const bank = document.querySelector('.blatt.schmiede')!;
        const ziel = [...bank.querySelectorAll('button')].find((b) =>
          (b.textContent ?? '').includes('Token je Auftrag')
        )!;
        ziel.click();
        const suchen = [...document.querySelectorAll('.blatt.schmiede button')].find(
          (b) => (b.textContent ?? '').trim() === 'Suche starten'
        ) as HTMLButtonElement;
        suchen.click();
        return [...document.querySelectorAll('.blatt.schmiede table td.zahl')]
          .map((t) => t.textContent)
          .join('|');
      }, WERK);
    };

    const a = await lauf();
    const b = await lauf();
    expect(a.length, 'Die Suche hat keine Tabelle erzeugt').toBeGreaterThan(0);
    expect(b).toBe(a);

    await pruefeSauberkeit(s);
  });
});
