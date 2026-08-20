/**
 * Wiederverwendbare Beweis-Maschinerie für Level-Sätze.
 *
 * Jeder Akt bringt eine eigene Testdatei mit, die diese Funktion mit seinen
 * vier Leveln aufruft. Dadurch ist jeder Akt unabhängig beweisbar und mehrere
 * Akte können parallel entstehen, ohne sich in die Quere zu kommen.
 */

import { describe, expect, it } from 'vitest';
import { simuliere } from '../../src/sim/simulation';
import { bewerte, pruefeZiel } from '../../src/sim/ziele';
import { hatFehler, pruefeWerk } from '../../src/sim/graph';
import { levelrolle } from '../../src/inhalt/level_typen';
import type { AntiMuster, LevelDefinition } from '../../src/inhalt/level_typen';
import type { Metriken, Werk } from '../../src/sim/typen';

export function messe(level: LevelDefinition, werk: Werk): Metriken {
  return simuliere({ werk, strom: level.strom, saat: level.saat }).metriken;
}

/** Scheitert das Anti-Muster genau an der vorgesehenen Stelle? */
export function scheitertRichtig(level: LevelDefinition, am: AntiMuster, m: Metriken): boolean {
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
      return ziel ? !pruefeZiel(ziel, m).erfuellt : false;
    }
  }
}

/** Dominiert `a` die Lösung `b` auf allen drei Wettbewerbsachsen? */
export function dominiert(a: Metriken, b: Metriken): boolean {
  const nieSchlechter =
    a.kostenJeAuftrag <= b.kostenJeAuftrag && a.latenzP95 <= b.latenzP95 && a.flaeche <= b.flaeche;
  const irgendwoBesser =
    a.kostenJeAuftrag < b.kostenJeAuftrag || a.latenzP95 < b.latenzP95 || a.flaeche < b.flaeche;
  return nieSchlechter && irgendwoBesser;
}

/**
 * Vollständiger Beweißatz für einen Akt. Erzeugt die vitest-Suiten.
 *
 * @param aktName      Anzeigename, z. B. "Akt II — Die Weiche"
 * @param level        Die vier Level des Akts
 * @param vorgänger   Referenzlösung des Vorgängerlevels, die das TEN-Level
 *                     nachweislich brechen muss (Produktions-Bibel 5.3).
 */
