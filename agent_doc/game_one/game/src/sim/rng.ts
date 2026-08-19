/**
 * Deterministischer Zufall fuer SCHWARMWERK.
 *
 * Entwurfsentscheidung: Es gibt KEINEN sequentiellen Zufallsstrom. Jeder
 * Zufallswert wird aus einem Hash ueber (Saat, Kanal, Index...) abgeleitet.
 * Dadurch ist das Ergebnis vollstaendig unabhaengig von der Auswertungs-
 * reihenfolge der Simulation — eine Voraussetzung dafuer, dass die Simulation
 * parallelisierbar bleibt und Golden-Master-Tests niemals flackern.
 *
 * Math.random() und Date.now() sind im gesamten sim/-Verzeichnis verboten;
 * `tests/einheit/determinismus.test.ts` erzwingt das per Quelltext-Scan.
 */

/** 32-Bit-Mischfunktion (splitmix32-Variante, Finalizer aus MurmurHash3). */
function mische(x: number): number {
  let h = x | 0;
  h = Math.imul(h ^ (h >>> 16), 0x21f0aaad);
  h = Math.imul(h ^ (h >>> 15), 0x735a2d97);
  h = h ^ (h >>> 15);
  return h >>> 0;
}

/** FNV-1a ueber eine Zeichenkette — stabil ueber alle Laufzeiten hinweg. */
export function hashText(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Liefert eine reproduzierbare Gleitkommazahl in [0, 1).
 *
 * @param saat  Laufsaat des Simulationslaufs.
 * @param kanal Fachlicher Kanal, z. B. "kern.streuung" — trennt unabhaengige
 *              Zufallsquellen sauber voneinander.
 * @param teile Beliebig viele Diskriminatoren (Auftrags-Id, Knoten-Id, Besuch).
 */
export function zufall(saat: number, kanal: string, ...teile: (string | number)[]): number {
  let h = mische(saat ^ hashText(kanal));
  for (const teil of teile) {
    const wert = typeof teil === 'number' ? (teil | 0) : hashText(teil);
    h = mische(h ^ (wert + 0x9e3779b9 + ((h << 6) | 0) + (h >>> 2)));
  }
  // 24 signifikante Bits reichen und vermeiden Rundungsartefakte.
  return (h >>> 8) / 0x01000000;
}

/** Reproduzierbare Ganzzahl in [0, obergrenze). */
export function zufallGanz(
  saat: number,
  kanal: string,
  obergrenze: number,
  ...teile: (string | number)[]
): number {
  if (obergrenze <= 0) return 0;
  return Math.min(obergrenze - 1, Math.floor(zufall(saat, kanal, ...teile) * obergrenze));
}

/** Reproduzierbarer Muenzwurf mit Wahrscheinlichkeit `p` fuer `true`. */
export function zufallJa(
  saat: number,
  kanal: string,
  p: number,
  ...teile: (string | number)[]
): boolean {
  return zufall(saat, kanal, ...teile) < p;
}

/**
 * Naeherungsweise normalverteilter Wert (Irwin–Hall, n = 4), Mittelwert 0,
 * Standardabweichung ~1. Wird fuer Guete-Streuung von Modell-Kernen benutzt.
 */
export function zufallNormal(
  saat: number,
  kanal: string,
  ...teile: (string | number)[]
): number {
  let summe = 0;
  for (let i = 0; i < 4; i++) summe += zufall(saat, kanal + ':' + i, ...teile);
  return (summe - 2) * 1.732;
}

/** Sequentieller Generator — ausschliesslich fuer Werkzeuge/Generatoren ausserhalb der Simulation. */
export function erzeugeStrom(saat: number): () => number {
  let zustand = saat >>> 0;
  return () => {
    zustand = (zustand + 0x9e3779b9) >>> 0;
    return mische(zustand) / 0x100000000;
  };
}
