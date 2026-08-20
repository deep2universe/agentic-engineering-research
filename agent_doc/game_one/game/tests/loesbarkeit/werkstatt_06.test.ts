/** Temporaeres Messwerkzeug fuer Akt VI. Wird vor der Abgabe geloescht. */
import { it } from 'vitest';
import { simuliere } from '../../src/sim/simulation';
import { bewerte } from '../../src/sim/ziele';
import { Bau } from '../../src/inhalt/bauhilfe';
import { AKT_6 } from '../../src/inhalt/akt_06';
import type { AuftragsStrom, KernGroesse, SammlerModus, Werk } from '../../src/sim/typen';

// --- Kopie des Baukastens aus akt_06.ts (identische Ids und Felder) --------

type Glied =
  | { readonly k: KernGroesse; readonly spez?: 'recht' | 'analyse' | 'text' | 'finanz' | 'technik' }
  | { readonly pruef: number; readonly runden: number; readonly zurueck: number }
  | { readonly tor: number; readonly reparatur: readonly Glied[] }
  | { readonly faecher: readonly KernGroesse[]; readonly modus: SammlerModus };

function K(k: KernGroesse): Glied {
  return { k };
}
function P(pruef: number, runden: number, zurueck = 1): Glied {
  return { pruef, runden, zurueck };
}
function TOR(tor: number, reparatur: readonly Glied[]): Glied {
  return { tor, reparatur };
}
function FAECHER(faecher: readonly KernGroesse[], modus: SammlerModus): Glied {
  return { faecher, modus };
}

class Feld {
  private n = 0;
  next(): number {
    return 2 + this.n++ * 2;
  }
}

function lege(b: Bau, f: Feld, glieder: readonly Glied[], z: number, ziel: string, praefix: string): string {
  if (glieder.length === 0) return ziel;
  const ids = glieder.map((g, i) => {
    const x = f.next();
    const id = `${praefix}${i}`;
    if ('k' in g) return b.setze('kern', g.spez ? { groesse: g.k, spezialisierung: g.spez } : { groesse: g.k }, id, x, z);
    if ('pruef' in g) return b.setze('pruefer', { schwelle: g.pruef, runden: g.runden }, id, x, z);
    if ('tor' in g) return b.setze('schranke', { schwelle: g.tor }, id, x, z);
    return b.setze('verteiler', { zweige: g.faecher.length }, id, x, z);
  });
  const folge = [...ids, ziel];
  glieder.forEach((g, i) => {
    const von = ids[i]!;
    const nach = folge[i + 1]!;
    if ('k' in g) {
      b.verbinde(von, nach, 'aus');
    } else if ('pruef' in g) {
      b.verbinde(von, nach, 'frei');
      b.verbinde(von, ids[i - g.zurueck]!, 'zurueck', 'ein');
    } else if ('tor' in g) {
      const rep = lege(b, f, g.reparatur, z + 2, nach, `${praefix}${i}r`);
      b.verbinde(von, nach, 'ok');
      b.verbinde(von, rep, 'fehler');
    } else {
      const sammler = b.setze('sammler', { modus: g.modus }, `${praefix}${i}s`, f.next(), z);
      g.faecher.forEach((gr, j) => {
        const zweig = b.setze('kern', { groesse: gr }, `${praefix}${i}z${j}`, f.next(), z - 2 - j);
        b.verbinde(von, zweig, `z${j + 1}`);
        b.verbinde(zweig, sammler, 'aus');
      });
      b.verbinde(sammler, nach, 'aus');
    }
  });
  return ids[0]!;
}

function strasse(glieder: readonly Glied[]): Werk {
  const b = new Bau();
  const f = new Feld();
  const q = b.setze('quelle', {}, 'q', 0, 6);
  const erst = lege(b, f, glieder, 6, 's', 'm');
  b.setze('senke', {}, 's', f.next(), 6);
  b.verbinde(q, erst);
  return b.fertig();
}

