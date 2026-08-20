/**
 * SCHWARMWERK — Synthese-Bausteine.
 *
 * Hier stehen die reinen Rechenkerne der Klangwelt: Rauschen, Hall-Impuls-
 * antworten, gezupfte Metallsaiten (Karplus-Strong), Hüllkurven-Helfer und
 * der Tonvorrat. Alles, was ohne AudioContext berechnet werden kann, wird
 * hier als reine Funktion auf `Float32Array` berechnet — dadurch ist die
 * Klangwelt in Node testbar, ohne dass ein Browser läuft.
 *
 * Musikalische Grundlage des Spiels: **D-Dorisch**, Tonika D3 = 146,83 Hz.
 * Dorisch ist die Molltonart mit großer Sexte — nachdenklich, aber nicht
 * traurig. Genau die Haltung, die eine stille Werkhalle um drei Uhr nachts
 * haben soll. Wird es gefährlich, kippt die Musik nach **D-Aeolisch**
 * (kleine Sexte statt großer) und wird damit hörbar kühler, ohne die
 * Tonika zu verlassen.
 *
 * Determinismus: NIEMALS `Math.random()`. Alles Zufällige kommt aus
 * `erzeugeStrom(saat)` in `src/sim/rng.ts`.
 */

import { erzeugeStrom } from '../sim/rng';

// ---------------------------------------------------------------------------
// Konstanten
// ---------------------------------------------------------------------------

/**
 * Ersatz für die Null bei `exponentialRampToValueAtTime` — die Web-Audio-API
 * verbietet dort exakt 0 (der Wert wird logarithmisch interpoliert).
 */
export const EPS = 0.0001;

/**
 * Ein Block Abtastwerte. Der explizite Puffertyp ist noetig, weil
 * `AudioBuffer.copyToChannel` kein `SharedArrayBuffer`-gestütztes Feld
 * annimmt — `Float32Array` allein wäre zu weit gefasst.
 */
export type Abtastfeld = Float32Array<ArrayBuffer>;

/** Kammerton, Bezugspunkt der MIDI-Umrechnung: A4 = MIDI 69. */
export const A4_HZ = 440;

/** Tonika des Spiels: D3 = MIDI 50 = 146,83 Hz. */
export const TONIKA_MIDI = 50;

/** Grundfrequenz des UI-Kits: D5 = 587,33 Hz — das UI klingt in der Spieltonart. */
export const UI_GRUND_HZ = 587.33;

// ---------------------------------------------------------------------------
// Tonvorrat: Skalen, Stufen, Akkorde
// ---------------------------------------------------------------------------

/** Dorisch: grosse Sekunde, kleine Terz, grosse Sexte — Grundstimmung des Spiels. */
export const DORISCH: readonly number[] = [0, 2, 3, 5, 7, 9, 10];

/** Aeolisch (natürlich Moll): wie Dorisch, aber kleine Sexte — kühler. */
export const AEOLISCH: readonly number[] = [0, 2, 3, 5, 7, 8, 10];

/** Phrygisch: kleine Sekunde — nur für Alarmzustände, sehr sparsam. */
export const PHRYGISCH: readonly number[] = [0, 1, 3, 5, 7, 8, 10];

export type Skala = readonly number[];

/** Alle im Spiel benutzten Skalen unter sprechendem Namen. */
export const SKALEN: Readonly<Record<'dorisch' | 'aeolisch' | 'phrygisch', Skala>> = {
  dorisch: DORISCH,
  aeolisch: AEOLISCH,
  phrygisch: PHRYGISCH,
};

/** MIDI-Notennummer zu Frequenz in Hertz. */
export function midiZuHz(midi: number): number {
  return A4_HZ * Math.pow(2, (midi - 69) / 12);
}

/** Frequenz zu MIDI-Notennummer (nicht gerundet). */
export function hzZuMidi(hz: number): number {
  return 69 + 12 * Math.log2(Math.max(1e-6, hz) / A4_HZ);
}

/**
 * Halbtonabstand einer Skalenstufe über alle Oktaven hinweg.
 * Stufe 7 ist die Oktave (12), Stufe -1 die Septime darunter (-2 bei Dorisch).
 */
