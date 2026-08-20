/**
 * Vertrag der prozeduralen Audio-Engine.
 *
 * Zwei Ebenen werden geprüft:
 *
 * 1. **Die reinen Rechenkerne aus `synthese.ts`** — Rauschen, Impulsantworten,
 *    Karplus-Strong, Skalen. Die laufen ohne jede Audio-Umgebung und werden
 *    darum IMMER geprüft.
 * 2. **Das Klangwerk selbst.** Node 22 bringt keinen `OfflineAudioContext`
 *    mit. Statt die Prüfung dann ersatzlos ausfallen zu lassen, faehrt sie
 *    auf einer Attrappe des Web-Audio-Graphen weiter: die Attrappe zeichnet
 *    jeden erzeugten Knoten, jede Verbindung und jede Parameterplanung auf.
 *    Damit lässt sich genau das prüfen, worauf es hier ankommt — Knotenzahl,
 *    Stimmenlimit, Frequenzen, sauberes Abräumen. Wo echte Abtastwerte noetig
 *    sind (Schwebungsmessung), steht ein `it.skipIf`, das nur mit echtem
 *    `OfflineAudioContext` läuft.
 */

import { describe, expect, it } from 'vitest';
import {
  AEOLISCH,
  DORISCH,
  HALL_KURZ,
  HALL_LANG,
  akkordFrequenzen,
  anschlag,
  energieHuelle,
  impulsantwortDaten,
  karplusStrongDaten,
  midiZuHz,
  nulldurchgaenge,
  quartAkkord,
  rauschDaten,
  reglerZuPegel,
  saitenGrundfrequenz,
  skalenTon,
  stufeZuHalbton,
  tiefpassKette,
  weichesZiel,
} from '../../src/audio/synthese';
import { Klangwerk, type Achse, type Klang } from '../../src/audio/klangwerk';

const RATE = 48_000;

const ALLE_KLAENGE: readonly Klang[] = [
  'ui_zeiger',
  'ui_waehlen',
  'ui_abbruch',
  'ui_fehler',
  'modul_setzen',
  'modul_entfernen',
  'modul_drehen',
  'leitung_verbinden',
  'leitung_trennen',
  'sim_start',
  'sim_pause',
  'sim_tick',
  'paket_eintritt',
  'paket_auslieferung',
  'paket_verworfen',
  'alarm',
  'schleife',
  'freigabe_mensch',
  'ziel_erreicht',
  'level_bestanden',
  'level_gescheitert',
  'notiz_beginn',
  'seite_blaettern',
];

const ALLE_ACHSEN: readonly Achse[] = ['spannung', 'aktivitaet', 'gefahr', 'erfolg', 'ruhe'];

// ===========================================================================
// Attrappe des Web-Audio-Graphen
// ===========================================================================

interface Planpunkt {
  readonly art: 'abbruch' | 'setze' | 'linear' | 'exponentiell' | 'ziel';
  readonly wert: number;
  readonly zeit: number;
}

class ParamAttrappe {
  value: number;
  readonly plan: Planpunkt[] = [];

  constructor(wert: number) {
    this.value = wert;
  }

  cancelScheduledValues(zeit: number): this {
    this.plan.push({ art: 'abbruch', wert: 0, zeit });
    return this;
  }
  setValueAtTime(wert: number, zeit: number): this {
    this.plan.push({ art: 'setze', wert, zeit });
    this.value = wert;
    return this;
  }
  linearRampToValueAtTime(wert: number, zeit: number): this {
    this.plan.push({ art: 'linear', wert, zeit });
    return this;
  }
  exponentialRampToValueAtTime(wert: number, zeit: number): this {
    this.plan.push({ art: 'exponentiell', wert, zeit });
    return this;
  }
  setTargetAtTime(wert: number, zeit: number, _tau: number): this {
    this.plan.push({ art: 'ziel', wert, zeit });
    return this;
  }
}

class PufferAttrappe {
  private readonly kanaele: Float32Array[] = [];

  constructor(
    readonly numberOfChannels: number,
    readonly length: number,
    readonly sampleRate: number
  ) {
    for (let k = 0; k < numberOfChannels; k++) this.kanaele.push(new Float32Array(length));
  }

  get duration(): number {
    return this.length / this.sampleRate;
  }
  getChannelData(k: number): Float32Array {
    return this.kanaele[k] ?? new Float32Array(this.length);
  }
  copyToChannel(quelle: Float32Array, k: number): void {
    this.kanaele[k]?.set(quelle.subarray(0, this.length));
  }
}

