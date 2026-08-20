/**
 * Das HUD. Vollständig im DOM — kein Text im WebGL-Canvas.
 *
 * Es zeigt nur, was gerade eine Entscheidung stützt: die Ziele mit ihrem
 * Ist-Wert, die drei Wettbewerbsachsen, und eine Kontextleiste mit genau den
 * Aktionen, die im aktuellen Modus gelten. Es gibt keinen Gesamtscore, keine
 * Sterne und keine Währung — die Metriken werden niemals zu einer Zahl
 * verrechnet, weil das die Pareto-Front und damit das ganze Spiel zerstören
 * würde.
 */

import type { Metriken, ModulArt } from '../sim/typen';
import { BAUBAR, KATALOG } from '../sim/katalog';
import { tokenZuEuro } from '../sim/balance';
import type { Bewertung } from '../sim/ziele';
import { zielFormel } from '../sim/ziele';
import type { LevelDefinition } from '../inhalt/level_typen';
import { keymapNachBereich, KEYMAP, type Befehl } from './keymap';

export type Modus = 'auswahl' | 'bauen' | 'leitung' | 'abriss';

/**
 * Alles, was die Schmiede-Werkbank zum Zeichnen braucht — und nichts darüber
 * hinaus. Das HUD kennt weder Genotypen noch Pareto-Fronten; es bekommt
 * fertige Zeilen und meldet Klicks zurück.
 */
export interface SchmiedeAnsicht {
  readonly hinweis: string;
  readonly maxZiele: number;
  readonly ziele: readonly { metrik: keyof Metriken; name: string; aktiv: boolean }[];
  readonly bedingungen: readonly { text: string; aktiv: boolean }[];
  readonly population: number;
  readonly generationen: number;
  readonly auswertungen: number;
  readonly budget: number;
  readonly lauf: {
    readonly ausgang: Metriken;
    readonly auswahl: readonly Metriken[];
    readonly warnungen: readonly string[];
    readonly ausnutzung: readonly string[];
  } | null;
  readonly aufZiel: (metrik: keyof Metriken) => void;
  readonly aufBedingung: (text: string) => void;
  readonly aufAufwand: (population: number, generationen: number) => void;
  readonly aufSuchen: () => void;
  readonly aufUebernehmen: (index: number) => void;
}

export interface HudRueckrufe {
  readonly aufModulWahl: (art: ModulArt) => void;
  readonly aufStart: () => void;
  readonly aufZuruecksetzen: () => void;
  readonly aufTempo: (faktor: number) => void;
  readonly aufBriefingSchliessen: () => void;
  readonly aufWeiter: () => void;
  readonly aufNochmal: () => void;
  /** Die Akttafel wurde weggeklickt — danach folgt der Auftrag. */
  readonly aufTafelSchliessen: () => void;
}

const TEMPI = [1, 4, 12, 60] as const;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attr: Record<string, string> = {},
  kinder: (Node | string)[] = []
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attr)) {
    if (k === 'text') e.textContent = v;
    else if (k === 'html') e.innerHTML = v;
    else e.setAttribute(k, v);
  }
  for (const k of kinder) e.append(k);
  return e;
}

/**
 * Zeigt ein Dialogblatt und setzt den Fokus, OHNE ans Ende zu springen.
 *
 * Ein schlichtes `focus()` scrollt das fokussierte Element ins Bild — bei
 * einem langen Auftrag landet man damit auf dem Knopf ganz unten und liest
 * den Text von der Mitte an. Genau dieser Fehler kostet den ersten Eindruck.
 */
function zeigeBlatt(schleier: HTMLElement, blatt: HTMLElement, fokus: HTMLElement): void {
  schleier.replaceChildren(blatt);
  schleier.hidden = false;
  blatt.scrollTop = 0;
  fokus.focus({ preventScroll: true });
}

function zahl(n: number): string {
  if (!Number.isFinite(n)) return '∞';
  return Math.round(n).toLocaleString('de-DE');
}

const ROEMISCH = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'] as const;

/** Akte werden römisch gezählt — im Titel, in den Leveln und auf der Tafel. */
function roemisch(n: number): string {
  return ROEMISCH[n] ?? String(n);
}

export class Hud {
  readonly wurzel: HTMLElement;
  private readonly kopf: HTMLElement;
  private readonly zieleListe: HTMLUListElement;
  private readonly metrikListe: HTMLDListElement;
  private readonly paletteEl: HTMLElement;
  private readonly kontextEl: HTMLElement;
  private readonly startKnopf: HTMLButtonElement;
  private readonly tempoEl: HTMLElement;
  private readonly meldungEl: HTMLElement;
  private readonly lebendig: HTMLElement;
  private readonly briefingEl: HTMLElement;
  private readonly ergebnisEl: HTMLElement;
  private readonly hilfeEl: HTMLElement;
  private readonly tafelEl: HTMLElement;
  private readonly notizEl: HTMLElement;
  private readonly schmiedeEl: HTMLElement;
  readonly schattenbaum: HTMLElement;

