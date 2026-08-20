/**
 * Kamerafuehrung: RTS-Orbit-Hybrid mit bodenverankertem Drehpunkt.
 *
 * Warum nicht `OrbitControls`/`MapControls`: deren Standardbelegung
 * `{LEFT: PAN, MIDDLE: DOLLY, RIGHT: ROTATE}` macht Orbit und Dolly auf einem
 * MacBook ohne Maus schlicht unerreichbar. Diese Steuerung kommt mit einer
 * Taste, dem Trackpad und der Tastatur aus.
 *
 * Der Drehpunkt liegt IMMER auf der Bodenebene y=0. Dadurch bleibt das
 * Fundament stets im Bild, und Zoom heisst "naeher an die Stelle, auf die du
 * zeigst" statt "weiter in irgendeine Richtung".
 */

import * as THREE from 'three/webgpu';
import type { Geste } from './zeigerquelle';

const GRAD = Math.PI / 180;

export interface KameraGrenzen {
  readonly minAbstand: number;
  readonly maxAbstand: number;
  readonly minNeigung: number;
  readonly maxNeigung: number;
  /** Halbe Kantenlaenge des Bereichs, in dem sich der Drehpunkt bewegen darf. */
  readonly reichweite: number;
}

const STANDARD: KameraGrenzen = {
  minAbstand: 7,
  maxAbstand: 72,
  minNeigung: 18 * GRAD,
  maxNeigung: 78 * GRAD,
  reichweite: 26,
};

export class Kamerafuehrung {
  /** Bodenpunkt, um den die Kamera kreist. */
  readonly ziel = new THREE.Vector3(0, 0, 0);
  private zielSoll = new THREE.Vector3(0, 0, 0);

  private abstand = 26;
  private abstandSoll = 26;
  private gierung = -35 * GRAD;
  private gierungSoll = -35 * GRAD;
  private neigung = 52 * GRAD;
  private neigungSoll = 52 * GRAD;

  /** Zeitpunkt der letzten manuellen Neigungsaenderung, in Sekunden. */
  private letzteNeigungManuell = -99;
  private uhr = 0;
  private reduziert = false;

  constructor(
    private readonly kamera: THREE.PerspectiveCamera,
    private readonly grenzen: KameraGrenzen = STANDARD
  ) {
    this.wendeAn(1);
  }

  setzeReduzierteBewegung(an: boolean): void {
    this.reduziert = an;
  }

  // -------------------------------------------------------------------------
  // Eingaben
  // -------------------------------------------------------------------------

  /** Zwei-Finger-Schwenk ueber die Bodenebene. */
  schwenke(dx: number, dy: number): void {
    const massstab = this.abstandSoll * 0.0016;
    const cos = Math.cos(this.gierungSoll);
    const sin = Math.sin(this.gierungSoll);
    // Bildschirm-Rechts und Bildschirm-Vorwaerts in Weltkoordinaten.
    this.zielSoll.x += (dx * cos - dy * sin) * massstab;
    this.zielSoll.z += (dx * sin + dy * cos) * massstab;
    this.klemmeZiel();
  }

  /** Zoom zur Zeigerposition: der Punkt unter dem Zeiger bleibt stehen. */
  zoome(delta: number, ndcX = 0, ndcY = 0): void {
    const vorher = this.bodenPunkt(ndcX, ndcY);
    const faktor = Math.exp(delta * 0.0016);
    this.abstandSoll = Math.min(
      this.grenzen.maxAbstand,
      Math.max(this.grenzen.minAbstand, this.abstandSoll * faktor)
    );
    this.koppleNeigung();
    if (vorher) {
      // Provisorisch anwenden, um den neuen Bodenpunkt zu bestimmen.
      const merkeAbstand = this.abstand;
      const merkeNeigung = this.neigung;
      this.abstand = this.abstandSoll;
      this.neigung = this.neigungSoll;
      this.setzePosition(this.ziel);
      const nachher = this.bodenPunkt(ndcX, ndcY);
      this.abstand = merkeAbstand;
      this.neigung = merkeNeigung;
      this.setzePosition(this.ziel);
      if (nachher) {
        this.zielSoll.x += vorher.x - nachher.x;
        this.zielSoll.z += vorher.z - nachher.z;
        this.klemmeZiel();
      }
    }
  }

  /** Orbit — ausschliesslich mit gedrueckter Wahltaste. */
  drehe(dx: number, dy: number): void {
    this.gierungSoll -= dx * 0.005;
    this.neigungSoll = Math.min(
      this.grenzen.maxNeigung,
      Math.max(this.grenzen.minNeigung, this.neigungSoll - dy * 0.004)
    );
    this.letzteNeigungManuell = this.uhr;
  }

  /** Gierung in 45-Grad-Rasten. */
  rasteGierung(richtung: 1 | -1): void {
    const raster = 45 * GRAD;
    const jetzt = Math.round(this.gierungSoll / raster);
    this.gierungSoll = (jetzt + richtung) * raster;
  }

  verarbeiteGeste(g: Geste): void {
    if (g.art === 'pinch') this.zoome(g.dy * 3.2, g.ndcX, g.ndcY);
    else if (g.art === 'rad') this.zoome(g.dy, g.ndcX, g.ndcY);
    else this.schwenke(g.dx, g.dy);
  }

