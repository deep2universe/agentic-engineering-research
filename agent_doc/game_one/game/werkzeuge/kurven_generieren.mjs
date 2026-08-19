/**
 * Erzeugt `src/sim/kurven.ts`.
 *
 * Warum ueberhaupt Tabellen? Die Simulation muss bitgleiche Ergebnisse auf
 * jeder Maschine liefern, weil Golden-Master-Tests, Replays, der Zeit-Debugger
 * und der Node-gegen-Browser-Kreuzcheck sonst wertlos sind. `Math.pow`,
 * `Math.exp` und die trigonometrischen Funktionen sind in IEEE-754 NICHT
 * bitgenau spezifiziert und unterscheiden sich zwischen V8-Versionen und
 * Plattformen. Grundrechenarten, `Math.sqrt` und `Math.round` sind es sehr
 * wohl. Also werden alle nichtlinearen Kurven hier EINMAL vorberechnet, als
 * Integer-Tabelle eingecheckt und zur Laufzeit nur noch linear interpoliert.
 *
 * Aufruf: node werkzeuge/kurven_generieren.mjs
 */
import { writeFileSync } from 'node:fs';

const N = 1024; // Stuetzstellen je Kurve
const SKALA = 1_000_000; // Festkomma-Einheit

/** Kurven-Definitionen. Eingang und Ausgang jeweils in [0, 1]. */
const KURVEN = [
  {
    name: 'KURVE_KOMPETENZ',
    kommentar:
      'Wie stark eine Kompetenzluecke die Guete-Decke druckt. Eingang: max(0, schwierigkeit - kompetenz)\n' +
      ' * skaliert auf [0,1] (also geteilt durch 1). Ausgang: Deckelabzug. Form x^1.6 mal Steilheit 1.6,\n' +
      ' * geklemmt auf 1 — ein Kern kann eine Aufgabe komplett verfehlen, aber nicht mehr als komplett.',
    f: (x) => Math.min(1, Math.pow(x, 1.6) * 1.6 * 1.9),
  },
  {
    name: 'KURVE_KONTEXT_ROT',
    kommentar:
      'Context Rot. Eingang: (kontext - 0.45) / 0.55, also der Anteil oberhalb der Schwelle.\n' +
      ' * Ausgang: Anteil der Wirkung, der verloren geht (noch ohne KONTEXT_ROT_MAX). Form x^1.5.',
    f: (x) => Math.pow(x, 1.5),
  },
  {
    name: 'KURVE_HALLUZINATION',
    kommentar:
      'Saettigungskurve fuer die Halluzinationswahrscheinlichkeit. Eingang: roher Risikoterm,\n' +
      ' * Ausgang: Wahrscheinlichkeit. Verhindert, dass Risiken linear ueber 1 hinauswachsen.',
    f: (x) => 1 - Math.exp(-2.2 * x),
  },
  {
    name: 'KURVE_ERTRAG',
    kommentar:
      'Abnehmender Grenzertrag fuer Aggregations- und Wiederholungsgewinne.\n' +
      ' * Eingang: normierte Anzahl (n-1)/8, Ausgang: Ertragsfaktor. Form 1-(1-x)^2 gedaempft.',
    f: (x) => 1 - Math.pow(1 - x, 2.2),
  },
];

function tabelle(f) {
  const werte = [];
  for (let i = 0; i < N; i++) {
    const x = i / (N - 1);
    const y = f(x);
    werte.push(Math.round(Math.min(1, Math.max(0, y)) * SKALA));
  }
  return werte;
}

function formatiere(werte) {
  const zeilen = [];
  for (let i = 0; i < werte.length; i += 16) {
    zeilen.push('  ' + werte.slice(i, i + 16).join(', ') + ',');
  }
  return zeilen.join('\n');
}

let out = `/**
 * ERZEUGTE DATEI — nicht von Hand aendern.
 * Quelle: werkzeuge/kurven_generieren.mjs · Stuetzstellen: ${N} · Festkomma: ${SKALA}
 *
 * Alle nichtlinearen Kurven der Simulation als Integer-Tabellen. Zur Laufzeit
 * wird ausschliesslich linear interpoliert — nur +, -, *, / und Math.floor.
 * Damit ist jede Auswertung bitgleich reproduzierbar, unabhaengig von
 * Plattform und V8-Version.
 */

const N = ${N};
const SKALA = ${SKALA};

/** Lineare Interpolation in einer Kurventabelle. Eingang wird auf [0,1] geklemmt. */
function lies(tabelle: readonly number[], x: number): number {
  if (!(x > 0)) return tabelle[0]! / SKALA;
  if (x >= 1) return tabelle[N - 1]! / SKALA;
  const p = x * (N - 1);
  const i = Math.floor(p);
  const t = p - i;
  const a = tabelle[i]!;
  const b = tabelle[i + 1] ?? a;
  return (a + (b - a) * t) / SKALA;
}
`;

for (const k of KURVEN) {
  const t = tabelle(k.f);
  out += `
/**
 * ${k.kommentar}
 */
const T_${k.name} : readonly number[] = [
${formatiere(t)}
];
export function ${k.name}(x: number): number {
  return lies(T_${k.name}, x);
}
`;
}

writeFileSync(new URL('../src/sim/kurven.ts', import.meta.url), out);
console.log(`src/sim/kurven.ts erzeugt: ${KURVEN.length} Kurven x ${N} Stuetzstellen`);