function verzweigt(vor: readonly Glied[], schwelle: number, leicht: readonly Glied[], schwer: readonly Glied[]): Werk {
  const b = new Bau();
  const f = new Feld();
  const q = b.setze('quelle', {}, 'q', 0, 6);
  const aErst = lege(b, f, leicht, 10, 's', 'a');
  const bErst = lege(b, f, schwer, 16, 's', 'b');
  const vorErst = lege(b, f, vor, 6, 'r', 'v');
  const r = b.setze('weiche', { kriterium: 'schwierigkeit', schwelle }, 'r', f.next(), 6);
  b.setze('senke', {}, 's', f.next(), 6);
  b.verbinde(q, vorErst);
  b.verbinde(r, aErst, 'a');
  b.verbinde(r, bErst, 'b');
  return b.fertig();
}

// --- Messung --------------------------------------------------------------

function zeig(nr: number, name: string, werk: Werk): void {
  const l = AKT_6[nr]!;
  const e = simuliere({ werk, strom: l.strom, saat: l.saat });
  const m = e.metriken;
  const b = bewerte(l.ziele, l.budget, m);
  // eslint-disable-next-line no-console
  console.log(
    `${b.bestanden ? '✓' : '✗'} ${name.padEnd(34)} G ${m.guete.toFixed(3)} | Tok ${String(Math.round(m.kosten)).padStart(7)}` +
      ` | T/A ${String(Math.round(m.kostenJeAuftrag)).padStart(5)} | p95 ${String(m.latenzP95).padStart(4)}` +
      ` | M ${String(m.flaeche).padStart(2)} | t ${m.dauer}` +
      (e.abgebrochen ? ` | ABBRUCH ${e.abbruchGrund}` : '')
  );
}

