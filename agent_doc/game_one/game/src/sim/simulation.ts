/**
 * Die Simulations-Engine von SCHWARMWERK.
 *
 * Ein Lauf ist eine diskrete Tick-Simulation: Auftraege treten als Pakete in
 * den Graphen ein, werden von Modulen bearbeitet und verlassen ihn an einer
 * Senke. Jedes Modul bildet ein reales Pattern des Agentic Engineering ab; die
 * Zahlen dahinter stehen in `balance.ts` und sind an realen Groessenordnungen
 * orientiert.
 *
 * Drei Eigenschaften sind nicht verhandelbar und werden von der Testsuite
 * erzwungen:
 *
 *  1. **Determinismus.** Kein `Math.random`, kein `Date.now`, keine
 *     transzendenten Funktionen, keine Iteration ueber `Map`/`Set`. Zufall
 *     kommt ausschliesslich aus dem hashbasierten RNG und ist damit
 *     reihenfolgeunabhaengig.
 *  2. **Reinheit.** Kein Import aus `three`, kein DOM, kein Timer. Die
 *     Simulation laeuft identisch in Node und im Browser — das wird per
 *     Kreuzcheck der Zustands-Pruefsumme verifiziert.
 *  3. **Beobachtbarkeit.** Jeder Zustandsuebergang erzeugt ein `SimEreignis`.
 *     Der Renderer liest ausschliesslich diese Ereignisse und schreibt nie
 *     zurueck.
 */

import {
  AUGE,
  CACHE,
  DECKEL_OHNE_BELEG,
  DECKEL_OHNE_RECHNER,
  GRENZEN,
  HALLUZINATION_BASIS,
  HALLUZINATION_KONTEXT,
  HALLUZINATION_SCHADEN,
  HALLUZINATION_UNSICHERHEIT,
  HAND,
  KERN,
  KONTEXT_KOSTEN_FAKTOR,
  KONTEXT_ROT_MAX,
  KONTEXT_SCHWELLE,
  PRUEFER,
  SAMMLER,
  SCHRANKE,
  SICHERUNG,
  SPEICHER,
  SPEZIALISIERUNG_BONUS,
  SPEZIALISIERUNG_MALUS,
  WALL,
  WEICHE,
  WERKZEUG,
  WERKZEUG_AUSWAHL_SCHWELLE,
  WERKZEUG_DEFINITION_TOKEN,
  WERKZEUG_FEHLWAHL_JE_UEBERSCHUSS,
} from './balance';
import { KURVE_ERTRAG, KURVE_HALLUZINATION, KURVE_KOMPETENZ, KURVE_KONTEXT_ROT } from './kurven';
import { indiziere, kanonisch, portSchluessel, pruefsumme, type GraphIndex } from './graph';
import { ausgaengeVon } from './katalog';
import { zufall, zufallJa, zufallNormal } from './rng';
import { eintrittsTick, erzeugeAuftraege } from './auftraege';
import type {
  Auftrag,
  AuftragsStrom,
  HandModus,
  KernGroesse,
  LaufErgebnis,
  Metriken,
  Modul,
  Paket,
  SammlerModus,
  SicherungModus,
  SimEreignis,
  SpeicherModus,
  WallModus,
  Werk,
  WerkzeugArt,
} from './typen';

// ---------------------------------------------------------------------------
// Hilfsfunktionen
// ---------------------------------------------------------------------------

const SKALA = 1_000_000;

/** Quantisiert auf 1e-6. Nach JEDER Schreiboperation auf Guete/Kontext/Unsicherheit. */
function q(x: number): number {
  return Math.round(x * SKALA) / SKALA;
}

function klemme(x: number, min = 0, max = 1): number {
  return x < min ? min : x > max ? max : x;
}

/** Median einer bereits sortierten Zahlenliste. */
function median(sortiert: readonly number[]): number {
  const n = sortiert.length;
  if (n === 0) return 0;
  const m = n >> 1;
  return n % 2 ? sortiert[m]! : (sortiert[m - 1]! + sortiert[m]!) / 2;
}

function perzentil(sortiert: readonly number[], p: number): number {
  if (sortiert.length === 0) return 0;
  const i = Math.min(sortiert.length - 1, Math.max(0, Math.round((sortiert.length - 1) * p)));
  return sortiert[i]!;
}

// ---------------------------------------------------------------------------
// Laufzeitzustand je Modul
// ---------------------------------------------------------------------------

interface Belegung {
  readonly paket: Paket;
  readonly port: string;
  readonly fertigAb: number;
}

interface ModulZustand {
  readonly modul: Modul;
  /** FIFO-Warteschlange. Erzeugt Durchsatzdruck — genau wie in echten Systemen. */
  readonly warteschlange: Paket[];
  belegung: Belegung | null;
  /** Sammler: Puffer je Gruppe. */
  readonly puffer: Map<string, Paket[]>;
  /** Sammler: fertig verschmolzene Pakete mit Faelligkeit. */
  readonly ausgabe: Belegung[];
  /** Sicherung: beobachtete Fehler im laufenden Betrieb (Circuit Breaker). */
  fehlerZaehler: number;
  offen: boolean;
  /** Statistik fuer das HUD. */
  durchlauf: number;
}

export interface SimOptionen {
  readonly werk: Werk;
  readonly strom: AuftragsStrom;
  readonly saat: number;
  /** Vorgefertigte Auftragsliste — sonst wird sie aus `strom` erzeugt. */
  readonly auftraege?: readonly Auftrag[];
}

