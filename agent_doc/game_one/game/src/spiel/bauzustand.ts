/**
 * Der Bauzustand: das Werk, das die Spielerin gerade baut, samt Historie.
 *
 * Rueckgaengig/Wiederholen ist als Command-Pattern umgesetzt, nicht als
 * Schnappschuss-Kette. Der Grund ist nicht Speicher, sondern Klarheit: eine
 * Aktion, die sich nicht sauber umkehren laesst, faellt beim Schreiben auf —
 * und ein Test kann `Undo(Redo(x)) === x` auf Pruefsummen-Ebene erzwingen.
 */

import type { Leitung, Modul, ModulArt, ModulParameter, Werk } from '../sim/typen';
import { ausgaengeVon, KATALOG } from '../sim/katalog';
import { hatFehler, indiziere, portSchluessel, pruefeWerk, werkPruefsumme, type Befund } from '../sim/graph';

export interface Aktion {
  readonly art: string;
  readonly beschreibung: string;
  aus(z: BauZustand): void;
  zurueck(z: BauZustand): void;
}

export type SetzErgebnis =
  | { readonly ok: true; readonly id: string }
  | { readonly ok: false; readonly grund: string };

export type VerbindErgebnis =
  | { readonly ok: true; readonly id: string }
  | { readonly ok: false; readonly grund: string };

const MAX_HISTORIE = 250;

export class BauZustand {
  private module: Modul[] = [];
  private leitungen: Leitung[] = [];
  private zaehler = 0;
  private readonly getan: Aktion[] = [];
  private readonly rueckgaengig: Aktion[] = [];
  /** Module aus dem Level-Vorbau lassen sich nicht loeschen. */
  private readonly fest = new Set<string>();

  constructor(vorbau?: Werk, festeIds: readonly string[] = []) {
    if (vorbau) {
      this.module = vorbau.module.map((m) => ({ ...m, param: { ...m.param } }));
      this.leitungen = vorbau.leitungen.map((l) => ({ ...l }));
      this.zaehler = this.module.length;
    }
    for (const id of festeIds) this.fest.add(id);
    for (const m of this.module) if (m.art === 'quelle' || m.art === 'senke') this.fest.add(m.id);
  }

  // -------------------------------------------------------------------------
  // Lesen
  // -------------------------------------------------------------------------

  werk(): Werk {
    return { module: this.module, leitungen: this.leitungen };
  }

  pruefsumme(): string {
    return werkPruefsumme(this.werk());
  }

  befunde(): Befund[] {
    return pruefeWerk(this.werk());
  }

  lauffaehig(): boolean {
    return !hatFehler(this.befunde());
  }

  modul(id: string): Modul | undefined {
    return this.module.find((m) => m.id === id);
  }

  modulAufFeld(x: number, z: number): Modul | undefined {
    return this.module.find((m) => m.x === x && m.z === z);
  }

  istFest(id: string): boolean {
    return this.fest.has(id);
  }

  /** Anzahl baubarer Module (Quelle und Senke zaehlen nicht als Flaeche). */
  flaeche(): number {
    return this.module.filter((m) => m.art !== 'quelle' && m.art !== 'senke').length;
  }

  /** Freie Ausgangsports eines Moduls. */
  freieAusgaenge(id: string): string[] {
    const m = this.modul(id);
    if (!m) return [];
    const idx = indiziere(this.werk());
    return ausgaengeVon(m)
      .map((p) => p.id)
      .filter((p) => !idx.ausgang.has(portSchluessel(id, p)));
  }

  kannRueckgaengig(): boolean {
    return this.getan.length > 0;
  }

  kannWiederholen(): boolean {
    return this.rueckgaengig.length > 0;
  }

  letzteAktion(): string | null {
    return this.getan[this.getan.length - 1]?.beschreibung ?? null;
  }

  // -------------------------------------------------------------------------
  // Schreiben — jede Aenderung laeuft ueber eine Aktion
  // -------------------------------------------------------------------------

  private fuehreAus(a: Aktion): void {
    a.aus(this);
    this.getan.push(a);
    if (this.getan.length > MAX_HISTORIE) this.getan.shift();
    this.rueckgaengig.length = 0;
  }

  setze(art: ModulArt, x: number, z: number, param?: ModulParameter): SetzErgebnis {
    if (this.modulAufFeld(x, z)) return { ok: false, grund: 'Feld belegt' };
    const id = `${art.slice(0, 2)}${++this.zaehler}`;
    const voll: ModulParameter = { ...KATALOG[art].standard, ...(param ?? {}) };
    const neu: Modul = { id, art, x, z, param: voll };
    this.fuehreAus({
      art: 'setze',
      beschreibung: `${KATALOG[art].name} gesetzt`,
      aus: (s) => {
        s.module = [...s.module, neu];
      },
      zurueck: (s) => {
        s.module = s.module.filter((m) => m.id !== id);
      },
    });
    return { ok: true, id };
  }

