/* TEMPORAeR — Messwerkzeug fuer Akt VIII. Wird vor der Abgabe geloescht. */
import { it } from 'vitest';
import { simuliere } from '../../src/sim/simulation';
import type { AuftragsStrom, Werk } from '../../src/sim/typen';
import { AKT_8 } from '../../src/inhalt/akt_08';

function mess(werk: Werk, strom: AuftragsStrom, saat: number) {
  return simuliere({ werk, strom, saat }).metriken;
}

const RASTER: Record<string, { anzahl: number[]; gift: number[] }> = {
  'VIII-0': { anzahl: [14, 16, 18, 20, 22, 24, 26], gift: [0.3, 0.4, 0.5, 0.6] },
  'VIII-1': { anzahl: [20, 24, 28, 30, 32, 36], gift: [0.3, 0.4, 0.5] },
  'VIII-2': { anzahl: [40, 44, 48, 52, 56], gift: [0.5, 0.6, 0.7, 0.85] },
  'VIII-3': { anzahl: [28, 32, 36, 40], gift: [0.3, 0.4, 0.5, 0.6] },
};

it('scan lecks', () => {
  const zeilen: string[] = [];
  for (const l of AKT_8) {
    const r = RASTER[l.id]!;
    zeilen.push(`\n### ${l.id}  saat ${l.saat}`);
    for (const anzahl of r.anzahl) {
      for (const g of r.gift) {
        const strom: AuftragsStrom = { ...l.strom, anzahl, anteilGiftig: g };
        const teile: string[] = [];
        for (const x of l.referenzen) {
          const m = mess(x.werk, strom, l.saat);
          teile.push(`R:${x.name.slice(0, 10)} L${m.lecks} D${m.durchsatz.toFixed(2)} G${m.guete.toFixed(2)} T${Math.round(m.kosten)}`);
        }
        for (const a of l.antiMuster) {
          const m = mess(a.werk, strom, l.saat);
          teile.push(`A:${a.name.slice(0, 10)} L${m.lecks} D${m.durchsatz.toFixed(2)} G${m.guete.toFixed(2)} T${Math.round(m.kosten)}`);
        }
        zeilen.push(`n${String(anzahl).padStart(3)} g${g.toFixed(2)}\n     ` + teile.join('\n     '));
      }
    }
  }
  // eslint-disable-next-line no-console
  console.log(zeilen.join('\n'));
});