export function stufeZuHalbton(skala: Skala, stufe: number): number {
  const laenge = skala.length;
  const oktave = Math.floor(stufe / laenge);
  const rest = stufe - oktave * laenge;
  return (skala[rest] ?? 0) + 12 * oktave;
}

/** Skalenstufe als MIDI-Note über einer Grundnote. */
export function skalenTon(grundMidi: number, skala: Skala, stufe: number): number {
  return grundMidi + stufeZuHalbton(skala, stufe);
}

/**
 * Quartenschichtung statt Terzschichtung: Stufen 0/3/6 der Skala.
 * Auf D-Dorisch ergibt das D–G–C — offen, schwebend, ohne Dur/Moll-Aussage.
 * Genau deshalb trägt der Akkord stundenlang, ohne sich festzulegen.
 */
export function quartAkkord(grundMidi: number, skala: Skala, stufe: number): number[] {
  return [0, 3, 6].map((versatz) => skalenTon(grundMidi, skala, stufe + versatz));
}

/**
 * Akkordvorrat als Skalenstufen der Grundtonleiter. Die Namen beschreiben die
 * dramaturgische Funktion, nicht die Funktionsharmonik — die Stimmung ist
 * modal und kennt keine Kadenz.
 */
export const AKKORDE: Readonly<Record<string, readonly number[]>> = {
  /** Ruhelage: D–G–C, die Tonika in Quarten. */
  heimat: [0, 3, 6],
  /** Aufhellung: E–A–D, ein Schritt nach oben, wirkt wie Einatmen. */
  atem: [1, 4, 7],
  /** Weite: G–C–F, Subdominantfarbe ohne Terz. */
  weite: [3, 6, 9],
  /** Absenkung: C–F–B, zurück ins Dunkle. */
  senke: [6, 9, 12],
  /** Spannung: Sekundcluster D–E–G, wird nur bei Gefahr eingeblendet. */
  spannung: [0, 1, 3],
};

/** Frequenzen eines Akkords aus dem Vorrat. */
export function akkordFrequenzen(
  name: keyof typeof AKKORDE | string,
  grundMidi: number,
  skala: Skala
): number[] {
  const stufen = AKKORDE[name] ?? AKKORDE['heimat'] ?? [0, 3, 6];
  return stufen.map((stufe) => midiZuHz(skalenTon(grundMidi, skala, stufe)));
}

/** Cent-Verstimmung als Frequenzfaktor — 100 Cent sind ein Halbton. */
export function cent(anzahl: number): number {
  return Math.pow(2, anzahl / 1200);
}

// ---------------------------------------------------------------------------
// Rauschen
// ---------------------------------------------------------------------------

/**
 * Deterministisches weißes Rauschen in [-1, 1).
 *
 * Erwartungswert 0, Standardabweichung 1/sqrt(3) ≈ 0,577. Jeder Kanal
 * bekommt einen eigenen Strom und ist damit vom Nachbarkanal dekorreliert —
 * das ist die Voraussetzung für einen breiten, nicht in der Mitte klebenden
 * Hall.
 */
export function rauschDaten(anzahl: number, saat: number, kanaele = 1): Abtastfeld[] {
  const laenge = Math.max(1, Math.floor(anzahl));
  const felder: Abtastfeld[] = [];
  for (let k = 0; k < Math.max(1, kanaele); k++) {
    const strom = erzeugeStrom((saat + k * 0x9e37_79b1) >>> 0);
    const feld = new Float32Array(laenge);
    for (let i = 0; i < laenge; i++) feld[i] = strom() * 2 - 1;
    felder.push(feld);
  }
  return felder;
}

/** Rauschpuffer als `AudioBuffer` — im Spiel existiert genau einer (1 s, Stereo). */
export function rauschPuffer(
  kontext: BaseAudioContext,
  sekunden: number,
  saat: number,
  kanaele = 2
): AudioBuffer {
  const laenge = Math.max(1, Math.round(kontext.sampleRate * sekunden));
  const felder = rauschDaten(laenge, saat, kanaele);
  const puffer = kontext.createBuffer(kanaele, laenge, kontext.sampleRate);
  for (let k = 0; k < kanaele; k++) {
    const quelle = felder[k];
    if (quelle) puffer.copyToChannel(quelle, k);
  }
  return puffer;
}