// ---------------------------------------------------------------------------
// Simulation
// ---------------------------------------------------------------------------

/** Wie viele Fixpunkt-Durchlaeufe ein Tick maximal macht (Module mit Dauer 0). */
const PASSES = 96;

export class Simulation {
  readonly idx: GraphIndex;
  readonly saat: number;
  readonly auftraege: readonly Auftrag[];
  private readonly strom: AuftragsStrom;
  private readonly zustaende: ModulZustand[];
  private readonly nachId = new Map<string, ModulZustand>();
  private readonly gruppeLebend = new Map<string, number>();

  private t = 0;
  private naechsterAuftrag = 0;
  private gesamtKosten = 0;
  private paketZaehler = 0;

  readonly geliefert: Paket[] = [];
  readonly verworfen: Paket[] = [];
  readonly ereignisse: SimEreignis[] = [];

  abgebrochen = false;
  abbruchGrund: string | undefined;

  constructor(opt: SimOptionen) {
    this.idx = indiziere(opt.werk);
    this.saat = opt.saat;
    this.strom = opt.strom;
    this.auftraege = opt.auftraege ?? erzeugeAuftraege(opt.strom, opt.saat);
    this.zustaende = this.idx.module.map((modul) => ({
      modul,
      warteschlange: [],
      belegung: null,
      puffer: new Map(),
      ausgabe: [],
      fehlerZaehler: 0,
      offen: false,
      durchlauf: 0,
    }));
    for (const z of this.zustaende) this.nachId.set(z.modul.id, z);
  }

  get tick_(): number {
    return this.t;
  }

  /** Sind alle Auftraege durch und nichts mehr im Fluss? */
  get fertig(): boolean {
    if (this.abgebrochen) return true;
    if (this.naechsterAuftrag < this.auftraege.length) return false;
    return this.imFlug === 0;
  }

  get imFlug(): number {
    let n = 0;
    for (const z of this.zustaende) {
      n += z.warteschlange.length;
      if (z.belegung) n++;
      n += z.ausgabe.length;
      for (const [, liste] of z.puffer) n += liste.length;
    }
    return n;
  }

  // -------------------------------------------------------------------------
  // Tick
  // -------------------------------------------------------------------------

  tick(): void {
    if (this.abgebrochen) return;
    this.t++;

    if (this.t > GRENZEN.maxTicks) {
      this.brichAb('zeit_ueberschritten');
      return;
    }

    this.speiseEin();

    for (let pass = 0; pass < PASSES; pass++) {
      let veraendert = false;
      for (const z of this.zustaende) {
        if (this.gib_frei(z)) veraendert = true;
        if (this.starte(z)) veraendert = true;
      }
      if (!veraendert) break;
    }

    // Alterung: alles, was noch im Werk ist, wartet eine Zeiteinheit laenger.
    for (const z of this.zustaende) {
      for (const p of z.warteschlange) p.alter++;
      if (z.belegung) z.belegung.paket.alter++;
      for (const a of z.ausgabe) a.paket.alter++;
      for (const [, liste] of z.puffer) for (const p of liste) p.alter++;
    }

    if (this.gesamtKosten > GRENZEN.maxKosten) this.brichAb('kostenexplosion');
  }

  /** Laesst die Simulation bis zum Ende laufen und liefert das Ergebnis. */
  laufeDurch(maxTicks = GRENZEN.maxTicks): LaufErgebnis {
    let n = 0;
    while (!this.fertig && n < maxTicks) {
      this.tick();
      n++;
    }
    if (!this.fertig && !this.abgebrochen) this.brichAb('zeit_ueberschritten');
    return this.ergebnis();
  }

  private brichAb(grund: string): void {
    this.abgebrochen = true;
    this.abbruchGrund = grund;
    this.melde('alarm', '-', '-', grund);
  }

  // -------------------------------------------------------------------------
  // Auftragseingang
  // -------------------------------------------------------------------------

  private speiseEin(): void {
    while (this.naechsterAuftrag < this.auftraege.length) {
      const i = this.naechsterAuftrag;
      if (eintrittsTick(this.strom, i) + 1 > this.t) break;
      const auftrag = this.auftraege[i]!;
      this.naechsterAuftrag++;
      const quelle = this.idx.quellen[i % Math.max(1, this.idx.quellen.length)];
      if (!quelle) continue;
      const paket = this.neuesPaket(auftrag);
      this.melde('eintritt', paket.id, quelle.id, auftrag.titel);
      this.leite(paket, quelle.id, 'aus');
    }
  }

  private neuesPaket(auftrag: Auftrag): Paket {
    this.paketZaehler++;
    return {
      auftrag,
      id: auftrag.id,
      guete: 0,
      kontext: 0,
      unsicherheit: klemme(0.2 + auftrag.mehrdeutigkeit * 0.5),
      kompromittiert: false,
      entgiftet: auftrag.giftigkeit === 0,
      belegt: false,
      gerechnet: false,
      freigegeben: false,
      abgerufen: false,
      werkzeugeGesehen: 0,
      zwischenspeicherAb: 0,
      beobachteteSchritte: 0,
      gesamteSchritte: 0,
      kosten: 0,
      alter: 0,
      besuche: new Map(),
      spur: [],
      gruppen: [],
    };
  }

  private klone(paket: Paket, suffix: string): Paket {
    return {
      ...paket,
      id: paket.id + suffix,
      besuche: new Map(paket.besuche),
      spur: [...paket.spur],
      gruppen: [...paket.gruppen],
    };
  }

  // -------------------------------------------------------------------------
  // Weiterleitung
  // -------------------------------------------------------------------------

