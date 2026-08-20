import { it } from 'vitest';
import { simuliere } from '../../src/sim/simulation';
import { Bau } from '../../src/inhalt/bauhilfe';
import type { AuftragsStrom, HandModus, KernGroesse, SpeicherModus, WallModus, Werk, WerkzeugArt } from '../../src/sim/typen';

type Glied =
  | { readonly kern: KernGroesse }
  | { readonly hand: HandModus; readonly schwelle?: number }
  | { readonly werkzeug: WerkzeugArt }
  | { readonly speicher: SpeicherModus }
  | { readonly wall: WallModus };

function setzeGlied(b: Bau, g: Glied, id: string, x: number, z: number): string {
  if ('kern' in g) return b.setze('kern', { groesse: g.kern }, id, x, z);
  if ('hand' in g)
    return b.setze(
      'hand',
      g.schwelle === undefined ? { modus: g.hand } : { modus: g.hand, schwelle: g.schwelle },
      id,
      x,
      z
    );
  if ('werkzeug' in g) return b.setze('werkzeug', { werkzeugArt: g.werkzeug }, id, x, z);
  if ('speicher' in g) return b.setze('speicher', { modus: g.speicher }, id, x, z);
  return b.setze('wall', { modus: g.wall }, id, x, z);
}

function verbindeGlied(b: Bau, g: Glied, id: string, nach: string): void {
  if ('kern' in g || 'speicher' in g) {
    b.verbinde(id, nach, 'aus');
    return;
  }
  if ('hand' in g) {
    b.verbinde(id, nach, 'frei');
    return;
  }
  if ('werkzeug' in g) {
    b.verbinde(id, nach, 'ok');
    b.verbinde(id, nach, 'fehler');
    return;
  }
  b.verbinde(id, nach, 'rein');
  if (g.wall === 'eingang') b.verbinde(id, nach, 'alarm');
}

function strasse(glieder: readonly Glied[]): Werk {
  const b = new Bau();
  const q = b.setze('quelle', {}, 'q', 0, 5);
  const ids = glieder.map((g, i) => setzeGlied(b, g, `m${i + 1}`, 2 + i * 2, 5));
  const s = b.setze('senke', {}, 's', 2 + glieder.length * 2, 5);
  const folge = [...ids, s];
  b.verbinde(q, folge[0]!);
  glieder.forEach((g, i) => verbindeGlied(b, g, ids[i]!, folge[i + 1]!));
  return b.fertig();
}

interface GabelPlan {
  readonly vor: readonly Glied[];
  readonly kriterium: 'schwierigkeit' | 'vertraulichkeit' | 'unsicherheit';
  readonly schwelle: number;
  readonly a: readonly Glied[];
  readonly b: readonly Glied[];
}

function gabel(plan: GabelPlan): Werk {
  const b = new Bau();
  const q = b.setze('quelle', {}, 'q', 0, 5);
  const vorIds = plan.vor.map((g, i) => setzeGlied(b, g, `v${i + 1}`, 2 + i * 2, 5));
  const wx = 2 + plan.vor.length * 2;
  const w = b.setze('weiche', { kriterium: plan.kriterium, schwelle: plan.schwelle }, 'w', wx, 5);
  const tiefe = Math.max(plan.a.length, plan.b.length);
  const s = b.setze('senke', {}, 's', wx + 2 + tiefe * 2, 5);
  const vorFolge = [...vorIds, w];
  b.verbinde(q, vorFolge[0]!);
  plan.vor.forEach((g, i) => verbindeGlied(b, g, vorIds[i]!, vorFolge[i + 1]!));

  const aIds = plan.a.map((g, i) => setzeGlied(b, g, `a${i + 1}`, wx + 2 + i * 2, 1));
  const aFolge = [...aIds, s];
  b.verbinde(w, aFolge[0]!, 'a');
  plan.a.forEach((g, i) => verbindeGlied(b, g, aIds[i]!, aFolge[i + 1]!));

  const bIds = plan.b.map((g, i) => setzeGlied(b, g, `b${i + 1}`, wx + 2 + i * 2, 9));
  const bFolge = [...bIds, s];
  b.verbinde(w, bFolge[0]!, 'b');
  plan.b.forEach((g, i) => verbindeGlied(b, g, bIds[i]!, bFolge[i + 1]!));
  return b.fertig();
}

