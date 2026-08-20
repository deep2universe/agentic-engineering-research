/** Temporaeres Messwerkzeug fuer Akt VII. Wird vor der Abgabe geloescht. */
import { it } from 'vitest';
import { simuliere } from '../../src/sim/simulation';
import { Bau } from '../../src/inhalt/bauhilfe';
import type {
  AuftragsStrom,
  KernGroesse,
  SammlerModus,
  SpeicherModus,
  Werk,
  WerkzeugArt,
} from '../../src/sim/typen';

type Glied =
  | { readonly kern: KernGroesse }
  | { readonly speicher: SpeicherModus }
  | { readonly werkzeug: WerkzeugArt; readonly sicher?: true };

const K = (g: KernGroesse): Glied => ({ kern: g });
const S = (m: SpeicherModus): Glied => ({ speicher: m });
const W = (w: WerkzeugArt): Glied => ({ werkzeug: w });
const WS = (w: WerkzeugArt): Glied => ({ werkzeug: w, sicher: true });

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
function gabel(vor: readonly Glied[], schwelle: number, bahnA: readonly Glied[], bahnB: readonly Glied[]): Werk {
  const b = new Bau();
  const q = b.setze('quelle', {}, 'q', 0, 5);
  const vorIds = vor.map((g, i) => setzeGlied(b, g, `v${i + 1}`, 2 + i * 2, 5));
  const wx = 2 + vor.length * 2;
  const w = b.setze('weiche', { kriterium: 'schwierigkeit', schwelle }, 'w', wx, 5);
  const tief = Math.max(bahnA.length, bahnB.length);
  const s = b.setze('senke', {}, 's', wx + 2 + tief * 2, 5);
  const vorFolge = [...vorIds, w];
  b.verbinde(q, vorFolge[0]!);
  vor.forEach((g, i) => verbindeGlied(b, g, vorIds[i]!, vorFolge[i + 1]!, 2 + i * 2, 5));
  const aIds = bahnA.map((g, i) => setzeGlied(b, g, `a${i + 1}`, wx + 2 + i * 2, 1));
  const aFolge = [...aIds, s];
  b.verbinde(w, aFolge[0]!, 'a');
  bahnA.forEach((g, i) => verbindeGlied(b, g, aIds[i]!, aFolge[i + 1]!, wx + 2 + i * 2, 1));
  const bIds = bahnB.map((g, i) => setzeGlied(b, g, `b${i + 1}`, wx + 2 + i * 2, 9));
  const bFolge = [...bIds, s];
  b.verbinde(w, bFolge[0]!, 'b');
  bahnB.forEach((g, i) => verbindeGlied(b, g, bIds[i]!, bFolge[i + 1]!, wx + 2 + i * 2, 9));
  return b.fertig();
}
function chor(vor: readonly Glied[], zweige: readonly (readonly Glied[])[], modus: SammlerModus, nach: readonly Glied[] = []): Werk {
  const b = new Bau();
  const q = b.setze('quelle', {}, 'q', 0, 5);
  const vorIds = vor.map((g, i) => setzeGlied(b, g, `v${i + 1}`, 2 + i * 2, 5));
  const vx = 2 + vor.length * 2;
  const vt = b.setze('verteiler', { zweige: zweige.length }, 'vt', vx, 5);
  const tiefe = Math.max(...zweige.map((z) => z.length));
  const sx = vx + 2 + tiefe * 2;
  const sm = b.setze('sammler', { modus }, 'sm', sx, 5);
  const nachIds = nach.map((g, i) => setzeGlied(b, g, `n${i + 1}`, sx + 2 + i * 2, 5));
  const s = b.setze('senke', {}, 's', sx + 2 + nach.length * 2, 5);
  const vorFolge = [...vorIds, vt];
  b.verbinde(q, vorFolge[0]!);
  vor.forEach((g, i) => verbindeGlied(b, g, vorIds[i]!, vorFolge[i + 1]!, 2 + i * 2, 5));
  zweige.forEach((zweig, zi) => {
    const zeile = 10 + zi * 4;
    const ids = zweig.map((g, i) => setzeGlied(b, g, `z${zi + 1}_${i + 1}`, vx + 2 + i * 2, zeile));
    const folge = [...ids, sm];
    b.verbinde(vt, folge[0]!, `z${zi + 1}`);
    zweig.forEach((g, i) => verbindeGlied(b, g, ids[i]!, folge[i + 1]!, vx + 2 + i * 2, zeile));
  });
  const nachFolge = [...nachIds, s];
  b.verbinde(sm, nachFolge[0]!);
  nach.forEach((g, i) => verbindeGlied(b, g, nachIds[i]!, nachFolge[i + 1]!, sx + 2 + i * 2, 5));
  return b.fertig();
}