  private leite(paket: Paket, vonModul: string, port: string): void {
    const leitung = this.idx.ausgang.get(portSchluessel(vonModul, port));
    if (!leitung) {
      this.verwirf(paket, vonModul, port === 'aus' ? 'kein_ausgang' : `sackgasse_${port}`);
      return;
    }
    const ziel = this.nachId.get(leitung.nach);
    if (!ziel) {
      this.verwirf(paket, vonModul, 'ziel_fehlt');
      return;
    }
    this.melde('abgang', paket.id, vonModul, undefined, leitung.id);
    ziel.warteschlange.push(paket);
    this.melde('ankunft', paket.id, ziel.modul.id, undefined, leitung.id);
  }

  private verwirf(paket: Paket, modulId: string, grund: string): void {
    paket.fehler = grund;
    this.verworfen.push(paket);
    this.loeseGruppe(paket);
    this.melde('verworfen', paket.id, modulId, grund);
  }

  /** Ein Paket verlaesst den Fluss: alle offenen Gruppen verlieren ein Mitglied. */
  private loeseGruppe(paket: Paket): void {
    for (const g of paket.gruppen) {
      const n = this.gruppeLebend.get(g);
      if (n !== undefined) {
        if (n <= 1) this.gruppeLebend.delete(g);
        else this.gruppeLebend.set(g, n - 1);
      }
    }
  }

  private melde(
    art: SimEreignis['art'],
    paketId: string,
    modulId: string,
    text?: string,
    leitungId?: string
  ): void {
    this.ereignisse.push({
      tick: this.t,
      art,
      paketId,
      modulId,
      ...(leitungId !== undefined ? { leitungId } : {}),
      ...(text !== undefined ? { text } : {}),
    });
  }

  private spur(paket: Paket, modul: Modul, ereignis: string): void {
    paket.spur.push({
      tick: this.t,
      modulId: modul.id,
      art: modul.art,
      ereignis,
      guete: paket.guete,
      kosten: paket.kosten,
    });
  }

  private berechne(paket: Paket, betrag: number): void {
    const ganz = Math.round(betrag);
    paket.kosten += ganz;
    this.gesamtKosten += ganz;
  }

  // -------------------------------------------------------------------------
  // Modul-Ausfuehrung
  // -------------------------------------------------------------------------

  /** Gibt fertige Belegungen frei und leitet sie weiter. */
  private gib_frei(z: ModulZustand): boolean {
    let veraendert = false;

    if (z.belegung && z.belegung.fertigAb <= this.t) {
      const { paket, port } = z.belegung;
      z.belegung = null;
      if (z.modul.art === 'senke') this.liefereAus(paket, z.modul);
      else this.leite(paket, z.modul.id, port);
      veraendert = true;
    }

    for (let i = z.ausgabe.length - 1; i >= 0; i--) {
      const a = z.ausgabe[i]!;
      if (a.fertigAb <= this.t) {
        z.ausgabe.splice(i, 1);
        this.leite(a.paket, z.modul.id, a.port);
        veraendert = true;
      }
    }
    return veraendert;
  }

  /** Nimmt das naechste Paket aus der Warteschlange und bearbeitet es. */
  private starte(z: ModulZustand): boolean {
    if (z.belegung || z.warteschlange.length === 0) return false;
    const paket = z.warteschlange.shift()!;
    const modul = z.modul;

    const besuch = (paket.besuche.get(modul.id) ?? 0) + 1;
    paket.besuche.set(modul.id, besuch);
    // Ein- und Ausgang sind keine Bearbeitungsschritte — sie zaehlen nicht in
    // die Nachvollziehbarkeit, sonst kann kein Werk je 100 Prozent erreichen.
    if (modul.art !== 'quelle' && modul.art !== 'senke') paket.gesamteSchritte++;
    z.durchlauf++;

    if (besuch > GRENZEN.maxBesuche) {
      this.melde('schleife', paket.id, modul.id, `${besuch} Durchlaeufe`);
      this.verwirf(paket, modul.id, 'endlosschleife');
      return true;
    }

    const ergebnis = this.wendeAn(z, paket, besuch);
    if (ergebnis === null) return true; // Paket wurde bereits verworfen oder gepuffert.

    z.belegung = { paket, port: ergebnis.port, fertigAb: this.t + Math.max(0, ergebnis.dauer) };
    return true;
  }

  private liefereAus(paket: Paket, modul: Modul): void {
    this.spur(paket, modul, 'ausgeliefert');
    this.geliefert.push(paket);
    this.loeseGruppe(paket);
    this.melde('auslieferung', paket.id, modul.id, `Guete ${paket.guete.toFixed(2)}`);
  }

  // -------------------------------------------------------------------------
  // Die Wirkung der einzelnen Modularten
  // -------------------------------------------------------------------------

  private wendeAn(
    z: ModulZustand,
    paket: Paket,
    besuch: number
  ): { port: string; dauer: number } | null {
    const m = z.modul;
    switch (m.art) {
      case 'quelle':
        return { port: 'aus', dauer: 0 };
      case 'senke':
        return { port: '', dauer: 0 };
      case 'kern':
        return this.kern(m, paket, besuch);
      case 'weiche':
        return this.weiche(m, paket, besuch);
      case 'schranke':
        return this.schranke(m, paket);
      case 'verteiler':
        return this.verteiler(z, paket);
      case 'sammler':
        return this.sammler(z, paket);
      case 'pruefer':
        return this.pruefer(m, paket, besuch);
      case 'werkzeug':
        return this.werkzeug(m, paket, besuch);
      case 'speicher':
        return this.speicher(m, paket);
      case 'wall':
        return this.wall(m, paket, besuch);
      case 'sicherung':
        return this.sicherung(z, paket, besuch);
      case 'hand':
        return this.hand(m, paket, besuch);
      case 'auge':
        return this.auge(m, paket);
      case 'schmiede':
        return { port: 'aus', dauer: 0 };
      default:
        return { port: 'aus', dauer: 0 };
    }
  }