function zeig(name: string, werk: Werk, strom: AuftragsStrom, saat: number): void {
  const e = simuliere({ werk, strom, saat });
  const m = e.metriken;
  // eslint-disable-next-line no-console
  console.log(
    `  ${name.padEnd(46).slice(0, 46)}` +
      ` G ${m.guete.toFixed(3)}` +
      ` | Tok ${String(Math.round(m.kosten)).padStart(7)}` +
      ` | T/A ${String(Number.isFinite(m.kostenJeAuftrag) ? Math.round(m.kostenJeAuftrag) : '∞').padStart(6)}` +
      ` | p50 ${String(m.latenzP50).padStart(4)}` +
      ` | p95 ${String(m.latenzP95).padStart(4)}` +
      ` | M ${String(m.flaeche).padStart(2)}` +
      ` | D ${m.durchsatz.toFixed(2)}` +
      ` | S ${m.sicherheit.toFixed(2)}` +
      ` | K ${m.konformitaet.toFixed(2)}` +
      ` | t ${String(m.dauer).padStart(4)}` +
      (e.abgebrochen ? ` ABBRUCH ${e.abbruchGrund}` : '')
  );
}

const K = (g: KernGroesse): Glied => ({ kern: g });
const H = (m: HandModus, s?: number): Glied => (s === undefined ? { hand: m } : { hand: m, schwelle: s });
const W = (a: WerkzeugArt): Glied => ({ werkzeug: a });
const SP = (m: SpeicherModus): Glied => ({ speicher: m });
const WA = (m: WallModus): Glied => ({ wall: m });

