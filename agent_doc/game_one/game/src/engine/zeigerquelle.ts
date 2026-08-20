/**
 * Die einzige Stelle im Spiel, die rohe `wheel`- und `pointer`-Ereignisse sieht.
 *
 * Hintergrund: Auf einem MacBook sind Trackpad-Pinch und ein physisch
 * gedruecktes Strg am `wheel`-Ereignis NICHT unterscheidbar — beide setzen
 * `ctrlKey = true`. Die einzige robuste Loesung ist ein Schattenzustand ueber
 * keydown/keyup auf `window`, der bei `blur` zuruecksetzt (sonst haengt er nach
 * Cmd+Tab). three.js macht es intern genauso.
 *
 * Ausserdem gilt: Rechtsklick und mittlere Maustaste werden NIRGENDS
 * vorausgesetzt. macOS uebersetzt Strg+Klick systemseitig in einen Rechtsklick,
 * deshalb ist der Orbit-Modifikator die Wahltaste (Alt/Option), niemals Strg.
 */

export type GestenArt = 'pinch' | 'schwenk' | 'rad';

export interface Geste {
  readonly art: GestenArt;
  readonly dx: number;
  readonly dy: number;
  /** Zeigerposition in normalisierten Geraetekoordinaten (-1..1). */
  readonly ndcX: number;
  readonly ndcY: number;
}

export interface ZeigerZustand {
  /** Position in NDC. */
  ndcX: number;
  ndcY: number;
  /** Position in CSS-Pixeln relativ zur Leinwand. */
  x: number;
  y: number;
  gedrueckt: boolean;
  /** Wahltaste — der Orbit-Modifikator. */
  wahl: boolean;
  umschalt: boolean;
  /** Cmd auf macOS, Strg sonst. */
  befehl: boolean;
}

export interface ZeigerquelleOptionen {
  readonly leinwand: HTMLCanvasElement;
  readonly aufGeste: (g: Geste) => void;
  readonly aufZeigerAb: (z: ZeigerZustand) => void;
  readonly aufZeigerAuf: (z: ZeigerZustand) => void;
  readonly aufZeigerBewegt: (z: ZeigerZustand, dx: number, dy: number) => void;
}

/** deltaMode-Normalisierung: 0 = Pixel, 1 = Zeile, 2 = Seite. */
function normalisiere(delta: number, modus: number): number {
  if (modus === 1) return delta * 16;
  if (modus === 2) return delta * 100;
  return delta;
}

export class Zeigerquelle {
  readonly zustand: ZeigerZustand = {
    ndcX: 0,
    ndcY: 0,
    x: 0,
    y: 0,
    gedrueckt: false,
    wahl: false,
    umschalt: false,
    befehl: false,
  };

  /** Genau ein Picking je Bild: das letzte Bewegungsereignis wird gepuffert. */
  private bewegungOffen = false;

  private readonly abbau: Array<() => void> = [];
  private strgPhysisch = false;
  private letzteX = 0;
  private letzteY = 0;