// ---------------------------------------------------------------------------
// Hall-Impulsantworten
// ---------------------------------------------------------------------------

export interface HallVorgabe {
  /** Nachhallzeit T60 in Sekunden. */
  readonly sekunden: number;
  /** Tiefpass-Eckfrequenz zu Beginn des Ausklangs. */
  readonly tiefpassStartHz: number;
  /** Tiefpass-Eckfrequenz am Ende — Höhen verschwinden zuerst, wie im echten Raum. */
  readonly tiefpassEndeHz: number;
  /** Saat des Rauschens. */
  readonly saat: number;
}

/** Kurzer Raum: Betonkabine neben der Halle. Für UI- und Bedienklänge. */
export const HALL_KURZ: HallVorgabe = {
  sekunden: 0.8,
  tiefpassStartHz: 9000,
  tiefpassEndeHz: 2600,
  saat: 0x5c48_11a3,
};

/** Langer Raum: Halle 3, 1957, Backstein und Stahlträger. Für alles Große. */
export const HALL_LANG: HallVorgabe = {
  sekunden: 3.5,
  tiefpassStartHz: 6400,
  tiefpassEndeHz: 520,
  saat: 0x27a1_9f0d,
};

/**
 * Prozedurale Impulsantwort nach Moorer: gefiltertes Rauschen mal
 * `a(t) = 10^(-3t/T)` (also -60 dB nach T Sekunden).
 *
 * Der Tiefpass ist ein Ein-Pol-Filter, dessen Eckfrequenz exponentiell von
 * `tiefpassStartHz` nach `tiefpassEndeHz` wandert. Dadurch verliert der
 * Nachhall zuerst die Höhen — die Halle schluckt Glanz, wie feuchter
 * Backstein es tut.
 *
 * Es gibt bewusst KEIN Pre-Delay in den Daten: die Energiehüllkurve muss
 * monoton fallen (das prüft ein Test). Das Pre-Delay sitzt im Graphen als
 * eigener `DelayNode` vor dem Convolver.
 */
export function impulsantwortDaten(abtastrate: number, vorgabe: HallVorgabe): Abtastfeld[] {
  const laenge = Math.max(1, Math.round(abtastrate * vorgabe.sekunden));
  const roh = rauschDaten(laenge, vorgabe.saat, 2);
  const kanaele: Abtastfeld[] = [];
  let spitze = 1e-9;

  for (let k = 0; k < 2; k++) {
    const quelle = roh[k];
    const ziel = new Float32Array(laenge);
    if (!quelle) {
      kanaele.push(ziel);
      continue;
    }
    let letzter = 0;
    for (let i = 0; i < laenge; i++) {
      const fortschritt = i / laenge;
      // Exponentieller Sweep der Eckfrequenz.
      const eck =
        vorgabe.tiefpassStartHz *
        Math.pow(vorgabe.tiefpassEndeHz / vorgabe.tiefpassStartHz, fortschritt);
      const alpha = 1 - Math.exp((-2 * Math.PI * eck) / abtastrate);
      letzter += alpha * ((quelle[i] ?? 0) - letzter);
      // Moorer-Hüllkurve a(t) = 10^(-3t/T): genau -60 dB nach T Sekunden.
      const huelle = Math.pow(10, -3 * fortschritt);
      const wert = letzter * huelle;
      ziel[i] = wert;
      const betrag = Math.abs(wert);
      if (betrag > spitze) spitze = betrag;
    }
    kanaele.push(ziel);
  }

  // Auf Spitzenwert 1 normieren; `ConvolverNode.normalize` regelt danach die
  // Lautheit, aber ein definierter Spitzenwert macht die Tests aussagekraeftig.
  const faktor = 1 / spitze;
  for (const kanal of kanaele) {
    for (let i = 0; i < kanal.length; i++) kanal[i] = (kanal[i] ?? 0) * faktor;
  }
  return kanaele;
}

