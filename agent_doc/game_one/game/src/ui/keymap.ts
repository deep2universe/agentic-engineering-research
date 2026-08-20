/**
 * Die Tastaturbelegung — eine einzige Tabelle, aus der sich Bindung,
 * Hilfe-Overlay und Kontextleiste speisen.
 *
 * Trennung nach Zweck: Bewegung und Werkzeuge hängen an `event.code`
 * (layoutunabhängig, W bleibt W), Systembefehle an `event.key` (folgt der
 * Beschriftung). Auf QWERTZ liegt `code 'KeyZ'` dort, wo QWERTY "Y" hat — ein
 * code-basiertes Rückgängig wäre falsch beschriftet.
 *
 * Reserviert und niemals belegt: Cmd+W/T/Q/N/R/L/M/D/Tab/Space, Cmd +/−/0,
 * Ctrl+Cmd+F, Cmd+Opt+I sowie Tab und Shift+Tab (die gehören dem DOM-Fokus).
 */

export type Befehl =
  | 'modus_auswahl'
  | 'modus_leitung'
  | 'modus_abriss'
  | 'setzen'
  | 'abbrechen'
  | 'loeschen'
  | 'verbinden'
  | 'kamera_vor'
  | 'kamera_zurueck'
  | 'kamera_links'
  | 'kamera_rechts'
  | 'gierung_links'
  | 'gierung_rechts'
  | 'zoom_ein'
  | 'zoom_aus'
  | 'fokus'
  | 'uebersicht'
  | 'sim_start'
  | 'sim_einzeltick'
  | 'sim_schneller'
  | 'sim_langsamer'
  | 'ansicht_gitter'
  | 'rueckgaengig'
  | 'wiederholen'
  | 'handbuch'
  | 'hilfe'
  | 'briefing'
  | 'ton'
  | 'schmiede';

export interface Bindung {
  readonly befehl: Befehl;
  /** `event.code`, layoutunabhängig. */
  readonly code?: string;
  /** `event.key`, folgt der Tastenbeschriftung. */
  readonly taste?: string;
  readonly umschalt?: boolean;
  /** Cmd auf macOS, Strg sonst. */
  readonly befehlstaste?: boolean;
  /** Anzeigetext im Hilfe-Overlay. */
  readonly anzeige: string;
  readonly bereich: 'Modi' | 'Bauen' | 'Kamera' | 'Simulation' | 'Ansicht' | 'Allgemein';
  readonly text: string;
}

