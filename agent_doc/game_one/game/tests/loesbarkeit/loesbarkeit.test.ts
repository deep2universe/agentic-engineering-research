/**
 * LOESBARKEITS-BEWEISE.
 *
 * Fuer jedes Level der Kampagne wird per Code bewiesen:
 *
 *  1. Jede Referenzloesung besteht alle Pflichtziele und alle Budgets.
 *  2. Das leere Fundament liefert nichts aus.
 *  3. Jedes Anti-Muster ist lauffaehig, scheitert aber GENAU an der
 *     vorgesehenen Stelle — nicht irgendwo.
 *  4. Ab Akt II gibt es mindestens zwei strukturell verschiedene Loesungen,
 *     von denen keine die andere auf allen drei Wettbewerbsachsen dominiert.
 *     Autonomie ist damit eine verifizierte Eigenschaft, keine Behauptung.
 *  5. Jedes Level ist strukturell gueltig und laeuft ohne Abbruch.
 *
 * Ohne diese Beweise koennte ein Level existieren, das die eigene Lektion
 * widerlegt — und niemand wuerde es merken.
 */

import { describe, expect, it } from 'vitest';
import { AKTE, ALLE_LEVEL, NOETIG_JE_AKT } from '../../src/inhalt/kampagne';
import { simuliere } from '../../src/sim/simulation';
import { bewerte, pruefeZiel } from '../../src/sim/ziele';
import { hatFehler, pruefeWerk } from '../../src/sim/graph';
import { levelrolle } from '../../src/inhalt/level_typen';
import type { AntiMuster, LevelDefinition } from '../../src/inhalt/level_typen';
import type { Metriken, Werk } from '../../src/sim/typen';

function fahre(level: LevelDefinition, werk: Werk): Metriken {
  return simuliere({ werk, strom: level.strom, saat: level.saat }).metriken;
}

/** Ist das Anti-Muster genau an der vorgesehenen Stelle gescheitert? */
function scheitertRichtig(level: LevelDefinition, am: AntiMuster, m: Metriken): boolean {
  switch (am.scheitertAn) {
    case 'budget_kosten':
      return level.budget.kosten !== undefined && m.kosten > level.budget.kosten;
    case 'budget_latenz':
      return level.budget.latenz !== undefined && m.latenzP95 > level.budget.latenz;
    case 'budget_module':
      return level.budget.module !== undefined && m.flaeche > level.budget.module;
    case 'budget_dauer':
      return level.budget.dauer !== undefined && m.dauer > level.budget.dauer;
    default: {
      const ziel = level.ziele.find((z) => z.metrik === am.scheitertAn && !z.optional);
      if (!ziel) return false;
      return !pruefeZiel(ziel, m).erfuellt;
    }
  }
}

/** Dominiert a die Loesung b auf allen drei Wettbewerbsachsen? */
function dominiert(a: Metriken, b: Metriken): boolean {
  const besserOderGleich =
    a.kostenJeAuftrag <= b.kostenJeAuftrag && a.latenzP95 <= b.latenzP95 && a.flaeche <= b.flaeche;
  const echtBesser =
    a.kostenJeAuftrag < b.kostenJeAuftrag || a.latenzP95 < b.latenzP95 || a.flaeche < b.flaeche;
  return besserOderGleich && echtBesser;
}