  constructor(private readonly opt: ZeigerquelleOptionen) {
    const el = opt.leinwand;

    const aufWheel = (e: WheelEvent): void => {
      e.preventDefault();
      this.aktualisiereAusEvent(e);
      const dx = normalisiere(e.deltaX, e.deltaMode);
      const dy = normalisiere(e.deltaY, e.deltaMode);
      // Pinch: ctrlKey gesetzt, aber Strg NICHT physisch gedrueckt.
      const art: GestenArt = e.ctrlKey && !this.strgPhysisch ? 'pinch' : e.shiftKey ? 'rad' : 'schwenk';
      opt.aufGeste({ art, dx, dy, ndcX: this.zustand.ndcX, ndcY: this.zustand.ndcY });
    };

    const aufDown = (e: PointerEvent): void => {
      if (e.button !== 0) return; // Nur die Haupttaste. Kein Rechtsklick, keine mittlere Taste.
      this.aktualisiereAusEvent(e);
      this.zustand.gedrueckt = true;
      this.letzteX = e.clientX;
      this.letzteY = e.clientY;
      el.setPointerCapture(e.pointerId);
      opt.aufZeigerAb(this.zustand);
    };

    const aufUp = (e: PointerEvent): void => {
      if (e.button !== 0) return;
      this.aktualisiereAusEvent(e);
      this.zustand.gedrueckt = false;
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
      opt.aufZeigerAuf(this.zustand);
    };

    const aufMove = (e: PointerEvent): void => {
      const dx = e.clientX - this.letzteX;
      const dy = e.clientY - this.letzteY;
      this.letzteX = e.clientX;
      this.letzteY = e.clientY;
      this.aktualisiereAusEvent(e);
      this.bewegungOffen = true;
      opt.aufZeigerBewegt(this.zustand, dx, dy);
    };

    const aufKontextmenue = (e: Event): void => e.preventDefault();

    const aufKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Control') this.strgPhysisch = true;
    };
    const aufKeyUp = (e: KeyboardEvent): void => {
      if (e.key === 'Control') this.strgPhysisch = false;
    };
    const aufBlur = (): void => {
      this.strgPhysisch = false;
      this.zustand.gedrueckt = false;
      this.zustand.wahl = false;
      this.zustand.umschalt = false;
      this.zustand.befehl = false;
    };

    // Safari: nur `gesturestart` mit preventDefault verhindert den Seitenzoom.
    const aufGestureStart = (e: Event): void => e.preventDefault();

    el.addEventListener('wheel', aufWheel, { passive: false });
    el.addEventListener('pointerdown', aufDown);
    el.addEventListener('pointerup', aufUp);
    el.addEventListener('pointercancel', aufUp);
    el.addEventListener('pointermove', aufMove);
    el.addEventListener('contextmenu', aufKontextmenue);
    el.addEventListener('gesturestart', aufGestureStart as EventListener);
    globalThis.addEventListener('keydown', aufKeyDown, { capture: true, passive: true });
    globalThis.addEventListener('keyup', aufKeyUp, { capture: true, passive: true });
    globalThis.addEventListener('blur', aufBlur);

    this.abbau.push(
      () => el.removeEventListener('wheel', aufWheel),
      () => el.removeEventListener('pointerdown', aufDown),
      () => el.removeEventListener('pointerup', aufUp),
      () => el.removeEventListener('pointercancel', aufUp),
      () => el.removeEventListener('pointermove', aufMove),
      () => el.removeEventListener('contextmenu', aufKontextmenue),
      () => el.removeEventListener('gesturestart', aufGestureStart as EventListener),
      () => globalThis.removeEventListener('keydown', aufKeyDown, { capture: true }),
      () => globalThis.removeEventListener('keyup', aufKeyUp, { capture: true }),
      () => globalThis.removeEventListener('blur', aufBlur)
    );
  }

  /** Wurde seit dem letzten Bild bewegt? Setzt das Flag zurueck. */
  bewegungAbholen(): boolean {
    const b = this.bewegungOffen;
    this.bewegungOffen = false;
    return b;
  }

  private aktualisiereAusEvent(e: MouseEvent | WheelEvent | PointerEvent): void {
    // NDC immer aus getBoundingClientRect, nie aus innerWidth: die Leinwand
    // fuellt nicht zwangslaeufig das Fenster.
    const r = this.opt.leinwand.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    this.zustand.x = x;
    this.zustand.y = y;
    this.zustand.ndcX = r.width > 0 ? (x / r.width) * 2 - 1 : 0;
    this.zustand.ndcY = r.height > 0 ? -((y / r.height) * 2 - 1) : 0;
    this.zustand.wahl = e.altKey;
    this.zustand.umschalt = e.shiftKey;
    this.zustand.befehl = e.metaKey || (e.ctrlKey && !this.strgPhysisch ? false : e.ctrlKey);
  }

  entsorge(): void {
    for (const f of this.abbau.splice(0)) f();
  }
}
