/**
 * AUTOPLAY — das Spiel spielt sich selbst.
 *
 * Für jedes Level der Kampagne wird die Referenzlösung im echten Browser
 * gebaut, die Simulation gefahren und das Ergebnis geprüft. Damit ist belegt,
 * dass die Kampagne nicht nur in Node rechnet, sondern im ausgelieferten Spiel
 * auch tatsächlich spielbar ist.
 *
 * Zusätzlich läuft in derselben Sitzung der wichtigste Determinismus-Nachweis
 * des Projekts: die Zustands-Prüfsumme aus dem Browser muss Zeichen für Zeichen
 * der aus Node entsprechen. Weicht sie ab, ist Nichtdeterminismus aus Renderer,
 * DOM oder Map-Iteration in die Simulation geleckt.
 */

import { expect, test } from '@playwright/test';
import { oeffne, pruefeNichtSchwarz, pruefeSauberkeit, spieleReferenz } from './hilfe';
import { ALLE_LEVEL } from '../../src/inhalt/kampagne';
import { simuliere } from '../../src/sim/simulation';
import { bewerte } from '../../src/sim/ziele';

test.describe('Autoplay der Kampagne', () => {
  test('startet, rendert und stellt die Debug-Schnittstelle bereit', async ({ page }) => {
    const s = await oeffne(page);
    const info = await page.evaluate(() => {
      window.__spiel!.frameSchritt(3);
      return window.__spiel!.rendererInfo();
    });
    expect(['webgl2', 'webgpu']).toContain(info.backend);
    await pruefeNichtSchwarz(page);
    await pruefeSauberkeit(s);
  });

  test('spielt jedes Level mit seiner Referenzlösung erfolgreich durch', async ({ page }) => {
    test.setTimeout(15 * 60_000);
    const s = await oeffne(page);
    const misserfolge: string[] = [];

    for (const level of ALLE_LEVEL) {
      const ergebnis = await spieleReferenz(page, level.id);
      if (!ergebnis.bestanden) {
        misserfolge.push(
          `${level.id} (${level.titel}): Güte ${(ergebnis.metriken['guete'] ?? 0).toFixed(3)}, ` +
            `Token ${Math.round(ergebnis.metriken['kosten'] ?? 0)}, p95 ${ergebnis.metriken['latenzP95']}`
        );
      }
    }

    expect(misserfolge, `Diese Level bestehen im Browser nicht:\n  ${misserfolge.join('\n  ')}`).toEqual([]);
    await pruefeSauberkeit(s);
  });

  test('liefert im Browser bitgleich dieselbe Simulation wie in Node', async ({ page }) => {
    test.setTimeout(15 * 60_000);
    const s = await oeffne(page);
    const abweichungen: string[] = [];

    for (const level of ALLE_LEVEL) {
      const imBrowser = await spieleReferenz(page, level.id);
      const referenz = level.referenzen[0]!;
      const inNode = simuliere({ werk: referenz.werk, strom: level.strom, saat: level.saat });

      if (imBrowser.hash !== inNode.pruefsumme) {
        abweichungen.push(`${level.id}: Browser ${imBrowser.hash} vs. Node ${inNode.pruefsumme}`);
        continue;
      }
      const nodeBewertung = bewerte(level.ziele, level.budget, inNode.metriken);
      if (nodeBewertung.bestanden !== imBrowser.bestanden) {
        abweichungen.push(`${level.id}: Bewertung weicht ab`);
      }
    }

    expect(
      abweichungen,
      `Die Simulation läuft nicht überall gleich. Das ist immer ein echter Fehler,\n` +
        `niemals ein Wackler:\n  ${abweichungen.join('\n  ')}`
    ).toEqual([]);
    await pruefeSauberkeit(s);
  });

  test('kommt bei gleichem Ablauf in zwei frischen Kontexten zum selben Ergebnis', async ({ browser }) => {
    const level = ALLE_LEVEL[0]!;
    const hashes: string[] = [];
    for (let i = 0; i < 2; i++) {
      const kontext = await browser.newContext({ viewport: { width: 1280, height: 720 } });
      const seite = await kontext.newPage();
      await oeffne(seite);
      const e = await spieleReferenz(seite, level.id);
      hashes.push(e.hash);
      await kontext.close();
    }
    expect(hashes[0]).toBe(hashes[1]);
  });
});

test.describe('Bauen im Browser', () => {
  test('setzt Module, verdrahtet sie und liefert Aufträge aus', async ({ page }) => {
    const s = await oeffne(page);

    const ergebnis = await page.evaluate(() => {
      const g = window.__spiel!;
      g.ladeLevel('I-0');
      const kern = g.setzeModul('kern', 6, 5, { groesse: 'reiher' });
      if (kern === null) throw new Error('Der Kern liess sich nicht setzen');
      const okA = g.verbinde('q', 'aus', kern, 'ein');
      const okB = g.verbinde(kern, 'aus', 's', 'ein');
      g.starteSimulation();
      g.laufeDurch();
      return { okA, okB, befunde: g.befunde(), metriken: g.metriken(), bewertung: g.bewertung() };
    });

    expect(ergebnis.okA && ergebnis.okB, 'Die Leitungen liessen sich nicht legen').toBe(true);
    expect(ergebnis.befunde.filter((b) => b.stufe === 'fehler')).toEqual([]);
    expect(ergebnis.metriken['geliefert']).toBeGreaterThan(0);
    expect(ergebnis.bewertung.bestanden).toBe(true);
    await pruefeSauberkeit(s);
  });

  test('verweigert unsinnige Bauaktionen mit einer Begründung', async ({ page }) => {
    const s = await oeffne(page);
    const ergebnis = await page.evaluate(() => {
      const g = window.__spiel!;
      g.ladeLevel('I-0');
      const erst = g.setzeModul('kern', 6, 5, {});
      const zweit = g.setzeModul('kern', 6, 5, {}); // Feld ist belegt
      const ausserhalb = g.setzeModul('kern', 99, 99, {});
      const selbst = erst !== null ? g.verbinde(erst, 'aus', erst, 'ein') : true;
      return { erst, zweit, ausserhalb, selbst };
    });
    expect(ergebnis.erst).not.toBeNull();
    expect(ergebnis.zweit, 'Ein belegtes Feld darf nicht doppelt bebaut werden').toBeNull();
    expect(ergebnis.ausserhalb, 'Außerhalb des Fundaments darf nichts stehen').toBeNull();
    expect(ergebnis.selbst, 'Ein Modul darf nicht auf sich selbst zeigen').toBe(false);
    await pruefeSauberkeit(s);
  });

  test('macht Bauschritte rückgängig und stellt sie wieder her', async ({ page }) => {
    const s = await oeffne(page);
    const ergebnis = await page.evaluate(() => {
      const g = window.__spiel!;
      g.ladeLevel('I-0');
      const leer = g.werkPruefsumme();
      g.setzeModul('kern', 6, 5, {});
      const gebaut = g.werkPruefsumme();
      g.befehl('rueckgaengig');
      const zurueck = g.werkPruefsumme();
      g.befehl('wiederholen');
      const wieder = g.werkPruefsumme();
      return { leer, gebaut, zurueck, wieder };
    });
    expect(ergebnis.gebaut).not.toBe(ergebnis.leer);
    expect(ergebnis.zurueck).toBe(ergebnis.leer);
    expect(ergebnis.wieder).toBe(ergebnis.gebaut);
    await pruefeSauberkeit(s);
  });
});