  private meldungsTimer: ReturnType<typeof globalThis.setTimeout> | undefined;
  private gewaehlt: ModulArt = 'kern';
  private erlaubt: readonly ModulArt[] = BAUBAR;
  private monolithSatz = '';
  private offeneFragen: readonly string[] = [];

  constructor(
    private readonly ziel: HTMLElement,
    private readonly rueckrufe: HudRueckrufe
  ) {
    this.wurzel = el('div', { id: 'hud' });

    this.kopf = el('section', { class: 'tafel', id: 'kopf' });
    this.zieleListe = el('ul', { class: 'tafel', id: 'ziele', 'aria-label': 'Ziele dieses Auftrags' });
    this.metrikListe = el('dl');
    const metrikTafel = el('section', { class: 'tafel', id: 'metriken', 'aria-label': 'Kennzahlen' }, [
      el('h2', { text: 'Kennzahlen' }),
      this.metrikListe,
    ]);
    this.paletteEl = el('nav', { class: 'tafel', id: 'palette', 'aria-label': 'Modulpalette' });
    this.kontextEl = el('div', { class: 'tafel', id: 'kontext' });

    this.startKnopf = el('button', { type: 'button', text: 'Simulation starten' });
    this.startKnopf.addEventListener('click', () => this.rueckrufe.aufStart());
    const zurueck = el('button', { type: 'button', text: 'Zurücksetzen' });
    zurueck.addEventListener('click', () => this.rueckrufe.aufZuruecksetzen());
    this.tempoEl = el('div', { id: 'tempo', role: 'group', 'aria-label': 'Geschwindigkeit' });
    for (const t of TEMPI) {
      const b = el('button', { type: 'button', text: `${t}×`, 'aria-pressed': t === 4 ? 'true' : 'false' });
      b.addEventListener('click', () => {
        this.setzeTempo(t);
        this.rueckrufe.aufTempo(t);
      });
      this.tempoEl.append(b);
    }
    const steuerung = el('section', { class: 'tafel', id: 'steuerung' }, [this.startKnopf, this.tempoEl, zurueck]);

    this.wurzel.append(this.kopf, this.zieleListe, metrikTafel, this.paletteEl, steuerung, this.kontextEl);

    this.meldungEl = el('div', { id: 'meldung', hidden: 'true' });
    this.lebendig = el('div', { class: 'nur-vorlesen', 'aria-live': 'polite', 'aria-atomic': 'true' });
    this.schattenbaum = el('div', { id: 'schattenbaum' });
    this.briefingEl = el('div', { class: 'schleier-voll', hidden: 'true' });
    this.ergebnisEl = el('div', { class: 'schleier-voll', hidden: 'true' });
    this.hilfeEl = el('div', { class: 'schleier-voll', hidden: 'true' });
    // Die Akttafel liegt VOR dem Auftrag und deckt die Halle vollständig ab —
    // sie ist der einzige Moment, in dem das Spiel nichts von dir will.
    this.tafelEl = el('div', { class: 'schleier-voll tafel-akt', hidden: 'true' });
    this.notizEl = el('div', { class: 'schleier-voll', hidden: 'true' });
    this.schmiedeEl = el('div', { class: 'schleier-voll', hidden: 'true' });

    ziel.append(
      this.wurzel,
      this.meldungEl,
      this.lebendig,
      this.schattenbaum,
      this.briefingEl,
      this.ergebnisEl,
      this.hilfeEl,
      this.tafelEl,
      this.notizEl,
      this.schmiedeEl
    );
    this.baueHilfe();
  }

  // -------------------------------------------------------------------------
  // Level
  // -------------------------------------------------------------------------

  zeigeLevel(level: LevelDefinition, aktTitel: string): void {
    this.erlaubt = BAUBAR.filter((a) => level.module.includes(a));
    if (!this.erlaubt.includes(this.gewaehlt)) this.gewaehlt = this.erlaubt[0] ?? 'kern';
    this.kopf.replaceChildren(
      el('div', { id: 'akt-marke', text: `Akt ${roemisch(level.akt)} · ${aktTitel}` }),
      el('h2', { text: `${level.id} — ${level.titel}` }),
      el('div', { class: 'leise', text: level.untertitel })
    );
    this.bauePalette();
    this.zeigeZiele(level, null);
  }