class KnotenAttrappe {
  readonly gain: ParamAttrappe;
  readonly frequency = new ParamAttrappe(350);
  readonly detune = new ParamAttrappe(0);
  readonly Q = new ParamAttrappe(1);
  readonly offset = new ParamAttrappe(0);
  readonly delayTime = new ParamAttrappe(0);
  readonly pan = new ParamAttrappe(0);
  readonly playbackRate = new ParamAttrappe(1);
  readonly threshold = new ParamAttrappe(0);
  readonly knee = new ParamAttrappe(0);
  readonly ratio = new ParamAttrappe(1);
  readonly attack = new ParamAttrappe(0);
  readonly release = new ParamAttrappe(0);
  type = '';
  buffer: PufferAttrappe | null = null;
  loop = false;
  loopStart = 0;
  loopEnd = 0;
  normalize = true;
  getrennt = false;
  readonly ziele: unknown[] = [];
  readonly startZeiten: number[] = [];
  readonly stoppZeiten: number[] = [];

  constructor(readonly art: string) {
    this.gain = new ParamAttrappe(1);
  }

  connect(ziel: unknown): unknown {
    this.ziele.push(ziel);
    return ziel;
  }
  disconnect(): void {
    this.getrennt = true;
    this.ziele.length = 0;
  }
  start(zeit = 0, _versatz = 0): void {
    this.startZeiten.push(zeit);
  }
  stop(zeit = 0): void {
    this.stoppZeiten.push(zeit);
  }
}

/** Ein vollständig aufzeichnender Ersatz für einen `BaseAudioContext`. */
class KontextAttrappe {
  readonly sampleRate = RATE;
  currentTime = 0;
  readonly knoten: KnotenAttrappe[] = [];
  readonly destination: KnotenAttrappe;

  constructor() {
    this.destination = this.neu('ziel');
  }

  private neu(art: string): KnotenAttrappe {
    const knoten = new KnotenAttrappe(art);
    this.knoten.push(knoten);
    return knoten;
  }

  vonArt(art: string): KnotenAttrappe[] {
    return this.knoten.filter((k) => k.art === art);
  }

  createGain(): KnotenAttrappe {
    return this.neu('gain');
  }
  createOscillator(): KnotenAttrappe {
    return this.neu('oszillator');
  }
  createBufferSource(): KnotenAttrappe {
    return this.neu('pufferquelle');
  }
  createBiquadFilter(): KnotenAttrappe {
    return this.neu('filter');
  }
  createConvolver(): KnotenAttrappe {
    return this.neu('convolver');
  }
  createDelay(_maximum?: number): KnotenAttrappe {
    return this.neu('verzoegerung');
  }
  createStereoPanner(): KnotenAttrappe {
    return this.neu('panner');
  }
  createDynamicsCompressor(): KnotenAttrappe {
    return this.neu('kompressor');
  }
  createConstantSource(): KnotenAttrappe {
    return this.neu('konstante');
  }
  createBuffer(kanaele: number, laenge: number, rate: number): PufferAttrappe {
    return new PufferAttrappe(kanaele, laenge, rate);
  }
}

/**
 * Die Attrappe erfüllt den Vertrag strukturell, aber nicht nominal — daher
 * die Brücke über `unknown`. `any` kommt nicht vor: jeder Aufruf, den das
 * Klangwerk taetigt, ist oben mit echten Typen ausprogrammiert.
 */
function baueWerk(einstellungen?: { musik?: number; klaenge?: number }): {
  werk: Klangwerk;
  ctx: KontextAttrappe;
} {
  const ctx = new KontextAttrappe();
  const werk = new Klangwerk(einstellungen, ctx as unknown as BaseAudioContext);
  return { werk, ctx };
}

const hatEchtenOfflineKontext = typeof globalThis.OfflineAudioContext !== 'undefined';

// ===========================================================================
// 1. Rauschen
// ===========================================================================

