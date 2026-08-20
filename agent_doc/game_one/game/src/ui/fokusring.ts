/**
 * Der Fokusring: hält die Tabulatortaste im Spiel.
 *
 * Anlass war ein Testausfall, der ein echtes Bedienproblem beschreibt: Nach elf
 * Tabs lag der Fokus auf `<body>`. Für eine Spielerin, die ohne Maus arbeitet,
 * heißt das, dass sie aus dem Spiel herausfällt und nur durch Raten wieder
 * hineinkommt — die Leinwand sieht danach genauso aus, reagiert aber auf keine
 * Taste mehr.
 *
 * Zwei Regeln, und die Reihenfolge ist wichtig:
 *
 *  1. **Ist ein modaler Dialog offen, bleibt der Fokus IN ihm.** Das ist keine
 *     Feinheit, sondern die Bedingung, unter der `aria-modal="true"` überhaupt
 *     zutrifft. Ein Dialog, hinter dem sich weitertabben lässt, belügt jede
 *     Vorlesehilfe.
 *  2. **Sonst läuft der Fokus im Kreis durch die Oberfläche.** Das Spiel füllt
 *     das Fenster; es gibt kein „danach", zu dem man tabben könnte.
 *
 * Die Liste der erreichbaren Elemente wird bei jedem Tastendruck neu gelesen.
 * Das klingt verschwenderisch und ist es nicht: Sie ändert sich, sobald ein
 * Dialog auf- oder zugeht oder die Modulpalette wechselt, und eine
 * zwischengespeicherte Liste wäre genau dann falsch, wenn es darauf ankommt.
 */

const ERREICHBAR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/** Sichtbar im Sinne der Fokusfolge: nicht `hidden`, nicht ausgeblendet. */
function sichtbar(el: HTMLElement): boolean {
  if (el.hidden) return false;
  // `offsetParent === null` fängt `display: none` mitsamt aller Vorfahren ab.
  // Ein `position: fixed`-Element hat ebenfalls keinen `offsetParent`, deshalb
  // die zweite Bedingung.
  if (el.offsetParent === null && getComputedStyle(el).position !== 'fixed') return false;
  return el.getAttribute('aria-hidden') !== 'true';
}

function erreichbare(wurzel: ParentNode): HTMLElement[] {
  return [...wurzel.querySelectorAll<HTMLElement>(ERREICHBAR)].filter(sichtbar);
}

export class Fokusring {
  private readonly abbau: Array<() => void> = [];

  /**
   * @param bereich  Der Bereich, in dem der Fokus normalerweise kreist.
   * @param dialog   Liefert den gerade offenen modalen Dialog, sonst `null`.
   */
  constructor(
    private readonly bereich: HTMLElement,
    private readonly dialog: () => HTMLElement | null
  ) {
    const ab = (e: KeyboardEvent): void => this.aufTab(e);
    // Erfassungsphase: Der Ring entscheidet, BEVOR ein Element die Taste
    // sieht. Sonst käme er bei einem Dialog zu spät, der Tab selbst behandelt.
    globalThis.addEventListener('keydown', ab, true);
    this.abbau.push(() => globalThis.removeEventListener('keydown', ab, true));
  }

  private aufTab(e: KeyboardEvent): void {
    if (e.key !== 'Tab' || e.ctrlKey || e.metaKey || e.altKey) return;
    const wurzel = this.dialog() ?? this.bereich;
    const liste = erreichbare(wurzel);
    if (liste.length === 0) return;

    const erstes = liste[0]!;
    const letztes = liste[liste.length - 1]!;
    const aktiv = document.activeElement as HTMLElement | null;
    const drin = aktiv !== null && wurzel.contains(aktiv);

    // Fokus außerhalb des zuständigen Bereichs: hineinholen, statt ihn
    // weiterwandern zu lassen.
    if (!drin) {
      e.preventDefault();
      (e.shiftKey ? letztes : erstes).focus();
      return;
    }
    if (!e.shiftKey && aktiv === letztes) {
      e.preventDefault();
      erstes.focus();
      return;
    }
    if (e.shiftKey && aktiv === erstes) {
      e.preventDefault();
      letztes.focus();
    }
  }

  entsorge(): void {
    for (const f of this.abbau.splice(0)) f();
  }
}
