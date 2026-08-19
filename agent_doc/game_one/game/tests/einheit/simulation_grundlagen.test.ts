import { describe, expect, it } from 'vitest';
import { Simulation, simuliere } from '../../src/sim/simulation';
import { pruefeWerk, hatFehler, werkPruefsumme } from '../../src/sim/graph';
import type { AuftragsStrom, Werk } from '../../src/sim/typen';

/** Kleines Hilfsmittel: gerade Kette Quelle → Kern → Senke. */
function kette(groesse: 'kolibri' | 'reiher' | 'kondor'): Werk {
  return {
    module: [
      { id: 'q', art: 'quelle', x: 0, z: 0, param: {} },
      { id: 'k', art: 'kern', x: 2, z: 0, param: { groesse } },
      { id: 's', art: 'senke', x: 4, z: 0, param: {} },
    ],
    leitungen: [
      { id: 'l1', von: 'q', vonPort: 'aus', nach: 'k', nachPort: 'ein' },
      { id: 'l2', von: 'k', vonPort: 'aus', nach: 's', nachPort: 'ein' },
    ],
  };
}

const STROM: AuftragsStrom = {
  anzahl: 12,
  takt: 2,
  domaenen: ['technik', 'text'],
  schwierigkeit: [0.2, 0.5],
};

