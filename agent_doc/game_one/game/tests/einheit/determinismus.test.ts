/**
 * DER DETERMINISMUS-WÄCHTER.
 *
 * Die Simulation muss auf jeder Maschine bitgleich dasselbe Ergebnis liefern.
 * Davon hängen Golden-Master-Prüfungen, der Zeit-Debugger, die Wiedergabe von
 * Läufen, der Vergleich mit anderen Spielenden und der Kreuzcheck zwischen Node
 * und Browser ab. Fällt der Determinismus, fällt die gesamte Verifikation — und
 * zwar leise.
 *
 * Deshalb wird die Regel hier am QUELLTEXT geprüft, nicht am Verhalten. Ein
 * Laufzeittest erwischt nur, was er ausführt; eine Textsuche erwischt auch den
 * Pfad, den heute noch niemand nimmt.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { simuliere } from '../../src/sim/simulation';
import { ALLE_LEVEL } from '../../src/inhalt/kampagne';
import { zufall, zufallGanz, zufallJa, zufallNormal, hashText } from '../../src/sim/rng';

function dateienUnter(wurzel: string): string[] {
  const treffer: string[] = [];
  for (const name of readdirSync(wurzel)) {
    const pfad = join(wurzel, name);
    if (statSync(pfad).isDirectory()) treffer.push(...dateienUnter(pfad));
    else if (name.endsWith('.ts') && !name.endsWith('.d.ts')) treffer.push(pfad);
  }
  return treffer;
}

/** Entfernt Kommentare, damit eine Erwähnung im Fließtext nichts auslöst. */
function ohneKommentare(quelle: string): string {
  return quelle.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

const SIM_DATEIEN = dateienUnter('src/sim');

describe('Determinismus-Wächter über src/sim', () => {
  it('findet überhaupt Dateien', () => {
    expect(SIM_DATEIEN.length).toBeGreaterThanOrEqual(8);
  });

  it('benutzt keine unbestimmten Zeitquellen', () => {
    const verboten = ['Math.random(', 'Date.now(', 'performance.now(', 'new Date('];
    for (const pfad of SIM_DATEIEN) {
      const code = ohneKommentare(readFileSync(pfad, 'utf8'));
      for (const muster of verboten) {
        expect(code.includes(muster), `${pfad} benutzt ${muster}`).toBe(false);
      }
    }
  });

  it('benutzt keine transzendenten Funktionen', () => {
    /*
     * `Math.pow`, `Math.exp`, `Math.log` und die Winkelfunktionen sind in
     * IEEE-754 NICHT bitgenau festgelegt: verschiedene V8-Versionen und
     * Plattformen liefern im letzten Bit unterschiedliche Ergebnisse. In einer
     * Simulation, die über Tausende Ticks akkumuliert, wächst genau daraus eine
     * sichtbare Abweichung. Erlaubt bleiben Grundrechenarten, `Math.sqrt`,
     * `Math.round`, `Math.floor`, `Math.min/max` und `Math.abs` — die sind
     * korrekt gerundet und damit überall gleich.
     *
     * Alle nichtlinearen Kurven laufen deshalb über die Integer-Tabellen in
     * `kurven.ts`.
     */
    const verboten = ['Math.pow(', 'Math.exp(', 'Math.log(', 'Math.sin(', 'Math.cos(', 'Math.tan(', 'Math.atan2('];
    for (const pfad of SIM_DATEIEN) {
      const code = ohneKommentare(readFileSync(pfad, 'utf8'));
      for (const muster of verboten) {
        expect(code.includes(muster), `${pfad} benutzt ${muster} — nutze die Tabellen aus kurven.ts`).toBe(false);
      }
    }
  });

  it('hält die Simulation frei von Renderer, DOM und Zeitgebern', () => {
    const verboten = ["from 'three", 'window.', 'document.', 'setTimeout(', 'setInterval(', 'requestAnimationFrame('];
    for (const pfad of SIM_DATEIEN) {
      const code = ohneKommentare(readFileSync(pfad, 'utf8'));
      for (const muster of verboten) {
        expect(code.includes(muster), `${pfad} greift auf ${muster} zu`).toBe(false);
      }
    }
  });

  it('iteriert nie unsortiert über Map oder Set', () => {
    /*
     * `for (const x of meineMap.values())` läuft in Einfügereihenfolge. Sobald
     * jemand dieselben Module in anderer Reihenfolge platziert, ist der Lauf ein
     * anderer — und niemand merkt es, weil beide Läufe für sich plausibel
     * aussehen. Erlaubt ist die Iteration nur über explizit sortierte Arrays.
     */
    const verdaechtig = [/\.values\(\)\s*\)/, /\.keys\(\)\s*\)/, /Object\.keys\([^)]*\)\s*\)/];
    for (const pfad of SIM_DATEIEN) {
      const code = ohneKommentare(readFileSync(pfad, 'utf8'));
      const zeilen = code.split('\n');
      zeilen.forEach((zeile, i) => {
        if (!zeile.includes('for (')) return;
        for (const muster of verdaechtig) {
          expect(
            muster.test(zeile),
            `${pfad}:${i + 1} iteriert unsortiert: ${zeile.trim()}`
          ).toBe(false);
        }
      });
    }
  });
});