/** Impulsantwort als `AudioBuffer` für einen `ConvolverNode`. */
export function impulsantwort(kontext: BaseAudioContext, vorgabe: HallVorgabe): AudioBuffer {
  const kanaele = impulsantwortDaten(kontext.sampleRate, vorgabe);
  const laenge = kanaele[0]?.length ?? 1;
  const puffer = kontext.createBuffer(2, laenge, kontext.sampleRate);
  for (let k = 0; k < 2; k++) {
    const daten = kanaele[k];
    if (daten) puffer.copyToChannel(daten, k);
  }
  return puffer;
}

/**
 * Energiehüllkurve eines Signals in Bloecken — Prüfwerkzeug für Tests und
 * Abstimmung. Liefert die Summe der Quadrate je Block.
 */
export function energieHuelle(daten: Float32Array, blockLaenge: number): number[] {
  const bloecke: number[] = [];
  for (let start = 0; start + blockLaenge <= daten.length; start += blockLaenge) {
    let summe = 0;
    for (let i = start; i < start + blockLaenge; i++) {
      const wert = daten[i] ?? 0;
      summe += wert * wert;
    }
    bloecke.push(summe);
  }
  return bloecke;
}

// ---------------------------------------------------------------------------
// Karplus-Strong — gezupfte Metallsaite
// ---------------------------------------------------------------------------

export interface SaitenVorgabe {
  /** Gewünschte Grundfrequenz in Hertz. */
  readonly frequenzHz: number;
  /** Länge des gerenderten Puffers in Sekunden. */
  readonly sekunden: number;
  /**
   * Dämpfung je Umlauf, 0..1. 0,999 klingt lange nach (Stahlträger),
   * 0,985 ist ein kurzer, trockener Anschlag (Schraubenschlüssel auf Blech).
   */
  readonly daempfung: number;
  /**
   * Anteil des aktuellen Abtastwertes im Rückkopplungs-Tiefpass.
   * 0,5 ist der klassische Mittelwert; größere Werte klingen metallischer,
   * weil die Höhen langsamer sterben.
   */
  readonly glaettung?: number;
  readonly saat: number;
}

/**
 * Karplus-Strong: eine mit Rauschen gefüllte Verzögerungsleitung, die sich
 * über einen Tiefpass selbst zurückspeist. Das Ergebnis klingt wie eine
 * angeschlagene Metallsaite — der Grundklang aller Bauklänge im Spiel.
 *
 * Die Leitungslänge N ergibt die Grundfrequenz `rate / (N + 0,5)`; das
 * halbe Sample stammt aus der Gruppenlaufzeit des Mittelwertfilters. N wird
 * darum aus `rate/f - 0,5` gerundet, damit die Tonhöhe stimmt.
 *
 * Bewusst als Puffer vorgerechnet und nicht als `DelayNode`-Rückkopplung:
 * ein `DelayNode` hat 128 Frames Mindestverzögerung, Grundtoene über
 * ~375 Hz wären damit unerreichbar.
 */
export function karplusStrongDaten(abtastrate: number, vorgabe: SaitenVorgabe): Abtastfeld {
  const glaettung = Math.min(0.95, Math.max(0.05, vorgabe.glaettung ?? 0.5));
  const laenge = Math.max(1, Math.round(abtastrate * vorgabe.sekunden));
  const n = Math.max(2, Math.round(abtastrate / Math.max(1, vorgabe.frequenzHz) - 0.5));

  // Anregung: ein Rauschstoss von genau einer Leitungslänge.
  const anregung = rauschDaten(n, vorgabe.saat, 1)[0] ?? new Float32Array(n);
  const leitung = new Float32Array(n);
  // Sanfte Vorglaettung der Anregung nimmt das Kratzen aus dem Anschlag.
  let vorher = 0;
  let mittel = 0;
  for (let i = 0; i < n; i++) {
    const wert = 0.6 * (anregung[i] ?? 0) + 0.4 * vorher;
    leitung[i] = wert;
    mittel += wert;
    vorher = anregung[i] ?? 0;
  }
  // Gleichanteil abziehen. Ohne diesen Schritt hält die Verzögerungsleitung
  // einen konstanten Versatz fest — die Saite hängt dann dauerhaft schief,
  // und jede Messung der Grundfrequenz über Nulldurchgänge geht fehl.
  mittel /= n;
  for (let i = 0; i < n; i++) leitung[i] = (leitung[i] ?? 0) - mittel;

  const ausgabe = new Float32Array(laenge);
  let zeiger = 0;
  let letzter = leitung[n - 1] ?? 0;
  for (let i = 0; i < laenge; i++) {
    const aktuell = leitung[zeiger] ?? 0;
    const neu = vorgabe.daempfung * (glaettung * aktuell + (1 - glaettung) * letzter);
    ausgabe[i] = aktuell;
    leitung[zeiger] = neu;
    letzter = aktuell;
    zeiger = zeiger + 1 === n ? 0 : zeiger + 1;
  }
  return ausgabe;
}