  private bauePalette(): void {
    this.paletteEl.replaceChildren();
    for (const art of this.erlaubt) {
      const def = KATALOG[art];
      const punkt = el('span', { class: 'punkt' });
      punkt.style.background = `#${def.farbe.toString(16).padStart(6, '0')}`;
      const b = el('button', {
        type: 'button',
        'aria-pressed': art === this.gewaehlt ? 'true' : 'false',
        title: def.lehrsatz,
      });
      b.append(el('span', { class: 'kuerzel', text: def.taste }), el('span', {}, [punkt, def.name]));
      b.addEventListener('click', () => {
        this.setzeModulWahl(art);
        this.rueckrufe.aufModulWahl(art);
      });
      this.paletteEl.append(b);
    }
  }

  setzeModulWahl(art: ModulArt): void {
    this.gewaehlt = art;
    const knoepfe = this.paletteEl.querySelectorAll('button');
    this.erlaubt.forEach((a, i) => knoepfe[i]?.setAttribute('aria-pressed', a === art ? 'true' : 'false'));
  }

  modulWahl(): ModulArt {
    return this.gewaehlt;
  }

  erlaubteModule(): readonly ModulArt[] {
    return this.erlaubt;
  }

  // -------------------------------------------------------------------------
  // Laufende Anzeige
  // -------------------------------------------------------------------------

  zeigeZiele(level: LevelDefinition, bewertung: Bewertung | null): void {
    this.zieleListe.replaceChildren(el('li', { class: 'leise', text: 'Ziele' }));
    for (const z of level.ziele) {
      const stand = bewertung?.staende.find((s) => s.ziel.id === z.id);
      const li = el('li', {
        'data-erfuellt': stand?.erfuellt === true ? 'true' : 'false',
        'data-kuer': z.optional === true ? 'true' : 'false',
      });
      li.append(
        el('span', { class: 'haken', text: stand?.erfuellt === true ? '✓' : '·' }),
        el('span', { text: z.text, title: zielFormel(z) }),
        el('span', { class: 'ist', text: stand?.anzeige ?? '—' })
      );
      this.zieleListe.append(li);
    }
    const b = level.budget;
    const budgets: string[] = [];
    if (b.kosten !== undefined) budgets.push(`Token ≤ ${zahl(b.kosten)}`);
    if (b.latenz !== undefined) budgets.push(`p95 ≤ ${b.latenz} Ticks`);
    if (b.module !== undefined) budgets.push(`Module ≤ ${b.module}`);
    if (budgets.length) {
      /*
       * Jedes Budget als eigenes, nicht umbrechendes Stück.
       *
       * Als eine Zeichenkette gesetzt, zerbrach "Token ≤ 5.200" im schmalen
       * Panel in drei Zeilen — "Token", "≤", "5.200" — und sah aus wie ein
       * Darstellungsfehler. Deutsche Panels brauchen Umbruchreserve; ein
       * Vergleichsoperator allein in einer Zeile ist keine.
       */
      const li = el('li', { class: 'leise budget' });
      li.append(el('span', { class: 'marke', text: 'Budget' }));
      for (const b of budgets) li.append(el('span', { class: 'posten', text: b }));
      this.zieleListe.append(li);
    }
  }

  zeigeMetriken(m: Metriken, level: LevelDefinition | null): void {
    const zeilen: [string, string, 'gut' | 'warn' | 'schlecht' | ''][] = [];
    const kostenGrenze = level?.budget.kosten;
    const latenzGrenze = level?.budget.latenz;

    /*
     * Vor dem ersten Lauf gibt es keine Zahlen, nur einen Gedankenstrich.
     *
     * Der erste Entwurf zeigte hier "Güte 0 %" in Rot und "Token je Auftrag ∞".
     * Beides ist rechnerisch richtig und als Rückmeldung falsch: Es ist nichts
     * schiefgegangen, es ist nur noch nichts passiert. Rot bedeutet in diesem
     * HUD "du hast ein Problem", und diese Bedeutung darf nicht verschleißen.
     */
    const ruht = m.geliefert === 0 && m.verworfen === 0 && m.kosten === 0;
    const wert = (text: string): string => (ruht ? '—' : text);
    const ampel = (a: 'gut' | 'warn' | 'schlecht' | ''): 'gut' | 'warn' | 'schlecht' | '' => (ruht ? '' : a);

    zeilen.push([
      'Güte',
      wert(`${Math.round(m.guete * 100)} %`),
      ampel(m.guete >= 0.7 ? 'gut' : m.guete >= 0.5 ? 'warn' : 'schlecht'),
    ]);
    zeilen.push([
      'Token',
      wert(zahl(m.kosten)),
      ampel(
        kostenGrenze === undefined
          ? ''
          : m.kosten > kostenGrenze
            ? 'schlecht'
            : m.kosten > kostenGrenze * 0.85
              ? 'warn'
              : 'gut'
      ),
    ]);
    zeilen.push(['davon in Euro', wert(`${tokenZuEuro(m.kosten).toFixed(2)} €`), '']);
    zeilen.push(['Token je Auftrag', wert(zahl(m.kostenJeAuftrag)), '']);
    zeilen.push([
      'Latenz p95',
      wert(`${m.latenzP95}`),
      ampel(latenzGrenze === undefined ? '' : m.latenzP95 > latenzGrenze ? 'schlecht' : 'gut'),
    ]);
    // Die Modulzahl steht auch im Ruhezustand: Sie zählt, was gebaut ist,
    // nicht was gelaufen ist.
    zeilen.push(['Module', `${m.flaeche}`, '']);
    zeilen.push(['Ausgeliefert', wert(`${m.geliefert}`), ampel(m.durchsatz >= 1 ? 'gut' : m.durchsatz > 0 ? 'warn' : '')]);
    if (m.verworfen > 0) zeilen.push(['Verworfen', `${m.verworfen}`, 'warn']);
    if (m.lecks > 0) zeilen.push(['Lecks', `${m.lecks}`, 'schlecht']);

    this.metrikListe.replaceChildren();
    for (const [name, wert, zustand] of zeilen) {
      this.metrikListe.append(
        el('dt', { text: name }),
        el('dd', { text: wert, ...(zustand ? { 'data-zustand': zustand } : {}) })
      );
    }
  }

