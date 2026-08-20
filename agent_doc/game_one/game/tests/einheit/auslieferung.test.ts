/**
 * AUSLIEFERUNGSPRÜFUNG.
 *
 * Prüft das echte Produktionsbündel, nicht den Quelltext. Der wichtigste Punkt:
 * die Debug-Schnittstelle darf im ausgelieferten Spiel nicht existieren. Mit
 * ihr liessen sich Metriken von aussen setzen — und ein Lernspiel, in dem man
 * das Ergebnis fälschen kann, vermittelt nichts mehr.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const DIST = 'dist';
const vorhanden = existsSync(DIST);

function alleDateien(wurzel: string, treffer: string[] = []): string[] {
  for (const name of readdirSync(wurzel)) {
    const pfad = join(wurzel, name);
    if (statSync(pfad).isDirectory()) alleDateien(pfad, treffer);
    else treffer.push(pfad);
  }
  return treffer;
}

describe.skipIf(!vorhanden)('Produktionsbündel', () => {
  const dateien = vorhanden ? alleDateien(DIST) : [];
  const skripte = dateien.filter((d) => d.endsWith('.js'));

  it('wurde überhaupt gebaut', () => {
    expect(skripte.length).toBeGreaterThan(0);
    expect(dateien.some((d) => d.endsWith('index.html'))).toBe(true);
  });

  it('enthält die Debug-Schnittstelle NICHT', () => {
    for (const d of skripte) {
      const inhalt = readFileSync(d, 'utf8');
      expect(inhalt.includes('__spiel'), `${d} enthält die Debug-Schnittstelle`).toBe(false);
      expect(inhalt.includes('haengeDebugApiEin'), `${d} enthält den Debug-Einhänger`).toBe(false);
    }
  });

  it('lädt keine fremden Adressen nach', () => {
    /*
     * Null externe Assets ist eine Grundsatzentscheidung: kein CDN, keine
     * Schriftdatei, kein Bild, kein Ton von aussen.
     *
     * Geprüft wird das LADEN, nicht das blosse Vorkommen einer Adresse.
     * In three.js stehen Quellenangaben als Kommentar im Bündel
     * (github.com, shadertoy.com) — das ist eine Fussnote, kein Netzzugriff.
     */
    const ladeMuster = [
      /fetch\(\s*['"`]https?:/,
      /\.open\(\s*['"`](?:GET|POST)['"`]\s*,\s*['"`]https?:/,
      /import\(\s*['"`]https?:/,
      /<(?:script|link|img)[^>]+(?:src|href)=["']https?:/i,
      /@import\s+url\(\s*['"]?https?:/i,
    ];
    for (const d of [...skripte, ...dateien.filter((x) => x.endsWith('.css') || x.endsWith('.html'))]) {
      const inhalt = readFileSync(d, 'utf8');
      for (const muster of ladeMuster) {
        const treffer = muster.exec(inhalt);
        expect(treffer, `${d} lädt von aussen nach: ${treffer?.[0] ?? ''}`).toBeNull();
      }
    }
  });

  it('bleibt in einer Größe, die auch über eine schlechte Leitung lädt', () => {
    const gesamt = dateien.reduce((s, d) => s + statSync(d).size, 0);
    expect(gesamt / 1024 / 1024, `Bündel ist ${(gesamt / 1024 / 1024).toFixed(1)} MB gross`).toBeLessThan(6);
  });
});