describe('Rauschen', () => {
  it('ist mittelwertfrei und hat die Streuung einer Gleichverteilung', () => {
    const feld = rauschDaten(200_000, 0x1234_5678, 1)[0];
    expect(feld).toBeDefined();
    if (!feld) return;

    let summe = 0;
    for (const wert of feld) summe += wert;
    const mittel = summe / feld.length;

    let quadrate = 0;
    for (const wert of feld) quadrate += (wert - mittel) ** 2;
    const streuung = Math.sqrt(quadrate / feld.length);

    // Gleichverteilung auf [-1, 1): Erwartungswert 0, Streuung 1/sqrt(3) = 0,577.
    expect(Math.abs(mittel)).toBeLessThan(0.01);
    expect(streuung).toBeGreaterThan(0.55);
    expect(streuung).toBeLessThan(0.6);
    expect(feld.every((w) => Number.isFinite(w) && w >= -1 && w < 1)).toBe(true);
  });

  it('ist bei gleicher Saat identisch und bei anderer Saat verschieden', () => {
    const a = rauschDaten(2048, 99, 1)[0];
    const b = rauschDaten(2048, 99, 1)[0];
    const c = rauschDaten(2048, 100, 1)[0];
    if (!a || !b || !c) throw new Error('Rauschen fehlt');
    expect(Array.from(a)).toEqual(Array.from(b));
    expect(Array.from(a)).not.toEqual(Array.from(c));
  });

  it('liefert dekorrelierte Kanaele — sonst klebt der Hall in der Mitte', () => {
    const [links, rechts] = rauschDaten(100_000, 4711, 2);
    if (!links || !rechts) throw new Error('Rauschen fehlt');

    let kreuz = 0;
    let energieL = 0;
    let energieR = 0;
    for (let i = 0; i < links.length; i++) {
      const l = links[i] ?? 0;
      const r = rechts[i] ?? 0;
      kreuz += l * r;
      energieL += l * l;
      energieR += r * r;
    }
    const korrelation = kreuz / Math.sqrt(energieL * energieR);
    expect(Math.abs(korrelation)).toBeLessThan(0.02);
  });
});

// ===========================================================================
// 2. Impulsantworten
// ===========================================================================

describe('Impulsantwort', () => {
  for (const [name, vorgabe] of [
    ['kurzer Raum', HALL_KURZ],
    ['große Halle', HALL_LANG],
  ] as const) {
    it(`${name}: Länge, Endlichkeit und monoton fallende Energie`, () => {
      const kanaele = impulsantwortDaten(RATE, vorgabe);
      expect(kanaele).toHaveLength(2);

      for (const kanal of kanaele) {
        expect(kanal.length).toBe(Math.round(RATE * vorgabe.sekunden));
        expect(kanal.every((w) => Number.isFinite(w))).toBe(true);

        const bloecke = energieHuelle(kanal, Math.floor(kanal.length / 24));
        expect(bloecke.length).toBeGreaterThanOrEqual(24);
        for (let i = 1; i < bloecke.length; i++) {
          expect(bloecke[i] ?? 0).toBeLessThan(bloecke[i - 1] ?? 0);
        }
        // Nachhallzeit: nach der vollen Länge ist die Energie um weit mehr
        // als 40 dB gefallen (Moorer-Hüllkurve, -60 dB bei T60).
        const erste = bloecke[0] ?? 1;
        const letzte = bloecke[bloecke.length - 1] ?? 0;
        expect(letzte).toBeLessThan(erste * 1e-4);
      }
    });
  }
});

// ===========================================================================
// 3. Tonvorrat
// ===========================================================================

