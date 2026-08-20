/** Temporaeres Messwerkzeug fuer Akt VII. Wird vor der Abgabe geloescht. */
import { it } from 'vitest';
import { simuliere } from '../../src/sim/simulation';
import { Bau } from '../../src/inhalt/bauhilfe';
import type {
  AuftragsStrom,
  KernGroesse,
  SpeicherModus,
  Werk,
  WerkzeugArt,
} from '../../src/sim/typen';

type Glied =
  | { readonly kern: KernGroesse }
  | { readonly speicher: SpeicherModus }
  | { readonly werkzeug: WerkzeugArt; readonly sicher?: true };

function K(g: KernGroesse): Glied {
  return { kern: g };
}
function S(m: SpeicherModus): Glied {
  return { speicher: m };
}
function W(w: WerkzeugArt): Glied {
  return { werkzeug: w };
}
function WS(w: WerkzeugArt): Glied {
  return { werkzeug: w, sicher: true };
}

function setzeGlied(b: Bau, g: Glied, id: string, x: number, z: number): string {
  if ('kern' in g) return b.setze('kern', { groesse: g.kern }, id, x, z);
  if ('speicher' in g) return b.setze('speicher', { modus: g.speicher }, id, x, z);
  return b.setze('werkzeug', { werkzeugArt: g.werkzeug }, id, x, z);
}

function verbindeGlied(b: Bau, g: Glied, id: string, nach: string, x: number, z: number): void {
  if (!('werkzeug' in g)) {
    b.verbinde(id, nach, 'aus');
    return;
  }
  b.verbinde(id, nach, 'ok');
  if (g.sicher === true) {
    const si = b.setze('sicherung', { modus: 'wiederholen', versuche: 2 }, `${id}s`, x, z + 1);
    b.verbinde(id, si, 'fehler');
    b.verbinde(si, id, 'zurueck');
    b.verbinde(si, nach, 'notausgang');
  } else {
    b.verbinde(id, nach, 'fehler');
  }
}

function strasse(glieder: readonly Glied[]): Werk {
  const b = new Bau();
  const q = b.setze('quelle', {}, 'q', 0, 5);
  const ids = glieder.map((g, i) => setzeGlied(b, g, `m${i + 1}`, 2 + i * 2, 5));
  const s = b.setze('senke', {}, 's', 2 + glieder.length * 2, 5);
  const folge = [...ids, s];
  b.verbinde(q, folge[0]!);
  glieder.forEach((g, i) => verbindeGlied(b, g, ids[i]!, folge[i + 1]!, 2 + i * 2, 5));
  return b.fertig();
}

interface Gabel {
  readonly vor?: readonly Glied[];
  readonly schwelle: number;
  readonly a: readonly Glied[];
  readonly b: readonly Glied[];
}

function gabel(plan: Gabel): Werk {
  const bb = new Bau();
  const vor = plan.vor ?? [];
  const q = bb.setze('quelle', {}, 'q', 0, 5);
  const vorIds = vor.map((g, i) => setzeGlied(bb, g, `v${i + 1}`, 2 + i * 2, 5));
  const wx = 2 + vor.length * 2;
  const w = bb.setze('weiche', { kriterium: 'schwierigkeit', schwelle: plan.schwelle }, 'w', wx, 5);
  const tief = Math.max(plan.a.length, plan.b.length);
  const s = bb.setze('senke', {}, 's', wx + 2 + tief * 2, 5);
  const vorFolge = [...vorIds, w];
  bb.verbinde(q, vorFolge[0]!);
  vor.forEach((g, i) => verbindeGlied(bb, g, vorIds[i]!, vorFolge[i + 1]!, 2 + i * 2, 5));

  const aIds = plan.a.map((g, i) => setzeGlied(bb, g, `a${i + 1}`, wx + 2 + i * 2, 2));
  const aFolge = [...aIds, s];
  bb.verbinde(w, aFolge[0]!, 'a');
  plan.a.forEach((g, i) => verbindeGlied(bb, g, aIds[i]!, aFolge[i + 1]!, wx + 2 + i * 2, 2));

  const bIds = plan.b.map((g, i) => setzeGlied(bb, g, `b${i + 1}`, wx + 2 + i * 2, 8));
  const bFolge = [...bIds, s];
  bb.verbinde(w, bFolge[0]!, 'b');
  plan.b.forEach((g, i) => verbindeGlied(bb, g, bIds[i]!, bFolge[i + 1]!, wx + 2 + i * 2, 8));
  return bb.fertig();
}

function zeig(name: string, werk: Werk, strom: AuftragsStrom, saat: number): void {
  const e = simuliere({ werk, strom, saat });
  const m = e.metriken;
  // eslint-disable-next-line no-console
  console.log(
    `${name.padEnd(44).slice(0, 44)} G ${m.guete.toFixed(3)} | Tok ${String(Math.round(m.kosten)).padStart(7)}` +
      ` | T/A ${String(Math.round(m.kostenJeAuftrag)).padStart(5)} | p95 ${String(m.latenzP95).padStart(3)}` +
      ` | M ${String(m.flaeche).padStart(2)} | D ${m.durchsatz.toFixed(2)} | B ${m.belegquote.toFixed(2)}` +
      ` | t ${String(m.dauer).padStart(4)}${e.abgebrochen ? ' ABBRUCH ' + e.abbruchGrund : ''}`
  );
}

