/**
 * Prüft die Schmiede.
 *
 * Eine evolutionäre Suche ist die undankbarste Sorte Code für Tests: Sie ist
 * per Konstruktion stochastisch, sie liefert selten dasselbe zweimal, und
 * „hat etwas Besseres gefunden" ist keine Zusicherung, sondern eine Hoffnung.
 *
 * Deshalb prüft diese Datei drei Klassen von Aussagen, und nur die:
 *
 *  1. **Determinismus.** Zwei Läufe mit derselben Saat sind bitgleich, zwei
 *     mit verschiedener Saat nicht. Ohne das ist alles Weitere wertlos.
 *  2. **Algorithmische Eigenschaften.** Constrained dominance ordnet richtig,
 *     Mutation bleibt im Suchraum, Elitismus verliert nie den Besten, die
 *     Pareto-Front enthält keine dominierte Lösung. Das sind Beweise, keine
 *     Messungen.
 *  3. **Didaktische Zusicherungen.** Die Suche findet auf einer Aufgabe mit
 *     bekannter Lösung tatsächlich etwas mindestens so Gutes wie der
 *     Ausgangsbau — und sie meldet Reward Hacking, wenn es auftritt.
 */

import { describe, expect, it } from 'vitest';
import {
  bewerteGenotyp,
  erkenneAusnutzung,
  evolviere,
  genotypSchluessel,
  genotypVon,
  laufPruefsumme,
  mutiere,
  paretoFront,
  vergleicheDeb,
  wendeAn,
  type Bewertet,
  type EvoAufgabe,
} from '../../src/sim/evolution';
import { reihe } from '../../src/inhalt/bauhilfe';
import type { AuftragsStrom, Metriken } from '../../src/sim/typen';

const STROM: AuftragsStrom = {
  anzahl: 24,
  takt: 2,
  domaenen: ['text', 'technik', 'finanz'],
  schwierigkeit: [0.15, 0.6],
  mehrdeutigkeit: [0.05, 0.35],
};

/** Eine Kette mit echtem Suchraum: zwei Kerne, eine Weiche, eine Prüferin. */
function werkstueck() {
  return reihe([
    { art: 'weiche', param: { kriterium: 'schwierigkeit', schwelle: 0.5 } },
    { art: 'kern', param: { groesse: 'kondor' } },
    { art: 'pruefer', param: { schwelle: 0.5, runden: 2 } },
  ]);
}

function aufgabe(zusatz: Partial<EvoAufgabe> = {}): EvoAufgabe {
  return {
    werk: werkstueck(),
    strom: STROM,
    saat: 4711,
    ziele: [{ metrik: 'kostenJeAuftrag', richtung: 'klein' }],
    einstellungen: { population: 12, generationen: 6, inseln: 2, budget: 200 },
    ...zusatz,
  };
}

describe('Genotyp', () => {
  it('liest je Modul die veränderlichen Felder aus', () => {
    const g = genotypVon(werkstueck());
    const felder = g.gene.map((x) => `${x.feld}`).sort();
    expect(felder).toContain('groesse');
    expect(felder).toContain('kriterium');
    expect(felder).toContain('runden');
    expect(g.gene.length).toBeGreaterThanOrEqual(6);
  });

  it('gibt jedem Gen einen gültigen Index in seinen Wertebereich', () => {
    for (const gen of genotypVon(werkstueck()).gene) {
      expect(gen.index).toBeGreaterThanOrEqual(0);
      expect(gen.index).toBeLessThan(gen.werte.length);
    }
  });

  it('schreibt einen Genotyp verlustfrei ins Werk zurück', () => {
    const werk = werkstueck();
    const g = genotypVon(werk);
    const zurueck = genotypVon(wendeAn(werk, g));
    expect(genotypSchluessel(zurueck)).toBe(genotypSchluessel(g));
  });

  it('lässt die Verdrahtung unangetastet', () => {
    const werk = werkstueck();
    const neu = wendeAn(werk, genotypVon(werk));
    expect(neu.leitungen).toEqual(werk.leitungen);
    expect(neu.module.map((m) => m.id)).toEqual(werk.module.map((m) => m.id));
  });

  it('ist unabhängig von der Reihenfolge der Module im Werk', () => {
    const werk = werkstueck();
    const gedreht = { module: [...werk.module].reverse(), leitungen: werk.leitungen };
    expect(genotypSchluessel(genotypVon(gedreht))).toBe(genotypSchluessel(genotypVon(werk)));
  });
});

