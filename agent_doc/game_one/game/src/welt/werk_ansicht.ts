/**
 * Die Werkansicht: macht den Orchestrierungs-Graphen sichtbar.
 *
 * Sie liest ausschließlich aus der Simulation und schreibt nie zurück. Ihre
 * einzige Aufgabe ist, den Fluss LESBAR zu machen — man soll einen Fehler
 * SEHEN, nicht aus Zahlen erschließen müssen. Deshalb:
 *  - jedes Modul hat eine eigene Silhouette, nicht nur eine Farbe
 *  - Leitungen leuchten nur, wenn tatsächlich etwas durch sie fliesst
 *  - Pakete tragen ihre Güte als Farbe und ihre Kompromittierung als Form
 *  - ein wartendes Paket sitzt sichtbar VOR dem Modul, ein bearbeitetes darin
 */

import * as THREE from 'three/webgpu';
import type { Leitung, Modul, Werk } from '../sim/typen';
import type { PaketAnsicht } from '../sim/simulation';
import { ausgaengeVon, KATALOG } from '../sim/katalog';
import { geistMaterial, hervorhebung, kernAufsatz, leitungsForm, leitungsMaterial, modulForm, modulMaterial, paketMaterial } from './aussehen';
import type { Halle } from './halle';

const MAX_PAKETE = 512;

interface ModulKnoten {
  readonly modul: Modul;
  readonly gruppe: THREE.Group;
  readonly koerper: THREE.Mesh;
  huelle: THREE.Mesh | null;
}

interface LeitungsKnoten {
  readonly leitung: Leitung;
  readonly mesh: THREE.Mesh;
  readonly punkte: THREE.Vector3[];
  readonly laenge: number;
  aktivitaet: number;
}

export class WerkAnsicht {
  readonly wurzel = new THREE.Group();

  private readonly module = new Map<string, ModulKnoten>();
  private readonly leitungen = new Map<string, LeitungsKnoten>();
  private readonly leitungsAktiv: ReturnType<typeof leitungsMaterial>;

  private pakete: THREE.InstancedMesh;
  private readonly paketFarben: THREE.InstancedBufferAttribute;
  private vorigeLage = new Map<string, THREE.Vector3>();

  private geist: THREE.Mesh | null = null;
  private readonly hilfsgeometrie: THREE.BufferGeometry[] = [];

  constructor(private readonly halle: Halle) {
    this.wurzel.name = 'werk';
    this.leitungsAktiv = leitungsMaterial();

    const paketGeo = new THREE.OctahedronGeometry(0.13, 0);
    this.hilfsgeometrie.push(paketGeo);
    this.pakete = new THREE.InstancedMesh(paketGeo, paketMaterial(), MAX_PAKETE);
    this.pakete.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.pakete.frustumCulled = false;
    this.pakete.count = 0;
    const farben = new Float32Array(MAX_PAKETE * 3);
    this.paketFarben = new THREE.InstancedBufferAttribute(farben, 3);
    this.pakete.instanceColor = this.paketFarben;
    this.wurzel.add(this.pakete);
  }

  // -------------------------------------------------------------------------
  // Aufbau
  // -------------------------------------------------------------------------

  /** Baut die Ansicht neu auf. Wird nach jeder Bauaktion gerufen. */
  setzeWerk(werk: Werk): void {
    for (const [, k] of this.module) this.wurzel.remove(k.gruppe);
    this.module.clear();
    for (const [, l] of this.leitungen) {
      this.wurzel.remove(l.mesh);
      l.mesh.geometry.dispose();
    }
    this.leitungen.clear();

    for (const m of werk.module) this.fuegeModulHinzu(m);
    for (const l of werk.leitungen) this.fuegeLeitungHinzu(werk, l);
  }

  private fuegeModulHinzu(m: Modul): void {
    const gruppe = new THREE.Group();
    gruppe.name = `modul:${m.id}`;
    const p = this.halle.feldZuWelt(m.x, m.z);
    gruppe.position.copy(p);

    const koerper = new THREE.Mesh(modulForm(m.art, 1), modulMaterial(m.art));
    koerper.castShadow = true;
    koerper.receiveShadow = true;
    koerper.userData['modulId'] = m.id;
    gruppe.add(koerper);

    if (m.art === 'kern') {
      const aufsatz = new THREE.Mesh(kernAufsatz(m.param.groesse ?? 'reiher'), modulMaterial('kern'));
      aufsatz.castShadow = true;
      gruppe.add(aufsatz);
    }

    this.wurzel.add(gruppe);
    this.module.set(m.id, { modul: m, gruppe, koerper, huelle: null });
  }