function zeig(name: string, werk: Werk, strom: AuftragsStrom, saat: number): void {
  const e = simuliere({ werk, strom, saat });
  const m = e.metriken;
  // eslint-disable-next-line no-console
  console.log(
    `${name.padEnd(40).slice(0, 40)} G ${m.guete.toFixed(3)} | Tok ${String(Math.round(m.kosten)).padStart(7)}` +
      ` | T/A ${String(Math.round(m.kostenJeAuftrag)).padStart(5)} | p95 ${String(m.latenzP95).padStart(3)}` +
      ` | M ${String(m.flaeche).padStart(2)} | D ${m.durchsatz.toFixed(2)} | B ${m.belegquote.toFixed(2)}` +
      ` | t ${String(m.dauer).padStart(4)}${e.abgebrochen ? ' ABBRUCH' : ''}`
  );
}

const KD = K('kondor');
const RH = K('reiher');
const KL = K('kolibri');
const V = S('komprimieren');
const P = S('puffern');
const I = S('isolieren');
const A = S('abrufen');

const S0: AuftragsStrom = { anzahl: 30, takt: 3, domaenen: ['recht', 'analyse'], schwierigkeit: [0.6, 0.88], mehrdeutigkeit: [0.0, 0.12] };
const S1: AuftragsStrom = { anzahl: 30, takt: 3, domaenen: ['recht', 'technik', 'analyse'], schwierigkeit: [0.15, 0.92], mehrdeutigkeit: [0.25, 0.5] };
const S2: AuftragsStrom = { anzahl: 30, takt: 3, domaenen: ['recht', 'analyse', 'technik'], schwierigkeit: [0.55, 0.9], mehrdeutigkeit: [0.1, 0.3] };
const S3: AuftragsStrom = { anzahl: 32, takt: 3, domaenen: ['finanz', 'recht', 'analyse'], schwierigkeit: [0.3, 0.9], mehrdeutigkeit: [0.2, 0.5], anteilBelegpflichtig: 0.5, anteilRechnerisch: 0.4 };