describe('Skalen und Akkorde', () => {
  it('Dorisch hat die Halbtonfolge 2-1-2-2-2-1', () => {
    const schritte = DORISCH.slice(1).map((halbton, i) => halbton - (DORISCH[i] ?? 0));
    expect(schritte).toEqual([2, 1, 2, 2, 2, 1]);
    // Große Sexte, 9 Halbtoene — das unterscheidet Dorisch von Aeolisch.
    expect(DORISCH[5]).toBe(9);
  });

  it('Aeolisch hat die Halbtonfolge 2-1-2-2-1-2', () => {
    const schritte = AEOLISCH.slice(1).map((halbton, i) => halbton - (AEOLISCH[i] ?? 0));
    expect(schritte).toEqual([2, 1, 2, 2, 1, 2]);
    // Kleine Sexte, 8 Halbtoene.
    expect(AEOLISCH[5]).toBe(8);
  });

  it('unterscheidet Dorisch und Aeolisch genau in der Sexte', () => {
    const abweichungen = DORISCH.map((halbton, i) => halbton - (AEOLISCH[i] ?? 0));
    expect(abweichungen).toEqual([0, 0, 0, 0, 0, 1, 0]);
  });

  it('rechnet Stufen über Oktavgrenzen hinweg', () => {
    expect(stufeZuHalbton(DORISCH, 0)).toBe(0);
    expect(stufeZuHalbton(DORISCH, 7)).toBe(12);
    expect(stufeZuHalbton(DORISCH, 8)).toBe(14);
    expect(stufeZuHalbton(DORISCH, 14)).toBe(24);
    expect(stufeZuHalbton(DORISCH, -1)).toBe(-2);
    expect(stufeZuHalbton(DORISCH, -7)).toBe(-12);
  });

  it('bildet Quartenakkorde: D-G-C auf D-Dorisch', () => {
    // MIDI 50 = D3, 55 = G3, 60 = C4.
    expect(quartAkkord(50, DORISCH, 0)).toEqual([50, 55, 60]);
    const hz = akkordFrequenzen('heimat', 50, DORISCH);
    expect(hz[0] ?? 0).toBeCloseTo(146.83, 1);
    expect(hz[1] ?? 0).toBeCloseTo(196.0, 1);
    expect(hz[2] ?? 0).toBeCloseTo(261.63, 1);
  });

  it('bindet die MIDI-Umrechnung an den Kammerton', () => {
    expect(midiZuHz(69)).toBeCloseTo(440, 6);
    expect(midiZuHz(50)).toBeCloseTo(146.83, 2);
    expect(midiZuHz(86)).toBeCloseTo(midiZuHz(74) * 2, 6);
    expect(midiZuHz(skalenTon(50, DORISCH, 7))).toBeCloseTo(midiZuHz(50) * 2, 6);
  });
});

// ===========================================================================
// 4. Karplus-Strong
// ===========================================================================

describe('Karplus-Strong', () => {
  for (const frequenz of [110, 146.83, 293.66, 440, 880]) {
    it(`trifft die Grundfrequenz ${frequenz} Hz`, () => {
      const daten = karplusStrongDaten(RATE, {
        frequenzHz: frequenz,
        sekunden: 0.5,
        daempfung: 0.996,
        saat: 0x0a0b_0c0d,
      });
      // Vor dem Zählen die Obertoene wegfiltern — sonst zählt man deren
      // Nulldurchgänge mit und misst ein Vielfaches der Grundfrequenz.
      const gefiltert = tiefpassKette(daten, RATE, frequenz * 1.3, 6);
      const periode = RATE / frequenz;
      const ab = Math.round(10 * periode);
      const bis = Math.min(daten.length, Math.round(ab + 300 * periode));
      const gemessen = (nulldurchgaenge(gefiltert, ab, bis) * RATE) / (2 * (bis - ab));

      const soll = saitenGrundfrequenz(RATE, frequenz);
      // Die Leitungslänge ist ganzzahlig, darum weicht die erreichbare
      // Tonhöhe minimal vom Wunsch ab — hörbar ist das nicht.
      expect(Math.abs(soll - frequenz) / frequenz).toBeLessThan(0.01);
      expect(Math.abs(gemessen - soll) / soll).toBeLessThan(0.02);
    });
  }

  it('fällt monoton ab und bleibt endlich', () => {
    const daten = karplusStrongDaten(RATE, {
      frequenzHz: 220,
      sekunden: 0.6,
      daempfung: 0.994,
      saat: 7,
    });
    expect(daten.every((w) => Number.isFinite(w))).toBe(true);

    const fenster = Math.round(RATE * 0.02);
    const spitzen: number[] = [];
    for (let start = 0; start + fenster <= daten.length; start += fenster) {
      let spitze = 0;
      for (let i = start; i < start + fenster; i++) {
        spitze = Math.max(spitze, Math.abs(daten[i] ?? 0));
      }
      spitzen.push(spitze);
    }
    expect(spitzen.length).toBeGreaterThan(20);
    for (let i = 1; i < spitzen.length; i++) {
      expect(spitzen[i] ?? 0).toBeLessThanOrEqual(spitzen[i - 1] ?? 0);
    }
    // Nach 0,6 s ist der Anschlag praktisch verklungen.
    expect(spitzen[spitzen.length - 1] ?? 1).toBeLessThan((spitzen[0] ?? 1) * 0.2);
  });

  it('ist deterministisch', () => {
    const vorgabe = { frequenzHz: 330, sekunden: 0.1, daempfung: 0.99, saat: 5 };
    expect(Array.from(karplusStrongDaten(RATE, vorgabe))).toEqual(
      Array.from(karplusStrongDaten(RATE, vorgabe))
    );
  });
});