describe('Mutation', () => {
  it('bleibt immer im Suchraum', () => {
    const basis = genotypVon(werkstueck());
    for (const op of ['blind', 'reflektor'] as const) {
      for (let k = 0; k < 60; k++) {
        for (const gen of mutiere(basis, 1, op, 99, 0, k, k).gene) {
          expect(gen.index).toBeGreaterThanOrEqual(0);
          expect(gen.index).toBeLessThan(gen.werte.length);
        }
      }
    }
  });

  it('ändert bei Rate 0 nichts', () => {
    const basis = genotypVon(werkstueck());
    expect(genotypSchluessel(mutiere(basis, 0, 'blind', 7, 0, 0, 0))).toBe(genotypSchluessel(basis));
  });

  it('verschiebt den Reflektor höchstens um einen Schritt je Gen', () => {
    const basis = genotypVon(werkstueck());
    const neu = mutiere(basis, 1, 'reflektor', 7, 0, 0, 0);
    for (let i = 0; i < basis.gene.length; i++) {
      expect(Math.abs(neu.gene[i]!.index - basis.gene[i]!.index)).toBeLessThanOrEqual(1);
    }
  });

  it('ist deterministisch', () => {
    const basis = genotypVon(werkstueck());
    const a = mutiere(basis, 0.5, 'blind', 7, 1, 2, 3);
    const b = mutiere(basis, 0.5, 'blind', 7, 1, 2, 3);
    expect(genotypSchluessel(a)).toBe(genotypSchluessel(b));
  });
});

describe('Constrained Dominance nach Deb', () => {
  const mach = (fitness: number, verletzung: number, schluessel: string): Bewertet =>
    ({ fitness, verletzung, schluessel, genotyp: { gene: [] }, metriken: {} as Metriken, verhalten: [0, 0] });

  it('lässt jede zulässige Lösung jede unzulässige schlagen', () => {
    // Auch dann, wenn die unzulässige um Größenordnungen besser aussieht.
    expect(vergleicheDeb(mach(0.9, 0, 'a'), mach(0.01, 0.001, 'b'))).toBeLessThan(0);
  });

  it('entscheidet unter unzulässigen nach der Verletzungssumme', () => {
    expect(vergleicheDeb(mach(0.9, 0.1, 'a'), mach(0.1, 0.4, 'b'))).toBeLessThan(0);
  });

  it('entscheidet unter zulässigen nach der Fitness', () => {
    expect(vergleicheDeb(mach(0.1, 0, 'a'), mach(0.2, 0, 'b'))).toBeLessThan(0);
  });

  it('bricht Gleichstand stabil über den Genotyp-Schlüssel', () => {
    expect(vergleicheDeb(mach(0.1, 0, 'a'), mach(0.1, 0, 'b'))).toBeLessThan(0);
    expect(vergleicheDeb(mach(0.1, 0, 'b'), mach(0.1, 0, 'a'))).toBeGreaterThan(0);
  });
});

describe('Suche', () => {
  it('liefert bei gleicher Saat bitgleich dasselbe Ergebnis', () => {
    const a = evolviere(aufgabe());
    const b = evolviere(aufgabe());
    expect(laufPruefsumme(a)).toBe(laufPruefsumme(b));
    expect(a.bester.schluessel).toBe(b.bester.schluessel);
  });

  it('liefert bei anderer Saat ein anderes Ergebnis', () => {
    const a = evolviere(aufgabe());
    const b = evolviere(aufgabe({ saat: 4712 }));
    expect(laufPruefsumme(a)).not.toBe(laufPruefsumme(b));
  });

  it('hält das Auswertungsbudget ein', () => {
    const e = evolviere(aufgabe({ einstellungen: { population: 12, generationen: 99, inseln: 2, budget: 40 } }));
    expect(e.auswertungen).toBeLessThanOrEqual(60);
    expect(e.budgetErschoepft).toBe(true);
  });

  it('wird nie schlechter als der Ausgangsbau', () => {
    /*
     * Das ist die wichtigste Zusicherung des ganzen Akts. Eine Suche, die das
     * Werk der Spielerin verschlimmbessern kann, lehrt Misstrauen gegen ein
     * Werkzeug, das in Wirklichkeit funktioniert — und Misstrauen ist genau
     * die Haltung, die dieses Spiel abbauen soll.
     */
    const a = aufgabe();
    const start = bewerteGenotyp(a.werk, a.strom, a.saat, genotypVon(a.werk), a.ziele, []);
    const e = evolviere(a);
    expect(vergleicheDeb(e.bester, start)).toBeLessThanOrEqual(0);
  });

  it('führt einen Verlauf mit Vielfalt je Generation', () => {
    const e = evolviere(aufgabe());
    expect(e.verlauf.length).toBeGreaterThan(0);
    for (const v of e.verlauf) {
      expect(v.vielfalt).toBeGreaterThan(0);
      expect(v.auswertungen).toBeGreaterThanOrEqual(0);
    }
  });

  it('warnt, wenn der Elitismus die Suche einfriert', () => {
    const e = evolviere(aufgabe({ einstellungen: { population: 12, elitismus: 6, generationen: 4, inseln: 1 } }));
    expect(e.warnungen.join(' ')).toMatch(/friert ein/);
  });

  it('meldet, wenn keine einzige Lösung die Bedingungen erfüllt', () => {
    const e = evolviere(
      aufgabe({
        bedingungen: [{ metrik: 'guete', vergleich: 'min', wert: 2, text: 'unerfüllbar' }],
      })
    );
    expect(e.front).toEqual([]);
    expect(e.warnungen.join(' ')).toMatch(/zulässige Lösung/);
  });

  it('nimmt eine harte Bedingung ernst, statt sie zu verrechnen', () => {
    /*
     * Der Kern der Deb-Regel: Sobald es überhaupt eine zulässige Lösung gibt,
     * darf keine unzulässige gewinnen — egal wie billig sie ist.
     */
    const e = evolviere(
      aufgabe({
        ziele: [{ metrik: 'kostenJeAuftrag', richtung: 'klein' }],
        bedingungen: [{ metrik: 'durchsatz', vergleich: 'min', wert: 0.9, text: 'fast alles ausliefern' }],
      })
    );
    if (e.front.length > 0) expect(e.bester.verletzung).toBe(0);
  });

  it('kommt mit einem Werk ohne veränderliche Parameter zurecht', () => {
    const e = evolviere(aufgabe({ werk: reihe([]) }));
    expect(e.auswertungen).toBe(1);
    expect(e.warnungen.join(' ')).toMatch(/nichts zu suchen/);
  });

  it('legt ein Archiv nur mit zulässigen Individuen an', () => {
    const e = evolviere(aufgabe());
    for (const z of e.archiv) expect(z.eintrag.verletzung).toBe(0);
  });

  it('hält jede Verhaltenszelle höchstens einmal besetzt', () => {
    const e = evolviere(aufgabe());
    const zellen = e.archiv.map((z) => `${z.x}:${z.y}`);
    expect(new Set(zellen).size).toBe(zellen.length);
  });
});