it('sweep', () => {
  // eslint-disable-next-line no-console
  console.log('\n--- VI-0 ---');
  for (const sw of [0.8, 0.85, 0.9]) {
    for (const r of [2, 3, 4]) {
      zeig(0, `r + P(${sw},${r})`, strasse([K('reiher'), P(sw, r)]));
    }
  }
  for (const sw of [0.8, 0.85, 0.9]) {
    for (const r of [1, 2, 3]) {
      zeig(0, `r r + P(${sw},${r}) z1`, strasse([K('reiher'), K('reiher'), P(sw, r)]));
      zeig(0, `r r + P(${sw},${r}) z2`, strasse([K('reiher'), K('reiher'), P(sw, r, 2)]));
      zeig(0, `o r + P(${sw},${r}) z1`, strasse([K('kolibri'), K('reiher'), P(sw, r)]));
    }
  }
  zeig(0, 'chain rrr', strasse([K('reiher'), K('reiher'), K('reiher')]));
  zeig(0, 'chain rK', strasse([K('reiher'), K('kondor')]));
  zeig(0, 'chain ooK', strasse([K('kolibri'), K('kolibri'), K('kondor')]));
  zeig(0, 'chain orK', strasse([K('kolibri'), K('reiher'), K('kondor')]));
  zeig(0, 'chain KK', strasse([K('kondor'), K('kondor')]));
  zeig(0, 'chain oK', strasse([K('kolibri'), K('kondor')]));
  zeig(0, 'chain Kr', strasse([K('kondor'), K('reiher')]));

  // eslint-disable-next-line no-console
  console.log('\n--- VI-1 ---');
  for (const sw of [0.8, 0.85]) {
    for (const r of [1, 2]) {
      zeig(1, `weiche 0.45 | oo | r P(${sw},${r})`, verzweigt([], 0.45, [K('kolibri'), K('kolibri')], [K('reiher'), P(sw, r)]));
      zeig(1, `weiche 0.4 | or | r P(${sw},${r})`, verzweigt([], 0.4, [K('kolibri'), K('reiher')], [K('reiher'), P(sw, r)]));
      zeig(1, `nur r P(${sw},${r})`, strasse([K('reiher'), P(sw, r)]));
      zeig(1, `r r P(${sw},${r})`, strasse([K('reiher'), K('reiher'), P(sw, r)]));
    }
  }
  zeig(1, 'chain rr', strasse([K('reiher'), K('reiher')]));
  zeig(1, 'chain rrr', strasse([K('reiher'), K('reiher'), K('reiher')]));
  zeig(1, 'chain oo', strasse([K('kolibri'), K('kolibri')]));
  zeig(1, 'anti P(0.9,6)', strasse([K('reiher'), P(0.9, 6)]));
  zeig(1, 'anti r P K', strasse([K('reiher'), P(0.85, 2), K('kondor')]));

  // eslint-disable-next-line no-console
  console.log('\n--- VI-2 ---');
  for (const sw of [0.7, 0.74, 0.78, 0.82]) {
    for (const r of [1, 2, 3]) {
      zeig(2, `r P(${sw},${r})`, strasse([K('reiher'), P(sw, r)]));
      zeig(2, `K P(${sw + 0.15},${r})`, strasse([K('kondor'), P(sw + 0.15, r)]));
    }
  }
  zeig(2, 'chain rr', strasse([K('reiher'), K('reiher')]));
  zeig(2, 'chain rrr', strasse([K('reiher'), K('reiher'), K('reiher')]));
  zeig(2, 'chain K', strasse([K('kondor')]));
  zeig(2, 'chain rK', strasse([K('reiher'), K('kondor')]));
  zeig(2, 'chain KK', strasse([K('kondor'), K('kondor')]));
  zeig(2, 'tor r r [0.78] rep r P(0.8,1)', strasse([K('reiher'), K('reiher'), TOR(0.78, [K('reiher'), P(0.8, 1)])]));
  zeig(2, 'tor K [0.85] rep K P(0.9,1)', strasse([K('kondor'), TOR(0.85, [K('kondor'), P(0.9, 1)])]));
  zeig(2, 'tor r r [0.8] rep K', strasse([K('reiher'), K('reiher'), TOR(0.8, [K('kondor')])]));
  zeig(2, 'anti 0.95 r8', strasse([K('reiher'), P(0.95, 8)]));
  zeig(2, 'anti VI-1', verzweigt([], 0.45, [K('kolibri'), K('kolibri')], [K('reiher'), P(0.85, 2)]));

  // eslint-disable-next-line no-console
  console.log('\n--- VI-3 ---');
  zeig(3, 'weiche o | o | r P(0.82,2)', verzweigt([K('kolibri')], 0.45, [K('kolibri')], [K('reiher'), P(0.82, 2)]));
  zeig(3, 'weiche - | oo | r r P(0.82,2)', verzweigt([], 0.45, [K('kolibri'), K('kolibri')], [K('reiher'), K('reiher'), P(0.82, 2)]));
  zeig(3, 'weiche - | or | r P(0.85,2)', verzweigt([], 0.45, [K('kolibri'), K('reiher')], [K('reiher'), P(0.85, 2)]));
  zeig(3, 'faecher ooR bester + r P(0.82,1)', strasse([FAECHER(['kolibri', 'kolibri', 'reiher'], 'bester'), K('reiher'), P(0.82, 1)]));
  zeig(3, 'faecher ooo verschm + r P(0.82,1)', strasse([FAECHER(['kolibri', 'kolibri', 'kolibri'], 'verschmelzen'), K('reiher'), P(0.82, 1)]));
  zeig(3, 'faecher oo verschm + r P(0.85,2)', strasse([FAECHER(['kolibri', 'kolibri'], 'verschmelzen'), K('reiher'), P(0.85, 2)]));
  zeig(3, 'chain rr', strasse([K('reiher'), K('reiher')]));
  zeig(3, 'chain rrr', strasse([K('reiher'), K('reiher'), K('reiher')]));
  zeig(3, 'chain K', strasse([K('kondor')]));
});
