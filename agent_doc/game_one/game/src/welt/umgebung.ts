/**
 * Prozedurale Umgebungsbeleuchtung (Image-Based Lighting).
 *
 * Ohne Environment-Map sehen metallische Materialien falsch aus: ein Metall
 * bezieht seine Farbe fast vollständig aus der Umgebung, und wenn es keine
 * gibt, bleibt nur der Glanzpunkt der Lichtquellen übrig. Genau daran ist die
 * erste Fassung der Halle gescheitert — lackierter Stahl wurde knallrot, weil
 * ihn nur eine warme Arbeitsleuchte traf.
 *
 * Statt eine HDRI-Datei zu laden (externe Assets sind im Projekt ausgeschlossen)
 * wird hier eine kleine Szene gebaut, die die Halle grob nachbildet — dunkle
 * Wände, ein heller Streifen für die Sprossenfenster, ein kühler Himmel —
 * und daraus per `PMREMGenerator` eine vorgefilterte Umgebungstextur erzeugt.
 * Das ist derselbe Ansatz wie three.js' RoomEnvironment, nur auf die
 * Farbstimmung dieses Spiels abgestimmt.
 */

import * as THREE from 'three/webgpu';

function flaeche(
  breite: number,
  hoehe: number,
  farbe: number,
  intensitaet: number,
  x: number,
  y: number,
  z: number,
  drehungY = 0,
  drehungX = 0
): THREE.Mesh {
  const material = new THREE.MeshBasicMaterial({ color: new THREE.Color(farbe).multiplyScalar(intensitaet) });
  material.side = THREE.DoubleSide;
  const netz = new THREE.Mesh(new THREE.PlaneGeometry(breite, hoehe), material);
  netz.position.set(x, y, z);
  netz.rotation.set(drehungX, drehungY, 0);
  return netz;
}

/**
 * Baut die Modellszene. Sie wird nie direkt gerendert, sondern nur einmal in
 * eine Cube-Map gebacken.
 */
function baueModellszene(): THREE.Scene {
  const s = new THREE.Scene();

  // Boden: dunkler, leicht warmer Beton.
  s.add(flaeche(60, 60, 0x1a1d22, 1.0, 0, -8, 0, 0, -Math.PI / 2));
  // Decke: sehr dunkel, damit von oben kein Grau einfällt.
  s.add(flaeche(60, 60, 0x0a0d12, 1.0, 0, 14, 0, 0, Math.PI / 2));

  // Vier Wände in kühlem Ziegelton.
  s.add(flaeche(60, 24, 0x232830, 1.0, 0, 3, -22, 0));
  s.add(flaeche(60, 24, 0x232830, 1.0, 0, 3, 22, Math.PI));
  s.add(flaeche(44, 24, 0x1e232a, 1.0, -26, 3, 0, Math.PI / 2));
  s.add(flaeche(44, 24, 0x1e232a, 1.0, 26, 3, 0, -Math.PI / 2));

  // Sprossenfenster: die eigentliche Lichtquelle der Umgebung. Kühles
  // Tageslicht in schmalen, hohen Streifen — das gibt Metallen längliche
  // Reflexe und damit sofort einen glaubhaften Industriecharakter.
  for (let i = 0; i < 5; i++) {
    const x = -22 + i * 11;
    s.add(flaeche(3.4, 9, 0xbcd4f5, 5.5, x, 6.5, -21.6, 0));
    s.add(flaeche(3.4, 9, 0x9fb8dc, 3.2, x, 6.5, 21.6, Math.PI));
  }

  // Warme Arbeitsleuchten unter der Decke — sie liefern den Gegenpol.
  for (const x of [-9, 9]) {
    s.add(flaeche(5, 5, 0xffd9a0, 2.2, x, 13.4, 0, 0, Math.PI / 2));
  }

  // Ein schwacher Himmelsanteil oben, damit nach oben zeigende Flächen nicht
  // vollständig absaufen.
  s.add(flaeche(60, 60, 0x2f4763, 0.55, 0, 13.6, 0, 0, Math.PI / 2));

  return s;
}

export interface Umgebung {
  readonly textur: THREE.Texture;
  entsorge(): void;
}

/**
 * Erzeugt die Umgebungstextur. Muss NACH `renderer.init()` aufgerufen werden,
 * weil der PMREM-Generator die GPU braucht.
 */
export function erzeugeUmgebung(renderer: THREE.WebGPURenderer): Umgebung {
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader?.();
  const szene = baueModellszene();
  const ziel = pmrem.fromScene(szene, 0.04, 0.1, 120);

  // Modellszene sofort wieder freigeben — sie wird nie erneut gebraucht.
  szene.traverse((o) => {
    const m = o as THREE.Mesh;
    m.geometry?.dispose();
    const mat = m.material as THREE.Material | undefined;
    mat?.dispose();
  });
  szene.clear();

  return {
    textur: ziel.texture,
    entsorge(): void {
      ziel.dispose();
      pmrem.dispose();
    },
  };
}