export const KEYMAP: readonly Bindung[] = [
  /*
   * Die Ziffern gehören den MODULEN, nicht den Modi.
   *
   * Vorher standen hier die vier Modi auf 1 bis 4 — während die Palette
   * daneben jedem Modul eine Ziffer als Tastenkuerzel anzeigte. Jede einzelne
   * davon war anderweitig belegt: die Palette hat eine Bedienung versprochen,
   * die es nicht gab. Die Modulkuerzel stehen im Katalog und sind über die
   * ganze Kampagne stabil; sie werden in `spiel.ts` aufgelöst und tauchen
   * deshalb hier nicht einzeln auf.
   *
   * Zwei Modi bleiben: Leitung und Abriss. Bauen ergibt sich daraus, dass man
   * ein Modul wählt, und Auswahl ist der Zustand, in den Escape zurückführt.
   */
  { befehl: 'modus_leitung', code: 'KeyL', anzeige: 'L', bereich: 'Modi', text: 'Leitung legen' },
  { befehl: 'modus_abriss', code: 'KeyR', anzeige: 'R', bereich: 'Modi', text: 'Abriss (Rückbau)' },
  { befehl: 'modus_auswahl', code: 'KeyC', anzeige: 'C', bereich: 'Modi', text: 'Auswahl (Module ansehen)' },

  { befehl: 'setzen', code: 'Enter', anzeige: '⏎', bereich: 'Bauen', text: 'Setzen' },
  { befehl: 'verbinden', code: 'KeyV', anzeige: 'V', bereich: 'Bauen', text: 'Markierte Module verbinden' },
  { befehl: 'loeschen', code: 'Backspace', anzeige: '⌫', bereich: 'Bauen', text: 'Auswahl löschen' },
  { befehl: 'loeschen', code: 'Delete', anzeige: 'Entf', bereich: 'Bauen', text: 'Auswahl löschen' },

  { befehl: 'kamera_vor', code: 'KeyW', anzeige: 'W', bereich: 'Kamera', text: 'Schwenk vorwärts' },
  { befehl: 'kamera_links', code: 'KeyA', anzeige: 'A', bereich: 'Kamera', text: 'Schwenk links' },
  { befehl: 'kamera_zurueck', code: 'KeyS', anzeige: 'S', bereich: 'Kamera', text: 'Schwenk zurück' },
  { befehl: 'kamera_rechts', code: 'KeyD', anzeige: 'D', bereich: 'Kamera', text: 'Schwenk rechts' },
  { befehl: 'kamera_vor', code: 'ArrowUp', anzeige: '↑', bereich: 'Kamera', text: 'Schwenk vorwärts' },
  { befehl: 'kamera_zurueck', code: 'ArrowDown', anzeige: '↓', bereich: 'Kamera', text: 'Schwenk zurück' },
  { befehl: 'kamera_links', code: 'ArrowLeft', anzeige: '←', bereich: 'Kamera', text: 'Schwenk links' },
  { befehl: 'kamera_rechts', code: 'ArrowRight', anzeige: '→', bereich: 'Kamera', text: 'Schwenk rechts' },
  { befehl: 'gierung_links', code: 'Comma', anzeige: ',', bereich: 'Kamera', text: 'Drehen in 45-Grad-Rasten' },
  { befehl: 'gierung_rechts', code: 'Period', anzeige: '.', bereich: 'Kamera', text: 'Drehen in 45-Grad-Rasten' },
  { befehl: 'fokus', code: 'KeyF', anzeige: 'F', bereich: 'Kamera', text: 'Auf Auswahl fokussieren' },
  { befehl: 'uebersicht', code: 'KeyO', anzeige: 'O', bereich: 'Kamera', text: 'Ganze Halle' },
  // Ohne Befehlstaste: Cmd +/− gehören dem Browser und bleiben unangetastet.
  { befehl: 'zoom_ein', code: 'Equal', anzeige: '+', bereich: 'Kamera', text: 'Näher heran' },
  { befehl: 'zoom_aus', code: 'Minus', anzeige: '−', bereich: 'Kamera', text: 'Weiter weg' },

  { befehl: 'sim_start', code: 'Space', anzeige: 'Leer', bereich: 'Simulation', text: 'Start und Pause' },
  { befehl: 'sim_einzeltick', code: 'KeyN', anzeige: 'N', bereich: 'Simulation', text: 'Einzelner Tick' },
  { befehl: 'sim_langsamer', code: 'Comma', umschalt: true, anzeige: '⇧,', bereich: 'Simulation', text: 'Langsamer' },
  { befehl: 'sim_schneller', code: 'Period', umschalt: true, anzeige: '⇧.', bereich: 'Simulation', text: 'Schneller' },

  { befehl: 'ansicht_gitter', code: 'KeyG', anzeige: 'G', bereich: 'Ansicht', text: 'Gitter' },

  /*
   * Hier standen einmal drei weitere Bindungen: ⇧F "Zum ersten Regelverstoß",
   * P "Spur-Overlay" und I "Inspektor". Alle drei waren gebunden, standen im
   * Hilfe-Overlay — und hatten keine Zeile Code hinter sich. Wer sie drückte,
   * bekam nichts, und schloss daraus, die Tastatur des Spiels sei kaputt.
   *
   * Sie sind entfernt, nicht auskommentiert: Eine Taste in der Hilfe ist ein
   * Versprechen. Wer eine dieser Funktionen bauen will, baut zuerst die
   * Funktion und trägt die Bindung danach ein. `fuehreBefehlAus` erzwingt das
   * inzwischen über eine Vollständigkeitsprüfung.
   */

  { befehl: 'rueckgaengig', taste: 'z', befehlstaste: true, anzeige: '⌘Z', bereich: 'Allgemein', text: 'Rückgängig' },
  { befehl: 'wiederholen', taste: 'z', befehlstaste: true, umschalt: true, anzeige: '⇧⌘Z', bereich: 'Allgemein', text: 'Wiederholen' },
  { befehl: 'handbuch', taste: '?', anzeige: '?', bereich: 'Allgemein', text: 'Betriebshandbuch' },
  { befehl: 'hilfe', taste: '/', anzeige: '/', bereich: 'Allgemein', text: 'Tastenübersicht' },
  { befehl: 'briefing', code: 'KeyB', anzeige: 'B', bereich: 'Allgemein', text: 'Auftrag noch einmal lesen' },
  { befehl: 'ton', code: 'KeyM', anzeige: 'M', bereich: 'Allgemein', text: 'Ton an und aus' },
  { befehl: 'schmiede', code: 'KeyX', anzeige: 'X', bereich: 'Bauen', text: 'Schmiede öffnen (braucht eine SCHMIEDE im Werk)' },
  { befehl: 'abbrechen', code: 'Escape', anzeige: '⎋', bereich: 'Allgemein', text: 'Abbrechen' },
];

/** Findet den Befehl zu einem Tastendruck. */
export function befehlFuer(e: KeyboardEvent): Befehl | null {
  const befehlstaste = e.metaKey || e.ctrlKey;
  for (const b of KEYMAP) {
    if (b.befehlstaste === true && !befehlstaste) continue;
    if (b.befehlstaste !== true && befehlstaste) continue;
    if ((b.umschalt === true) !== e.shiftKey) continue;
    if (b.code !== undefined && b.code === e.code) return b.befehl;
    if (b.taste !== undefined && b.taste.toLowerCase() === e.key.toLowerCase()) return b.befehl;
  }
  return null;
}

/** Gruppierte Übersicht für das Hilfe-Overlay. */
export function keymapNachBereich(): Map<Bindung['bereich'], Bindung[]> {
  const m = new Map<Bindung['bereich'], Bindung[]>();
  for (const b of KEYMAP) {
    const liste = m.get(b.bereich);
    if (liste) liste.push(b);
    else m.set(b.bereich, [b]);
  }
  return m;
}
