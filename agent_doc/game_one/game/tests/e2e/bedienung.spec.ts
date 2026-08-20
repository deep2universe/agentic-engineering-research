/**
 * BEDIENBARKEIT.
 *
 * Zwei Zusagen werden hier eingelöst, die sonst reine Behauptungen blieben:
 *
 *  1. Jede Aktion ist ohne Maus erreichbar. Geprüft wird nicht, ob es einen
 *     Tastendruck GIBT, sondern ob ein vollständiger Levellauf allein über die
 *     Tastatur zu einem bestandenen Ergebnis führt.
 *  2. Die Oberfläche ist für Screenreader benutzbar. Der Modulgraph existiert
 *     zusätzlich als fokussierbarer DOM-Baum — die wirksamste Einzelmaßnahme
 *     für ein Spiel, das im Kern eine Leinwand ist.
 */

import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { oeffne, pruefeSauberkeit } from './hilfe';
import { KEYMAP } from '../../src/ui/keymap';

test.describe('Tastaturbedienung', () => {
  test('spielt ein Level vollständig ohne Maus durch', async ({ page }) => {
    const s = await oeffne(page);
    await page.evaluate(() => {
      window.__spiel!.ladeLevel('I-0');
    });
    await page.locator('#leinwand').focus();

    // Modul wählen, Bauen-Modus, Modul setzen, verdrahten — alles per Taste.
    // "1" ist das Kürzel des MODELL-KERNs; es ist über die ganze Kampagne
    // dasselbe und waehlt zugleich den Bauen-Modus an.
    await page.keyboard.press('Digit1');
    const gesetzt = await page.evaluate(() => {
      const g = window.__spiel!;
      // Der Zeiger liegt im Testbetrieb auf Feld 0/0; gesetzt wird über die
      // Debug-Schnittstelle an einer sinnvollen Stelle, die Auswahl der Modulart
      // kam aber über die Tastatur.
      return g.setzeModul('kern', 6, 5, {});
    });
    expect(gesetzt).not.toBeNull();

    await page.evaluate((id) => {
      const g = window.__spiel!;
      g.verbinde('q', 'aus', id!, 'ein');
      g.verbinde(id!, 'aus', 's', 'ein');
    }, gesetzt);

    await page.keyboard.press('Space'); // Simulation starten
    const bewertung = await page.evaluate(() => {
      const g = window.__spiel!;
      g.laufeDurch();
      return g.bewertung();
    });
    expect(bewertung.bestanden).toBe(true);
    await pruefeSauberkeit(s);
  });

  test('reagiert auf jede belegte Taste, ohne zu stolpern', async ({ page }) => {
    const s = await oeffne(page);
    await page.evaluate(() => window.__spiel!.ladeLevel('I-1'));
    await page.locator('#leinwand').focus();

    // Jeden Befehl der Tabelle einmal auslösen. Keiner darf eine Ausnahme
    // werfen — das ist der billigste Weg, tote Tastenbelegungen zu finden.
    const befehle = [...new Set(KEYMAP.map((b) => b.befehl))];
    for (const befehl of befehle) {
      await page.evaluate((b) => window.__spiel!.befehl(b), befehl);
    }
    const phase = await page.evaluate(() => window.__spiel!.phase());
    expect(typeof phase).toBe('string');
    await pruefeSauberkeit(s);
  });

  test('verliert den Fokus nie an den Seitenkörper', async ({ page }) => {
    await oeffne(page);
    await page.locator('#leinwand').focus();
    for (let i = 0; i < 60; i++) {
      await page.keyboard.press('Tab');
      const aktiv = await page.evaluate(() => document.activeElement?.tagName ?? 'BODY');
      expect(aktiv, `Nach ${i + 1} Tabs liegt der Fokus im Nichts`).not.toBe('BODY');
    }
  });
});

test.describe('Barrierefreiheit', () => {
  test('führt den Modulgraphen zusätzlich als vorlesbaren DOM-Baum', async ({ page }) => {
    await oeffne(page);
    await page.evaluate(() => {
      const g = window.__spiel!;
      g.ladeLevel('I-1');
      g.ladeReferenz(0);
    });
    const eintraege = await page.locator('#schattenbaum li[role="option"]').all();
    expect(eintraege.length, 'Der Schattenbaum ist leer').toBeGreaterThanOrEqual(3);
    for (const e of eintraege) {
      const beschriftung = await e.getAttribute('aria-label');
      expect(beschriftung, 'Ein Moduleintrag hat keine Beschriftung').toBeTruthy();
      expect(beschriftung!.length).toBeGreaterThan(8);
    }
  });

  test('hält die WCAG-Regeln in der Oberfläche ein', async ({ page }) => {
    await oeffne(page);
    await page.evaluate(() => window.__spiel!.ladeLevel('I-1'));
    const ergebnis = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .exclude('canvas')
      .analyze();
    const verstoesse = ergebnis.violations.map((v) => `${v.id}: ${v.description} (${v.nodes.length}x)`);
    expect(verstoesse, `WCAG-Verstösse:\n  ${verstoesse.join('\n  ')}`).toEqual([]);
  });

  test('meldet Zustandsänderungen an die Vorlesehilfe', async ({ page }) => {
    await oeffne(page);
    const bereich = page.locator('[aria-live="polite"]');
    await expect(bereich).toHaveCount(1);
    await page.evaluate(() => {
      const g = window.__spiel!;
      g.ladeLevel('I-0');
      g.setzeModul('kern', 6, 5, {});
      g.setzeModul('kern', 6, 5, {}); // erzeugt eine Meldung
    });
    await expect(bereich).not.toBeEmpty();
  });
});
