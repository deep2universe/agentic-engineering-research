/**
 * SPIELBARKEIT — das Spiel wird von Hand gespielt.
 *
 * Diese Datei existiert, weil das Spiel ausgeliefert wurde, ohne dass es je
 * jemand gespielt hat. Alle anderen Browsertests setzen das Werk über
 * `window.__spiel` zusammen und prüfen danach den Simulationskern. Der rechnet
 * seit jeher richtig. Unspielbar war alles davor: die erste Kette liess sich
 * nicht schließen, die Tastatur wirkte erst nach einem Klick auf die Leinwand,
 * und ein Dutzend beworbener Tasten war nie implementiert.
 *
 * Regel für diese Datei, ohne Ausnahme: Was den Spielzustand VERÄNDERT, geht
 * durch `page.mouse` oder `page.keyboard`. Die Testschnittstelle darf lesen und
 * rechnen, niemals setzen.
 *
 * Die Bildschleife läuft dabei echt (`schleife=1`) — im Testbetrieb war sie
 * abgeschaltet, weshalb kein Test je ein laufendes Spiel gesehen hat.
 */

import { expect, test } from '@playwright/test';
import {
  betreteHalle,
  bildstatistik,
  klickeFeld,
  kontextleiste,
  oeffne,
  pruefeNichtSchwarz,
  pruefeSauberkeit,
  werkstand,
} from './hilfe';

/** Level I-0: Eingang bei (0,5), Auslieferung bei (15,5), ein Kern dazwischen. */
const QUELLE = { x: 0, z: 5 };
const SENKE = { x: 15, z: 5 };
const KERN = { x: 7, z: 5 };

test.describe('Von Hand gespielt', () => {
  test('Level I-0 lässt sich mit Maus und Tastatur gewinnen', async ({ page }) => {
    test.setTimeout(180_000);
    const s = await oeffne(page, '&schleife=1');
    await betreteHalle(page);

    // Das Spielfeld muss überhaupt sichtbar sein, bevor Bedienung Sinn ergibt.
    await pruefeNichtSchwarz(page);

    const anfang = await werkstand(page);
    expect(anfang.module, 'Eingang und Auslieferung stehen zu Beginn bereit').toEqual(
      expect.arrayContaining([`quelle@${QUELLE.x},${QUELLE.z}`, `senke@${SENKE.x},${SENKE.z}`])
    );
    expect(anfang.leitungen).toEqual([]);

    // --- Modul wählen und setzen, nur über Tastatur und Maus ---
    await page.keyboard.press('Digit1');
    await klickeFeld(page, KERN.x, KERN.z);
    const nachBau = await werkstand(page);
    expect(nachBau.module, 'Der Kern muss durch einen echten Mausklick entstehen').toContain(
      `kern@${KERN.x},${KERN.z}`
    );

    // --- Kette schließen: Eingang → Kern → Auslieferung ---
    // Genau diese Abfolge scheiterte: nach der ersten Leitung musste man das
    // Zielmodul ein zweites Mal anklicken, sonst ging es nicht weiter. Wer das
    // nicht wusste, kam über Level I-0 nicht hinaus.
    await page.keyboard.press('KeyL');
    await klickeFeld(page, QUELLE.x, QUELLE.z);
    await klickeFeld(page, KERN.x, KERN.z);
    await klickeFeld(page, SENKE.x, SENKE.z);

    const verdrahtet = await werkstand(page);
    expect(
      verdrahtet.leitungen.length,
      `Die Kette muss mit drei Klicks stehen. Stand: ${JSON.stringify(verdrahtet.leitungen)}`
    ).toBe(2);

    // --- Simulation starten, ebenfalls per Tastatur ---
    await page.keyboard.press('Space');
    await page.waitForFunction(() => window.__spiel!.phase() === 'auswertung', null, { timeout: 90_000 });

    const bewertung = await page.evaluate(() => window.__spiel!.bewertung());
    const metriken = await page.evaluate(() => window.__spiel!.metriken());
    expect(
      bewertung.bestanden,
      `Level I-0 muss von Hand bestehbar sein. Ziele: ${JSON.stringify(bewertung.ziele)}, ` +
        `geliefert ${metriken['geliefert']}, verworfen ${metriken['verworfen']}`
    ).toBe(true);

    await pruefeSauberkeit(s);
  });

  test('die Kontextleiste bewirbt nur Tasten, die es wirklich gibt', async ({ page }) => {
    const s = await oeffne(page, '&schleife=1');
    await betreteHalle(page);

    // Jede Taste, die in der Kontextleiste steht, muss eine Wirkung haben.
    // Vorher warb sie mit "Q / E Modul wählen" und "⎋ Abbrechen" — beide ohne
    // jede Bindung. Eine Leiste, die luegt, ist schlimmer als gar keine.
    await page.keyboard.press('Digit1');
    const bauen = await kontextleiste(page);
    expect(bauen, 'Im Baumodus muss die Leiste das Setzen erklären').toContain('Setzen');

    await page.keyboard.press('KeyL');
    const leitung = await kontextleiste(page);
    expect(leitung, 'Im Leitungsmodus muss die Leiste die Richtung erklären').toMatch(/Ausgang|Eingang/);

    await pruefeSauberkeit(s);
  });

  test('die Tastatur wirkt ohne vorherigen Klick auf die Leinwand', async ({ page }) => {
    const s = await oeffne(page, '&schleife=1');
    await betreteHalle(page);

    // Kein Mausklick auf die Leinwand — nur Tastatur, so wie jemand, der sie
    // bevorzugt oder benutzen muss. Vorher war das Spiel so nicht bedienbar.
    await page.keyboard.press('KeyL');
    expect(
      await kontextleiste(page),
      'L muss auch ohne vorherigen Klick in den Leitungsmodus schalten'
    ).toMatch(/Ausgang|Eingang/);

    await pruefeSauberkeit(s);
  });

  test('das Spielfeld ist hell genug, um es zu lesen', async ({ page }) => {
    const s = await oeffne(page, '&schleife=1');
    await betreteHalle(page);

    // Zahlenwerte statt Bauchgefühl: ein Bild, in dem fast nichts über der
    // Sichtbarkeitsschwelle liegt, ist auf einem gewoehnlichen Bildschirm nicht
    // lesbar — egal wie stimmungsvoll es auf dem Entwicklungsgeraet wirkt.
    const bild = await bildstatistik(page);
    expect(
      bild.mittlereHelligkeit,
      `Das Spielfeld ist zu dunkel (mittlere Helligkeit ${bild.mittlereHelligkeit.toFixed(1)} von 255)`
    ).toBeGreaterThan(28);
    expect(
      bild.anteilSichtbar,
      `Nur ${(bild.anteilSichtbar * 100).toFixed(1)} % des Bildes liegen über der Sichtbarkeitsschwelle`
    ).toBeGreaterThan(0.45);

    await pruefeSauberkeit(s);
  });
});
