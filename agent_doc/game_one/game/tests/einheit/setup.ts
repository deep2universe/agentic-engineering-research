/**
 * Laufzeit-Falle gegen Nichtdeterminismus.
 *
 * `Math.random` und `Date.now` sind in der Simulation verboten. Der
 * Quelltext-Scan in `determinismus.test.ts` faengt die statischen Faelle; diese
 * Falle faengt alles, was sich ueber Umwege einschleicht (z. B. eine
 * Bibliothek, die intern wuerfelt).
 */

const echtesRandom = Math.random;

Math.random = (): number => {
  throw new Error(
    'Math.random ist in SCHWARMWERK verboten. Nutze src/sim/rng.ts (hashbasiert, reihenfolgeunabhaengig).'
  );
};

// Einzelne Testwerkzeuge (z. B. fast-check) brauchen echten Zufall fuer die
// Fallgenerierung — nicht fuer die Simulation. Sie duerfen ihn hier abholen.
(globalThis as unknown as { __echtesRandom: () => number }).__echtesRandom = echtesRandom;