  entferne(id: string): boolean {
    if (this.fest.has(id)) return false;
    const modul = this.modul(id);
    if (!modul) return false;
    const betroffen = this.leitungen.filter((l) => l.von === id || l.nach === id);
    this.fuehreAus({
      art: 'entferne',
      beschreibung: `${KATALOG[modul.art].name} entfernt`,
      aus: (s) => {
        s.module = s.module.filter((m) => m.id !== id);
        s.leitungen = s.leitungen.filter((l) => l.von !== id && l.nach !== id);
      },
      zurueck: (s) => {
        s.module = [...s.module, modul];
        s.leitungen = [...s.leitungen, ...betroffen];
      },
    });
    return true;
  }

  verbinde(von: string, vonPort: string, nach: string, nachPort = 'ein'): VerbindErgebnis {
    const a = this.modul(von);
    const b = this.modul(nach);
    if (!a || !b) return { ok: false, grund: 'Modul unbekannt' };
    if (von === nach) return { ok: false, grund: 'Ein Modul kann nicht auf sich selbst zeigen' };
    if (!ausgaengeVon(a).some((p) => p.id === vonPort)) return { ok: false, grund: `Kein Ausgang "${vonPort}"` };
    if (!KATALOG[b.art].eingaenge.some((p) => p.id === nachPort)) return { ok: false, grund: `Kein Eingang "${nachPort}"` };
    const belegt = this.leitungen.some((l) => l.von === von && l.vonPort === vonPort);
    if (belegt) return { ok: false, grund: 'Ausgang ist bereits verdrahtet' };

    const id = `v${++this.zaehler}`;
    const neu: Leitung = { id, von, vonPort, nach, nachPort };
    this.fuehreAus({
      art: 'verbinde',
      beschreibung: 'Leitung gelegt',
      aus: (s) => {
        s.leitungen = [...s.leitungen, neu];
      },
      zurueck: (s) => {
        s.leitungen = s.leitungen.filter((l) => l.id !== id);
      },
    });
    return { ok: true, id };
  }

  trenne(leitungsId: string): boolean {
    const l = this.leitungen.find((x) => x.id === leitungsId);
    if (!l) return false;
    this.fuehreAus({
      art: 'trenne',
      beschreibung: 'Leitung getrennt',
      aus: (s) => {
        s.leitungen = s.leitungen.filter((x) => x.id !== leitungsId);
      },
      zurueck: (s) => {
        s.leitungen = [...s.leitungen, l];
      },
    });
    return true;
  }

  /** Aendert Parameter eines Moduls (Kerngroesse, Schwelle, Modus …). */
  stelleEin(id: string, param: ModulParameter): boolean {
    const m = this.modul(id);
    if (!m) return false;
    const vorher = { ...m.param };
    const nachher = { ...m.param, ...param };
    this.fuehreAus({
      art: 'einstellen',
      beschreibung: `${KATALOG[m.art].name} eingestellt`,
      aus: (s) => {
        s.module = s.module.map((x) => (x.id === id ? { ...x, param: nachher } : x));
      },
      zurueck: (s) => {
        s.module = s.module.map((x) => (x.id === id ? { ...x, param: vorher } : x));
      },
    });
    return true;
  }

  /** Verschiebt ein Modul auf ein freies Feld. */
  verschiebe(id: string, x: number, z: number): boolean {
    const m = this.modul(id);
    if (!m || this.fest.has(id)) return false;
    if (this.modulAufFeld(x, z)) return false;
    const alt = { x: m.x, z: m.z };
    this.fuehreAus({
      art: 'verschiebe',
      beschreibung: 'Modul verschoben',
      aus: (s) => {
        s.module = s.module.map((q) => (q.id === id ? { ...q, x, z } : q));
      },
      zurueck: (s) => {
        s.module = s.module.map((q) => (q.id === id ? { ...q, x: alt.x, z: alt.z } : q));
      },
    });
    return true;
  }

  macheRueckgaengig(): boolean {
    const a = this.getan.pop();
    if (!a) return false;
    a.zurueck(this);
    this.rueckgaengig.push(a);
    return true;
  }

  wiederhole(): boolean {
    const a = this.rueckgaengig.pop();
    if (!a) return false;
    a.aus(this);
    this.getan.push(a);
    return true;
  }

  /** Setzt auf den Vorbau zurueck. Nicht umkehrbar — die Historie wird geleert. */
  leere(vorbau?: Werk): void {
    this.module = vorbau ? vorbau.module.map((m) => ({ ...m, param: { ...m.param } })) : [];
    this.leitungen = vorbau ? vorbau.leitungen.map((l) => ({ ...l })) : [];
    this.getan.length = 0;
    this.rueckgaengig.length = 0;
    this.zaehler = this.module.length;
  }

  /** Uebernimmt ein vollstaendiges Werk (Blaupause, Referenzloesung, Testaufbau). */
  ladeWerk(werk: Werk): void {
    this.module = werk.module.map((m) => ({ ...m, param: { ...m.param } }));
    this.leitungen = werk.leitungen.map((l) => ({ ...l }));
    this.getan.length = 0;
    this.rueckgaengig.length = 0;
    this.zaehler = this.module.length + this.leitungen.length;
    for (const m of this.module) if (m.art === 'quelle' || m.art === 'senke') this.fest.add(m.id);
  }
}