export function pruefeAkt(
  aktName: string,
  level: readonly LevelDefinition[],
  vorgaenger?: { werk: Werk; name: string }
): void {
  describe(aktName, () => {
    it('besteht aus vier Leveln im Kishotenketsu-Rhythmus', () => {
      expect(level.length).toBe(4);
      expect(level.map((l) => levelrolle(l.nummer))).toEqual(['ki', 'sho', 'ten', 'ketsu']);
      expect(new Set(level.map((l) => l.akt)).size).toBe(1);
    });

    it('führt genau eine neue Modulart ein', () => {
      // Über den Akt hinweg darf die Modulliste nur wachsen, nie schrumpfen.
      for (let i = 1; i < level.length; i++) {
        const vorher = new Set(level[i - 1]!.module);
        for (const m of vorher) {
          expect(level[i]!.module, `${level[i]!.id} verliert Modulart ${m}`).toContain(m);
        }
      }
    });

    if (vorgaenger) {
      it('bricht im TEN-Level die Lösung des Vorgängerlevels', () => {
        const ten = level[2]!;
        const m = messe(ten, vorgaenger.werk);
        const b = bewerte(ten.ziele, ten.budget, m);
        expect(
          b.bestanden,
          `${ten.id}: "${vorgaenger.name}" aus dem Vorgängerlevel besteht noch immer — ` +
            `dann bricht dieses Level nichts und ist überflüssig.`
        ).toBe(false);
      });
    }

    describe.each(level.map((l) => [l.id, l] as const))('%s', (_id, l) => {
      it('ist strukturell gültig aufgebaut', () => {
        expect(l.referenzen.length).toBeGreaterThanOrEqual(1);
        for (const r of l.referenzen) {
          const befunde = pruefeWerk(r.werk);
          expect(hatFehler(befunde), `${r.name}: ${befunde.map((b) => b.text).join(' | ')}`).toBe(false);
        }
        for (const a of l.antiMuster) {
          const befunde = pruefeWerk(a.werk);
          expect(hatFehler(befunde), `${a.name}: ${befunde.map((b) => b.text).join(' | ')}`).toBe(false);
        }
      });

      it('wird von jeder Referenzlösung bestanden', () => {
        for (const r of l.referenzen) {
          const m = messe(l, r.werk);
          const b = bewerte(l.ziele, l.budget, m);
          const offen = b.staende
            .filter((s) => !s.ziel.optional && !s.erfuellt)
            .map((s) => `${s.ziel.text} (ist ${s.anzeige})`);
          expect(b.bestanden, `${l.id} / ${r.name}: ${[...offen, ...b.budgetVerstoesse].join(' | ')}`).toBe(true);
        }
      });

      it('läuft mit jeder Referenzlösung ohne Abbruch durch', () => {
        for (const r of l.referenzen) {
          const e = simuliere({ werk: r.werk, strom: l.strom, saat: l.saat });
          expect(e.abgebrochen, `${r.name}: ${e.abbruchGrund}`).toBe(false);
        }
      });

      it('liefert ohne Verdrahtung nichts aus', () => {
        const module = l.vorbau?.module ?? [];
        if (module.length === 0) return;
        const m = messe(l, { module, leitungen: [] });
        expect(m.geliefert).toBe(0);
        expect(bewerte(l.ziele, l.budget, m).bestanden).toBe(false);
      });

      it('lässt jedes Anti-Muster genau an der vorgesehenen Stelle scheitern', () => {
        expect(l.antiMuster.length, `${l.id} braucht mindestens ein Anti-Muster`).toBeGreaterThanOrEqual(1);
        for (const a of l.antiMuster) {
          const m = messe(l, a.werk);
          expect(bewerte(l.ziele, l.budget, m).bestanden, `${a.name} besteht wider Erwarten`).toBe(false);
          expect(
            scheitertRichtig(l, a, m),
            `${a.name} sollte an "${a.scheitertAn}" scheitern. Ist: Güte ${m.guete.toFixed(3)}, ` +
              `Token ${Math.round(m.kosten)}, p95 ${m.latenzP95}, Module ${m.flaeche}, Durchsatz ${m.durchsatz.toFixed(2)}, ` +
              `Sicherheit ${m.sicherheit.toFixed(2)}, Nachvollziehbarkeit ${m.nachvollziehbarkeit.toFixed(2)}`
          ).toBe(true);
        }
      });

      it('bietet ab Akt II zwei Lösungswege, von denen keiner den anderen dominiert', () => {
        if (l.akt < 2) return;
        expect(l.referenzen.length, `${l.id} braucht zwei Referenzen`).toBeGreaterThanOrEqual(2);
        const messungen = l.referenzen.map((r) => ({ name: r.name, m: messe(l, r.werk) }));
        let paar = false;
        for (let i = 0; i < messungen.length; i++) {
          for (let j = i + 1; j < messungen.length; j++) {
            const a = messungen[i]!;
            const b = messungen[j]!;
            if (!dominiert(a.m, b.m) && !dominiert(b.m, a.m)) paar = true;
          }
        }
        expect(
          paar,
          `${l.id}: alle Referenzen dominieren einander, es gibt nur einen sinnvollen Weg. ` +
            messungen
              .map((x) => `${x.name}: ${Math.round(x.m.kostenJeAuftrag)}T/A, p95 ${x.m.latenzP95}, ${x.m.flaeche} Module`)
              .join(' · ')
        ).toBe(true);
      });

      it('hält die Textbudgets und die Form der Pflichttexte ein', () => {
        expect(l.briefing.length, `${l.id} Briefing`).toBeLessThanOrEqual(900);
        expect(l.briefing.length).toBeGreaterThan(120);
        expect(l.reflexion.length, `${l.id} Reflexion`).toBeLessThanOrEqual(220);
        expect(l.reflexion.trim().endsWith('?'), `${l.id} Reflexion muss eine Frage sein`).toBe(true);
        if (l.notiz !== undefined) expect(l.notiz.length, `${l.id} Notiz`).toBeLessThanOrEqual(460);
        const punkte = l.lernziel.match(/[.!?]/g) ?? [];
        expect(punkte.length, `${l.id} Lernziel ist mehr als ein Satz`).toBeLessThanOrEqual(1);
        expect(l.quelle, l.id).toMatch(/^\d\d_[a-z_0-9]+\.md(#[a-z0-9-]+)?$/);
      });
    });
  });
}