it('erkundet Akt IX Runde 2', () => {
  const s1: AuftragsStrom = {
    anzahl: 24,
    takt: 8,
    domaenen: ['recht', 'text', 'finanz'],
    schwierigkeit: [0.2, 0.6],
    mehrdeutigkeit: [0.05, 0.3],
    anteilVertraulich: 0.25,
  };
  console.log('\n=== IX-1 Runde 2 (saat 911) ===');
  zeig('A REIHERx2 + Hand(bV)', strasse([K('reiher'), K('reiher'), H('bei_vertraulich')]), s1, 911);
  zeig('A KOLIBRI+REIHER + Hand(bV)', strasse([K('kolibri'), K('reiher'), H('bei_vertraulich')]), s1, 911);
  zeig(
    'B Weiche(vertr) A:REIHER B:REIHERx2+Hand(immer)',
    gabel({ vor: [], kriterium: 'vertraulichkeit', schwelle: 0.5, a: [K('reiher')], b: [K('reiher'), K('reiher'), H('immer')] }),
    s1,
    911
  );
  zeig(
    'B Weiche(vertr) A:KOLIBRI+REIHER B:REIHERx2+Hand',
    gabel({ vor: [], kriterium: 'vertraulichkeit', schwelle: 0.5, a: [K('kolibri'), K('reiher')], b: [K('reiher'), K('reiher'), H('immer')] }),
    s1,
    911
  );
  zeig(
    'B Weiche(vertr) A:KOLIBRIx2 B:REIHERx2+Hand',
    gabel({ vor: [], kriterium: 'vertraulichkeit', schwelle: 0.5, a: [K('kolibri'), K('kolibri')], b: [K('reiher'), K('reiher'), H('immer')] }),
    s1,
    911
  );
  zeig(
    'B Vorstufe REIHER, Weiche(vertr) B:REIHER+Hand',
    gabel({ vor: [K('reiher')], kriterium: 'vertraulichkeit', schwelle: 0.5, a: [K('reiher')], b: [K('reiher'), H('immer')] }),
    s1,
    911
  );
  zeig('ANTI Hand(immer) in der Linie', strasse([K('reiher'), K('reiher'), H('immer')]), s1, 911);
  zeig('ANTI ohne Hand', strasse([K('reiher'), K('reiher')]), s1, 911);
  zeig('ANTI Hand(unsicher 0.35)', strasse([K('reiher'), K('reiher'), H('bei_unsicherheit', 0.35)]), s1, 911);
  zeig('ANTI KONDORx2 + Hand(bV)', strasse([K('kondor'), K('kondor'), H('bei_vertraulich')]), s1, 911);
  zeig('KONDOR + Hand(bV)', strasse([K('kondor'), H('bei_vertraulich')]), s1, 911);

  const s2: AuftragsStrom = {
    anzahl: 30,
    takt: 6,
    domaenen: ['recht', 'finanz', 'analyse'],
    schwierigkeit: [0.25, 0.7],
    mehrdeutigkeit: [0.2, 0.5],
    anteilVertraulich: 0.4,
  };
  console.log('\n=== IX-2 Runde 2 (saat 921) ===');
  zeig('SHO-Loesung REIHERx2+Hand(bV)', strasse([K('reiher'), K('reiher'), H('bei_vertraulich')]), s2, 921);
  for (const sw of [0.45, 0.5]) {
    zeig(
      `Zwei Schalter (schwelle ${sw})`,
      gabel({
        vor: [],
        kriterium: 'schwierigkeit',
        schwelle: sw,
        a: [K('reiher'), K('reiher'), H('bei_vertraulich')],
        b: [K('reiher'), K('reiher'), H('bei_vertraulich')],
      }),
      s2,
      921
    );
  }
  for (const sw of [0.2, 0.25, 0.3, 0.35, 0.4]) {
    zeig(
      `Weiche(vertr) B:BESTAND+Hand(uns ${sw})`,
      gabel({
        vor: [K('reiher'), K('reiher')],
        kriterium: 'vertraulichkeit',
        schwelle: 0.5,
        a: [],
        b: [W('datenbank'), H('bei_unsicherheit', sw)],
      }),
      s2,
      921
    );
  }
  for (const sw of [0.2, 0.25, 0.3, 0.35]) {
    zeig(
      `Weiche(vertr) B:ABRUF+Hand(uns ${sw})`,
      gabel({
        vor: [K('reiher'), K('reiher')],
        kriterium: 'vertraulichkeit',
        schwelle: 0.5,
        a: [],
        b: [SP('abrufen'), H('bei_unsicherheit', sw)],
      }),
      s2,
      921
    );
  }
  zeig(
    'Weiche(vertr) B:Hand(uns 0.3) ohne Klaerung',
    gabel({
      vor: [K('reiher'), K('reiher')],
      kriterium: 'vertraulichkeit',
      schwelle: 0.5,
      a: [],
      b: [H('bei_unsicherheit', 0.3)],
    }),
    s2,
    921
  );
});