  private fuegeLeitungHinzu(werk: Werk, l: Leitung): void {
    const von = werk.module.find((m) => m.id === l.von);
    const nach = werk.module.find((m) => m.id === l.nach);
    if (!von || !nach) return;
    const punkte = this.leitungsPfad(von, nach, l.vonPort);
    const geo = leitungsForm(punkte, 0.05);
    const mesh = new THREE.Mesh(geo, this.leitungsAktiv.material);
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    mesh.userData['leitungId'] = l.id;
    this.wurzel.add(mesh);
    let laenge = 0;
    for (let i = 1; i < punkte.length; i++) laenge += punkte[i]!.distanceTo(punkte[i - 1]!);
    this.leitungen.set(l.id, { leitung: l, mesh, punkte, laenge, aktivitaet: 0 });
  }

  /**
   * Orthogonaler Kabelweg mit abgerundeten Ecken. Bewusst kein A*: bei
   * Modulzahlen unter fuenfzig liest sich eine saubere Dreisegment-Führung
   * besser als ein optimal kurzer, aber zappeliger Weg.
   */
  private leitungsPfad(von: Modul, nach: Modul, vonPort: string): THREE.Vector3[] {
    const a = this.halle.feldZuWelt(von.x, von.z);
    const b = this.halle.feldZuWelt(nach.x, nach.z);
    const hoehe = 0.42;
    // Der Ausgangsport verschiebt den Austrittspunkt seitlich, damit mehrere
    // Ausgänge eines Moduls unterscheidbar bleiben.
    const ports = ausgaengeVon(von).map((p) => p.id);
    const idx = Math.max(0, ports.indexOf(vonPort));
    const versatz = ports.length > 1 ? (idx - (ports.length - 1) / 2) * 0.26 : 0;

    const start = new THREE.Vector3(a.x, hoehe, a.z + versatz);
    const ende = new THREE.Vector3(b.x, hoehe, b.z);
    const mitteX = (start.x + ende.x) / 2;

    if (Math.abs(start.z - ende.z) < 0.05) {
      return [start, new THREE.Vector3(mitteX, hoehe, start.z), ende];
    }
    return [
      start,
      new THREE.Vector3(mitteX - 0.35, hoehe, start.z),
      new THREE.Vector3(mitteX, hoehe, (start.z + ende.z) / 2),
      new THREE.Vector3(mitteX + 0.35, hoehe, ende.z),
      ende,
    ];
  }

  // -------------------------------------------------------------------------
  // Laufender Betrieb
  // -------------------------------------------------------------------------

  /**
   * Übernimmt einen Simulationszustand. `alpha` interpoliert zwischen dem
   * vorherigen und diesem Tick, damit die Bewegung bei jeder Bildrate flüssig
   * bleibt und trotzdem an die Simulationszeit gebunden ist.
   */
  zeigeSimulation(sicht: readonly PaketAnsicht[], alpha: number): void {
    const matrix = new THREE.Matrix4();
    const farbe = new THREE.Color();
    const lage = new THREE.Vector3();
    const neueLage = new Map<string, THREE.Vector3>();

    // Leitungsaktivität abklingen lassen; sie wird gleich neu angeregt.
    for (const [, l] of this.leitungen) l.aktivitaet *= 0.9;

    let n = 0;
    for (const p of sicht) {
      if (n >= MAX_PAKETE) break;
      const knoten = this.module.get(p.modulId);
      if (!knoten) continue;

      const basis = knoten.gruppe.position;
      // Wartende Pakete stauen sich sichtbar vor dem Modul, bearbeitete steigen
      // in ihm auf. Beides macht Warteschlangen ohne Zahlen erkennbar.
      const y = p.wartend ? 0.3 : 0.34 + p.anteil * 0.5;
      const x = p.wartend ? basis.x - 0.62 : basis.x;
      const z = basis.z + (p.wartend ? ((n % 3) - 1) * 0.16 : 0);
      lage.set(x, y, z);

      const vorher = this.vorigeLage.get(p.id);
      if (vorher && vorher.distanceToSquared(lage) > 0.001) {
        // Das Paket ist umgezogen: den Weg dorthin ausspielen statt springen.
        lage.lerpVectors(vorher, lage, alpha);
        this.regeAn(vorher, lage);
      }
      neueLage.set(p.id, lage.clone());

      matrix.makeTranslation(lage.x, lage.y, lage.z);
      const groesse = p.kompromittiert ? 1.35 : 1;
      matrix.scale(new THREE.Vector3(groesse, groesse, groesse));
      this.pakete.setMatrixAt(n, matrix);

      // Farbe trägt die Güte: rot → bernstein → gruen. Kompromittiert ist
      // immer rot und zusätzlich größer (Form UND Farbe, nie nur Farbe).
      if (p.kompromittiert) farbe.setHex(0xff4d4d);
      else farbe.setHSL(0.02 + p.guete * 0.32, 0.85, 0.5);
      this.paketFarben.setXYZ(n, farbe.r, farbe.g, farbe.b);
      n++;
    }

    this.pakete.count = n;
    this.pakete.instanceMatrix.needsUpdate = true;
    this.paketFarben.needsUpdate = true;
    this.vorigeLage = neueLage;

    // Der Leitungs-Uniform ist global; er zeigt an, ob überhaupt etwas läuft.
    let hoechste = 0;
    for (const [, l] of this.leitungen) hoechste = Math.max(hoechste, l.aktivitaet);
    this.leitungsAktiv.aktiv.value = hoechste;
  }

