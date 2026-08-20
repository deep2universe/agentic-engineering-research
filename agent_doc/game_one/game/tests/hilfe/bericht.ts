/**
 * Balance-Bericht für einen Levelsatz.
 *
 * Kein Test, sondern ein Messwerkzeug: Budgets werden aus diesen Zahlen
 * abgeleitet und niemals geraten. Jeder Akt ruft es in seiner eigenen
 * Berichtsdatei auf.
 */

import { bewerte } from '../../src/sim/ziele';
import type { LevelDefinition } from '../../src/inhalt/level_typen';
import type { Metriken } from '../../src/sim/typen';
import { messe } from './level_pruefung';

function feld(s: string | number, n: number): string {
  return String(s).padStart(n);
}

function zeile(name: string, m: Metriken, ok: boolean | null): string {
  return (
    `  ${ok === null ? ' ' : ok ? '✓' : '✗'} ${name.padEnd(28).slice(0, 28)}` +
    ` G ${feld(m.guete.toFixed(3), 5)}` +
    ` | Tok ${feld(Math.round(m.kosten), 8)}` +
    ` | T/A ${feld(Number.isFinite(m.kostenJeAuftrag) ? Math.round(m.kostenJeAuftrag) : '∞', 6)}` +
    ` | p95 ${feld(m.latenzP95, 4)}` +
    ` | M ${feld(m.flaeche, 2)}` +
    ` | D ${feld(m.durchsatz.toFixed(2), 4)}` +
    ` | S ${feld(m.sicherheit.toFixed(2), 4)}` +
    ` | N ${feld(m.nachvollziehbarkeit.toFixed(2), 4)}` +
    ` | K ${feld(m.konformitaet.toFixed(2), 4)}` +
    ` | B ${feld(m.belegquote.toFixed(2), 4)}` +
    ` | t ${feld(m.dauer, 4)}`
  );
}

/**
 * Legende: ✓ bei Referenzen heißt "besteht", ✓ bei Anti-Mustern heißt
 * "fällt korrekt durch". ✗ ist jeweils das Gegenteil und muss behoben werden.
 */
export function druckeBericht(titel: string, level: readonly LevelDefinition[]): void {
  const zeilen: string[] = ['', '='.repeat(152), titel, '='.repeat(152)];
  for (const l of level) {
    const b = l.budget;
    const budgets = [
      b.kosten !== undefined ? `Token ≤ ${b.kosten}` : null,
      b.latenz !== undefined ? `p95 ≤ ${b.latenz}` : null,
      b.module !== undefined ? `Module ≤ ${b.module}` : null,
      b.dauer !== undefined ? `Dauer ≤ ${b.dauer}` : null,
    ]
      .filter(Boolean)
      .join(' · ');
    zeilen.push(`\n${l.id}  ${l.titel}  —  ${budgets || 'kein Budget'}`);
    zeilen.push(`     Pflicht: ${l.ziele.filter((z) => !z.optional).map((z) => z.text).join(' / ')}`);
    const kuer = l.ziele.filter((z) => z.optional);
    if (kuer.length) zeilen.push(`     Kuer:    ${kuer.map((z) => z.text).join(' / ')}`);
    for (const r of l.referenzen) {
      const m = messe(l, r.werk);
      zeilen.push(zeile(`REF  ${r.name}`, m, bewerte(l.ziele, l.budget, m).bestanden));
    }
    for (const a of l.antiMuster) {
      const m = messe(l, a.werk);
      zeilen.push(zeile(`ANTI ${a.name}`, m, !bewerte(l.ziele, l.budget, m).bestanden));
    }
    if (l.monolith) zeilen.push(zeile('MONOLITH', messe(l, l.monolith), null));
  }
  zeilen.push('', '='.repeat(152));
  // eslint-disable-next-line no-console
  console.log(zeilen.join('\n'));
}