it.skip('erkundet Akt IX', () => {
  const s0: AuftragsStrom = {
    anzahl: 24,
    takt: 6,
    domaenen: ['recht', 'finanz'],
    schwierigkeit: [0.2, 0.55],
    mehrdeutigkeit: [0.05, 0.25],
    anteilVertraulich: 0.35,
  };
  console.log('\n--- IX-0 Kandidaten (saat 901) ---');
  zeig('KONDOR + Hand(bei_vertraulich)', strasse([K('kondor'), H('bei_vertraulich')]), s0, 901);
  zeig('REIHER x2 + Hand(bei_vertraulich)', strasse([K('reiher'), K('reiher'), H('bei_vertraulich')]), s0, 901);
  zeig('REIHER + Hand(bei_vertraulich)', strasse([K('reiher'), H('bei_vertraulich')]), s0, 901);
  zeig('KOLIBRI x2 + Hand(bei_vertraulich)', strasse([K('kolibri'), K('kolibri'), H('bei_vertraulich')]), s0, 901);
  zeig('KOLIBRI x3 + Hand', strasse([K('kolibri'), K('kolibri'), K('kolibri'), H('bei_vertraulich')]), s0, 901);
  zeig('REIHER x2 + Hand(immer)', strasse([K('reiher'), K('reiher'), H('immer')]), s0, 901);
  zeig('REIHER x2 + Hand(unsicher 0.4)', strasse([K('reiher'), K('reiher'), H('bei_unsicherheit', 0.4)]), s0, 901);
  zeig('REIHER x2 ohne Hand', strasse([K('reiher'), K('reiher')]), s0, 901);
  zeig('KONDOR x2 + Hand', strasse([K('kondor'), K('kondor'), H('bei_vertraulich')]), s0, 901);

  const s1: AuftragsStrom = {
    anzahl: 24,
    takt: 8,
    domaenen: ['recht', 'text', 'finanz'],
    schwierigkeit: [0.2, 0.6],
    mehrdeutigkeit: [0.05, 0.3],
    anteilVertraulich: 0.25,
  };
  console.log('\n--- IX-1 Kandidaten (saat 911) ---');
  zeig('REIHER x2 + Hand(bei_vertraulich)', strasse([K('reiher'), K('reiher'), H('bei_vertraulich')]), s1, 911);
  zeig('KONDOR + Hand(bei_vertraulich)', strasse([K('kondor'), H('bei_vertraulich')]), s1, 911);
  zeig('REIHER x2 + Hand(immer)', strasse([K('reiher'), K('reiher'), H('immer')]), s1, 911);
  zeig(
    'Weiche(vertr) A:KOLIBRIx2 B:REIHER+Hand(immer)',
    gabel({ vor: [], kriterium: 'vertraulichkeit', schwelle: 0.5, a: [K('kolibri'), K('kolibri')], b: [K('reiher'), H('immer')] }),
    s1,
    911
  );
  zeig(
    'Weiche(vertr) A:REIHERx2 B:REIHERx2+Hand(immer)',
    gabel({ vor: [], kriterium: 'vertraulichkeit', schwelle: 0.5, a: [K('reiher'), K('reiher')], b: [K('reiher'), K('reiher'), H('immer')] }),
    s1,
    911
  );

  const s2: AuftragsStrom = {
    anzahl: 30,
    takt: 6,
    domaenen: ['recht', 'finanz', 'analyse'],
    schwierigkeit: [0.25, 0.7],
    mehrdeutigkeit: [0.2, 0.5],
    anteilVertraulich: 0.4,
  };
  console.log('\n--- IX-2 Kandidaten (saat 921) ---');
  zeig('SHO-Loesung: REIHERx2 + Hand(bei_vertraulich)', strasse([K('reiher'), K('reiher'), H('bei_vertraulich')]), s2, 921);
  zeig('Hand(immer)', strasse([K('reiher'), K('reiher'), H('immer')]), s2, 921);
  for (const sw of [0.2, 0.3, 0.35, 0.4, 0.45, 0.5, 0.6]) {
    zeig(
      `REIHERx2 + BESTAND + Hand(unsicher ${sw})`,
      strasse([K('reiher'), K('reiher'), W('datenbank'), H('bei_unsicherheit', sw)]),
      s2,
      921
    );
  }
  for (const sw of [0.2, 0.3, 0.4, 0.5]) {
    zeig(
      `REIHERx2 + ABRUF + Hand(unsicher ${sw})`,
      strasse([K('reiher'), K('reiher'), SP('abrufen'), H('bei_unsicherheit', sw)]),
      s2,
      921
    );
  }
  zeig(
    'Zwei Schalter: Weiche(schwer 0.45) je REIHERx2+Hand(bV)',
    gabel({
      vor: [],
      kriterium: 'schwierigkeit',
      schwelle: 0.45,
      a: [K('reiher'), K('reiher'), H('bei_vertraulich')],
      b: [K('reiher'), K('reiher'), H('bei_vertraulich')],
    }),
    s2,
    921
  );
  zeig(
    'Weiche(vertr) B:Hand(immer)',
    gabel({
      vor: [K('reiher'), K('reiher')],
      kriterium: 'vertraulichkeit',
      schwelle: 0.5,
      a: [],
      b: [H('immer')],
    }),
    s2,
    921
  );
});
