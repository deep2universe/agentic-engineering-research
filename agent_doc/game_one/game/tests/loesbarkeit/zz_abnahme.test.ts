import { describe, it, expect } from 'vitest';
import { AKTE, ALLE_LEVEL } from '../../src/inhalt/kampagne';

const ERSATZ = /\b\w*(ae|oe|ue|ss)\w*\b/g;
const AUSNAHMEN = new Set([
  'aber','oder','under','super','neue','neuen','neuer','neues','muessen',
]);

describe('Abnahme', () => {
  it('Struktur', () => {
    const probleme: string[] = [];
    for (const akt of AKTE) {
      expect(akt.level.length, `Akt ${akt.nummer}`).toBe(4);
      for (const l of akt.level) {
        if (l.antiMuster.length < 1) probleme.push(`${l.id}: kein Anti-Muster`);
        if (akt.nummer >= 2 && l.referenzen.length < 2) probleme.push(`${l.id}: nur ${l.referenzen.length} Referenz`);
        if (l.akt !== akt.nummer) probleme.push(`${l.id}: akt-Feld ${l.akt} != ${akt.nummer}`);
      }
    }
    expect(probleme).toEqual([]);
  });

  it('Textlimits', () => {
    const probleme: string[] = [];
    for (const l of ALLE_LEVEL) {
      if (l.briefing.length < 120 || l.briefing.length > 900) probleme.push(`${l.id} briefing ${l.briefing.length}`);
      if (l.reflexion.length > 220) probleme.push(`${l.id} reflexion ${l.reflexion.length}`);
      if ((l.reflexion.match(/\?/g) ?? []).length !== 1) probleme.push(`${l.id} reflexion Fragen`);
      if (l.notiz.length > 460) probleme.push(`${l.id} notiz ${l.notiz.length}`);
    }
    expect(probleme).toEqual([]);
  });

  it('Orthografie', () => {
    const treffer: string[] = [];
    for (const l of ALLE_LEVEL) {
      const felder: Array<[string, string]> = [
        ['titel', l.titel], ['untertitel', l.untertitel], ['briefing', l.briefing],
        ['lernziel', l.lernziel], ['reflexion', l.reflexion], ['notiz', l.notiz],
        ...l.referenzen.map((r, i) => [`ref${i}`, r.name] as [string, string]),
        ...l.antiMuster.map((a, i) => [`anti${i}`, a.name] as [string, string]),
        ...l.ziele.map((z, i) => [`ziel${i}`, z.text] as [string, string]),
      ];
      for (const [feld, text] of felder) {
        for (const w of text.match(ERSATZ) ?? []) {
          const kl = w.toLowerCase();
          if (AUSNAHMEN.has(kl)) continue;
          treffer.push(`${l.id}/${feld}: ${w}`);
        }
      }
    }
    expect(treffer).toEqual([]);
  });
});