// ===========================================================================
// 5. Hüllkurven-Helfer
// ===========================================================================

describe('Hüllkurven', () => {
  it('planen Anschläge nur mit setValueAtTime und linearRampToValueAtTime', () => {
    const param = new ParamAttrappe(0);
    const ende = anschlag(param as unknown as AudioParam, 1, {
      spitze: 0.5,
      anstieg: 0.01,
      abfall: 0.2,
    });
    expect(ende).toBeCloseTo(1.21, 6);
    expect(param.plan.map((p) => p.art)).toEqual(['abbruch', 'setze', 'linear', 'linear']);
    expect(param.plan[2]).toMatchObject({ wert: 0.5 });
    expect(param.plan[3]).toMatchObject({ wert: 0 });
  });

  it('schließt jedes setTargetAtTime mit einem harten Zielwert ab', () => {
    const param = new ParamAttrappe(0.2);
    const abschluss = weichesZiel(param as unknown as AudioParam, 2, 0.8, 0.1, 0.2);
    expect(abschluss).toBeCloseTo(2.5, 6);
    const letzter = param.plan[param.plan.length - 1];
    expect(letzter?.art).toBe('setze');
    expect(letzter?.wert).toBe(0.8);
  });

  it('macht den Lautstärkeregler nichtlinear', () => {
    expect(reglerZuPegel(0)).toBe(0);
    expect(reglerZuPegel(1)).toBe(1);
    // Halber Regler ist deutlich weniger als halbe Verstärkung.
    expect(reglerZuPegel(0.5)).toBeLessThan(0.2);
    expect(reglerZuPegel(2)).toBe(1);
  });

  it('dämpft hohe Frequenzen in der Tiefpasskette', () => {
    const laenge = RATE;
    const tief = new Float32Array(laenge);
    const hoch = new Float32Array(laenge);
    for (let i = 0; i < laenge; i++) {
      tief[i] = Math.sin((2 * Math.PI * 100 * i) / RATE);
      hoch[i] = Math.sin((2 * Math.PI * 8000 * i) / RATE);
    }
    const spitze = (feld: Float32Array): number => {
      let max = 0;
      for (let i = feld.length - 1000; i < feld.length; i++) max = Math.max(max, Math.abs(feld[i] ?? 0));
      return max;
    };
    expect(spitze(tiefpassKette(tief, RATE, 500, 4))).toBeGreaterThan(0.5);
    expect(spitze(tiefpassKette(hoch, RATE, 500, 4))).toBeLessThan(0.01);
  });
});

// ===========================================================================
// 6. Klangwerk — Aufbau des Graphen
// ===========================================================================