  /**
   * Beschriftet die Kontextleiste — mit Tasten, die es wirklich gibt.
   *
   * Hier stand vorher fest verdrahteter Text, und der war falsch: Im Baumodus
   * warb die Leiste mit „Q / E — Modul wählen", obwohl Q und E nirgends
   * gebunden sind, und im Auswahlmodus mit „2 Bauen, 3 Leitung", obwohl 2 eine
   * Modulziffer ist und die Leitung auf L liegt. Genau diese Tasten probiert
   * jemand als Erstes aus — und schließt aus dem Ausbleiben jeder Wirkung, das
   * Spiel sei kaputt.
   *
   * Die Beschriftungen kommen deshalb jetzt aus `KEYMAP` und dem Katalog. Wer
   * eine Bindung ändert, ändert die Leiste mit; auseinanderlaufen können sie
   * nicht mehr.
   */
  setzeKontext(modus: Modus, zusatz: string[] = []): void {
    const taste = (befehl: Befehl): string =>
      KEYMAP.find((b) => b.befehl === befehl)?.anzeige ?? '—';
    // Die Ziffern der in DIESEM Level freigegebenen Module, nicht alle.
    const modulTasten = this.erlaubt.map((a) => KATALOG[a].taste).join(' ');

    const eintraege: [string, string][] = [];
    switch (modus) {
      case 'bauen':
        eintraege.push(['Klick', 'Setzen']);
        if (modulTasten) eintraege.push([modulTasten, 'Modul wählen']);
        eintraege.push([taste('modus_leitung'), 'Leitung legen'], [taste('abbrechen'), 'Abbrechen']);
        break;
      case 'leitung':
        eintraege.push(['Klick', 'Ausgang, dann Eingang'], [taste('abbrechen'), 'Abbrechen']);
        break;
      case 'abriss':
        eintraege.push(['Klick', 'Modul entfernen'], [taste('abbrechen'), 'Zurück zur Auswahl']);
        break;
      default:
        eintraege.push(['Klick', 'Auswählen']);
        if (modulTasten) eintraege.push([modulTasten, 'Bauen']);
        eintraege.push(
          [taste('modus_leitung'), 'Leitung'],
          [taste('modus_abriss'), 'Abriss'],
          [taste('sim_start'), 'Simulation']
        );
    }
    this.kontextEl.replaceChildren();
    for (const [taste, text] of eintraege) {
      this.kontextEl.append(el('span', {}, [el('kbd', { text: taste }), text]));
    }
    for (const z of zusatz) this.kontextEl.append(el('span', { text: z }));
  }

  setzeTempo(faktor: number): void {
    const knoepfe = this.tempoEl.querySelectorAll('button');
    TEMPI.forEach((t, i) => knoepfe[i]?.setAttribute('aria-pressed', t === faktor ? 'true' : 'false'));
  }

  setzeStartText(text: string, aktiv = true): void {
    this.startKnopf.textContent = text;
    this.startKnopf.disabled = !aktiv;
  }

  melde(text: string, art: 'info' | 'gut' | 'fehler' = 'info', dauerMs = 4200): void {
    this.meldungEl.textContent = text;
    this.meldungEl.dataset['art'] = art;
    this.meldungEl.hidden = false;
    this.lebendig.textContent = text;
    globalThis.clearTimeout(this.meldungsTimer);
    this.meldungsTimer = globalThis.setTimeout(() => {
      this.meldungEl.hidden = true;
    }, dauerMs);
  }