  private regeAn(von: THREE.Vector3, nach: THREE.Vector3): void {
    // Grobe Zuordnung: die Leitung, deren Endpunkte am besten passen.
    let beste: LeitungsKnoten | null = null;
    let bestAbstand = Infinity;
    for (const [, l] of this.leitungen) {
      const a = l.punkte[0]!;
      const b = l.punkte[l.punkte.length - 1]!;
      const d = a.distanceToSquared(von) + b.distanceToSquared(nach);
      if (d < bestAbstand) {
        bestAbstand = d;
        beste = l;
      }
    }
    if (beste && bestAbstand < 9) beste.aktivitaet = 1;
  }

  /** Setzt die Ansicht auf den Ruhezustand zurück. */
  ruhe(): void {
    this.pakete.count = 0;
    this.pakete.instanceMatrix.needsUpdate = true;
    this.vorigeLage.clear();
    this.leitungsAktiv.aktiv.value = 0;
    for (const [, l] of this.leitungen) l.aktivitaet = 0;
  }

  // -------------------------------------------------------------------------
  // Bau-Rückmeldung
  // -------------------------------------------------------------------------

  /** Zeigt die Vorschau des zu setzenden Moduls. `null` blendet sie aus. */
  zeigeGeist(art: Modul['art'] | null, x: number, z: number, gueltig: boolean): void {
    if (art === null) {
      if (this.geist) {
        this.wurzel.remove(this.geist);
        this.geist = null;
      }
      return;
    }
    if (!this.geist) {
      this.geist = new THREE.Mesh(modulForm(art, 1), geistMaterial(gueltig));
      this.geist.renderOrder = 10;
      this.wurzel.add(this.geist);
    } else {
      this.geist.geometry = modulForm(art, 1);
      this.geist.material = geistMaterial(gueltig);
    }
    this.geist.position.copy(this.halle.feldZuWelt(x, z));
  }

  /** Hebt Module hervor: Auswahl, Zeigerziel oder Fehlerstelle. */
  setzeHervorhebung(ids: readonly string[], art: 'auswahl' | 'zeiger' | 'fehler'): void {
    for (const [id, k] of this.module) {
      const soll = ids.includes(id);
      if (soll && !k.huelle) {
        const h = new THREE.Mesh(k.koerper.geometry, hervorhebung(art));
        h.scale.setScalar(1.14);
        h.renderOrder = 5;
        k.gruppe.add(h);
        k.huelle = h;
      } else if (!soll && k.huelle) {
        k.gruppe.remove(k.huelle);
        k.huelle = null;
      } else if (soll && k.huelle) {
        k.huelle.material = hervorhebung(art);
      }
    }
  }

  /** Weltposition eines Moduls — für Kamerafokus und Beschriftungen. */
  modulPosition(id: string): THREE.Vector3 | null {
    return this.module.get(id)?.gruppe.position.clone() ?? null;
  }

  modulIds(): string[] {
    return [...this.module.keys()].sort();
  }

  entsorge(): void {
    for (const [, l] of this.leitungen) l.mesh.geometry.dispose();
    this.leitungen.clear();
    this.module.clear();
    for (const g of this.hilfsgeometrie.splice(0)) g.dispose();
    this.pakete.dispose();
    this.wurzel.clear();
    void KATALOG;
  }
}
