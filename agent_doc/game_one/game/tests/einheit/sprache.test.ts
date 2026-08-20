/**
 * SPRACHPRÜFUNG.
 *
 * Das Projekt schreibt Deutsch mit korrekten Umlauten. Diese Regel gilt für
 * alles, was ein Mensch liest — Spieltexte und Kommentare —, ausdrücklich aber
 * NICHT für Bezeichner: die bleiben ASCII, weil sie zugleich Schlüssel in
 * serialisierten Datenstrukturen sind und auf jeder Tastatur eingebbar bleiben
 * müssen.
 *
 * Der Test prüft deshalb genau die Texte, die im Spiel angezeigt werden. Er
 * hält die Regel dauerhaft, auch wenn später jemand einen Text ergänzt, ohne
 * das Werkzeug `werkzeuge/umlaute.mjs` laufen zu lassen.
 */

import { describe, expect, it } from 'vitest';
import { ALLE_LEVEL, AKTE } from '../../src/inhalt/kampagne';
import { KATALOG } from '../../src/sim/katalog';
import { KEYMAP } from '../../src/ui/keymap';
import { zielFormel } from '../../src/sim/ziele';

/**
 * Ersatzschreibungen, die in Spieltexten nicht vorkommen dürfen. Die Liste ist
 * bewusst wortstammbasiert: deutsche Komposita sind unbegrenzt, eine Wortliste
 * käme nie hinterher.
 */
const VERBOTENE_STAEMME = [
  'ueber', 'fuer', 'muess', 'koenn', 'duerf', 'wuerd', 'zurueck', 'naechst',
  'moeg', 'loes', 'pruef', 'fuehr', 'erfuell', 'gross', 'groess', 'hoeher',
  'hoech', 'schliess', 'ausser', 'heisst', 'weiss', 'auftraeg', 'ausgaeng',
  'eingaeng', 'flaech', 'laeuf', 'laess', 'faell', 'haelt', 'traeg', 'staend',
  'staerk', 'waehr', 'waehl', 'aend', 'guete', 'gueltig', 'qualitaet',
  'konformitaet', 'domaen', 'schluess', 'kuend', 'gemaess', 'verstoss',
  'zulaess', 'vollstaend', 'zusaetz', 'abhaeng', 'tatsaech', 'spaet',
  'erklaer', 'kuehl', 'stueck', 'behoerd', 'oeffentl',
];

/** Sammelt alle Zeichenketten, die das Spiel jemals anzeigt. */
function alleSpieltexte(): { quelle: string; text: string }[] {
  const texte: { quelle: string; text: string }[] = [];

  for (const l of ALLE_LEVEL) {
    texte.push(
      { quelle: `${l.id}.titel`, text: l.titel },
      { quelle: `${l.id}.untertitel`, text: l.untertitel },
      { quelle: `${l.id}.briefing`, text: l.briefing },
      { quelle: `${l.id}.lernziel`, text: l.lernziel },
      { quelle: `${l.id}.reflexion`, text: l.reflexion }
    );
    if (l.notiz !== undefined) texte.push({ quelle: `${l.id}.notiz`, text: l.notiz });
    for (const z of l.ziele) texte.push({ quelle: `${l.id}.ziel.${z.id}`, text: z.text });
    for (const r of l.referenzen) {
      texte.push({ quelle: `${l.id}.ref.${r.name}`, text: r.name }, { quelle: `${l.id}.ref.ansatz`, text: r.ansatz });
    }
    for (const a of l.antiMuster) {
      texte.push(
        { quelle: `${l.id}.anti.${a.name}`, text: a.name },
        { quelle: `${l.id}.anti.verlockung`, text: a.verlockung }
      );
    }
  }

  for (const a of AKTE) {
    texte.push(
      { quelle: `akt${a.nummer}.titel`, text: a.titel },
      { quelle: `akt${a.nummer}.untertitel`, text: a.untertitel },
      { quelle: `akt${a.nummer}.lektion`, text: a.lektion }
    );
  }

  for (const [art, def] of Object.entries(KATALOG)) {
    texte.push(
      { quelle: `katalog.${art}.name`, text: def.name },
      { quelle: `katalog.${art}.kurz`, text: def.kurz },
      { quelle: `katalog.${art}.lehrsatz`, text: def.lehrsatz }
    );
    for (const p of [...def.eingaenge, ...def.ausgaenge]) {
      texte.push(
        { quelle: `katalog.${art}.port.${p.id}.name`, text: p.name },
        { quelle: `katalog.${art}.port.${p.id}.hinweis`, text: p.hinweis }
      );
    }
  }

  for (const b of KEYMAP) texte.push({ quelle: `keymap.${b.befehl}`, text: b.text });

  return texte;
}

