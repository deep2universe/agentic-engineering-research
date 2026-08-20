/* TEMPORAeR — Messwerkzeug fuer Akt VIII. Wird vor der Abgabe geloescht. */
import { it } from 'vitest';
import { simuliere } from '../../src/sim/simulation';
import type { AuftragsStrom, Werk } from '../../src/sim/typen';
import { AKT_8 } from '../../src/inhalt/akt_08';

function mess(werk: Werk, strom: AuftragsStrom, saat: number) {
  return simuliere({ werk, strom, saat }).metriken;
}

const BEREICHE: readonly (readonly [number, number])[] = [
  [0.15, 0.85],
  [0.2, 0.8],
  [0.1, 0.9],
  [0.25, 0.75],
  [0.2, 0.9],
  [0.15, 0.75],
  [0.3, 0.85],
  [0.12, 0.8],
];

it('scan VIII-1 schwierigkeit', () => {
  const l = AKT_8[1]!;
  const zeilen: string[] = ['### VIII-1 Schwierigkeitsbereiche'];
  for (const bereich of BEREICHE) {
    for (const anzahl of [24, 28, 30, 32]) {
      const strom: AuftragsStrom = { ...l.strom, anzahl, anteilGiftig: 0.35, schwierigkeit: bereich };
      const teile: string[] = [];
      for (const x of l.referenzen) {
        const m = mess(x.werk, strom, l.saat);
        teile.push(`${x.name.slice(0, 8)} L${m.lecks} G${m.guete.toFixed(2)} T${Math.round(m.kosten)} p95 ${m.latenzP95}`);
      }
      for (const a of l.antiMuster) {
        const m = mess(a.werk, strom, l.saat);
        teile.push(`${a.name.slice(0, 8)} L${m.lecks} G${m.guete.toFixed(2)} T${Math.round(m.kosten)}`);
      }
      zeilen.push(`[${bereich[0]},${bereich[1]}] n${anzahl}  ` + teile.join(' | '));
    }
  }
  // eslint-disable-next-line no-console
  console.log(zeilen.join('\n'));
});
