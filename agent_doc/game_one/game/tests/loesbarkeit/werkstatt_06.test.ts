/** Temporaeres Messwerkzeug fuer Akt VI. Wird vor der Abgabe geloescht. */
import { it } from 'vitest';
import { simuliere } from '../../src/sim/simulation';
import { bewerte } from '../../src/sim/ziele';
import { Bau } from '../../src/inhalt/bauhilfe';
import { AKT_6 } from '../../src/inhalt/akt_06';
import type { KernGroesse, SammlerModus, Werk, WerkzeugArt } from '../../src/sim/typen';

// --- Kopie des Baukastens aus akt_06.ts (identische Ids und Felder) --------

type Glied =
  | { readonly k: KernGroesse }
  | { readonly w: WerkzeugArt }
  | { readonly pruef: number; readonly runden: number; readonly zurueck: number }
  | { readonly tor: number; readonly reparatur: readonly Glied[] }
  | { readonly faecher: readonly KernGroesse[]; readonly modus: SammlerModus };

function K(k: KernGroesse): Glied {
  return { k };
}
function W(w: WerkzeugArt): Glied {
  return { w };
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
    if ('k' in g) return b.setze('kern', { groesse: g.k }, id, x, z);
    if ('w' in g) return b.setze('werkzeug', { werkzeugArt: g.w }, id, x, z);
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
    } else if ('w' in g) {
      b.verbinde(von, nach, 'ok');
      b.verbinde(von, nach, 'fehler');
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
  for (const we of [0.4, 0.45]) {
    for (const sw of [0.7, 0.75, 0.8]) {
      zeig(3, `we${we} | fa(oo,best) P(${sw},2) | r TOR(0.7)[K]`, verzweigt([W('rechner')], we, [FAECHER(['kolibri', 'kolibri'], 'bester'), P(sw, 2)], [K('reiher'), TOR(0.7, [K('kondor')])]));
      zeig(3, `we${we} | fa(oo,vers) P(${sw},2) | r TOR(0.7)[K]`, verzweigt([W('rechner')], we, [FAECHER(['kolibri', 'kolibri'], 'verschmelzen'), P(sw, 2)], [K('reiher'), TOR(0.7, [K('kondor')])]));
      zeig(3, `we${we} | fa(ooo,best) P(${sw},2) | r TOR(0.7)[K]`, verzweigt([W('rechner')], we, [FAECHER(['kolibri', 'kolibri', 'kolibri'], 'bester'), P(sw, 2)], [K('reiher'), TOR(0.7, [K('kondor')])]));
      zeig(3, `we${we} | fa(oo,best) P(${sw},2) | K`, verzweigt([W('rechner')], we, [FAECHER(['kolibri', 'kolibri'], 'bester'), P(sw, 2)], [K('kondor')]));
    }
  }
  zeig(3, 'ref A we0.4 | o P(0.75,2) | r TOR(0.7)[K]', verzweigt([W('rechner')], 0.4, [K('kolibri'), P(0.75, 2)], [K('reiher'), TOR(0.7, [K('kondor')])]));
  zeig(3, 'ref B r P(0.75,1) TOR(0.68)[K]', strasse([W('rechner'), K('reiher'), P(0.75, 1), TOR(0.68, [K('kondor')])]));
});