function kette(n: number, g: KernGroesse, sp: { modus: SpeicherModus; pos: number }[] = []): Glied[] {
  const out: Glied[] = [];
  for (let i = 0; i < n; i++) {
    for (const s of sp) if (s.pos === i) out.push(S(s.modus));
    out.push(K(g));
  }
  for (const s of sp) if (s.pos >= n) out.push(S(s.modus));
  return out;
}

const KI: AuftragsStrom = {
  anzahl: 24,
  takt: 4,
  domaenen: ['recht', 'analyse'],
  schwierigkeit: [0.6, 0.88],
  mehrdeutigkeit: [0.2, 0.45],
};

const SHO: AuftragsStrom = {
  anzahl: 28,
  takt: 4,
  domaenen: ['recht', 'technik', 'analyse'],
  schwierigkeit: [0.2, 0.95],
  mehrdeutigkeit: [0.3, 0.6],
};

it('misst Akt VII', () => {
  const log = (s: string) => console.log(s);

  log('\n=== VII-0 KI: gibt es OHNE Speicher etwas ueber 0.92? ===');
  for (const n of [4, 5, 6]) zeig(`${n}x KONDOR`, strasse(kette(n, 'kondor')), KI, 701);
  zeig('KONDOR x4 + REIHER', strasse([...kette(4, 'kondor'), K('reiher')]), KI, 701);
  zeig('REIHER + KONDOR x4', strasse([K('reiher'), ...kette(4, 'kondor')]), KI, 701);
  zeig('KONDOR x3 + REIHER x3', strasse([...kette(3, 'kondor'), ...kette(3, 'reiher')]), KI, 701);
  zeig('KOLIBRI + KONDOR x4', strasse([K('kolibri'), ...kette(4, 'kondor')]), KI, 701);

  log('\n--- mit einem Speicher ---');
  for (const modus of ['komprimieren', 'isolieren', 'puffern', 'abrufen'] as SpeicherModus[]) {
    for (const n of [4, 5, 6]) {
      for (const pos of [1, 2, 3]) {
        if (pos >= n) continue;
        zeig(`${n}x KONDOR + ${modus}@${pos}`, strasse(kette(n, 'kondor', [{ modus, pos }])), KI, 701);
      }
    }
  }
  log('\n--- Mischketten mit Speicher ---');
  zeig('K,K,kompr,K,K,REIHER', strasse([K('kondor'), K('kondor'), S('komprimieren'), K('kondor'), K('kondor'), K('reiher')]), KI, 701);
  zeig('K,K,kompr,K,REIHER,REIHER', strasse([K('kondor'), K('kondor'), S('komprimieren'), K('kondor'), K('reiher'), K('reiher')]), KI, 701);
  zeig('K,K,kompr,K,K (4 Kondor)', strasse(kette(4, 'kondor', [{ modus: 'komprimieren', pos: 2 }])), KI, 701);
  zeig('K,K,isol,K,K (4 Kondor)', strasse(kette(4, 'kondor', [{ modus: 'isolieren', pos: 2 }])), KI, 701);
  zeig('REIHER,K,K,kompr,K,K', strasse([K('reiher'), K('kondor'), K('kondor'), S('komprimieren'), K('kondor'), K('kondor')]), KI, 701);
  zeig('5xK + kompr@2 + kompr@4', strasse(kette(5, 'kondor', [{ modus: 'komprimieren', pos: 2 }, { modus: 'komprimieren', pos: 4 }])), KI, 701);
  zeig('6xK + kompr@2 + kompr@4', strasse(kette(6, 'kondor', [{ modus: 'komprimieren', pos: 2 }, { modus: 'komprimieren', pos: 4 }])), KI, 701);

  log('\n=== VII-1 SHO Strom: Basis ===');
  for (const n of [2, 3, 4, 5]) zeig(`${n}x KONDOR`, strasse(kette(n, 'kondor')), SHO, 711);
  zeig('4xK + kompr@2', strasse(kette(4, 'kondor', [{ modus: 'komprimieren', pos: 2 }])), SHO, 711);
  zeig('4xK + abruf@0', strasse(kette(4, 'kondor', [{ modus: 'abrufen', pos: 0 }])), SHO, 711);
  zeig('4xK + abruf@1', strasse(kette(4, 'kondor', [{ modus: 'abrufen', pos: 1 }])), SHO, 711);
  zeig('4xK + abruf@1 + kompr@3', strasse(kette(4, 'kondor', [{ modus: 'abrufen', pos: 1 }, { modus: 'komprimieren', pos: 3 }])), SHO, 711);
  zeig('3xK + abruf@1 + kompr@2', strasse(kette(3, 'kondor', [{ modus: 'abrufen', pos: 1 }, { modus: 'komprimieren', pos: 2 }])), SHO, 711);
  log('--- Gabel ---');
  zeig('Gabel .5 | A: 2xREIHER | B: abruf+3xKONDOR', gabel({ schwelle: 0.5, a: kette(2, 'reiher'), b: [S('abrufen'), ...kette(3, 'kondor')] }), SHO, 711);
  zeig('Gabel .5 | A: 3xREIHER | B: abruf+3xKONDOR+kompr@2', gabel({ schwelle: 0.5, a: kette(3, 'reiher'), b: [S('abrufen'), ...kette(3, 'kondor', [{ modus: 'komprimieren', pos: 2 }])] }), SHO, 711);
  zeig('Gabel .5 | A: 2xREIHER | B: 4xKONDOR', gabel({ schwelle: 0.5, a: kette(2, 'reiher'), b: kette(4, 'kondor') }), SHO, 711);
  void WS;
  void W;
});