describe('Pareto-Front', () => {
  it('enthält keine dominierte Lösung', () => {
    const ziele = [
      { metrik: 'kostenJeAuftrag', richtung: 'klein' },
      { metrik: 'guete', richtung: 'gross' },
    ] as const;
    const e = evolviere(aufgabe({ ziele: [...ziele] }));
    for (const a of e.front) {
      for (const b of e.front) {
        if (a === b) continue;
        const besser =
          b.metriken.kostenJeAuftrag <= a.metriken.kostenJeAuftrag && b.metriken.guete >= a.metriken.guete;
        const echt =
          b.metriken.kostenJeAuftrag < a.metriken.kostenJeAuftrag || b.metriken.guete > a.metriken.guete;
        expect(besser && echt, `${b.schluessel} dominiert ${a.schluessel} in der Front`).toBe(false);
      }
    }
  });

  it('ist bei einem einzelnen Ziel höchstens eine Handvoll gleichwertiger Lösungen', () => {
    const e = evolviere(aufgabe());
    const beste = e.front[0];
    if (beste) {
      for (const b of e.front) expect(b.metriken.kostenJeAuftrag).toBeCloseTo(beste.metriken.kostenJeAuftrag, 6);
    }
  });

  it('rechnet die Ziele niemals zu einer Zahl zusammen', () => {
    // Der Nachweis: Bei zwei gegenläufigen Zielen bleibt mehr als ein
    // Individuum stehen. Eine Summe hätte genau einen Sieger.
    const e = evolviere(
      aufgabe({
        ziele: [
          { metrik: 'kostenJeAuftrag', richtung: 'klein' },
          { metrik: 'guete', richtung: 'gross' },
        ],
        einstellungen: { population: 16, generationen: 8, inseln: 2, budget: 300 },
      })
    );
    expect(e.front.length).toBeGreaterThan(1);
  });
});

describe('Reward Hacking', () => {
  const grund: Metriken = {
    durchsatz: 1,
    guete: 0.7,
    kosten: 20_000,
    kostenJeAuftrag: 800,
    latenzP50: 8,
    latenzP95: 14,
    sicherheit: 1,
    nachvollziehbarkeit: 1,
    konformitaet: 1,
    belegquote: 1,
    dauer: 100,
    flaeche: 5,
    geliefert: 24,
    verworfen: 0,
    lecks: 0,
  };
  const mit = (aenderung: Partial<Metriken>): Bewertet => ({
    genotyp: { gene: [] },
    metriken: { ...grund, ...aenderung },
    fitness: 0,
    verletzung: 0,
    verhalten: [0, 0],
    schluessel: 'x',
  });

  it('meldet gekaufte Güte', () => {
    const h = erkenneAusnutzung(mit({ kostenJeAuftrag: 2400, guete: 0.72 }), grund);
    expect(h.join(' ')).toMatch(/Kennzahl/);
  });

  it('meldet erkaufte Latenz', () => {
    expect(erkenneAusnutzung(mit({ latenzP95: 40, guete: 0.71 }), grund).join(' ')).toMatch(/Latenz/);
  });

  it('meldet Güte, die aus Verwerfen kommt', () => {
    const h = erkenneAusnutzung(mit({ verworfen: 9, guete: 0.88 }), grund);
    expect(h.join(' ')).toMatch(/verworfen/);
  });

  it('schweigt bei einer ehrlichen Verbesserung', () => {
    expect(erkenneAusnutzung(mit({ kostenJeAuftrag: 500, guete: 0.74 }), grund)).toEqual([]);
  });
});