describe('Simulationskern', () => {
  it('liefert alle Auftraege durch eine gerade Kette aus', () => {
    const e = simuliere({ werk: kette('reiher'), strom: STROM, saat: 42 });
    expect(e.metriken.geliefert).toBe(12);
    expect(e.metriken.durchsatz).toBe(1);
    expect(e.abgebrochen).toBe(false);
  });

  it('ist bitgleich reproduzierbar', () => {
    const a = simuliere({ werk: kette('reiher'), strom: STROM, saat: 7 });
    const b = simuliere({ werk: kette('reiher'), strom: STROM, saat: 7 });
    expect(a.pruefsumme).toBe(b.pruefsumme);
    expect(a.metriken).toEqual(b.metriken);
  });

  it('haengt nicht von der Reihenfolge ab, in der Module angelegt wurden', () => {
    const w = kette('reiher');
    const gedreht: Werk = {
      module: [...w.module].reverse(),
      leitungen: [...w.leitungen].reverse(),
    };
    const a = simuliere({ werk: w, strom: STROM, saat: 9 });
    const b = simuliere({ werk: gedreht, strom: STROM, saat: 9 });
    expect(b.pruefsumme).toBe(a.pruefsumme);
    expect(werkPruefsumme(gedreht)).toBe(werkPruefsumme(w));
  });

  it('reagiert auf eine andere Saat mit anderen Ergebnissen', () => {
    const a = simuliere({ werk: kette('reiher'), strom: STROM, saat: 1 });
    const b = simuliere({ werk: kette('reiher'), strom: STROM, saat: 2 });
    expect(a.pruefsumme).not.toBe(b.pruefsumme);
  });

  it('bildet die Preisleiter 1:4:16 der Modell-Kerne ab', () => {
    const klein = simuliere({ werk: kette('kolibri'), strom: STROM, saat: 3 }).metriken;
    const mittel = simuliere({ werk: kette('reiher'), strom: STROM, saat: 3 }).metriken;
    const gross = simuliere({ werk: kette('kondor'), strom: STROM, saat: 3 }).metriken;
    expect(mittel.kosten / klein.kosten).toBeCloseTo(4, 1);
    expect(gross.kosten / klein.kosten).toBeCloseTo(16, 1);
    // Und: mehr Geld kauft mehr Guete — aber nicht unbegrenzt.
    expect(gross.guete).toBeGreaterThan(mittel.guete);
    expect(mittel.guete).toBeGreaterThan(klein.guete);
  });

  it('deckelt die Guete eines kleinen Kerns bei schweren Auftraegen', () => {
    const schwer: AuftragsStrom = { ...STROM, schwierigkeit: [0.85, 0.95] };
    const klein = simuliere({ werk: kette('kolibri'), strom: schwer, saat: 5 }).metriken;
    const gross = simuliere({ werk: kette('kondor'), strom: schwer, saat: 5 }).metriken;
    // Der kleine Kern kommt an der Kompetenzgrenze nicht ueber ein Drittel.
    expect(klein.guete).toBeLessThan(0.35);
    // Der grosse schafft deutlich mehr — aber mit EINEM Aufruf eben nicht alles.
    expect(gross.guete).toBeGreaterThan(0.6);
    expect(gross.guete).toBeLessThan(0.8);
  });

  it('belohnt eine Kette gegenueber einem einzelnen Aufruf — das ist Prompt Chaining', () => {
    const schwer: AuftragsStrom = { ...STROM, schwierigkeit: [0.85, 0.95] };
    const zweiStufen: Werk = {
      module: [
        { id: 'q', art: 'quelle', x: 0, z: 0, param: {} },
        { id: 'k1', art: 'kern', x: 2, z: 0, param: { groesse: 'kondor' } },
        { id: 'k2', art: 'kern', x: 4, z: 0, param: { groesse: 'kondor' } },
        { id: 's', art: 'senke', x: 6, z: 0, param: {} },
      ],
      leitungen: [
        { id: 'l1', von: 'q', vonPort: 'aus', nach: 'k1', nachPort: 'ein' },
        { id: 'l2', von: 'k1', vonPort: 'aus', nach: 'k2', nachPort: 'ein' },
        { id: 'l3', von: 'k2', vonPort: 'aus', nach: 's', nachPort: 'ein' },
      ],
    };
    const eins = simuliere({ werk: kette('kondor'), strom: schwer, saat: 5 }).metriken;
    const zwei = simuliere({ werk: zweiStufen, strom: schwer, saat: 5 }).metriken;
    expect(zwei.guete).toBeGreaterThan(eins.guete);
    // Aber der zweite Aufruf kostet mehr als das Doppelte — wegen des Kontexts,
    // den er mitbezahlen muss. Genau das ist die oekonomische Lektion.
    expect(zwei.kosten).toBeGreaterThan(eins.kosten * 2);
  });

  it('verwirft Pakete, wenn kein Ausgang verdrahtet ist', () => {
    const werk: Werk = {
      module: [
        { id: 'q', art: 'quelle', x: 0, z: 0, param: {} },
        { id: 'k', art: 'kern', x: 2, z: 0, param: { groesse: 'kolibri' } },
        { id: 's', art: 'senke', x: 4, z: 0, param: {} },
      ],
      leitungen: [{ id: 'l1', von: 'q', vonPort: 'aus', nach: 'k', nachPort: 'ein' }],
    };
    const e = simuliere({ werk, strom: STROM, saat: 1 });
    expect(e.metriken.geliefert).toBe(0);
    expect(e.metriken.verworfen).toBe(12);
    expect(e.pakete[0]?.fehler).toBe('kein_ausgang');
  });

  it('erkennt strukturelle Fehler im Werk', () => {
    const ohneSenke: Werk = { module: [{ id: 'q', art: 'quelle', x: 0, z: 0, param: {} }], leitungen: [] };
    const befunde = pruefeWerk(ohneSenke);
    expect(hatFehler(befunde)).toBe(true);
    expect(befunde.map((b) => b.code)).toContain('keine_senke');
  });

  it('zaehlt die Ticks und terminiert', () => {
    const sim = new Simulation({ werk: kette('kolibri'), strom: STROM, saat: 11 });
    let n = 0;
    while (!sim.fertig && n < 500) {
      sim.tick();
      n++;
    }
    expect(sim.fertig).toBe(true);
    expect(n).toBeLessThan(200);
    expect(sim.metriken().dauer).toBe(n);
  });
});
