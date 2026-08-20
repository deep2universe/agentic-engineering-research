/**
 * Die Erzählung im Spielfluss.
 *
 * Alle anderen Browsertests umgehen die Erzählkanäle bewusst — `ladeLevel`
 * räumt sie weg, damit gebaut werden kann. Genau deshalb braucht es diese
 * Datei: Sie ist der einzige Ort, an dem geprüft wird, was eine Spielerin
 * tatsächlich zu sehen bekommt, wenn sie das Spiel von vorn beginnt.
 *
 * Der Ablauf, den sie festhält:
 *
 *   Akttafel (kalter Einstieg) → Auftrag → Bauen → Auswertung
 *   → beim Aktwechsel: Schlusssatz des alten Akts → nächste Akttafel
 *
 * Und die Regel, die dabei am leichtesten kaputtgeht: **Ein Einstieg läuft
 * genau einmal je Akt.** Wer ein Level zum dritten Mal versucht, will bauen,
 * nicht lesen.
 */

import { test, expect } from '@playwright/test';
import { oeffne, pruefeSauberkeit } from './hilfe';

test.describe('Erzählung im Spielfluss', () => {
  test('empfängt mit der Akttafel, nicht mit dem Auftrag', async ({ page }) => {
    const s = await oeffne(page);

    const tafel = page.locator('.blatt.akttafel');
    await expect(tafel).toBeVisible();
    await expect(tafel.locator('#akt-marke')).toHaveText('Akt I');
    await expect(tafel.locator('h1')).toHaveText('Die Kette');

    // Der Einstieg beschreibt, was zu sehen ist, und erklärt nichts. Er ist
    // deshalb lang — unter 300 Zeichen wäre es eine Überschrift.
    const text = (await tafel.locator('p.fliess').allTextContents()).join(' ');
    expect(text.length).toBeGreaterThan(300);
    expect(text).toMatch(/\bdu\b|\bdir\b|\bdein/i);

    // Kein Auftrag, solange die Tafel steht.
    await expect(page.locator('.blatt[aria-label="Auftrag"]')).toBeHidden();

    await tafel.getByRole('button', { name: 'Halle betreten' }).click();
    await expect(page.locator('.blatt[aria-label="Auftrag"]')).toBeVisible();
    await pruefeSauberkeit(s);
  });

  test('zeigt MONOLITHs Angebot im Auftrag — ohne Widerrede', async ({ page }) => {
    const s = await oeffne(page);
    await page.locator('.blatt.akttafel').getByRole('button').click();

    const auftrag = page.locator('.blatt[aria-label="Auftrag"]');
    const monolith = auftrag.locator('blockquote.monolith');
    await expect(monolith).toBeVisible();

    /*
     * Das Angebot steht bei seinen Zahlen und wird vom Spiel NICHT kommentiert.
     * Stünde eine Warnung daneben, wäre die Versuchung keine mehr — und der
     * Antagonist verkäme zum Schild "Bitte nicht anfassen".
     */
    const text = (await monolith.textContent()) ?? '';
    expect(text.length).toBeGreaterThan(60);
    expect(text).not.toMatch(/Vorsicht|Achtung|Warnung|falsch/i);

    await pruefeSauberkeit(s);
  });

  test('zeigt den kalten Einstieg genau einmal je Akt', async ({ page }) => {
    const s = await oeffne(page);
    await page.locator('.blatt.akttafel').getByRole('button').click();
    await page.locator('.blatt[aria-label="Auftrag"]').getByRole('button').click();

    // Dasselbe Level noch einmal laden — die Tafel darf nicht wiederkommen.
    await page.evaluate(() => window.__spiel!.ladeLevel('I-0'));
    await expect(page.locator('.blatt.akttafel')).toBeHidden();

    const zustand = await page.evaluate(() => window.__spiel!.erzaehlZustand());
    expect(zustand.einstiege).toEqual([1]);
    await pruefeSauberkeit(s);
  });

  test('legt für jeden Akt lesbare Fundstücke in die Halle', async ({ page }) => {
    const s = await oeffne(page);

    const zaehle = async (level: string): Promise<number> =>
      page.evaluate((id) => {
        window.__spiel!.ladeLevel(id);
        return window.__spiel!.fundstuecke().length;
      }, level);

    const frueh = await zaehle('I-0');
    const spaet = await zaehle('XII-0');

    expect(frueh, 'Akt I muss lesbare Fundstücke haben').toBeGreaterThan(0);
    // Fundstücke wachsen mit: was in Akt III dazukommt, liegt in Akt XII noch da.
    expect(spaet).toBeGreaterThan(frueh);

    await pruefeSauberkeit(s);
  });

  test('merkt sich gelesene Fundstücke über den Levelwechsel hinweg', async ({ page }) => {
    const s = await oeffne(page);

    const gelesen = await page.evaluate(() => {
      const g = window.__spiel!;
      g.ladeLevel('I-0');
      g.setzeKamera(0, 0, 30, -35, 40);
      g.frameSchritt(2);
      const ids = g.fundstuecke();
      for (const id of ids) {
        if (g.klickeFundstueck(id)) {
          g.befehl('abbrechen');
          break;
        }
      }
      g.ladeLevel('I-1');
      return g.erzaehlZustand().gelesen;
    });

    expect(gelesen.length, 'Kein Fundstück war im Bild — Kamera oder Platzierung prüfen').toBe(1);
    await pruefeSauberkeit(s);
  });

  test('legt beim Aktwechsel den Schlusssatz des alten Akts dazwischen', async ({ page }) => {
    const s = await oeffne(page);

    /*
     * Das letzte Level von Akt I wird mit seiner Referenzlösung bestanden.
     * Danach darf NICHT sofort Akt II kommen: erst steht der Satz da, der
     * beim Verlassen der Halle stehen bleibt.
     */
    await page.evaluate(() => {
      const g = window.__spiel!;
      g.ladeLevel('I-3');
      g.ladeReferenz(0);
      g.starteSimulation();
      g.laufeDurch();
    });

    const ergebnis = page.locator('.blatt').filter({ hasText: 'Auftrag erfüllt' });
    await expect(ergebnis).toBeVisible();
    await ergebnis.getByRole('button', { name: 'Weiter' }).click();

    const schluss = page.locator('.blatt.akttafel.schluss');
    await expect(schluss).toBeVisible();
    await expect(schluss.locator('#akt-marke')).toHaveText('Akt I');

    // Der Schlusssatz trägt keine Bewertung und ist kurz.
    const satz = (await schluss.locator('p.fliess').allTextContents()).join(' ');
    expect(satz.length).toBeGreaterThan(20);
    expect(satz.length).toBeLessThanOrEqual(160);

    // Danach beginnt Akt II mit seinem eigenen kalten Einstieg.
    await schluss.getByRole('button', { name: 'Weiter' }).click();
    const einstieg = page.locator('.blatt.akttafel.einstieg');
    await expect(einstieg).toBeVisible();
    await expect(einstieg.locator('#akt-marke')).toHaveText('Akt II');

    await pruefeSauberkeit(s);
  });
});