/** Tatsächliche Grundfrequenz, die `karplusStrongDaten` erzeugt. */
export function saitenGrundfrequenz(abtastrate: number, frequenzHz: number): number {
  const n = Math.max(2, Math.round(abtastrate / Math.max(1, frequenzHz) - 0.5));
  return abtastrate / (n + 0.5);
}

/** Karplus-Strong als `AudioBuffer` — im Spiel beim Start vorgerechnet. */
export function karplusStrongPuffer(
  kontext: BaseAudioContext,
  vorgabe: SaitenVorgabe
): AudioBuffer {
  const daten = karplusStrongDaten(kontext.sampleRate, vorgabe);
  const puffer = kontext.createBuffer(1, daten.length, kontext.sampleRate);
  puffer.copyToChannel(daten, 0);
  return puffer;
}

/**
 * Kaskade aus einpoligen Tiefpaessen — ein Werkzeug, kein Klangbaustein.
 *
 * Gebraucht wird sie dort, wo ein Signal außerhalb des Audio-Graphen
 * gefiltert werden muss: bei der Anregung der Saite und in den Tests, die
 * die Grundfrequenz über Nulldurchgänge messen. Ohne Tiefpass zählt man
 * dort die Obertoene mit und misst Unsinn.
 */
export function tiefpassKette(
  daten: Float32Array,
  abtastrate: number,
  eckHz: number,
  pole = 1
): Abtastfeld {
  const alpha = 1 - Math.exp((-2 * Math.PI * Math.max(1, eckHz)) / abtastrate);
  let quelle: Float32Array = daten;
  let ziel = new Float32Array(daten.length);
  for (let p = 0; p < Math.max(1, pole); p++) {
    ziel = new Float32Array(quelle.length);
    let letzter = 0;
    for (let i = 0; i < quelle.length; i++) {
      letzter += alpha * ((quelle[i] ?? 0) - letzter);
      ziel[i] = letzter;
    }
    quelle = ziel;
  }
  return ziel;
}

/**
 * Zählt Nulldurchgänge und schätzt daraus die Grundfrequenz.
 * Prüfwerkzeug: `2 * f * T` Nulldurchgänge in T Sekunden.
 */
export function nulldurchgaenge(daten: Float32Array, ab = 0, bis = daten.length): number {
  let anzahl = 0;
  let vorher = daten[ab] ?? 0;
  for (let i = ab + 1; i < Math.min(bis, daten.length); i++) {
    const wert = daten[i] ?? 0;
    if ((vorher < 0 && wert >= 0) || (vorher >= 0 && wert < 0)) anzahl++;
    vorher = wert;
  }
  return anzahl;
}

// ---------------------------------------------------------------------------
// Hüllkurven-Helfer
// ---------------------------------------------------------------------------

/**
 * Setzt einen Parameter hart und räumt vorher alles Geplante ab.
 * Projektregel: VOR jeder Neuplanung `cancelScheduledValues` + `setValueAtTime`,
 * sonst mischen sich alte und neue Rampen zu unhörbarem Unsinn.
 */
export function setze(param: AudioParam, zeit: number, wert: number): void {
  param.cancelScheduledValues(zeit);
  param.setValueAtTime(wert, zeit);
}

/**
 * Lineare Rampe mit definiertem Start — nie `linearRampToValueAtTime` ohne
 * vorheriges `setValueAtTime`, sonst hängt der Startwert vom Zufall der
 * bisherigen Automation ab.
 */