describe('Klangwerk: Aufbau', () => {
  it('baut genau zwei Convolver, einen Limiter und fuenf Achsenquellen', async () => {
    const { werk, ctx } = baueWerk();
    await werk.starte();

    expect(werk.laeuft).toBe(true);
    // Genau ZWEI Convolver im ganzen Spiel — der teuerste Knoten überhaupt.
    expect(ctx.vonArt('convolver')).toHaveLength(2);
    expect(ctx.vonArt('kompressor')).toHaveLength(1);
    expect(ctx.vonArt('konstante')).toHaveLength(ALLE_ACHSEN.length);

    const [kurz, lang] = ctx.vonArt('convolver');
    expect(kurz?.buffer?.length).toBe(Math.round(RATE * HALL_KURZ.sekunden));
    expect(lang?.buffer?.length).toBe(Math.round(RATE * HALL_LANG.sekunden));

    // Der Limiter sitzt unmittelbar vor dem Ausgang.
    const limiter = ctx.vonArt('kompressor')[0];
    expect(limiter?.ziele).toContain(ctx.destination);
    expect(limiter?.threshold.value).toBe(-6);

    werk.entsorge();
  });

  it('hält alle Musik-Layer dauerhaft am Laufen', async () => {
    const { werk, ctx } = baueWerk();
    await werk.starte();

    // Drone, Pads und Textur laufen ab Zeit 0 und werden nie gestoppt — nur
    // ihre Layer-Gains bewegen sich.
    const dauerhaft = ctx
      .vonArt('oszillator')
      .filter((o) => o.startZeiten.includes(0) && o.stoppZeiten.length === 0);
    expect(dauerhaft.length).toBeGreaterThanOrEqual(14);

    const dauerRauschen = ctx
      .vonArt('pufferquelle')
      .filter((q) => q.loop && q.stoppZeiten.length === 0);
    expect(dauerRauschen.length).toBeGreaterThanOrEqual(1);

    // Auch die Achsenquellen laufen dauerhaft.
    expect(ctx.vonArt('konstante').every((k) => k.startZeiten.includes(0))).toBe(true);

    werk.entsorge();
  });

  it('faehrt Achsen über 1,5 s nach und klemmt sie auf 0..1', async () => {
    const { werk, ctx } = baueWerk();
    await werk.starte();

    expect(ctx.vonArt('konstante').every((k) => k.offset.plan.length === 0)).toBe(true);
    werk.setzeAchse('gefahr', 0.6);
    werk.setzeAchse('erfolg', 4);

    const rampen = ctx
      .vonArt('konstante')
      .flatMap((k) => k.offset.plan)
      .filter((p) => p.art === 'linear');
    expect(rampen).toHaveLength(2);
    expect(rampen.some((p) => p.wert === 0.6 && p.zeit === 1.5)).toBe(true);
    // 4 wird auf 1 geklemmt — keine Achse darf den Mix aufreissen.
    expect(rampen.some((p) => p.wert === 1 && p.zeit === 1.5)).toBe(true);

    werk.entsorge();
  });
});

// ===========================================================================
// 7. Klangwerk — Klänge
// ===========================================================================

describe('Klangwerk: Klänge', () => {
  it('ui_fehler hat 440 Hz mit einer Schwebung von 25 Hz', async () => {
    const { werk, ctx } = baueWerk();
    await werk.starte();
    const vorher = ctx.vonArt('oszillator').length;
    werk.spiele('ui_fehler');

    const neue = ctx.vonArt('oszillator').slice(vorher);
    const frequenzen = neue.map((o) => o.frequency.value).sort((a, b) => a - b);
    expect(frequenzen).toEqual([440, 465]);
    // Die Differenz der beiden Grundtoene IST die Schwebungsfrequenz.
    expect((frequenzen[1] ?? 0) - (frequenzen[0] ?? 0)).toBe(25);
    expect(neue.every((o) => o.type === 'sine')).toBe(true);

    werk.entsorge();
  });

  it('erzeugt jeden Klang und hält die Längengrenzen ein', async () => {
    const { werk, ctx } = baueWerk();
    await werk.starte();

    for (const klang of ALLE_KLAENGE) {
      const vorher = ctx.knoten.length;
      werk.spiele(klang);
      const neue = ctx.knoten.slice(vorher);
      expect(neue.length, klang).toBeGreaterThan(0);

      const quellen = neue.filter((k) => k.startZeiten.length > 0);
      expect(quellen.length, klang).toBeGreaterThan(0);
      const anfang = Math.min(...quellen.map((q) => Math.min(...q.startZeiten)));
      const schluss = Math.max(...quellen.flatMap((q) => q.stoppZeiten));
      expect(Number.isFinite(schluss), klang).toBe(true);

      // Jede Quelle bekommt eine ABSOLUTE Zeit mit — nie start() ohne Argument.
      expect(anfang, klang).toBeGreaterThan(0);
      // 400 ms Obergrenze; nur der Kapitelabschluss darf 2,5 s dauern.
      // Die 21 ms Zuschlag sind der Sicherheitsabstand beim Stoppen.
      const grenze = klang === 'level_bestanden' ? 2.5 : 0.4;
      expect(schluss - anfang, klang).toBeLessThanOrEqual(grenze + 0.021);
    }

    werk.entsorge();
  });

  it('setzt Klänge am Ort auf die richtige Stereoseite', async () => {
    const { werk, ctx } = baueWerk();
    await werk.starte();
    werk.hoererAn({ x: 0, y: 2, z: 0 }, { x: 0, y: 0, z: -1 });

    werk.spieleAmOrt('modul_setzen', { x: 10, y: 0, z: 0 });
    werk.spieleAmOrt('modul_setzen', { x: -10, y: 0, z: 0 });
    werk.spieleAmOrt('modul_setzen', { x: 0, y: 0, z: -60 });

    const panner = ctx.vonArt('panner');
    expect(panner).toHaveLength(3);
    expect(panner[0]?.pan.value ?? 0).toBeGreaterThan(0.5);
    expect(panner[1]?.pan.value ?? 0).toBeLessThan(-0.5);
    // Direkt voraus: keine Seite.
    expect(Math.abs(panner[2]?.pan.value ?? 1)).toBeLessThan(0.2);

    // Die ferne Quelle ist leiser und dumpfer als die nahen.
    const luft = ctx.vonArt('filter').filter((f) => f.type === 'lowpass');
    const eckfrequenzen = luft.map((f) => f.frequency.value);
    expect(Math.min(...eckfrequenzen)).toBeLessThan(Math.max(...eckfrequenzen));

    werk.entsorge();
  });
});