describe('Kampagnenstruktur', () => {
  it('hat pro Akt vier Level im Kishotenketsu-Rhythmus', () => {
    for (const akt of AKTE) {
      expect(akt.level.length, `Akt ${akt.nummer}`).toBe(4);
      expect(akt.level.map((l) => levelrolle(l.nummer))).toEqual(['ki', 'sho', 'ten', 'ketsu']);
    }
  });

  it('vergibt eindeutige Level-Ids', () => {
    const ids = ALLE_LEVEL.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('laesst drei von vier Leveln zum Weiterkommen genuegen', () => {
    expect(NOETIG_JE_AKT).toBe(3);
    for (const akt of AKTE) expect(akt.level.length).toBeGreaterThanOrEqual(NOETIG_JE_AKT);
  });

  it('formuliert fuer jedes Level ein Lernziel in genau einem Satz', () => {
    for (const l of ALLE_LEVEL) {
      expect(l.lernziel.length, l.id).toBeGreaterThan(20);
      // Genau ein Satz: hoechstens ein Satzendezeichen, und zwar am Ende.
      const punkte = l.lernziel.match(/[.!?]/g) ?? [];
      expect(punkte.length, `${l.id}: "${l.lernziel}"`).toBeLessThanOrEqual(1);
    }
  });

  it('stellt in jedem Level genau eine Reflexionsfrage', () => {
    for (const l of ALLE_LEVEL) {
      expect(l.reflexion.trim().endsWith('?'), `${l.id}: "${l.reflexion}"`).toBe(true);
      expect((l.reflexion.match(/\?/g) ?? []).length, l.id).toBe(1);
    }
  });

  it('verweist jedes Level auf eine Quelle in der Forschungsablage', () => {
    for (const l of ALLE_LEVEL) expect(l.quelle, l.id).toMatch(/^\d\d_[a-z_]+\.md(#[a-z0-9-]+)?$/);
  });
});

describe.each(ALLE_LEVEL.map((l) => [l.id, l] as const))('Level %s', (_id, level) => {
  it('ist strukturell gueltig aufgebaut', () => {
    expect(level.referenzen.length).toBeGreaterThanOrEqual(1);
    for (const r of level.referenzen) {
      const befunde = pruefeWerk(r.werk);
      expect(hatFehler(befunde), `${r.name}: ${befunde.map((b) => b.text).join(' | ')}`).toBe(false);
    }
    for (const a of level.antiMuster) {
      const befunde = pruefeWerk(a.werk).filter((b) => b.code !== 'kein_ausgang');
      expect(hatFehler(befunde), `${a.name}: ${befunde.map((b) => b.text).join(' | ')}`).toBe(false);
    }
  });

  it('wird von jeder Referenzloesung bestanden', () => {
    for (const r of level.referenzen) {
      const m = fahre(level, r.werk);
      const b = bewerte(level.ziele, level.budget, m);
      const offen = b.staende.filter((s) => !s.ziel.optional && !s.erfuellt).map((s) => `${s.ziel.text} (ist ${s.anzeige})`);
      expect(
        b.bestanden,
        `${level.id} / ${r.name}: ${[...offen, ...b.budgetVerstoesse].join(' | ')}`
      ).toBe(true);
    }
  });

  it('laeuft mit jeder Referenzloesung ohne Abbruch durch', () => {
    for (const r of level.referenzen) {
      const e = simuliere({ werk: r.werk, strom: level.strom, saat: level.saat });
      expect(e.abgebrochen, `${r.name}: ${e.abbruchGrund}`).toBe(false);
    }
  });

  it('liefert auf leerem Fundament nichts aus', () => {
    const leer: Werk = { module: level.vorbau?.module ?? [], leitungen: [] };
    if (leer.module.length === 0) return;
    const m = fahre(level, leer);
    expect(m.geliefert).toBe(0);
    expect(bewerte(level.ziele, level.budget, m).bestanden).toBe(false);
  });

  it('laesst jedes Anti-Muster genau an der vorgesehenen Stelle scheitern', () => {
    for (const a of level.antiMuster) {
      const m = fahre(level, a.werk);
      expect(bewerte(level.ziele, level.budget, m).bestanden, `${a.name} besteht wider Erwarten`).toBe(false);
      expect(
        scheitertRichtig(level, a, m),
        `${a.name} sollte an "${a.scheitertAn}" scheitern, tut es aber nicht ` +
          `(Guete ${m.guete.toFixed(2)}, Kosten ${Math.round(m.kosten)}, p95 ${m.latenzP95}, Durchsatz ${m.durchsatz.toFixed(2)})`
      ).toBe(true);
    }
  });

  it('bietet ab Akt II mindestens zwei nicht-dominierte Loesungswege', () => {
    if (level.akt < 2) return;
    expect(level.referenzen.length, `${level.id} braucht zwei Referenzen`).toBeGreaterThanOrEqual(2);
    const messungen = level.referenzen.map((r) => ({ name: r.name, m: fahre(level, r.werk) }));
    let paarGefunden = false;
    for (let i = 0; i < messungen.length; i++) {
      for (let j = i + 1; j < messungen.length; j++) {
        const a = messungen[i]!;
        const b = messungen[j]!;
        if (!dominiert(a.m, b.m) && !dominiert(b.m, a.m)) paarGefunden = true;
      }
    }
    expect(
      paarGefunden,
      `${level.id}: alle Referenzen dominieren einander — es gibt nur einen sinnvollen Weg. ` +
        messungen.map((x) => `${x.name}: ${Math.round(x.m.kostenJeAuftrag)}T/${x.m.latenzP95}t/${x.m.flaeche}M`).join(' · ')
    ).toBe(true);
  });
});
