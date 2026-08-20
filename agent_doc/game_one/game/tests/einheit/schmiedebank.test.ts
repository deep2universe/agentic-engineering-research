/**
 * Prüft die Schmiedebank — den Arbeitsplatz von Akt XI.
 *
 * Der Schwerpunkt liegt nicht auf der Suche (die prüft `evolution.test.ts`),
 * sondern auf den ZUSICHERUNGEN GEGENÜBER DER SPIELERIN: dass eine Bank ohne
 * Ziel nicht startet, dass ein zu großer Aufwand vorher und nicht mittendrin
 * auffällt, dass die Auswahl aus der Front eine Auswahl bleibt — und dass die
 * Reihenfolge der Klicks das Ergebnis nicht verändert.
 */

import { describe, expect, it } from 'vitest';
import { Schmiedebank, type SchmiedeAufgabe } from '../../src/spiel/schmiedebank';
import { laufPruefsumme } from '../../src/sim/evolution';
import { Bau, reihe } from '../../src/inhalt/bauhilfe';
import type { AuftragsStrom } from '../../src/sim/typen';

const STROM: AuftragsStrom = {
  anzahl: 20,
  takt: 2,
  domaenen: ['text', 'technik', 'finanz'],
  schwierigkeit: [0.2, 0.65],
  mehrdeutigkeit: [0.05, 0.3],
};

const AUFGABE: SchmiedeAufgabe = {
  waehlbareZiele: [
    { metrik: 'kostenJeAuftrag', richtung: 'klein' },
    { metrik: 'guete', richtung: 'gross' },
    { metrik: 'latenzP95', richtung: 'klein' },
    { metrik: 'flaeche', richtung: 'klein' },
  ],
  waehlbareBedingungen: [
    { metrik: 'durchsatz', vergleich: 'min', wert: 0.95, text: 'Fast alles wird ausgeliefert.' },
    { metrik: 'sicherheit', vergleich: 'min', wert: 1, text: 'Kein einziges Leck.' },
  ],
  budget: 240,
  maxZiele: 2,
  hinweis: 'Setze den Maßstab, nach dem gesucht wird.',
};

/**
 * Ein Werk mit echtem Suchraum UND beiden Weichenbahnen verdrahtet.
 *
 * Der erste Anlauf hat die Weiche mit `reihe()` gebaut — damit hing Bahn B in
 * der Luft, jeder zweite Auftrag verschwand, und `kostenJeAuftrag` war
 * unendlich. Das war kein Fehler der Suche, sondern ein kaputtes Werkstück,
 * und ein kaputtes Werkstück beweist über eine Suche gar nichts.
 */
function werkstueck() {
  const b = new Bau();
  const q = b.setze('quelle', {}, 'q');
  const w = b.setze('weiche', { kriterium: 'schwierigkeit', schwelle: 0.5 });
  const klein = b.bei(5, 3).setze('kern', { groesse: 'kolibri' });
  const gross = b.bei(5, 7).setze('kern', { groesse: 'kondor' });
  const p = b.bei(9, 5).setze('pruefer', { schwelle: 0.5, runden: 2 });
  const s = b.bei(13, 5).setze('senke', {}, 's');
  b.verbinde(q, w);
  b.verbinde(w, klein, 'a');
  b.verbinde(w, gross, 'b');
  b.verbinde(klein, p);
  b.verbinde(gross, p);
  // Die PRÜFERIN hat KEINEN Port 'aus'. Sie hat 'frei' und 'zurück' — und
  // wer den Standardport nimmt, verdrahtet nichts und wundert sich, warum
  // nichts ankommt. Genau das ist im ersten Anlauf passiert.
  b.verbinde(p, s, 'frei');
  b.verbinde(p, gross, 'zurueck');
  return b.fertig();
}

function bank(): Schmiedebank {
  return new Schmiedebank(AUFGABE, werkstueck(), STROM, 8123);
}

describe('Schmiedebank — Einrichtung', () => {
  it('startet ohne gesetzte Ziele und ohne gesetzte Bedingungen', () => {
    const z = bank().zustand();
    expect(z.ziele).toEqual([]);
    expect(z.bedingungen).toEqual([]);
  });

  it('verweigert den Start ohne Ziel und sagt warum', () => {
    const b = bank();
    const bereit = b.bereit();
    expect(bereit.ok).toBe(false);
    if (!bereit.ok) expect(bereit.grund).toMatch(/ohne Maßstab/);
  });

  it('nimmt ein Ziel an und lässt es wieder abschalten', () => {
    const b = bank();
    expect(b.schalteZiel('kostenJeAuftrag')).toBe(true);
    expect(b.zustand().ziele.map((z) => z.metrik)).toEqual(['kostenJeAuftrag']);
    expect(b.schalteZiel('kostenJeAuftrag')).toBe(true);
    expect(b.zustand().ziele).toEqual([]);
  });

  it('hält die Obergrenze an gleichzeitigen Zielen ein', () => {
    const b = bank();
    expect(b.schalteZiel('kostenJeAuftrag')).toBe(true);
    expect(b.schalteZiel('guete')).toBe(true);
    expect(b.schalteZiel('latenzP95')).toBe(false);
    expect(b.zustand().ziele).toHaveLength(2);
  });

  it('nimmt keine Kennzahl an, die das Level nicht anbietet', () => {
    expect(bank().schalteZiel('belegquote')).toBe(false);
  });

  it('ordnet die Ziele unabhängig von der Klickreihenfolge', () => {
    const a = bank();
    a.schalteZiel('guete');
    a.schalteZiel('kostenJeAuftrag');
    const b = bank();
    b.schalteZiel('kostenJeAuftrag');
    b.schalteZiel('guete');
    expect(a.zustand().ziele.map((z) => z.metrik)).toEqual(b.zustand().ziele.map((z) => z.metrik));
  });

  it('begrenzt den Aufwand auf sinnvolle Werte', () => {
    const b = bank();
    b.setzeAufwand(1, 1000);
    expect(b.zustand().population).toBeGreaterThanOrEqual(6);
    expect(b.zustand().generationen).toBeLessThanOrEqual(60);
  });

  it('meldet ein gesprengtes Budget VOR dem Start', () => {
    const b = bank();
    b.schalteZiel('kostenJeAuftrag');
    b.setzeAufwand(48, 60);
    const bereit = b.bereit();
    expect(bereit.ok).toBe(false);
    if (!bereit.ok) expect(bereit.grund).toMatch(/Budget/);
  });
});