describe('Sprache der Spieltexte', () => {
  const texte = alleSpieltexte();

  it('sammelt überhaupt Texte ein', () => {
    expect(texte.length).toBeGreaterThan(200);
  });

  it('schreibt Umlaute aus, statt sie zu umschreiben', () => {
    const treffer: string[] = [];
    for (const { quelle, text } of texte) {
      const klein = text.toLowerCase();
      for (const stamm of VERBOTENE_STAEMME) {
        if (klein.includes(stamm)) {
          const stelle = klein.indexOf(stamm);
          treffer.push(`${quelle}: "…${text.slice(Math.max(0, stelle - 12), stelle + stamm.length + 12)}…"`);
          break;
        }
      }
    }
    expect(treffer, `Ersatzschreibung statt Umlaut:\n  ${treffer.slice(0, 25).join('\n  ')}`).toEqual([]);
  });

  it('verzichtet auf Emoji und Ausrufezeichen-Häufungen', () => {
    const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
    for (const { quelle, text } of texte) {
      expect(emoji.test(text), `${quelle} enthält ein Emoji`).toBe(false);
      expect(text.includes('!!'), `${quelle} häuft Ausrufezeichen`).toBe(false);
    }
  });

  it('hält höchstens ein Ausrufezeichen je Akt', () => {
    for (const a of AKTE) {
      const proAkt = texte
        .filter((t) => t.quelle.startsWith(`${romanisch(a.nummer)}-`) || t.quelle.startsWith(`akt${a.nummer}.`))
        .reduce((s, t) => s + (t.text.match(/!/g) ?? []).length, 0);
      expect(proAkt, `Akt ${a.nummer} hat ${proAkt} Ausrufezeichen`).toBeLessThanOrEqual(1);
    }
  });

  it('spricht die Spielerin durchgehend mit Du an', () => {
    // Kundenfiguren und MONOLITH ab Akt IX dürfen siezen — im Briefing und in
    // Ilvas Notizen darf "Sie" als Anrede der Spielerin nicht vorkommen.
    // Nur eindeutige Hoeflichkeitsformen. Ein blosses "Sie" ist im Deutschen
    // meist die dritte Person Plural ("Sie nennen es …") und kein Siezen.
    const anrede =
      /(^|[\s(„"])(Ihnen|Ihre[nmrs]?|Sie\s+(haben|sind|können|können|müssen|müssen|sollten|werden|finden|sehen))([\s.,;:!?"“)]|$)/;
    for (const l of ALLE_LEVEL) {
      if (l.notiz !== undefined) {
        expect(anrede.test(l.notiz), `${l.id}.notiz siezt: "${l.notiz}"`).toBe(false);
      }
    }
  });

  it('formuliert jede Zielformel lesbar', () => {
    for (const l of ALLE_LEVEL) {
      for (const z of l.ziele) {
        const f = zielFormel(z);
        expect(f.length, `${l.id}/${z.id}`).toBeGreaterThan(4);
        expect(f).toMatch(/[≥≤=]/);
      }
    }
  });
});

function romanisch(n: number): string {
  const z = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
  return z[n] ?? String(n);
}
