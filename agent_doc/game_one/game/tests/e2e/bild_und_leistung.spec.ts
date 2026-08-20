/**
 * BILD UND LEISTUNG.
 *
 * Bildvergleiche laufen ausschließlich im Temporalmodus 'aus'. Mit temporaler
 * Akkumulation weicht jedes Bild vom vorigen ab, alle Vergleichsbilder würden
 * bei jedem Lauf auffallen, und das Team schaltet die Prüfung genervt ab — die
 * geforderte Verifikation wäre dann faktisch weg.
 *
 * Die Leistungsprüfung misst bewusst NICHT die Bildzeit: unter SwiftShader
 * schwankt sie um den Faktor drei und wäre als Merge-Blocker wertlos. Geprüft
 * werden stattdessen maschinenunabhängige Zähler (Draw Calls, Dreiecke,
 * Geometrien, Texturen) und die reine Rechenzeit der Simulation.
 */

import { expect, test } from '@playwright/test';
import { oeffne, pruefeSauberkeit, stelleBildRuhig } from './hilfe';

/** Fest eingestellte Blickpunkte, damit Vergleichsbilder vergleichbar bleiben. */
const BLICKE = [
  { name: 'uebersicht', zielX: 0, zielZ: 0, abstand: 27, gierung: -35, neigung: 52 },
  { name: 'pipeline', zielX: 0, zielZ: 0, abstand: 16, gierung: -35, neigung: 46 },
  { name: 'flach', zielX: -2, zielZ: 1, abstand: 13, gierung: -18, neigung: 26 },
] as const;

test.describe('Bildvergleich', () => {
  for (const blick of BLICKE) {
    test(`hält den Blick "${blick.name}" stabil`, async ({ page }) => {
      await oeffne(page);
      await page.evaluate(
        ({ b }) => {
          const g = window.__spiel!;
          g.ladeLevel('I-1');
          g.ladeReferenz(0);
          g.versteckeHud(true);
          g.setzeKamera(b.zielX, b.zielZ, b.abstand, b.gierung, b.neigung);
        },
        { b: blick }
      );
      await stelleBildRuhig(page);
      await page.evaluate(() => window.__spiel!.frameSchritt(3));
      await expect(page.locator('#leinwand')).toHaveScreenshot(`${blick.name}.png`);
    });
  }

  test('zeigt die Oberfläche vollständig und unverrutscht', async ({ page }) => {
    await oeffne(page);
    await page.evaluate(() => {
      const g = window.__spiel!;
      g.ladeLevel('I-1');
      g.ladeReferenz(0);
      g.setzeKamera(0, 0, 27, -35, 52);
    });
    await stelleBildRuhig(page);
    await page.evaluate(() => window.__spiel!.frameSchritt(3));
    /*
     * Deutlich strenger als die 3D-Blicke — und aus gutem Grund.
     *
     * Mit der allgemeinen Toleranz (maxDiffPixelRatio 0,004) ging eine
     * Textänderung stillschweigend durch: "Akt 1" wurde zu "Akt I", die
     * Budgetzeile wurde neu gesetzt, die Kennzahlen bekamen einen
     * Ruhezustand — und der Bildvergleich blieb grün, weil ein paar hundert
     * Pixel unter der Schwelle liegen. Ein HUD besteht aber fast nur aus
     * solchen paar hundert Pixeln. Für Schrift gilt deshalb: fast keine
     * Toleranz, gerade genug für die Kantenglättung.
     */
    await expect(page).toHaveScreenshot('oberflaeche.png', {
      fullPage: false,
      maxDiffPixelRatio: 0.0002,
    });
  });
});

test.describe('Leistungsbudgets', () => {
  test('bleibt bei den maschinenunabhängigen Zählern im Rahmen', async ({ page }) => {
    const s = await oeffne(page);
    const info = await page.evaluate(() => {
      const g = window.__spiel!;
      g.ladeLevel('I-3');
      g.ladeReferenz(0);
      g.frameSchritt(4);
      return g.rendererInfo();
    });

    // Diese Grenzen sind großzügig gesetzt, aber hart: sie fangen genau die
    // Regression ab, bei der jemand pro Modul ein eigenes Mesh anlegt.
    expect(info.drawCalls, `Zu viele Draw Calls: ${info.drawCalls}`).toBeLessThan(400);
    expect(info.dreiecke, `Zu viele Dreiecke: ${info.dreiecke}`).toBeLessThan(900_000);
    expect(info.geometrien, `Zu viele Geometrien: ${info.geometrien}`).toBeLessThan(300);
    expect(info.texturen, `Zu viele Texturen: ${info.texturen}`).toBeLessThan(80);
    await pruefeSauberkeit(s);
  });

  test('rechnet die Simulation schnell genug', async ({ page }) => {
    const s = await oeffne(page);
    const dauern: number[] = [];
    for (let i = 0; i < 5; i++) {
      const dauer = await page.evaluate(() => {
        const g = window.__spiel!;
        g.ladeLevel('I-3');
        g.ladeReferenz(0);
        g.starteSimulation();
        const t0 = performance.now();
        g.laufeDurch();
        return performance.now() - t0;
      });
      dauern.push(dauer);
    }
    dauern.sort((a, b) => a - b);
    const median = dauern[Math.floor(dauern.length / 2)]!;
    expect(median, `Ein vollständiger Levellauf dauert ${median.toFixed(0)} ms`).toBeLessThan(1500);
    await pruefeSauberkeit(s);
  });

  test('gibt beim Levelwechsel alles wieder frei', async ({ page }) => {
    const s = await oeffne(page);
    const messung = await page.evaluate(() => {
      const g = window.__spiel!;
      g.ladeLevel('I-0');
      g.frameSchritt(2);
      const vorher = g.rendererInfo();
      for (let i = 0; i < 12; i++) {
        g.ladeLevel(i % 2 === 0 ? 'I-1' : 'I-2');
        g.ladeReferenz(0);
        g.frameSchritt(1);
      }
      g.ladeLevel('I-0');
      g.frameSchritt(2);
      return { vorher, nachher: g.rendererInfo() };
    });

    // Zwölf Levelwechsel dürfen den Ressourcenstand nicht nach oben treiben.
    expect(
      messung.nachher.geometrien - messung.vorher.geometrien,
      `Geometrien wachsen: ${messung.vorher.geometrien} → ${messung.nachher.geometrien}`
    ).toBeLessThan(40);
    expect(
      messung.nachher.texturen - messung.vorher.texturen,
      `Texturen wachsen: ${messung.vorher.texturen} → ${messung.nachher.texturen}`
    ).toBeLessThan(10);
    await pruefeSauberkeit(s);
  });
});