  /** Rueckt das Ziel auf einen Weltpunkt und faehrt den Abstand passend nach. */
  fokussiere(punkt: THREE.Vector3, abstand?: number): void {
    this.zielSoll.set(punkt.x, 0, punkt.z);
    if (abstand !== undefined) {
      this.abstandSoll = Math.min(this.grenzen.maxAbstand, Math.max(this.grenzen.minAbstand, abstand));
      this.koppleNeigung();
    }
    this.klemmeZiel();
  }

  /** Ganze Halle im Blick. */
  uebersicht(): void {
    this.zielSoll.set(0, 0, 0);
    // Fester Wert statt Anteil an der Obergrenze: das Fundament soll das Bild
    // fuellen, nicht darin verschwinden.
    this.abstandSoll = 27;
    this.letzteNeigungManuell = -99;
    this.koppleNeigung();
  }

  /** Setzt den Zustand sofort und ohne Nachlauf — fuer reproduzierbare Bilder. */
  setzeSofort(ziel: THREE.Vector3, abstand: number, gierungGrad: number, neigungGrad: number): void {
    this.zielSoll.set(ziel.x, 0, ziel.z);
    this.ziel.copy(this.zielSoll);
    this.abstand = this.abstandSoll = abstand;
    this.gierung = this.gierungSoll = gierungGrad * GRAD;
    this.neigung = this.neigungSoll = neigungGrad * GRAD;
    this.setzePosition(this.ziel);
  }

  // -------------------------------------------------------------------------
  // Bildschleife
  // -------------------------------------------------------------------------

  /** Tastatur-Schwenk. `richtung` ist bereits normalisiert. */
  schwenkeStetig(x: number, z: number, dt: number, schnell: boolean): void {
    if (x === 0 && z === 0) return;
    const tempo = this.abstandSoll * (schnell ? 1.8 : 0.6) * dt;
    const cos = Math.cos(this.gierungSoll);
    const sin = Math.sin(this.gierungSoll);
    this.zielSoll.x += (x * cos - z * sin) * tempo;
    this.zielSoll.z += (x * sin + z * cos) * tempo;
    this.klemmeZiel();
  }

  aktualisiere(dt: number): void {
    this.uhr += dt;
    if (this.reduziert) {
      this.ziel.copy(this.zielSoll);
      this.abstand = this.abstandSoll;
      this.gierung = this.gierungSoll;
      this.neigung = this.neigungSoll;
    } else {
      // Kritisch gedaempfte Annaeherung, framerate-unabhaengig (auch bei 120 Hz).
      const t = 1 - Math.pow(0.0022, Math.min(dt, 0.1));
      this.wendeAn(t);
    }
    this.setzePosition(this.ziel);
  }

  private wendeAn(t: number): void {
    this.ziel.lerp(this.zielSoll, t);
    this.abstand += (this.abstandSoll - this.abstand) * t;
    this.gierung += (this.gierungSoll - this.gierung) * t;
    this.neigung += (this.neigungSoll - this.neigung) * t;
  }

  /**
   * Beim Herauszoomen flacht die Kamera ab, beim Hereinzoomen richtet sie sich
   * auf — aber nur, wenn die Nutzerin nicht gerade selbst geneigt hat.
   */
  private koppleNeigung(): void {
    if (this.uhr - this.letzteNeigungManuell < 3) return;
    const t = (this.abstandSoll - this.grenzen.minAbstand) / (this.grenzen.maxAbstand - this.grenzen.minAbstand);
    this.neigungSoll = (65 - 30 * Math.min(1, Math.max(0, t))) * GRAD;
  }

  private klemmeZiel(): void {
    const r = this.grenzen.reichweite;
    this.zielSoll.x = Math.min(r, Math.max(-r, this.zielSoll.x));
    this.zielSoll.z = Math.min(r, Math.max(-r, this.zielSoll.z));
    this.zielSoll.y = 0;
  }

  private setzePosition(ziel: THREE.Vector3): void {
    const waagerecht = Math.cos(this.neigung) * this.abstand;
    this.kamera.position.set(
      ziel.x + Math.sin(this.gierung) * waagerecht,
      ziel.y + Math.sin(this.neigung) * this.abstand,
      ziel.z + Math.cos(this.gierung) * waagerecht
    );
    this.kamera.lookAt(ziel);
  }

  /** Schnittpunkt des Sehstrahls durch (ndcX, ndcY) mit der Bodenebene y=0. */
  bodenPunkt(ndcX: number, ndcY: number): THREE.Vector3 | null {
    const strahl = new THREE.Raycaster();
    strahl.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.kamera);
    const ebene = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const treffer = new THREE.Vector3();
    return strahl.ray.intersectPlane(ebene, treffer) ? treffer : null;
  }

  zustand(): { ziel: [number, number]; abstand: number; gierung: number; neigung: number } {
    return {
      ziel: [Math.round(this.ziel.x * 1000) / 1000, Math.round(this.ziel.z * 1000) / 1000],
      abstand: Math.round(this.abstand * 1000) / 1000,
      gierung: Math.round((this.gierung / GRAD) * 100) / 100,
      neigung: Math.round((this.neigung / GRAD) * 100) / 100,
    };
  }
}
