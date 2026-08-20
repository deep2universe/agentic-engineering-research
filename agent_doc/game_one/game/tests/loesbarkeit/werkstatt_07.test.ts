/** Temporaeres Messwerkzeug. Wird vor der Abgabe geloescht. */
import { it } from 'vitest';
import { simuliere } from '../../src/sim/simulation';
import { Bau } from '../../src/inhalt/bauhilfe';
import type { AuftragsStrom, KernGroesse, SpeicherModus, Werk, WerkzeugArt } from '../../src/sim/typen';

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
function gabel(vor: readonly Glied[], schwelle: number, a: readonly Glied[], bb: readonly Glied[]): Werk {
  const b = new Bau();
  const q = b.setze('quelle', {}, 'q', 0, 5);
  const vorIds = vor.map((g, i) => setzeGlied(b, g, `v${i + 1}`, 2 + i * 2, 5));
  const wx = 2 + vor.length * 2;
  const w = b.setze('weiche', { kriterium: 'schwierigkeit', schwelle }, 'w', wx, 5);
  const tief = Math.max(a.length, bb.length);
  const s = b.setze('senke', {}, 's', wx + 2 + tief * 2, 5);
  const vorFolge = [...vorIds, w];
  b.verbinde(q, vorFolge[0]!);
  vor.forEach((g, i) => verbindeGlied(b, g, vorIds[i]!, vorFolge[i + 1]!, 2 + i * 2, 5));
  const aIds = a.map((g, i) => setzeGlied(b, g, `a${i + 1}`, wx + 2 + i * 2, 1));
  const aFolge = [...aIds, s];
  b.verbinde(w, aFolge[0]!, 'a');
  a.forEach((g, i) => verbindeGlied(b, g, aIds[i]!, aFolge[i + 1]!, wx + 2 + i * 2, 1));
  const bIds = bb.map((g, i) => setzeGlied(b, g, `b${i + 1}`, wx + 2 + i * 2, 9));
  const bFolge = [...bIds, s];
  b.verbinde(w, bFolge[0]!, 'b');
  bb.forEach((g, i) => verbindeGlied(b, g, bIds[i]!, bFolge[i + 1]!, wx + 2 + i * 2, 9));
  return b.fertig();
}

const KD = K('kondor');
const RH = K('reiher');
const V = S('komprimieren');
const P = S('puffern');
const I = S('isolieren');
const A = S('abrufen');

const S1: AuftragsStrom = { anzahl: 30, takt: 5, domaenen: ['recht', 'analyse', 'technik'], schwierigkeit: [0.5, 1.4], mehrdeutigkeit: [0.1, 0.3] };
const S1b: AuftragsStrom = { anzahl: 30, takt: 5, domaenen: ['recht', 'analyse', 'technik'], schwierigkeit: [0.55, 1.25], mehrdeutigkeit: [0.05, 0.2] };
const S3: AuftragsStrom = { anzahl: 32, takt: 5, domaenen: ['finanz', 'recht', 'analyse'], schwierigkeit: [0.3, 0.9], mehrdeutigkeit: [0.2, 0.5], anteilBelegpflichtig: 0.5, anteilRechnerisch: 0.4 };

function zeig(name: string, werk: Werk, strom: AuftragsStrom, saat: number): void {
  const e = simuliere({ werk, strom, saat });
  const m = e.metriken;
  // eslint-disable-next-line no-console
  console.log(
    `${name.padEnd(42).slice(0, 42)} G ${m.guete.toFixed(3)} | Tok ${String(Math.round(m.kosten)).padStart(7)}` +
      ` | T/A ${String(Math.round(m.kostenJeAuftrag)).padStart(5)} | p95 ${String(m.latenzP95).padStart(3)}` +
      ` | M ${String(m.flaeche).padStart(2)} | D ${m.durchsatz.toFixed(2)} | B ${m.belegquote.toFixed(2)}`
  );
}

it('misst VII-1 und VII-3', () => {
  const log = (s: string) => console.log(s);
  const sus = WS('suche');
  const res = WS('rechner');
  log('\n=== VII-1 Gabel-Varianten (Saat 711, Strom A) ===');
  for (const sw of [0.8, 0.85, 0.9, 0.95, 1.0]) {
    zeig(`Gabel ${sw} A:3K B:A+3K`, gabel([], sw, [KD, KD, KD], [A, KD, KD, KD]), S1, 711);
  }
  zeig('Gabel .9 A:3K B:A+A+3K', gabel([], 0.9, [KD, KD, KD], [A, A, KD, KD, KD]), S1, 711);
  zeig('Gabel .9 A:A+2K B:A+3K', gabel([], 0.9, [A, KD, KD], [A, KD, KD, KD]), S1, 711);
  zeig('Gabel .9 A:3K B:A+3K+V+K', gabel([], 0.9, [KD, KD, KD], [A, KD, KD, KD, V, KD]), S1, 711);
  zeig('Gabel .7 A:3K B:A+3K', gabel([], 0.7, [KD, KD, KD], [A, KD, KD, KD]), S1, 711);
  zeig('A K K (nur 2 Kerne)', strasse([A, KD, KD]), S1, 711);
  zeig('A A K K', strasse([A, A, KD, KD]), S1, 711);
  zeig('K A K', strasse([KD, A, KD]), S1, 711);

  log('\n=== VII-3 Kandidaten (Saat 731) ===');
  zeig('A: WSsu WSre K V P K K', strasse([sus, res, KD, V, P, KD, KD]), S3, 731);
  zeig('B1: Gabel .5 vor=[su,re,K,V,P] a=[K] b=[K,K]', gabel([sus, res, KD, V, P], 0.5, [KD], [KD, KD]), S3, 731);
  zeig('B2: Gabel .5 vor=[su,re,K,V,P] a=[K] b=[K,V,K]', gabel([sus, res, KD, V, P], 0.5, [KD], [KD, V, KD]), S3, 731);
  zeig('B3: Gabel .45 vor=[su,re,K,V,P] a=[K] b=[K,K]', gabel([sus, res, KD, V, P], 0.45, [KD], [KD, KD]), S3, 731);
  zeig('B4: Gabel .6 vor=[su,re,K,V,P] a=[K] b=[K,K]', gabel([sus, res, KD, V, P], 0.6, [KD], [KD, KD]), S3, 731);
  zeig('C: WSsu WSre K V P K K K', strasse([sus, res, KD, V, P, KD, KD, KD]), S3, 731);
  zeig('D: WSsu WSre I P K K K', strasse([sus, res, I, P, KD, KD, KD]), S3, 731);
  zeig('E: WSsu WSre K I P K K', strasse([sus, res, KD, I, P, KD, KD]), S3, 731);
  zeig('F: WSsu WSre V P K K K', strasse([sus, res, V, P, KD, KD, KD]), S3, 731);
  zeig('anti1: WSsu WSre K P V K K', strasse([sus, res, KD, P, V, KD, KD]), S3, 731);
  zeig('anti2: WSsu WSre 4K', strasse([sus, res, KD, KD, KD, KD]), S3, 731);
  zeig('anti3: Wsu Wre K V P K K', strasse([W('suche'), W('rechner'), KD, V, P, KD, KD]), S3, 731);
  zeig('anti4: WSsu K V P K K', strasse([sus, KD, V, P, KD, KD]), S3, 731);
  zeig('anti5: P WSsu WSre 4K', strasse([P, sus, res, KD, KD, KD, KD]), S3, 731);
  void RH;
  void I;
});
