/**
 * Bildmasse aus dem fertigen Bildschirmfoto — dieselbe Rechnung wie in den
 * Browsertests, hier fuer die Werkzeuge auf der Kommandozeile.
 *
 * NICHT ueber `drawImage` auf die Leinwand messen: Ein WebGL-Kontext ohne
 * `preserveDrawingBuffer` gibt seinen Zeichenpuffer nach dem Compositing frei
 * und liefert dann schwarz zurueck — auch wenn auf dem Schirm alles steht.
 */
import { inflateSync } from 'node:zlib';

export function statistikAusPng(png) {
  let pos = 8;
  let breite = 0;
  let hoehe = 0;
  let farbtyp = 0;
  const daten = [];
  while (pos < png.length) {
    const laenge = png.readUInt32BE(pos);
    const art = png.toString('ascii', pos + 4, pos + 8);
    const inhalt = png.subarray(pos + 8, pos + 8 + laenge);
    if (art === 'IHDR') { breite = inhalt.readUInt32BE(0); hoehe = inhalt.readUInt32BE(4); farbtyp = inhalt.readUInt8(9); }
    else if (art === 'IDAT') daten.push(inhalt);
    else if (art === 'IEND') break;
    pos += 12 + laenge;
  }
  const k = farbtyp === 6 ? 4 : 3;
  const roh = inflateSync(Buffer.concat(daten));
  const zeile = breite * k;
  const vorige = Buffer.alloc(zeile);
  const akt = Buffer.alloc(zeile);
  let summe = 0, max = 0, sichtbar = 0;
  const farben = new Set();
  for (let y = 0; y < hoehe; y++) {
    const f = roh[y * (zeile + 1)];
    roh.copy(akt, 0, y * (zeile + 1) + 1, y * (zeile + 1) + 1 + zeile);
    for (let i = 0; i < zeile; i++) {
      const a = i >= k ? akt[i - k] : 0;
      const b = vorige[i];
      const c = i >= k ? vorige[i - k] : 0;
      const x = akt[i];
      let w = x;
      if (f === 1) w = x + a;
      else if (f === 2) w = x + b;
      else if (f === 3) w = x + ((a + b) >> 1);
      else if (f === 4) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        w = x + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
      }
      akt[i] = w & 0xff;
    }
    for (let x = 0; x < breite; x++) {
      const q = x * k;
      const l = akt[q] * 0.299 + akt[q + 1] * 0.587 + akt[q + 2] * 0.114;
      summe += l; if (l > max) max = l; if (l > 16) sichtbar += 1;
      farben.add((akt[q] >> 3) << 10 | (akt[q + 1] >> 3) << 5 | (akt[q + 2] >> 3));
    }
    akt.copy(vorige);
  }
  const n = breite * hoehe;
  return {
    mittel: +(summe / n).toFixed(2),
    max: Math.round(max),
    anteilSichtbar: +(sichtbar / n).toFixed(3),
    farben: farben.size,
  };
}

/** Misst nur die Leinwand, nicht das HUD. */
export async function statistik(seite) {
  return statistikAusPng(await seite.locator('#leinwand').screenshot());
}