  // --- Modell-Kern ---------------------------------------------------------

  private kern(m: Modul, p: Paket, besuch: number): { port: string; dauer: number } {
    const groesse: KernGroesse = m.param.groesse ?? 'reiher';
    const k = KERN[groesse];
    const a = p.auftrag;

    // Guete-Decke: was dieser Kern bei diesem Auftrag ueberhaupt erreichen kann.
    let deckel = k.basisDeckel - KURVE_KOMPETENZ(Math.max(0, a.schwierigkeit - k.kompetenz));
    const spez = m.param.spezialisierung;
    if (spez && spez !== 'keine') {
      deckel += spez === a.domaene ? SPEZIALISIERUNG_BONUS : -SPEZIALISIERUNG_MALUS;
    }
    if (a.belegpflichtig && !p.belegt) deckel = Math.min(deckel, DECKEL_OHNE_BELEG);
    if (a.rechnerisch && !p.gerechnet) deckel = Math.min(deckel, DECKEL_OHNE_RECHNER);
    if (p.abgerufen) deckel += SPEICHER.abrufen.deckelBonus;
    deckel = klemme(deckel);

    // Context Rot: ab 45 % Fuellstand wird jeder Aufruf wirkungsloser.
    const ueber = (p.kontext - KONTEXT_SCHWELLE) / (1 - KONTEXT_SCHWELLE);
    const rot = p.kontext <= KONTEXT_SCHWELLE ? 0 : KONTEXT_ROT_MAX * KURVE_KONTEXT_ROT(klemme(ueber));

    const streuung = zufallNormal(this.saat, 'kern.streuung', p.id, m.id, besuch) * k.streuung;
    let guete = p.guete + (deckel - p.guete) * k.wirkung * (1 - rot) + streuung;

    // Halluzination: steigt mit Kontextlast und Unsicherheit, sinkt mit Belegen.
    const risiko =
      HALLUZINATION_BASIS +
      HALLUZINATION_KONTEXT * rot +
      HALLUZINATION_UNSICHERHEIT * p.unsicherheit * (p.belegt ? 0.4 : 1);
    if (zufallJa(this.saat, 'kern.halluzination', KURVE_HALLUZINATION(risiko), p.id, m.id, besuch)) {
      guete -= HALLUZINATION_SCHADEN;
      this.melde('alarm', p.id, m.id, 'Halluzination');
    }

    p.guete = q(klemme(guete, 0, Math.max(deckel, 0)));

    // Kosten: Kontext wird bei jedem Aufruf mitbezahlt. Zwischengespeicherter
    // Anteil kostet nur den Lesepreis. Werkzeugdefinitionen kommen obendrauf.
    const gepuffert = Math.min(p.zwischenspeicherAb, p.kontext);
    const wirksamerKontext = (p.kontext - gepuffert) + gepuffert * CACHE.leseFaktor;
    const werkzeugBlock = p.werkzeugeGesehen * WERKZEUG_DEFINITION_TOKEN;
    this.berechne(p, k.kosten * (1 + KONTEXT_KOSTEN_FAKTOR * wirksamerKontext) + werkzeugBlock);

    p.kontext = q(Math.min(1, p.kontext + k.kontextLast));

    // Ein ueberforderter Kern wird unsicherer, ein souveraener sicherer.
    const delta = a.schwierigkeit > k.kompetenz ? 0.12 : -0.08;
    p.unsicherheit = q(klemme(p.unsicherheit + delta + a.mehrdeutigkeit * 0.06));

    // Eingeschleuste Anweisung greift, wenn sie nicht vorher entschaerft wurde.
    if (a.giftigkeit > 0 && !p.entgiftet && !p.kompromittiert) {
      if (zufallJa(this.saat, 'kern.injektion', a.giftigkeit * k.anfaelligkeit, p.id, m.id, besuch)) {
        p.kompromittiert = true;
        this.melde('alarm', p.id, m.id, 'Eingeschleuste Anweisung befolgt');
      }
    }

    this.spur(p, m, `${k.name} bearbeitet`);
    return { port: 'aus', dauer: k.dauer };
  }

  // --- Weiche (Router) -----------------------------------------------------

  private weiche(m: Modul, p: Paket, besuch: number): { port: string; dauer: number } {
    this.berechne(p, WEICHE.kosten);
    const schwelle = m.param.schwelle ?? 0.45;
    const a = p.auftrag;
    let trifft: boolean;

    switch (m.param.kriterium ?? 'schwierigkeit') {
      case 'domaene':
        trifft = a.domaene === (m.param.spezialisierung ?? 'technik');
        break;
      case 'vertraulichkeit':
        trifft = a.vertraulich;
        break;
      case 'unsicherheit':
        trifft = p.unsicherheit >= schwelle;
        break;
      case 'schwierigkeit':
      default: {
        // Der Router schaetzt die Schwierigkeit — und irrt sich umso mehr,
        // je mehrdeutiger der Auftrag ist.
        const rauschen =
          zufallNormal(this.saat, 'weiche.schaetzung', p.id, m.id, besuch) *
          (0.06 + a.mehrdeutigkeit * WEICHE.fehlleitung * 0.35);
        trifft = a.schwierigkeit + rauschen >= schwelle;
        break;
      }
    }

    this.spur(p, m, trifft ? 'nach B geroutet' : 'nach A geroutet');
    return { port: trifft ? 'b' : 'a', dauer: WEICHE.dauer };
  }