// ===========================================================================
// 8. Klangwerk — Stimmenhaushalt
// ===========================================================================

describe('Klangwerk: Stimmenhaushalt', () => {
  it('hält bei 100 Auslösungen höchstens 24 Stimmen', async () => {
    const { werk } = baueWerk();
    await werk.starte();
    expect(werk.stimmen).toBe(0);

    for (let i = 0; i < 100; i++) {
      werk.spiele(ALLE_KLAENGE[i % ALLE_KLAENGE.length] ?? 'sim_tick');
      expect(werk.stimmen).toBeLessThanOrEqual(24);
    }
    // Die Grenze wird auch wirklich ausgeschoepft — sonst würde der Test
    // auch dann gruen, wenn überhaupt keine Stimme entstuende.
    expect(werk.stimmen).toBe(24);

    werk.entsorge();
  });

  it('stiehlt die aelteste Stimme und blendet sie aus, statt sie zu kappen', async () => {
    const { werk, ctx } = baueWerk();
    await werk.starte();

    const koepfe: KnotenAttrappe[] = [];
    for (let i = 0; i < 30; i++) {
      const vorher = ctx.knoten.length;
      werk.spiele('paket_eintritt');
      const kopf = ctx.knoten.slice(vorher).find((k) => k.art === 'gain');
      if (kopf) koepfe.push(kopf);
    }
    expect(koepfe).toHaveLength(30);
    // Die ersten sechs wurden gestohlen: sie haben eine Ausblendrampe bekommen.
    expect(koepfe.slice(0, 6).every((k) => k.gain.plan.some((p) => p.art === 'linear'))).toBe(true);
    expect(koepfe.slice(6).every((k) => k.gain.plan.length === 0)).toBe(true);
    expect(werk.stimmen).toBe(24);

    werk.entsorge();
  });

  it('entsorge() setzt die Stimmenzahl auf 0 und trennt jeden Knoten', async () => {
    const { werk, ctx } = baueWerk();
    await werk.starte();
    for (const klang of ALLE_KLAENGE) werk.spiele(klang);
    werk.spieleAmOrt('alarm', { x: 3, y: 0, z: 4 });
    expect(werk.stimmen).toBeGreaterThan(0);

    werk.entsorge();

    expect(werk.stimmen).toBe(0);
    expect(werk.laeuft).toBe(false);
    const haengend = ctx.knoten.filter((k) => k !== ctx.destination && !k.getrennt);
    expect(haengend.map((k) => k.art)).toEqual([]);
    // Jede Quelle wurde auch angehalten.
    const laufend = ctx.knoten.filter(
      (k) => k.startZeiten.length > 0 && k.stoppZeiten.length === 0
    );
    expect(laufend.map((k) => k.art)).toEqual([]);

    // Nach dem Entsorgen ist jeder weitere Aufruf ein Nichts, kein Absturz.
    werk.spiele('alarm');
    werk.spieleAmOrt('alarm', { x: 0, y: 0, z: 0 });
    werk.setzeAchse('gefahr', 1);
    werk.setzeLautstaerke(0.5, 0.5);
    werk.pausiere();
    werk.fortsetzen();
    expect(werk.stimmen).toBe(0);
  });

  it('pausiert und setzt fort, ohne Ereignisse aufzustauen', async () => {
    const { werk, ctx } = baueWerk();
    await werk.starte();
    ctx.currentTime = 12;
    werk.pausiere();
    expect(werk.laeuft).toBe(false);
    ctx.currentTime = 300;
    werk.fortsetzen();
    expect(werk.laeuft).toBe(true);

    // Nach dem Fortsetzen darf nichts in der Vergangenheit geplant werden.
    const vorher = ctx.knoten.length;
    werk.spiele('sim_start');
    const neue = ctx.knoten.slice(vorher).filter((k) => k.startZeiten.length > 0);
    expect(neue.length).toBeGreaterThan(0);
    expect(neue.every((k) => k.startZeiten.every((z) => z >= 300))).toBe(true);

    werk.entsorge();
  });

  it('regelt Musik und Klänge getrennt', async () => {
    const { werk, ctx } = baueWerk({ musik: 0.5, klaenge: 0.5 });
    await werk.starte();
    werk.setzeLautstaerke(1, 0);
    const rampen = ctx
      .vonArt('gain')
      .flatMap((g) => g.gain.plan)
      .filter((p) => p.art === 'linear');
    // Genau zwei Busse werden nachgefahren: Musik hoch, Klänge auf null.
    expect(rampen).toHaveLength(2);
    expect(rampen.some((p) => p.wert === 0)).toBe(true);
    expect(rampen.some((p) => p.wert > 0)).toBe(true);
    werk.entsorge();
  });
});