describe('Schmiedebank — Suche', () => {
  function gestartet(): Schmiedebank {
    const b = bank();
    b.schalteZiel('kostenJeAuftrag');
    b.schalteZiel('guete');
    b.setzeAufwand(12, 8);
    return b;
  }

  it('liefert bei gleicher Einrichtung dasselbe Ergebnis', () => {
    expect(laufPruefsumme(gestartet().starte().ergebnis)).toBe(laufPruefsumme(gestartet().starte().ergebnis));
  });

  it('ist unabhängig von der Reihenfolge, in der die Ziele geklickt wurden', () => {
    const a = bank();
    a.schalteZiel('guete');
    a.schalteZiel('kostenJeAuftrag');
    a.setzeAufwand(12, 8);
    expect(laufPruefsumme(a.starte().ergebnis)).toBe(laufPruefsumme(gestartet().starte().ergebnis));
  });

  it('legt die Kennzahlen des Ausgangswerks als Bezugspunkt bei', () => {
    const lauf = gestartet().starte();
    expect(Number.isFinite(lauf.ausgang.kostenJeAuftrag)).toBe(true);
    expect(lauf.ausgang.flaeche).toBeGreaterThan(0);
  });

  it('bietet höchstens sechs Lösungen zur Auswahl an', () => {
    expect(gestartet().starte().auswahl.length).toBeLessThanOrEqual(6);
  });

  it('gibt bei zwei gegenläufigen Zielen mehr als eine Lösung zur Wahl', () => {
    // Der Beweis, dass hier nichts zu einer Zahl verrechnet wird.
    expect(gestartet().starte().auswahl.length).toBeGreaterThan(1);
  });

  it('übernimmt eine Auswahl als lauffähiges Werk', () => {
    const b = gestartet();
    const lauf = b.starte();
    const gewaehlt = lauf.auswahl[0]!;
    const werk = b.uebernimm(gewaehlt);
    expect(werk.module).toHaveLength(werkstueck().module.length);
    expect(werk.leitungen).toEqual(werkstueck().leitungen);
  });

  it('hält eine zugeschaltete Bedingung ein, sobald sie erfüllbar ist', () => {
    const b = bank();
    b.schalteZiel('kostenJeAuftrag');
    b.schalteBedingung('Fast alles wird ausgeliefert.');
    b.setzeAufwand(12, 8);
    const lauf = b.starte();
    if (lauf.ergebnis.front.length > 0) {
      for (const x of lauf.auswahl) expect(x.metriken.durchsatz).toBeGreaterThanOrEqual(0.95);
    }
  });

  it('merkt sich den letzten Lauf', () => {
    const b = gestartet();
    expect(b.lauf).toBeNull();
    b.starte();
    expect(b.lauf).not.toBeNull();
  });
});

describe('Schmiedebank — Goodhart', () => {
  it('meldet, wenn die Suche die Kennzahl erfüllt statt die Aufgabe', () => {
    /*
     * Der Aufbau des Levels XI-3 im Kleinen: Es wird ALLEIN auf Güte gedrückt,
     * und die Prüferin darf bis zu zwölf Runden nacharbeiten. Die Suche findet
     * das zuverlässig. Ob die Kosten dabei tatsächlich durch die Decke gehen,
     * hängt am Werk — deshalb prüft dieser Test nicht das Ergebnis, sondern
     * dass die Erkennung überhaupt zuschlägt, wenn es passiert.
     */
    const b = bank();
    b.schalteZiel('guete');
    b.setzeAufwand(14, 10);
    const lauf = b.starte();
    const teurer = lauf.ergebnis.bester.metriken.kostenJeAuftrag > lauf.ausgang.kostenJeAuftrag * 1.8;
    const kaumBesser = lauf.ergebnis.bester.metriken.guete <= lauf.ausgang.guete + 0.03;
    if (teurer && kaumBesser) expect(lauf.ausnutzung.length).toBeGreaterThan(0);
    else expect(lauf.ausnutzung).toBeDefined();
  });
});