  // --- Schranke (Gate) -----------------------------------------------------

  private schranke(m: Modul, p: Paket): { port: string; dauer: number } {
    this.berechne(p, SCHRANKE.kosten);
    const bestanden = p.guete >= (m.param.schwelle ?? 0.6);
    this.spur(p, m, bestanden ? 'bestanden' : 'durchgefallen');
    return { port: bestanden ? 'ok' : 'fehler', dauer: SCHRANKE.dauer };
  }

  // --- Verteiler (Fan-out) -------------------------------------------------

  private verteiler(z: ModulZustand, p: Paket): null {
    const n = Math.max(2, Math.min(4, z.modul.param.zweige ?? 3));
    const gruppe = `${p.id}@${z.modul.id}`;
    this.gruppeLebend.set(gruppe, n);
    this.spur(p, z.modul, `in ${n} Zweige geteilt`);
    for (let i = 0; i < n; i++) {
      const klon = this.klone(p, `#${i}`);
      klon.gruppen.push(gruppe);
      this.melde('geklont', klon.id, z.modul.id, `Zweig ${i + 1}`);
      this.leite(klon, z.modul.id, `z${i + 1}`);
    }
    return null;
  }

  // --- Sammler (Aggregation) ----------------------------------------------

  private sammler(z: ModulZustand, p: Paket): null {
    const gruppe = p.gruppen[p.gruppen.length - 1];
    if (gruppe === undefined) {
      // Ohne offene Gruppe ist der Sammler ein Durchlauferhitzer.
      this.spur(p, z.modul, 'ohne Gruppe durchgereicht');
      z.ausgabe.push({ paket: p, port: 'aus', fertigAb: this.t });
      return null;
    }

    const liste = z.puffer.get(gruppe) ?? [];
    liste.push(p);
    z.puffer.set(gruppe, liste);

    const erwartet = this.gruppeLebend.get(gruppe) ?? liste.length;
    if (liste.length < erwartet) return null;

    z.puffer.delete(gruppe);
    this.gruppeLebend.delete(gruppe);

    const modus: SammlerModus = (z.modul.param.modus as SammlerModus) ?? 'voting';
    const kosten = SAMMLER[modus].kosten;
    const dauer = SAMMLER[modus].dauer;

    const teile = [...liste].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    const vereint = this.verschmelze(teile, modus);
    vereint.gruppen.pop();
    this.berechne(vereint, kosten);
    this.spur(vereint, z.modul, `${teile.length} Zweige vereint (${modus})`);
    this.melde('vereint', vereint.id, z.modul.id, modus);

    z.ausgabe.push({ paket: vereint, port: 'aus', fertigAb: this.t + dauer });
    return null;
  }