it('misst Akt VII', () => {
  const log = (s: string) => console.log(s);

  log('\n=== VII-0 (Saat 701) ===');
  zeig('3K', strasse([KD, KD, KD]), S0, 701);
  zeig('4K', strasse([KD, KD, KD, KD]), S0, 701);
  zeig('5K', strasse([KD, KD, KD, KD, KD]), S0, 701);
  zeig('6K', strasse([KD, KD, KD, KD, KD, KD]), S0, 701);
  zeig('K K V K K', strasse([KD, KD, V, KD, KD]), S0, 701);
  zeig('K V K K K', strasse([KD, V, KD, KD, KD]), S0, 701);
  zeig('K K V K K K', strasse([KD, KD, V, KD, KD, KD]), S0, 701);
  zeig('K K I K K', strasse([KD, KD, I, KD, KD]), S0, 701);
  zeig('K K P K K', strasse([KD, KD, P, KD, KD]), S0, 701);
  zeig('K V K P K K', strasse([KD, V, KD, P, KD, KD]), S0, 701);
  zeig('K K V P K K', strasse([KD, KD, V, P, KD, KD]), S0, 701);
  zeig('K A K K', strasse([KD, A, KD, KD]), S0, 701);
  zeig('K A P K K', strasse([KD, A, P, KD, KD]), S0, 701);
  zeig('Chor 2x1K vor1', chor([KD], [[KD], [KD]], 'bester'), S0, 701);
  zeig('Chor 2x2K vor0', chor([], [[KD, KD], [KD, KD]], 'bester'), S0, 701);
  zeig('Chor 3x1K vor1', chor([KD], [[KD], [KD], [KD]], 'bester'), S0, 701);
  zeig('Chor 2x1K vor2', chor([KD, KD], [[KD], [KD]], 'bester'), S0, 701);
  zeig('Chor 2x2K vor1V', chor([KD, V], [[KD, KD], [KD, KD]], 'bester'), S0, 701);

  log('\n=== VII-1 (Saat 711) ===');
  zeig('3K', strasse([KD, KD, KD]), S1, 711);
  zeig('4K', strasse([KD, KD, KD, KD]), S1, 711);
  zeig('K A K K', strasse([KD, A, KD, KD]), S1, 711);
  zeig('K A K V K', strasse([KD, A, KD, V, KD]), S1, 711);
  zeig('A K K K', strasse([A, KD, KD, KD]), S1, 711);
  zeig('3R', strasse([RH, RH, RH]), S1, 711);
  zeig('Gabel .45 A:2R B:A+3K', gabel([], 0.45, [RH, RH], [A, KD, KD, KD]), S1, 711);
  zeig('Gabel .45 A:2R B:A+2K', gabel([], 0.45, [RH, RH], [A, KD, KD]), S1, 711);
  zeig('Gabel .45 A:3R B:A+K+V+K', gabel([], 0.45, [RH, RH, RH], [A, KD, V, KD]), S1, 711);
  zeig('Gabel .45 A:2R B:3K', gabel([], 0.45, [RH, RH], [KD, KD, KD]), S1, 711);
  zeig('Gabel .45 A:2R B:4K', gabel([], 0.45, [RH, RH], [KD, KD, KD, KD]), S1, 711);
  zeig('Gabel .6 A:3R B:A+3K', gabel([], 0.6, [RH, RH, RH], [A, KD, KD, KD]), S1, 711);
  zeig('K A K K K', strasse([KD, A, KD, KD, KD]), S1, 711);

  log('\n=== VII-2 (Saat 721) ===');
  zeig('4K', strasse([KD, KD, KD, KD]), S2, 721);
  zeig('5K', strasse([KD, KD, KD, KD, KD]), S2, 721);
  zeig('K K P K K', strasse([KD, KD, P, KD, KD]), S2, 721);
  zeig('K P K K K', strasse([KD, P, KD, KD, KD]), S2, 721);
  zeig('K K V K K', strasse([KD, KD, V, KD, KD]), S2, 721);
  zeig('K K P V K K', strasse([KD, KD, P, V, KD, KD]), S2, 721);
  zeig('K K V P K K', strasse([KD, KD, V, P, KD, KD]), S2, 721);
  zeig('K P K V K K', strasse([KD, P, KD, V, KD, KD]), S2, 721);
  zeig('K V K P K K', strasse([KD, V, KD, P, KD, KD]), S2, 721);
  zeig('K P K I K K', strasse([KD, P, KD, I, KD, KD]), S2, 721);
  zeig('K I K P K K', strasse([KD, I, KD, P, KD, KD]), S2, 721);
  zeig('K K P K K K', strasse([KD, KD, P, KD, KD, KD]), S2, 721);
  zeig('K K V K K K', strasse([KD, KD, V, KD, KD, KD]), S2, 721);
  zeig('Gabel .45 A:2R B:A+3K', gabel([], 0.45, [RH, RH], [A, KD, KD, KD]), S2, 721);
  zeig('K A K K', strasse([KD, A, KD, KD]), S2, 721);

  log('\n=== VII-3 (Saat 731) ===');
  zeig('WS(db) WS(re) 4K', strasse([WS('datenbank'), WS('rechner'), KD, KD, KD, KD]), S3, 731);
  zeig('WS(db) WS(re) K K V K K', strasse([WS('datenbank'), WS('rechner'), KD, KD, V, KD, KD]), S3, 731);
  zeig('WS WS K V P K K', strasse([WS('datenbank'), WS('rechner'), KD, V, P, KD, KD]), S3, 731);
  zeig('WS WS K P V K K', strasse([WS('datenbank'), WS('rechner'), KD, P, V, KD, KD]), S3, 731);
  zeig('WS WS V P K K K', strasse([WS('datenbank'), WS('rechner'), V, P, KD, KD, KD]), S3, 731);
  zeig('WS WS P V K K K', strasse([WS('datenbank'), WS('rechner'), P, V, KD, KD, KD]), S3, 731);
  zeig('WS WS K K P K K', strasse([WS('datenbank'), WS('rechner'), KD, KD, P, KD, KD]), S3, 731);
  zeig('WS WS 3K', strasse([WS('datenbank'), WS('rechner'), KD, KD, KD]), S3, 731);
  void W;
  void KL;
});