export function rampe(
  param: AudioParam,
  zeit: number,
  vonWert: number,
  nachWert: number,
  dauer: number
): number {
  param.setValueAtTime(vonWert, zeit);
  param.linearRampToValueAtTime(nachWert, zeit + Math.max(0.001, dauer));
  return zeit + Math.max(0.001, dauer);
}

export interface AnschlagVorgabe {
  /** Spitzenpegel. */
  readonly spitze: number;
  /** Anstiegszeit in Sekunden (1–20 ms bei Klicks, bis 400 ms bei Pads). */
  readonly anstieg: number;
  /** Abfallzeit bis zum Boden. */
  readonly abfall: number;
  /** Endpegel, praktisch immer 0. */
  readonly boden?: number;
}

/**
 * Perkussiver Anschlag: 0 → Spitze → Boden, ausschließlich mit linearen
 * Rampen. Liefert den Zeitpunkt zurück, an dem die Hüllkurve am Boden ist.
 */
export function anschlag(param: AudioParam, zeit: number, vorgabe: AnschlagVorgabe): number {
  const boden = vorgabe.boden ?? 0;
  const anstieg = Math.max(0.001, vorgabe.anstieg);
  const abfall = Math.max(0.002, vorgabe.abfall);
  setze(param, zeit, 0);
  param.linearRampToValueAtTime(vorgabe.spitze, zeit + anstieg);
  param.linearRampToValueAtTime(boden, zeit + anstieg + abfall);
  return zeit + anstieg + abfall;
}

export interface HuellVorgabe {
  readonly spitze: number;
  readonly anstieg: number;
  readonly verfall: number;
  /** Halteanteil des Spitzenpegels, 0..1. */
  readonly halte: number;
  /** Dauer der Haltephase. */
  readonly dauer: number;
  readonly ausklang: number;
}

/** Vollständige ADSR-Hüllkurve, rein linear. Liefert das Ende zurück. */
export function adsr(param: AudioParam, zeit: number, vorgabe: HuellVorgabe): number {
  const anstieg = Math.max(0.001, vorgabe.anstieg);
  const verfall = Math.max(0.001, vorgabe.verfall);
  const halte = vorgabe.spitze * Math.min(1, Math.max(0, vorgabe.halte));
  const ausklang = Math.max(0.002, vorgabe.ausklang);
  setze(param, zeit, 0);
  param.linearRampToValueAtTime(vorgabe.spitze, zeit + anstieg);
  param.linearRampToValueAtTime(halte, zeit + anstieg + verfall);
  const haltEnde = zeit + anstieg + verfall + Math.max(0, vorgabe.dauer);
  param.setValueAtTime(halte, haltEnde);
  param.linearRampToValueAtTime(0, haltEnde + ausklang);
  return haltEnde + ausklang;
}

/**
 * Weiches Nachfahren eines Zielwertes mit ABSCHLUSS.
 *
 * `setTargetAtTime` erreicht sein Ziel nie exakt; ohne Abschluss laufen
 * unhörbare Layer ewig knapp über null weiter und kosten CPU. Darum setzt
 * diese Funktion nach 5·tau (99,3 % erreicht) den Zielwert hart.
 */
export function weichesZiel(
  param: AudioParam,
  zeit: number,
  ziel: number,
  tau: number,
  aktuellerWert: number
): number {
  const sicheresTau = Math.max(0.005, tau);
  param.cancelScheduledValues(zeit);
  param.setValueAtTime(aktuellerWert, zeit);
  param.setTargetAtTime(ziel, zeit, sicheresTau);
  const abschluss = zeit + 5 * sicheresTau;
  param.setValueAtTime(ziel, abschluss);
  return abschluss;
}

/** Nutzerlautstärke ist nichtlinear: der Regler fühlt sich damit gleichmäßig an. */
export function reglerZuPegel(regler: number): number {
  return Math.pow(Math.min(1, Math.max(0, regler)), 2.5);
}

/** Begrenzt einen Wert auf [min, max]. */
export function klemme(wert: number, min: number, max: number): number {
  return wert < min ? min : wert > max ? max : wert;
}
