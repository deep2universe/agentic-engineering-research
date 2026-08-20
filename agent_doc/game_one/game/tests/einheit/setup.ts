/**
 * Laufzeit-Falle gegen Nichtdeterminismus.
 *
 * `Math.random` und `Date.now` sind in der Simulation verboten. Der
 * Quelltext-Scan in `determinismus.test.ts` faengt die statischen Fälle; diese
 * Falle faengt alles, was sich über Umwege einschleicht (z. B. eine
 * Bibliothek, die intern würfelt).
 */

const echtesRandom = Math.random;

Math.random = (): number => {
  throw new Error(
    'Math.random ist in SCHWARMWERK verboten. Nutze src/sim/rng.ts (hashbasiert, reihenfolgeunabhängig).'
  );
};

// Einzelne Testwerkzeuge (z. B. fast-check) brauchen echten Zufall für die
// Fallgenerierung — nicht für die Simulation. Sie dürfen ihn hier abholen.
(globalThis as unknown as { __echtesRandom: () => number }).__echtesRandom = echtesRandom;