  // -------------------------------------------------------------------------
  // Dialoge
  // -------------------------------------------------------------------------

  /**
   * Die Akttafel: kalter Einstieg oder Schlusssatz, ganzflächig, ohne HUD.
   *
   * Bewusst arm an Bedienelementen — ein Knopf, sonst nichts. Ein Einstieg,
   * neben dem Kennzahlen stehen, ist kein Einstieg mehr, sondern ein
   * Ladebildschirm mit Fließtext.
   */
  zeigeAkttafel(
    art: 'einstieg' | 'schluss',
    akt: number,
    titel: string,
    untertitel: string,
    text: string,
    knopf: string,
    nachsatz?: { frage: string; antwort: string }[]
  ): void {
    const blatt = el('article', {
      class: `blatt akttafel ${art}`,
      role: 'dialog',
      'aria-modal': 'true',
      'aria-label': `Akt ${akt}`,
    });
    blatt.append(
      el('div', { id: 'akt-marke', text: `Akt ${roemisch(akt)}` }),
      el('h1', { text: titel }),
      el('p', { class: 'unter', text: untertitel })
    );
    for (const absatz of text.split('\n')) blatt.append(el('p', { class: 'fliess', text: absatz }));
    for (const n of nachsatz ?? []) {
      blatt.append(
        el('div', { class: 'notiz' }, [
          el('p', { class: 'leise', text: n.frage }),
          el('p', { text: n.antwort }),
        ])
      );
    }
    const weiter = el('button', { type: 'button', text: knopf });
    weiter.addEventListener('click', () => this.rueckrufe.aufTafelSchliessen());
    blatt.append(el('footer', {}, [weiter]));
    zeigeBlatt(this.tafelEl, blatt, weiter);
  }

  schliesseAkttafel(): void {
    this.tafelEl.hidden = true;
  }

  get akttafelOffen(): boolean {
    return !this.tafelEl.hidden;
  }

  /**
   * Ein Fundstück. Titel, Text — und darunter das Vorher und das Nachher.
   *
   * Diese beiden Zeilen sind der ganze Trick: ein Gegenstand erzählt nur,
   * wenn es einen Moment vor ihm und einen nach ihm gibt. Ohne sie wäre die
   * Halle voller Requisiten statt voller Geschichte.
   */
  zeigeFundstueck(f: {
    titel: string;
    text: string;
    vorher: string;
    nachher: string;
  }, stand: { gelesen: number; gesamt: number }): void {
    const blatt = el('article', { class: 'blatt fundstueck', role: 'dialog', 'aria-modal': 'true' });
    blatt.append(
      el('div', { id: 'akt-marke', text: 'Gefunden in Halle 3' }),
      el('h1', { text: f.titel }),
      el('p', { class: 'fliess', text: f.text }),
      el('div', { class: 'notiz' }, [
        el('p', { class: 'leise', text: `Davor — ${f.vorher}` }),
        el('p', { class: 'leise', text: `Danach — ${f.nachher}` }),
      ]),
      el('p', { class: 'leise', text: `${stand.gelesen} von ${stand.gesamt} Fundstücken angesehen. Sie zählen für nichts.` })
    );
    const zu = el('button', { type: 'button', text: 'Zurück an die Arbeit' });
    zu.addEventListener('click', () => this.schliesseFundstueck());
    blatt.append(el('footer', {}, [zu]));
    zeigeBlatt(this.notizEl, blatt, zu);
  }

  schliesseFundstueck(): void {
    this.notizEl.hidden = true;
  }

  // -------------------------------------------------------------------------
  // Schmiede
  // -------------------------------------------------------------------------