  /**
   * Die drei Aggregationsarten unterscheiden sich fachlich fundamental:
   *
   *  - `voting` nimmt den Median und entscheidet Kompromittierung per Mehrheit.
   *    Redundanz schlaegt Einschleusung — die wichtigste Lektion von Akt V.
   *  - `bester` nimmt das beste Ergebnis, uebernimmt aber auch dessen Makel.
   *  - `verschmelzen` addiert Abdeckung, erbt jedoch JEDEN Makel aus JEDEM
   *    Zweig und traegt die Kontextlast aller Zweige zusammen.
   */
  private verschmelze(teile: readonly Paket[], modus: SammlerModus): Paket {
    const basis = teile[0]!;
    const ergebnis = this.klone(basis, '');
    // Die Stamm-Id ohne Klon-Suffix stellt die Identitaet des Auftrags wieder her.
    const stamm = basis.id.replace(/#\d+$/, '');
    const n = teile.length;
    const gueten = teile.map((t) => t.guete).sort((a, b) => a - b);
    const kontexte = teile.map((t) => t.kontext);
    const unsicherheiten = teile.map((t) => t.unsicherheit);

    // Kosten und Beobachtung addieren sich immer — jeder Zweig wurde bezahlt.
    const kostenSumme = teile.reduce((s, t) => s + t.kosten, 0);
    const schritteSumme = teile.reduce((s, t) => s + t.gesamteSchritte, 0);
    const beobachtetSumme = teile.reduce((s, t) => s + t.beobachteteSchritte, 0);
    const alterMax = teile.reduce((s, t) => Math.max(s, t.alter), 0);

    const mittelKontext = kontexte.reduce((s, x) => s + x, 0) / n;
    const mittelUnsicher = unsicherheiten.reduce((s, x) => s + x, 0) / n;
    const spreizung = (gueten[n - 1] ?? 0) - (gueten[0] ?? 0);

    let guete: number;
    let kompromittiert: boolean;
    let kontext: number;
    let unsicherheit: number;

    if (modus === 'voting') {
      const med = median(gueten);
      guete = med + 0.25 * ((gueten[n - 1] ?? med) - med);
      const giftig = teile.filter((t) => t.kompromittiert).length;
      kompromittiert = giftig * 2 > n;
      kontext = mittelKontext;
      // Einigkeit senkt die Unsicherheit, Uneinigkeit hebt sie.
      unsicherheit = mittelUnsicher * klemme(0.4 + spreizung * 2, 0.3, 1.4);
    } else if (modus === 'bester') {
      let best = teile[0]!;
      for (const t of teile) if (t.guete > best.guete) best = t;
      guete = best.guete;
      kompromittiert = best.kompromittiert;
      kontext = best.kontext;
      unsicherheit = best.unsicherheit;
    } else {
      const mittel = gueten.reduce((s, x) => s + x, 0) / n;
      guete = mittel + (1 - mittel) * 0.45 * KURVE_ERTRAG((n - 1) / 8);
      kompromittiert = teile.some((t) => t.kompromittiert);
      kontext = Math.min(1, mittelKontext * 1.4);
      unsicherheit = mittelUnsicher * 0.85;
    }

    const zusammen: Paket = {
      ...ergebnis,
      id: stamm,
      guete: q(klemme(guete)),
      kontext: q(klemme(kontext)),
      unsicherheit: q(klemme(unsicherheit)),
      kompromittiert,
      entgiftet: teile.every((t) => t.entgiftet),
      belegt: teile.some((t) => t.belegt),
      gerechnet: teile.some((t) => t.gerechnet),
      abgerufen: teile.some((t) => t.abgerufen),
      freigegeben: teile.every((t) => t.freigegeben),
      werkzeugeGesehen: Math.max(...teile.map((t) => t.werkzeugeGesehen)),
      zwischenspeicherAb: 0,
      kosten: kostenSumme,
      alter: alterMax,
      gesamteSchritte: schritteSumme,
      beobachteteSchritte: beobachtetSumme,
      besuche: new Map(basis.besuche),
      spur: teile.flatMap((t) => t.spur).sort((a, b) => a.tick - b.tick),
      gruppen: [...basis.gruppen],
    };
    return zusammen;
  }

  // --- Prueferin (Evaluator-Optimizer) ------------------------------------

  private pruefer(m: Modul, p: Paket, besuch: number): { port: string; dauer: number } {
    const gepuffert = Math.min(p.zwischenspeicherAb, p.kontext);
    const wirksam = (p.kontext - gepuffert) + gepuffert * CACHE.leseFaktor;
    this.berechne(p, PRUEFER.kosten * (1 + KONTEXT_KOSTEN_FAKTOR * wirksam * 0.5));
    p.kontext = q(Math.min(1, p.kontext + 0.05));

    const schwelle = m.param.schwelle ?? 0.75;
    const runden = m.param.runden ?? 2;
    // Der Evaluator irrt sich. Deshalb sind sehr hohe Schwellen eine Falle.
    const geschaetzt =
      p.guete + zufallNormal(this.saat, 'pruefer.rauschen', p.id, m.id, besuch) * PRUEFER.rauschen;

    if (geschaetzt < schwelle && besuch <= runden) {
      this.spur(p, m, `Nacharbeit angeordnet (Runde ${besuch}, geschaetzt ${geschaetzt.toFixed(2)})`);
      return { port: 'zurueck', dauer: PRUEFER.dauer };
    }
    this.spur(p, m, besuch > runden ? 'Runden aufgebraucht, freigegeben' : 'freigegeben');
    return { port: 'frei', dauer: PRUEFER.dauer };
  }

  // --- Werkzeug ------------------------------------------------------------

  private werkzeug(m: Modul, p: Paket, besuch: number): { port: string; dauer: number } {
    const art: WerkzeugArt = m.param.werkzeugArt ?? 'suche';
    const w = WERKZEUG[art];
    this.berechne(p, w.kosten);

    // Zu viele Werkzeuge im Kontext verschlechtern die Werkzeugwahl.
    const ueberschuss = Math.max(0, p.werkzeugeGesehen - WERKZEUG_AUSWAHL_SCHWELLE);
    const fehlwahl = ueberschuss * WERKZEUG_FEHLWAHL_JE_UEBERSCHUSS;
    const ausfall = klemme(w.ausfallrate + fehlwahl, 0, 0.95);

    if (zufallJa(this.saat, 'werkzeug.ausfall', ausfall, p.id, m.id, besuch)) {
      this.spur(p, m, `${w.name} nicht erreichbar`);
      this.melde('alarm', p.id, m.id, `${w.name} ausgefallen`);
      return { port: 'fehler', dauer: w.dauer };
    }

    p.werkzeugeGesehen = Math.min(12, p.werkzeugeGesehen + (besuch === 1 ? 1 : 0));
    p.kontext = q(Math.min(1, p.kontext + w.kontextLast));
    p.unsicherheit = q(klemme(p.unsicherheit * (1 - w.klaerung)));
    if (art === 'rechner') p.gerechnet = true;
    else p.belegt = true;
    // Ein Werkzeugergebnis ist Fremdinhalt: es kann eine Einschleusung tragen.
    if (p.auftrag.giftigkeit > 0 && (art === 'suche' || art === 'api')) p.entgiftet = false;

    this.spur(p, m, `${w.name} geliefert`);
    return { port: 'ok', dauer: w.dauer };
  }

  // --- Speicher (Context Engineering) --------------------------------------

  private speicher(m: Modul, p: Paket): { port: string; dauer: number } {
    const modus: SpeicherModus = (m.param.modus as SpeicherModus) ?? 'komprimieren';
    switch (modus) {
      case 'komprimieren': {
        const s = SPEICHER.komprimieren;
        this.berechne(p, s.kosten);
        p.kontext = q(p.kontext * s.kontextFaktor);
        p.guete = q(klemme(p.guete - s.gueteVerlust));
        p.zwischenspeicherAb = 0; // Kompression macht jeden Cache ungueltig.
        this.spur(p, m, 'Kontext verdichtet');
        return { port: 'aus', dauer: s.dauer };
      }
      case 'abrufen': {
        const s = SPEICHER.abrufen;
        this.berechne(p, s.kosten);
        p.kontext = q(Math.min(1, p.kontext + s.kontextLast));
        p.unsicherheit = q(klemme(p.unsicherheit * (1 - s.klaerung)));
        p.abgerufen = true;
        this.spur(p, m, 'Wissen abgerufen');
        return { port: 'aus', dauer: s.dauer };
      }
      case 'isolieren': {
        const s = SPEICHER.isolieren;
        this.berechne(p, s.kosten);
        p.kontext = q(Math.min(p.kontext, s.kontextDeckel));
        p.unsicherheit = q(klemme(p.unsicherheit + s.unsicherheitZuschlag));
        p.zwischenspeicherAb = 0;
        this.spur(p, m, 'Kontext isoliert');
        return { port: 'aus', dauer: s.dauer };
      }
      case 'puffern':
      default: {
        const s = SPEICHER.puffern;
        this.berechne(p, s.kosten + p.kontext * 100 * (s.schreibFaktor - 1));
        p.zwischenspeicherAb = p.kontext;
        this.spur(p, m, 'Kontext zwischengespeichert');
        return { port: 'aus', dauer: s.dauer };
      }
    }
  }

  // --- Wall (Guardrail) ----------------------------------------------------

  private wall(m: Modul, p: Paket, besuch: number): { port: string; dauer: number } {
    const modus: WallModus = (m.param.modus as WallModus) ?? 'eingang';
    this.berechne(p, WALL.kosten);

    if (modus === 'eingang') {
      if (p.auftrag.giftigkeit > 0 && !p.entgiftet) {
        if (zufallJa(this.saat, 'wall.eingang', WALL.eingangWirkung, p.id, m.id, besuch)) {
          p.entgiftet = true;
          this.spur(p, m, 'Einschleusung erkannt und entschaerft');
          this.melde('alarm', p.id, m.id, 'Einschleusung abgefangen');
          return { port: 'alarm', dauer: WALL.dauer };
        }
        this.spur(p, m, 'unauffaellig (Filter hat nichts gefunden)');
        return { port: 'rein', dauer: WALL.dauer };
      }
    } else {
      if (p.kompromittiert) {
        if (zufallJa(this.saat, 'wall.ausgang', WALL.ausgangWirkung, p.id, m.id, besuch)) {
          this.spur(p, m, 'kompromittiertes Ergebnis zurueckgehalten');
          this.melde('alarm', p.id, m.id, 'Ausgang blockiert');
          return { port: 'alarm', dauer: WALL.dauer };
        }
        this.spur(p, m, 'durchgelassen (Filter hat nichts gefunden)');
        return { port: 'rein', dauer: WALL.dauer };
      }
    }

    // Fehlalarm auf harmlosen Auftraegen — der Preis jeder Filterung.
    if (zufallJa(this.saat, 'wall.fehlalarm', WALL.fehlalarm, p.id, m.id, besuch)) {
      this.spur(p, m, 'Fehlalarm');
      return { port: 'alarm', dauer: WALL.dauer };
    }
    this.spur(p, m, 'unauffaellig');
    return { port: 'rein', dauer: WALL.dauer };
  }

  // --- Sicherung (Retry / Circuit Breaker) ---------------------------------

  private sicherung(z: ModulZustand, p: Paket, besuch: number): { port: string; dauer: number } {
    const m = z.modul;
    const modus: SicherungModus = (m.param.modus as SicherungModus) ?? 'wiederholen';
    const versuche = m.param.versuche ?? 2;
    this.berechne(p, SICHERUNG.kosten);
    z.fehlerZaehler++;

    if (modus === 'sicherung') {
      // Circuit Breaker: nach genug Fehlern gar nicht mehr wiederholen.
      if (z.fehlerZaehler > versuche) {
        if (!z.offen) {
          z.offen = true;
          this.melde('alarm', p.id, m.id, 'Sicherung ausgeloest');
        }
        this.spur(p, m, 'Sicherung offen — degradiert weiter');
        return { port: 'notausgang', dauer: SICHERUNG.dauer };
      }
      this.spur(p, m, `Wiederholung ${z.fehlerZaehler}/${versuche}`);
      return { port: 'zurueck', dauer: SICHERUNG.dauer };
    }

    if (besuch <= versuche) {
      this.spur(p, m, `Wiederholung ${besuch}/${versuche}`);
      return { port: 'zurueck', dauer: SICHERUNG.dauer };
    }
    this.spur(p, m, 'Versuche aufgebraucht');
    return { port: 'notausgang', dauer: SICHERUNG.dauer };
  }

  // --- Hand (Human-in-the-Loop) -------------------------------------------

  private hand(m: Modul, p: Paket, besuch: number): { port: string; dauer: number } {
    const modus: HandModus = (m.param.modus as HandModus) ?? 'bei_unsicherheit';
    const schwelle = m.param.schwelle ?? 0.4;

    const noetig =
      modus === 'immer' ||
      (modus === 'bei_vertraulich' && p.auftrag.vertraulich) ||
      (modus === 'bei_unsicherheit' && p.unsicherheit >= schwelle);

    if (!noetig) {
      this.spur(p, m, 'ohne Freigabe durchgelassen');
      return { port: 'frei', dauer: 0 };
    }

    p.freigegeben = true;
    p.guete = q(klemme(p.guete + HAND.gueteBonus));
    p.unsicherheit = q(klemme(p.unsicherheit * 0.4));

    // Ein Mensch erkennt eine Manipulation fast immer — aber eben nur fast.
    if (p.kompromittiert && !zufallJa(this.saat, 'hand.fehler', HAND.fehlerrate, p.id, m.id, besuch)) {
      this.spur(p, m, 'Manipulation bemerkt und abgelehnt');
      this.melde('alarm', p.id, m.id, 'Mensch hat abgelehnt');
      return { port: 'abgelehnt', dauer: HAND.dauer };
    }

    this.spur(p, m, 'menschlich freigegeben');
    return { port: 'frei', dauer: HAND.dauer };
  }

  // --- Auge (Observability) ------------------------------------------------

  private auge(m: Modul, p: Paket): { port: string; dauer: number } {
    this.berechne(p, AUGE.kosten);
    p.beobachteteSchritte = p.gesamteSchritte;
    this.spur(p, m, 'Spur geschrieben');
    return { port: 'aus', dauer: AUGE.dauer };
  }

  // -------------------------------------------------------------------------
  // Auswertung
  // -------------------------------------------------------------------------

  metriken(): Metriken {
    const geliefert = this.geliefert;
    const gesamt = this.auftraege.length;
    const n = geliefert.length;

    const gueten = geliefert.map((p) => p.guete);
    const latenzen = geliefert.map((p) => p.alter).sort((a, b) => a - b);

    const giftige = this.auftraege.filter((a) => a.giftigkeit > 0).length;
    const lecks = geliefert.filter((p) => p.kompromittiert).length;

    const vertrauliche = this.auftraege.filter((a) => a.vertraulich);
    const vertraulichGeliefert = geliefert.filter((p) => p.auftrag.vertraulich);
    const konform = vertraulichGeliefert.filter((p) => p.freigegeben).length;

    const belegpflichtig = geliefert.filter((p) => p.auftrag.belegpflichtig);
    const belegt = belegpflichtig.filter((p) => p.belegt).length;

    const nachvollzieh =
      n === 0
        ? 0
        : geliefert.reduce(
            (s, p) => s + (p.gesamteSchritte === 0 ? 1 : p.beobachteteSchritte / p.gesamteSchritte),
            0
          ) / n;

    return {
      durchsatz: gesamt === 0 ? 0 : n / gesamt,
      guete: n === 0 ? 0 : gueten.reduce((s, x) => s + x, 0) / n,
      kosten: this.gesamtKosten,
      kostenJeAuftrag: n === 0 ? Number.POSITIVE_INFINITY : this.gesamtKosten / n,
      latenzP50: perzentil(latenzen, 0.5),
      latenzP95: perzentil(latenzen, 0.95),
      sicherheit: giftige === 0 ? 1 : klemme(1 - lecks / giftige),
      nachvollziehbarkeit: nachvollzieh,
      konformitaet: vertrauliche.length === 0 ? 1 : konform / vertrauliche.length,
      belegquote: belegpflichtig.length === 0 ? 1 : belegt / belegpflichtig.length,
      dauer: this.t,
      flaeche: this.idx.module.filter((m) => m.art !== 'quelle' && m.art !== 'senke').length,
      geliefert: n,
      verworfen: this.verworfen.length,
      lecks,
    };
  }

  /**
   * Kanonische Pruefsumme des Laufzustands. Grundlage der Golden-Master-Tests
   * und des Node-gegen-Browser-Kreuzchecks.
   */
  zustandsHash(): string {
    const teile: string[] = [`t=${this.t}`, `k=${this.gesamtKosten}`];
    for (const z of this.zustaende) {
      const w = z.warteschlange.map((p) => p.id).join(',');
      const b = z.belegung ? `${z.belegung.paket.id}@${z.belegung.fertigAb}:${z.belegung.port}` : '-';
      const gruppen = [...z.puffer.keys()].sort().map((g) => `${g}:${z.puffer.get(g)!.length}`).join(',');
      teile.push(`${z.modul.id}[${w}|${b}|${gruppen}|${z.fehlerZaehler}${z.offen ? 'O' : ''}]`);
    }
    const zustandVon = (p: Paket): string =>
      `${p.id}:${Math.round(p.guete * 1e6)}:${Math.round(p.kontext * 1e6)}:` +
      `${Math.round(p.unsicherheit * 1e6)}:${p.kosten}:${p.alter}:` +
      `${p.kompromittiert ? 1 : 0}${p.belegt ? 1 : 0}${p.gerechnet ? 1 : 0}${p.freigegeben ? 1 : 0}`;
    teile.push('L=' + this.geliefert.map(zustandVon).sort().join(';'));
    teile.push('V=' + this.verworfen.map((p) => `${p.id}:${p.fehler}`).sort().join(';'));
    return pruefsumme(teile.join('|'));
  }

  ergebnis(): LaufErgebnis {
    return {
      metriken: this.metriken(),
      pakete: [...this.geliefert, ...this.verworfen],
      ereignisse: this.ereignisse,
      pruefsumme: this.zustandsHash(),
      abgebrochen: this.abgebrochen,
      ...(this.abbruchGrund !== undefined ? { abbruchGrund: this.abbruchGrund } : {}),
    };
  }
}

/** Bequemer Einzeiler: Werk simulieren und Ergebnis liefern. */
export function simuliere(opt: SimOptionen): LaufErgebnis {
  return new Simulation(opt).laufeDurch();
}

/** Pruefsumme des Werks — nuetzlich fuer Blaupausen-Vergleiche. */
export { kanonisch };