// ===========================================================================
// 9. Echter OfflineAudioContext (nur wo vorhanden)
// ===========================================================================

describe('Klangwerk im echten OfflineAudioContext', () => {
  it.skipIf(!hatEchtenOfflineKontext)(
    'rendert ui_fehler mit einer Schwebung von rund 25 Hz',
    async () => {
      const ctx = new OfflineAudioContext(2, RATE, RATE);
      const werk = new Klangwerk({ musik: 0, klaenge: 1 }, ctx);
      await werk.starte();
      werk.spiele('ui_fehler', 1);
      const ergebnis = await ctx.startRendering();

      const daten = ergebnis.getChannelData(0);
      // Hüllkurve über 1-ms-Fenster: die Schwebung moduliert die Amplitude
      // mit 25 Hz, also rund 25 Minima je Sekunde.
      const fenster = Math.round(RATE / 1000);
      const huelle: number[] = [];
      for (let start = 0; start + fenster <= Math.round(RATE * 0.3); start += fenster) {
        let spitze = 0;
        for (let i = start; i < start + fenster; i++) {
          spitze = Math.max(spitze, Math.abs(daten[i] ?? 0));
        }
        huelle.push(spitze);
      }
      // Die Hüllkurve ist mit 1 kHz abgetastet. Ihr Spektrum zwischen 5 und
      // 60 Hz muss sein Maximum bei 25 Hz haben — das IST die Schwebung.
      // (Gemessen im echten Chromium: Maximum exakt bei 25,0 Hz.)
      const mittel = huelle.reduce((a, b) => a + b, 0) / Math.max(1, huelle.length);
      let besteFrequenz = 0;
      let besteEnergie = 0;
      for (let f = 5; f <= 60; f += 0.5) {
        let re = 0;
        let im = 0;
        for (let i = 0; i < huelle.length; i++) {
          const phi = (2 * Math.PI * f * i) / 1000;
          const wert = (huelle[i] ?? 0) - mittel;
          re += wert * Math.cos(phi);
          im += wert * Math.sin(phi);
        }
        const energie = Math.hypot(re, im);
        if (energie > besteEnergie) {
          besteEnergie = energie;
          besteFrequenz = f;
        }
      }
      expect(besteFrequenz).toBeGreaterThanOrEqual(22);
      expect(besteFrequenz).toBeLessThanOrEqual(28);
      werk.entsorge();
    }
  );

  it.skipIf(!hatEchtenOfflineKontext)('bleibt unter der Übersteuerung', async () => {
    const ctx = new OfflineAudioContext(2, RATE * 2, RATE);
    const werk = new Klangwerk({ musik: 1, klaenge: 1 }, ctx);
    await werk.starte();
    for (const klang of ALLE_KLAENGE) werk.spiele(klang);
    const ergebnis = await ctx.startRendering();
    for (let k = 0; k < ergebnis.numberOfChannels; k++) {
      const daten = ergebnis.getChannelData(k);
      let spitze = 0;
      for (const wert of daten) spitze = Math.max(spitze, Math.abs(wert));
      expect(spitze).toBeGreaterThan(0);
      expect(spitze).toBeLessThanOrEqual(1);
    }
    werk.entsorge();
  });
});