describe('Reproduzierbarkeit des Zufalls', () => {
  it('liefert für dieselben Argumente immer denselben Wert', () => {
    for (let i = 0; i < 200; i++) {
      const a = zufall(4711, 'kanal.test', 'paket', i);
      const b = zufall(4711, 'kanal.test', 'paket', i);
      expect(a).toBe(b);
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThan(1);
    }
  });

  it('trennt Kanäle sauber voneinander', () => {
    const a = Array.from({ length: 64 }, (_, i) => zufall(1, 'kanal.a', i));
    const b = Array.from({ length: 64 }, (_, i) => zufall(1, 'kanal.b', i));
    const gleiche = a.filter((x, i) => x === b[i]).length;
    expect(gleiche, 'Zwei Kanäle liefern verdächtig oft denselben Wert').toBeLessThan(3);
  });

  it('ist unabhängig von der Reihenfolge der Abfragen', () => {
    // Genau diese Eigenschaft unterscheidet den hashbasierten Zufall von einem
    // sequentiellen Strom — und nur sie erlaubt es, die Simulation später über
    // mehrere Kerne zu verteilen, ohne das Ergebnis zu ändern.
    const vorwaerts = Array.from({ length: 50 }, (_, i) => zufall(9, 'k', i));
    const rueckwaerts: number[] = [];
    for (let i = 49; i >= 0; i--) rueckwaerts[i] = zufall(9, 'k', i);
    expect(rueckwaerts).toEqual(vorwaerts);
  });

  it('streut gleichmäßig genug für Wahrscheinlichkeiten', () => {
    const eimer = new Array<number>(10).fill(0);
    for (let i = 0; i < 20000; i++) {
      const idx = Math.min(9, Math.floor(zufall(3, 'streu', i) * 10));
      eimer[idx] = (eimer[idx] ?? 0) + 1;
    }
    for (const [i, n] of eimer.entries()) {
      expect(n, `Eimer ${i} ist mit ${n} von 2000 unplausibel besetzt`).toBeGreaterThan(1700);
      expect(n).toBeLessThan(2300);
    }
  });

  it('hält bei zufallJa die zugesagte Wahrscheinlichkeit ein', () => {
    for (const p of [0.05, 0.25, 0.5, 0.85]) {
      let treffer = 0;
      for (let i = 0; i < 20000; i++) if (zufallJa(7, 'ja', p, i)) treffer++;
      expect(Math.abs(treffer / 20000 - p), `p=${p}`).toBeLessThan(0.02);
    }
  });

  it('liefert bei zufallNormal Mittelwert nahe null', () => {
    let summe = 0;
    for (let i = 0; i < 20000; i++) summe += zufallNormal(11, 'normal', i);
    expect(Math.abs(summe / 20000)).toBeLessThan(0.05);
  });

  it('hält zufallGanz in den Grenzen', () => {
    for (let i = 0; i < 5000; i++) {
      const n = zufallGanz(5, 'ganz', 7, i);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(7);
      expect(Number.isInteger(n)).toBe(true);
    }
    expect(zufallGanz(5, 'ganz', 0, 1)).toBe(0);
  });

  it('hasht Text stabil', () => {
    expect(hashText('SCHWARMWERK')).toBe(hashText('SCHWARMWERK'));
    expect(hashText('SCHWARMWERK')).not.toBe(hashText('SCHWARMWERL'));
  });
});

describe('Reproduzierbarkeit ganzer Läufe', () => {
  it('liefert für jedes Level bei gleicher Saat dieselbe Prüfsumme', () => {
    for (const level of ALLE_LEVEL) {
      const referenz = level.referenzen[0];
      if (!referenz) continue;
      const a = simuliere({ werk: referenz.werk, strom: level.strom, saat: level.saat });
      const b = simuliere({ werk: referenz.werk, strom: level.strom, saat: level.saat });
      expect(b.pruefsumme, `${level.id} ist nicht reproduzierbar`).toBe(a.pruefsumme);
      expect(b.metriken).toEqual(a.metriken);
    }
  });

  it('liefert bei anderer Saat ein anderes Ergebnis', () => {
    const level = ALLE_LEVEL[0]!;
    const referenz = level.referenzen[0]!;
    const a = simuliere({ werk: referenz.werk, strom: level.strom, saat: level.saat });
    const b = simuliere({ werk: referenz.werk, strom: level.strom, saat: level.saat + 1 });
    expect(b.pruefsumme).not.toBe(a.pruefsumme);
  });

  it('hängt nicht von der Reihenfolge ab, in der das Werk aufgebaut wurde', () => {
    for (const level of ALLE_LEVEL.slice(0, 12)) {
      const referenz = level.referenzen[0];
      if (!referenz) continue;
      const gedreht = {
        module: [...referenz.werk.module].reverse(),
        leitungen: [...referenz.werk.leitungen].reverse(),
      };
      const a = simuliere({ werk: referenz.werk, strom: level.strom, saat: level.saat });
      const b = simuliere({ werk: gedreht, strom: level.strom, saat: level.saat });
      expect(b.pruefsumme, `${level.id} hängt von der Bau-Reihenfolge ab`).toBe(a.pruefsumme);
    }
  });
});
