/* Temporäre Messsonde für Akt V. Wird nach der Balance-Arbeit gelöscht. */
import { it } from 'vitest';
import { simuliere } from '../../src/sim/simulation';
import { Bau } from '../../src/inhalt/bauhilfe';
import type {
  AuftragsStrom,
  KernGroesse,
  SammlerModus,
  Werk,
  WerkzeugArt,
} from '../../src/sim/typen';

type Glied = { readonly kern: KernGroesse } | { readonly werkzeug: WerkzeugArt };

function K(kern: KernGroesse): Glied {
  return { kern };
}
function W(werkzeug: WerkzeugArt): Glied {
  return { werkzeug };
}

function setzeGlied(b: Bau, g: Glied, id: string, x: number, z: number): string {
  return 'werkzeug' in g
    ? b.setze('werkzeug', { werkzeugArt: g.werkzeug }, id, x, z)
    : b.setze('kern', { groesse: g.kern }, id, x, z);
}

function verbindeGlied(b: Bau, g: Glied, von: string, nach: string): void {
  if ('werkzeug' in g) {
    b.verbinde(von, nach, 'ok');
    b.verbinde(von, nach, 'fehler');
  } else {
    b.verbinde(von, nach, 'aus');
  }
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

interface ChorPlan {
  readonly vor?: readonly Glied[];
  readonly zweige: readonly (readonly Glied[])[];
  readonly modus: SammlerModus;
  readonly nach?: readonly Glied[];
}

function chor(plan: ChorPlan): Werk {
  const b = new Bau();
  const vor = plan.vor ?? [];
  const nach = plan.nach ?? [];
  const q = b.setze('quelle', {}, 'q', 0, 5);
  const vorIds = vor.map((g, i) => setzeGlied(b, g, `v${i + 1}`, 2 + i * 2, 5));
  const vx = 2 + vor.length * 2;
  const vt = b.setze('verteiler', { zweige: plan.zweige.length }, 'vt', vx, 5);
  const tiefe = Math.max(...plan.zweige.map((z) => z.length));
  const sx = vx + 2 + tiefe * 2;
  const sm = b.setze('sammler', { modus: plan.modus }, 'sm', sx, 5);
  const nachIds = nach.map((g, i) => setzeGlied(b, g, `n${i + 1}`, sx + 2 + i * 2, 5));
  const s = b.setze('senke', {}, 's', sx + 2 + nach.length * 2, 5);

  const vorFolge = [...vorIds, vt];
  b.verbinde(q, vorFolge[0]!);
  vor.forEach((g, i) => verbindeGlied(b, g, vorIds[i]!, vorFolge[i + 1]!));

  plan.zweige.forEach((zweig, zi) => {
    const zeile = zi * 2 + 1;
    const ids = zweig.map((g, i) => setzeGlied(b, g, `z${zi + 1}_${i + 1}`, vx + 2 + i * 2, zeile));
    const folge = [...ids, sm];
    b.verbinde(vt, folge[0]!, `z${zi + 1}`);
    zweig.forEach((g, i) => verbindeGlied(b, g, ids[i]!, folge[i + 1]!));
  });

  const nachFolge = [...nachIds, s];
  b.verbinde(sm, nachFolge[0]!);
  nach.forEach((g, i) => verbindeGlied(b, g, nachIds[i]!, nachFolge[i + 1]!));
  return b.fertig();
}

interface TeilPlan {
  readonly schwelle: number;
  readonly leicht: readonly Glied[];
  readonly zweige: readonly (readonly Glied[])[];
  readonly modus: SammlerModus;
  readonly vor?: readonly Glied[];
}

function geteilterChor(plan: TeilPlan): Werk {
  const b = new Bau();
  const vor = plan.vor ?? [];
  const q = b.setze('quelle', {}, 'q', 0, 5);
  const vorIds = vor.map((g, i) => setzeGlied(b, g, `v${i + 1}`, 2 + i * 2, 5));
  const wx = 2 + vor.length * 2;
  const w = b.setze('weiche', { kriterium: 'schwierigkeit', schwelle: plan.schwelle }, 'w', wx, 5);
  const tiefe = Math.max(...plan.zweige.map((z) => z.length));
  const sx = wx + 2 + tiefe * 2;
  const sm = b.setze('sammler', { modus: plan.modus }, 'sm', sx, 9);
  const s = b.setze('senke', {}, 's', sx + 4, 5);

  const vorFolge = [...vorIds, w];
  b.verbinde(q, vorFolge[0]!);
  vor.forEach((g, i) => verbindeGlied(b, g, vorIds[i]!, vorFolge[i + 1]!));

  const lIds = plan.leicht.map((g, i) => setzeGlied(b, g, `l${i + 1}`, wx + 2 + i * 2, 5));
  const lFolge = [...lIds, s];
  b.verbinde(w, lFolge[0]!, 'a');
  plan.leicht.forEach((g, i) => verbindeGlied(b, g, lIds[i]!, lFolge[i + 1]!));

  const vt = b.setze('verteiler', { zweige: plan.zweige.length }, 'vt', wx + 1, 7);
  b.verbinde(w, vt, 'b');
  plan.zweige.forEach((zweig, zi) => {
    const zeile = 7 + zi * 2;
    const ids = zweig.map((g, i) => setzeGlied(b, g, `z${zi + 1}_${i + 1}`, wx + 2 + i * 2, zeile));
    const folge = [...ids, sm];
    b.verbinde(vt, folge[0]!, `z${zi + 1}`);
    zweig.forEach((g, i) => verbindeGlied(b, g, ids[i]!, folge[i + 1]!));
  });
  b.verbinde(sm, s);
  return b.fertig();
}

function zeig(name: string, werk: Werk, strom: AuftragsStrom, saat: number): void {
  const e = simuliere({ werk, strom, saat });
  const m = e.metriken;
  // eslint-disable-next-line no-console
  console.log(
    `  ${name.padEnd(34).slice(0, 34)}` +
      ` G ${m.guete.toFixed(3)}` +
      ` | Tok ${String(Math.round(m.kosten)).padStart(7)}` +
      ` | T/A ${String(Number.isFinite(m.kostenJeAuftrag) ? Math.round(m.kostenJeAuftrag) : '∞').padStart(6)}` +
      ` | p95 ${String(m.latenzP95).padStart(4)}` +
      ` | p50 ${String(m.latenzP50).padStart(4)}` +
      ` | M ${String(m.flaeche).padStart(2)}` +
      ` | D ${m.durchsatz.toFixed(2)}` +
      ` | B ${m.belegquote.toFixed(2)}` +
      ` | t ${String(m.dauer).padStart(4)}` +
      (e.abgebrochen ? ` ABBRUCH ${e.abbruchGrund}` : '')
  );
}

const S0: AuftragsStrom = {
  anzahl: 24,
  takt: 5,
  domaenen: ['analyse', 'technik'],
  schwierigkeit: [0.7, 0.92],
  mehrdeutigkeit: [0.05, 0.2],
};

it('probe V-0', () => {
  // eslint-disable-next-line no-console
  console.log('\n--- V-0 Kandidaten (takt 5, schwierigkeit 0.70-0.92) ---');
  zeig('seriell KONDOR', strasse([K('kondor')]), S0, 501);
  zeig('seriell KONDOR x2', strasse([K('kondor'), K('kondor')]), S0, 501);
  zeig('seriell REIHER x2', strasse([K('reiher'), K('reiher')]), S0, 501);
  zeig('seriell REIHER x3', strasse([K('reiher'), K('reiher'), K('reiher')]), S0, 501);
  zeig('seriell KONDOR+REIHER', strasse([K('kondor'), K('reiher')]), S0, 501);
  zeig(
    'Chor 3x KONDOR bester',
    chor({ zweige: [[K('kondor')], [K('kondor')], [K('kondor')]], modus: 'bester' }),
    S0,
    501
  );
  zeig(
    'Chor 3x KONDOR voting',
    chor({ zweige: [[K('kondor')], [K('kondor')], [K('kondor')]], modus: 'voting' }),
    S0,
    501
  );
  zeig(
    'Chor 3x KONDOR verschmelz',
    chor({ zweige: [[K('kondor')], [K('kondor')], [K('kondor')]], modus: 'verschmelzen' }),
    S0,
    501
  );
  zeig(
    'Chor 2x KONDOR bester',
    chor({ zweige: [[K('kondor')], [K('kondor')]], modus: 'bester' }),
    S0,
    501
  );
  zeig(
    'Chor 4x KONDOR bester',
    chor({ zweige: [[K('kondor')], [K('kondor')], [K('kondor')], [K('kondor')]], modus: 'bester' }),
    S0,
    501
  );
  zeig(
    'Chor K|RR|RR bester',
    chor({
      zweige: [[K('kondor')], [K('reiher'), K('reiher')], [K('reiher'), K('reiher')]],
      modus: 'bester',
    }),
    S0,
    501
  );
  zeig(
    'Chor 3x RR verschmelzen',
    chor({
      zweige: [
        [K('reiher'), K('reiher')],
        [K('reiher'), K('reiher')],
        [K('reiher'), K('reiher')],
      ],
      modus: 'verschmelzen',
    }),
    S0,
    501
  );
  zeig(
    'Chor 3x RR bester',
    chor({
      zweige: [
        [K('reiher'), K('reiher')],
        [K('reiher'), K('reiher')],
        [K('reiher'), K('reiher')],
      ],
      modus: 'bester',
    }),
    S0,
    501
  );
  zeig(
    'Chor K|RR bester',
    chor({ zweige: [[K('kondor')], [K('reiher'), K('reiher')]], modus: 'bester' }),
    S0,
    501
  );
});

const S1: AuftragsStrom = {
  anzahl: 28,
  takt: 5,
  domaenen: ['recht', 'analyse', 'technik'],
  schwierigkeit: [0.1, 0.88],
  mehrdeutigkeit: [0.1, 0.3],
  anteilBelegpflichtig: 0.5,
};

it('probe V-1', () => {
  // eslint-disable-next-line no-console
  console.log('\n--- V-1 Kandidaten (takt 5, schwierigkeit 0.10-0.88, beleg 0.5) ---');
  zeig(
    'Drei Stimmen (DB vorn)',
    chor({
      vor: [W('datenbank')],
      zweige: [[K('kolibri'), K('kolibri'), K('kolibri'), K('kolibri')], [K('reiher'), K('reiher')], [K('kondor')]],
      modus: 'bester',
    }),
    S1,
    511
  );
  zeig(
    'Drei Stimmen (DB je Zweig)',
    chor({
      zweige: [
        [W('datenbank'), K('kolibri'), K('kolibri'), K('kolibri')],
        [W('datenbank'), K('reiher'), K('reiher')],
        [W('datenbank'), K('kondor')],
      ],
      modus: 'bester',
    }),
    S1,
    511
  );
  zeig('seriell DB+KONDOR', strasse([W('datenbank'), K('kondor')]), S1, 511);
  zeig('seriell DB+KONDOR+REIHER', strasse([W('datenbank'), K('kondor'), K('reiher')]), S1, 511);
  zeig('seriell DB+KONDORx2', strasse([W('datenbank'), K('kondor'), K('kondor')]), S1, 511);
  zeig('seriell DB+RRR', strasse([W('datenbank'), K('reiher'), K('reiher'), K('reiher')]), S1, 511);
  zeig(
    'Chor DB vorn 2 Stimmen',
    chor({
      vor: [W('datenbank')],
      zweige: [[K('reiher'), K('reiher')], [K('kondor')]],
      modus: 'bester',
    }),
    S1,
    511
  );
  zeig(
    'Chor DB vorn 3x KONDOR',
    chor({ vor: [W('datenbank')], zweige: [[K('kondor')], [K('kondor')], [K('kondor')]], modus: 'bester' }),
    S1,
    511
  );
});

it('probe V-2', () => {
  // eslint-disable-next-line no-console
  console.log('\n--- V-2 Kandidaten (gleicher Strom, Saat 521) ---');
  const S2: AuftragsStrom = { ...S1, anzahl: 30, saat: undefined } as AuftragsStrom;
  zeig(
    'Drei Stimmen (SHO-Referenz)',
    chor({
      vor: [W('datenbank')],
      zweige: [[K('kolibri'), K('kolibri'), K('kolibri'), K('kolibri')], [K('reiher'), K('reiher')], [K('kondor')]],
      modus: 'bester',
    }),
    S2,
    521
  );
  zeig(
    'Weiche + Chor schwer',
    geteilterChor({
      vor: [W('datenbank')],
      schwelle: 0.55,
      leicht: [K('kolibri'), K('kolibri')],
      zweige: [[K('reiher'), K('reiher')], [K('kondor')]],
      modus: 'bester',
    }),
    S2,
    521
  );
  zeig(
    'Weiche + Chor schwer 3',
    geteilterChor({
      vor: [W('datenbank')],
      schwelle: 0.55,
      leicht: [K('kolibri'), K('kolibri')],
      zweige: [[K('kolibri'), K('kolibri'), K('kolibri'), K('kolibri')], [K('reiher'), K('reiher')], [K('kondor')]],
      modus: 'bester',
    }),
    S2,
    521
  );
  zeig('seriell DB+KONDOR', strasse([W('datenbank'), K('kondor')]), S2, 521);
});