  /**
   * Die Werkbank der Schmiede.
   *
   * Aufgebaut wie ein Formular und nicht wie ein Spielmenü, und zwar mit
   * Absicht: Hier wird nichts gespielt, hier wird ein Auftrag an eine Maschine
   * formuliert. Was oben steht (Ziele) treibt die Suche; was in der Mitte
   * steht (Bedingungen) darf sie nicht verletzen; was unten steht (Aufwand)
   * kostet Auswertungen. Die Ergebnisse erscheinen als Liste zum Vergleichen —
   * nicht als Sieger.
   */
  zeigeSchmiede(a: SchmiedeAnsicht): void {
    const blatt = el('article', {
      class: 'blatt schmiede',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-label': 'Schmiede',
    });
    blatt.append(
      el('div', { id: 'akt-marke', text: 'Die Schmiede' }),
      el('h1', { text: 'Selektionsdruck einrichten' }),
      el('p', { class: 'unter', text: a.hinweis })
    );

    blatt.append(el('h2', { text: `Suchziele (höchstens ${a.maxZiele})` }));
    const zieleFeld = el('div', { class: 'schalter' });
    for (const z of a.ziele) {
      zieleFeld.append(
        this.schalter(z.name, z.aktiv, z.aktiv ? 'ziel' : '', () => a.aufZiel(z.metrik))
      );
    }
    blatt.append(zieleFeld);

    blatt.append(
      el('h2', { text: 'Harte Bedingungen' }),
      el('p', { class: 'leise', text: 'Nicht vorausgewählt. Was du hier nicht setzt, darf die Suche opfern.' })
    );
    const bedFeld = el('div', { class: 'schalter' });
    for (const b of a.bedingungen) {
      bedFeld.append(this.schalter(b.text, b.aktiv, b.aktiv ? 'bedingung' : '', () => a.aufBedingung(b.text)));
    }
    if (a.bedingungen.length === 0) {
      bedFeld.append(el('span', { class: 'leise', text: 'Dieses Level stellt keine harten Bedingungen.' }));
    }
    blatt.append(bedFeld);

    blatt.append(el('h2', { text: 'Aufwand' }));
    blatt.append(
      this.regler('Individuen', a.population, 6, 48, (v) => a.aufAufwand(v, a.generationen)),
      this.regler('Generationen', a.generationen, 2, 40, (v) => a.aufAufwand(a.population, v)),
      el('p', {
        class: a.auswertungen > a.budget ? 'frage warnung' : 'leise',
        text: `${a.auswertungen} Auswertungen von ${a.budget} Budget.`,
      })
    );

    if (a.lauf) {
      blatt.append(el('h2', { text: 'Ergebnis' }));
      for (const w of a.lauf.warnungen) blatt.append(el('blockquote', { class: 'monolith', text: w }));
      for (const w of a.lauf.ausnutzung) blatt.append(el('blockquote', { class: 'monolith', text: w }));
      const t = el('table');
      t.append(el('tr', { html: '<th>Anlage</th><th>Token/Auftrag</th><th>p95</th><th>Module</th><th>Güte</th><th></th>' }));
      t.append(
        el('tr', {
          class: 'ausgang',
          html:
            '<td>dein Bau</td>' +
            `<td class="zahl">${zahl(a.lauf.ausgang.kostenJeAuftrag)}</td>` +
            `<td class="zahl">${a.lauf.ausgang.latenzP95}</td>` +
            `<td class="zahl">${a.lauf.ausgang.flaeche}</td>` +
            `<td class="zahl">${Math.round(a.lauf.ausgang.guete * 100)} %</td><td></td>`,
        })
      );
      a.lauf.auswahl.forEach((k, i) => {
        const zeile = el('tr');
        zeile.innerHTML =
          `<td>Fund ${i + 1}</td>` +
          `<td class="zahl">${zahl(k.kostenJeAuftrag)}</td>` +
          `<td class="zahl">${k.latenzP95}</td>` +
          `<td class="zahl">${k.flaeche}</td>` +
          `<td class="zahl">${Math.round(k.guete * 100)} %</td>`;
        const zelle = el('td');
        const knopf = el('button', { type: 'button', class: 'leise', text: 'übernehmen' });
        knopf.addEventListener('click', () => a.aufUebernehmen(i));
        zelle.append(knopf);
        zeile.append(zelle);
        t.append(zeile);
      });
      blatt.append(t);
      if (a.lauf.auswahl.length === 0) {
        blatt.append(
          el('p', { class: 'frage', text: 'Keine zulässige Anlage gefunden. Lockere eine Bedingung oder gib der Suche mehr Aufwand.' })
        );
      }
    }

    const suchen = el('button', { type: 'button', text: a.lauf ? 'Neu suchen' : 'Suche starten' });
    suchen.addEventListener('click', () => a.aufSuchen());
    const zu = el('button', { type: 'button', class: 'leise', text: 'Schließen' });
    zu.addEventListener('click', () => this.schliesseSchmiede());
    blatt.append(el('footer', {}, [zu, suchen]));

    // Nach einem Suchlauf soll die Ergebnistabelle im Blick sein, nicht der
    // Kopf des Formulars — sonst scrollt man nach jedem Lauf von Hand.
    zeigeBlatt(this.schmiedeEl, blatt, a.lauf ? suchen : (zieleFeld.querySelector('button') ?? suchen));
  }

  schliesseSchmiede(): void {
    this.schmiedeEl.hidden = true;
  }

  get schmiedeOffen(): boolean {
    return !this.schmiedeEl.hidden;
  }

