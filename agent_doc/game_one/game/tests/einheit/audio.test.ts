import { describe, expect, it } from 'vitest';
import * as S from '../../src/audio/synthese';

describe('probe', () => {
  it('zahlen', () => {
    const [rausch] = S.rauschDaten(200_000, 12345, 1);
    if (!rausch) throw new Error('kein rauschen');
    let summe = 0;
    for (const w of rausch) summe += w;
    const mittel = summe / rausch.length;
    let varianz = 0;
    for (const w of rausch) varianz += (w - mittel) ** 2;
    const std = Math.sqrt(varianz / rausch.length);
    console.log('rausch mittel', mittel, 'std', std);

    for (const vorgabe of [S.HALL_KURZ, S.HALL_LANG]) {
      const kanaele = S.impulsantwortDaten(48000, vorgabe);
      const k0 = kanaele[0];
      const k1 = kanaele[1];
      if (!k0 || !k1) throw new Error('kein kanal');
      const bloecke = S.energieHuelle(k0, Math.floor(k0.length / 24));
      let verstoesse = 0;
      let schlimmster = 0;
      const wo: number[] = [];
      for (let i = 1; i < bloecke.length; i++) {
        const a = bloecke[i - 1] ?? 0;
        const b = bloecke[i] ?? 0;
        if (b > a) {
          verstoesse++;
          wo.push(i);
          schlimmster = Math.max(schlimmster, b / Math.max(a, 1e-30));
        }
      }
      console.log('verstöße bei', wo, 'von', bloecke.length, 'letzte energien', bloecke.slice(-6));
      // Korrelation der Kanaele
      let kor = 0;
      for (let i = 0; i < 20000; i++) kor += (k0[i] ?? 0) * (k1[i] ?? 0);
      console.log(
        'IR',
        vorgabe.sekunden,
        'laenge',
        k0.length,
        'bloecke',
        bloecke.length,
        'verstoesse',
        verstoesse,
        'faktor',
        schlimmster,
        'kor',
        kor
      );
    }

    for (const f of [110, 146.83, 293.66, 440, 1480]) {
      const daten = S.karplusStrongDaten(48000, {
        frequenzHz: f,
        sekunden: 0.4,
        daempfung: 0.996,
        saat: 7,
      });
      const gefiltert = S.tiefpassKette(daten, 48000, f * 1.3, 6);
      const periode = 48000 / f;
      const ab = Math.round(10 * periode);
      const bis = Math.min(daten.length, Math.round(ab + 300 * periode));
      const nd = S.nulldurchgaenge(gefiltert, ab, bis);
      const gemessen = (nd * 48000) / (2 * (bis - ab));
      const soll = S.saitenGrundfrequenz(48000, f);
      // Hüllkurve in 20-ms-Fenstern
      const fenster = Math.round(48000 * 0.02);
      const spitzen: number[] = [];
      for (let start = 0; start + fenster <= daten.length; start += fenster) {
        let m = 0;
        for (let i = start; i < start + fenster; i++) m = Math.max(m, Math.abs(daten[i] ?? 0));
        spitzen.push(m);
      }
      let vers = 0;
      let maxFaktor = 0;
      for (let i = 1; i < spitzen.length; i++) {
        const a = spitzen[i - 1] ?? 0;
        const b = spitzen[i] ?? 0;
        if (b > a) {
          vers++;
          maxFaktor = Math.max(maxFaktor, b / Math.max(a, 1e-30));
        }
      }
      console.log(
        'KS',
        f,
        'soll',
        soll.toFixed(2),
        'gemessen',
        gemessen.toFixed(2),
        'abw%',
        (((gemessen - soll) / soll) * 100).toFixed(2),
        'spitzenverstoesse',
        vers,
        maxFaktor.toFixed(4),
        'erste spitze',
        (spitzen[0] ?? 0).toFixed(3)
      );
    }
    expect(true).toBe(true);
  });
});