  private schalter(text: string, aktiv: boolean, marke: string, aufKlick: () => void): HTMLButtonElement {
    const b = el('button', {
      type: 'button',
      class: 'schalt',
      'aria-pressed': aktiv ? 'true' : 'false',
      ...(marke ? { 'data-marke': marke } : {}),
      text,
    });
    b.addEventListener('click', aufKlick);
    return b;
  }

  private regler(
    name: string,
    wert: number,
    min: number,
    max: number,
    aufWert: (v: number) => void
  ): HTMLElement {
    const zeile = el('label', { class: 'regler' });
    const eingabe = el('input', {
      type: 'range',
      min: String(min),
      max: String(max),
      value: String(wert),
      'aria-label': name,
    });
    const anzeige = el('span', { class: 'zahl', text: String(wert) });
    eingabe.addEventListener('input', () => {
      anzeige.textContent = eingabe.value;
    });
    eingabe.addEventListener('change', () => aufWert(Number(eingabe.value)));
    zeile.append(el('span', { text: name }), eingabe, anzeige);
    return zeile;
  }

  zeigeBriefing(level: LevelDefinition, aktTitel: string, monolith: Metriken | null): void {
    const blatt = el('article', { class: 'blatt', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Auftrag' });
    blatt.append(
      el('div', { id: 'akt-marke', text: `Akt ${roemisch(level.akt)} · ${aktTitel}` }),
      el('h1', { text: level.titel }),
      el('p', { class: 'unter', text: level.untertitel })
    );
    for (const absatz of level.briefing.split('\n')) blatt.append(el('p', { text: absatz }));
    blatt.append(el('div', { class: 'lernziel', text: level.lernziel }));
    if (level.notiz) blatt.append(el('div', { class: 'notiz', text: level.notiz }));
    if (monolith) {
      blatt.append(
        el('p', { class: 'leise', text: 'MONOLITH hat denselben Auftrag bereits bearbeitet:' }),
        el('table', {
          html:
            '<tr><th>Güte</th><th>Token</th><th>p95</th><th>Nachvollziehbarkeit</th></tr>' +
            `<tr><td class="zahl">${Math.round(monolith.guete * 100)} %</td>` +
            `<td class="zahl">${zahl(monolith.kosten)}</td>` +
            `<td class="zahl">${monolith.latenzP95}</td>` +
            `<td class="zahl">${Math.round(monolith.nachvollziehbarkeit * 100)} %</td></tr>`,
        })
      );
    }
    /*
     * MONOLITHs Angebot steht direkt bei seinen Zahlen — und zwar ohne
     * Widerrede des Spiels. Es ist bequem, es ist plausibel, und es ist
     * falsch. Würde hier eine Warnung danebenstehen, wäre die Versuchung
     * keine mehr, und der Antagonist verkäme zum Schild "Bitte nicht
     * anfassen".
     */
    if (this.monolithSatz) {
      blatt.append(el('blockquote', { class: 'monolith', text: this.monolithSatz }));
    }
    if (this.offeneFragen.length) {
      blatt.append(el('p', { class: 'leise', text: 'Was noch offen ist:' }));
      for (const f of this.offeneFragen) blatt.append(el('p', { class: 'frage', text: f }));
    }
    const weiter = el('button', { type: 'button', text: 'An die Arbeit' });
    weiter.addEventListener('click', () => this.rueckrufe.aufBriefingSchliessen());
    blatt.append(el('footer', {}, [weiter]));
    zeigeBlatt(this.briefingEl, blatt, weiter);
  }

  schliesseBriefing(): void {
    this.briefingEl.hidden = true;
  }

  /** Erzähltexte für den nächsten Auftrag. Muss vor `zeigeBriefing` stehen. */
  setzeErzaehltexte(monolith: string, fragen: readonly string[]): void {
    this.monolithSatz = monolith;
    this.offeneFragen = fragen;
  }

  zeigeErgebnis(level: LevelDefinition, bewertung: Bewertung, m: Metriken): void {
    const geschafft = bewertung.bestanden;
    const blatt = el('article', { class: 'blatt', role: 'dialog', 'aria-modal': 'true' });
    blatt.append(
      el('h1', { text: geschafft ? 'Auftrag erfüllt' : 'Auftrag nicht erfüllt' }),
      el('p', { class: 'unter', text: `${level.id} — ${level.titel}` })
    );

    const tabelle = el('table');
    tabelle.append(
      el('tr', { html: '<th>Ziel</th><th>Ist</th><th></th>' }),
      ...bewertung.staende.map((s) =>
        el('tr', {
          html:
            `<td>${s.ziel.text}${s.ziel.optional === true ? ' <em>(Kuer)</em>' : ''}</td>` +
            `<td class="zahl">${s.anzeige}</td><td>${s.erfuellt ? '✓' : '·'}</td>`,
        })
      )
    );
    blatt.append(tabelle);

    if (bewertung.budgetVerstoesse.length) {
      blatt.append(el('p', { text: 'Budget:' }));
      for (const v of bewertung.budgetVerstoesse) blatt.append(el('p', { class: 'leise', text: v }));
    }

    blatt.append(
      el('p', { class: 'leise', text: 'Deine drei Achsen — sie werden nie zu einer Zahl verrechnet.' }),
      el('table', {
        html:
          '<tr><th>Token je Auftrag</th><th>Latenz p95</th><th>Module</th></tr>' +
          `<tr><td class="zahl">${zahl(m.kostenJeAuftrag)}</td>` +
          `<td class="zahl">${m.latenzP95}</td><td class="zahl">${m.flaeche}</td></tr>`,
      })
    );

    if (geschafft) blatt.append(el('div', { class: 'lernziel', text: level.reflexion }));

    const nochmal = el('button', { type: 'button', class: 'leise', text: 'Noch einmal bauen' });
    nochmal.addEventListener('click', () => this.rueckrufe.aufNochmal());
    const weiter = el('button', { type: 'button', text: geschafft ? 'Weiter' : 'Zurück ins Werk' });
    weiter.addEventListener('click', () => this.rueckrufe.aufWeiter());
    blatt.append(el('footer', {}, [nochmal, weiter]));

    zeigeBlatt(this.ergebnisEl, blatt, weiter);
  }

  schliesseErgebnis(): void {
    this.ergebnisEl.hidden = true;
  }

  private baueHilfe(): void {
    const blatt = el('article', { class: 'blatt', role: 'dialog', 'aria-modal': 'true' });
    blatt.append(el('h1', { text: 'Tastenübersicht' }), el('p', { class: 'unter', text: 'Jede Aktion ist auch ohne Maus erreichbar.' }));
    for (const [bereich, bindungen] of keymapNachBereich()) {
      blatt.append(el('h2', { text: bereich }));
      const t = el('table');
      for (const b of bindungen) {
        t.append(el('tr', { html: `<td><kbd>${b.anzeige}</kbd></td><td>${b.text}</td>` }));
      }
      blatt.append(t);
    }
    const zu = el('button', { type: 'button', text: 'Schließen' });
    zu.addEventListener('click', () => this.schliesseHilfe());
    blatt.append(el('footer', {}, [zu]));
    this.hilfeEl.replaceChildren(blatt);
  }

  schalteHilfe(): void {
    this.hilfeEl.hidden = !this.hilfeEl.hidden;
    if (!this.hilfeEl.hidden) {
      const blatt = this.hilfeEl.querySelector('.blatt');
      if (blatt) blatt.scrollTop = 0;
      this.hilfeEl.querySelector('button')?.focus({ preventScroll: true });
    }
  }

  schliesseHilfe(): void {
    this.hilfeEl.hidden = true;
  }

  /**
   * Der oberste offene modale Dialog, sonst `null`.
   *
   * Die Reihenfolge folgt der Stapelung: Die Akttafel liegt über allem, danach
   * das Fundstück, dann Hilfe, Ergebnis und Auftrag. Wer sie umsortiert, muss
   * hier mitziehen — sonst hält der Fokusring den falschen Dialog fest.
   */
  offenerDialog(): HTMLElement | null {
    for (const el of [this.tafelEl, this.notizEl, this.schmiedeEl, this.hilfeEl, this.ergebnisEl, this.briefingEl]) {
      if (!el.hidden) return el;
    }
    return null;
  }

  get dialogOffen(): boolean {
    return (
      !this.briefingEl.hidden ||
      !this.ergebnisEl.hidden ||
      !this.hilfeEl.hidden ||
      !this.tafelEl.hidden ||
      !this.notizEl.hidden ||
      !this.schmiedeEl.hidden
    );
  }

  /**
   * Screenreader-Schattenbaum des Graphen. Die wirksamste Einzelmaßnahme für
   * die Bedienbarkeit eines Canvas-Spiels.
   */
  aktualisiereSchattenbaum(eintraege: readonly { id: string; text: string }[]): void {
    const liste = el('ul', { role: 'listbox', 'aria-label': 'Module im Werk' });
    for (const e of eintraege) {
      liste.append(el('li', { role: 'option', tabindex: '0', 'aria-label': e.text, 'data-modul': e.id, text: e.text }));
    }
    this.schattenbaum.replaceChildren(liste);
  }

  entsorge(): void {
    globalThis.clearTimeout(this.meldungsTimer);
    this.wurzel.remove();
    this.meldungEl.remove();
    this.lebendig.remove();
    this.schattenbaum.remove();
    this.briefingEl.remove();
    this.ergebnisEl.remove();
    this.hilfeEl.remove();
    void this.ziel;
  }
}
