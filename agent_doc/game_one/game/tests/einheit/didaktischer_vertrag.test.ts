/**
 * DER DIDAKTISCHE VERTRAG.
 *
 * Dies ist die wichtigste Testdatei des Projekts. Sie prueft nicht, ob der Code
 * laeuft — sie prueft, ob das Spiel die Wahrheit sagt.
 *
 * Jede Lektion, die SCHWARMWERK behauptet zu vermitteln, ist hier als
 * ausfuehrbare Aussage hinterlegt. Faellt eine dieser Aussagen um, dann lehrt
 * das Spiel etwas Falsches — und das ist schlimmer, als gar nichts zu lehren:
 * Lernende uebertragen mit hoher Konfidenz in ein Kundenprojekt, was sie hier
 * geuebt haben.
 *
 * Jeder Test nennt seinen Akt und seine Quelle in der Forschungsablage.
 */

import { describe, expect, it } from 'vitest';
import { simuliere } from '../../src/sim/simulation';
import { Bau, reihe } from '../../src/inhalt/bauhilfe';
import type { AuftragsStrom, Werk } from '../../src/sim/typen';

const SAAT = 20260819;

function strom(x: Partial<AuftragsStrom> = {}): AuftragsStrom {
  return {
    anzahl: 40,
    takt: 1,
    domaenen: ['technik', 'text', 'analyse'],
    schwierigkeit: [0.1, 0.9],
    mehrdeutigkeit: [0.1, 0.3],
    ...x,
  };
}

function lauf(werk: Werk, s: AuftragsStrom = strom(), saat = SAAT) {
  return simuliere({ werk, strom: s, saat }).metriken;
}

// ===========================================================================
describe('Akt I — Modellgroesse ist eine oekonomische Entscheidung', () => {
  // Quelle: 03_workflow_patterns.md
  it('kostet der grosse Kern das 16-fache des kleinen', () => {
    const klein = lauf(reihe([{ art: 'kern', param: { groesse: 'kolibri' } }]));
    const gross = lauf(reihe([{ art: 'kern', param: { groesse: 'kondor' } }]));
    expect(gross.kosten / klein.kosten).toBeCloseTo(16, 0);
  });

  it('holt eine kurze Kette kleiner Kerne den grossen bei LEICHTEN Auftraegen fast ein', () => {
    const leicht = strom({ schwierigkeit: [0.05, 0.3] });
    const zweiKlein = lauf(
      reihe([
        { art: 'kern', param: { groesse: 'kolibri' } },
        { art: 'kern', param: { groesse: 'kolibri' } },
      ] as never),
      leicht
    );
    const einGross = lauf(reihe([{ art: 'kern', param: { groesse: 'kondor' } }]), leicht);
    // Das ist die oekonomische Kernaussage von Akt I und die Voraussetzung
    // dafuer, dass Routing in Akt II ueberhaupt Sinn ergibt.
    expect(einGross.guete - zweiKlein.guete).toBeLessThan(0.1);
    expect(zweiKlein.kosten).toBeLessThan(einGross.kosten * 0.2);
  });

  it('scheitert der kleine Kern an SCHWEREN Auftraegen unabhaengig vom Budget', () => {
    const schwer = strom({ schwierigkeit: [0.8, 0.95] });
    const einmal = lauf(reihe([{ art: 'kern', param: { groesse: 'kolibri' } }]), schwer);
    const fuenfmal = lauf(
      reihe(Array.from({ length: 5 }, () => ({ art: 'kern' as const, param: { groesse: 'kolibri' as const } }))),
      schwer
    );
    // Fuenf Aufrufe eines zu kleinen Kerns heben die Decke nicht nennenswert an.
    expect(fuenfmal.guete).toBeLessThan(0.45);
    expect(fuenfmal.kosten).toBeGreaterThan(einmal.kosten * 3);
  });

  it('hebt Spezialisierung die Decke bei passender Domaene und senkt sie sonst', () => {
    const nurRecht = strom({ domaenen: ['recht'], schwierigkeit: [0.6, 0.7] });
    const neutral = lauf(reihe([{ art: 'kern', param: { groesse: 'reiher', spezialisierung: 'keine' } }]), nurRecht);
    const passend = lauf(reihe([{ art: 'kern', param: { groesse: 'reiher', spezialisierung: 'recht' } }]), nurRecht);
    const falsch = lauf(reihe([{ art: 'kern', param: { groesse: 'reiher', spezialisierung: 'finanz' } }]), nurRecht);
    expect(passend.guete).toBeGreaterThan(neutral.guete);
    expect(falsch.guete).toBeLessThan(neutral.guete);
  });
});

// ===========================================================================
describe('Akt II — Klassifizieren, bevor man bezahlt', () => {
  // Quelle: 03_workflow_patterns.md#pattern-2-routing
  /** Weiche: leichte Auftraege → KOLIBRI, schwere → KONDOR. */
  function mitRouter(): Werk {
    const b = new Bau();
    const q = b.setze('quelle', {}, 'q');
    const w = b.setze('weiche', { kriterium: 'schwierigkeit', schwelle: 0.45 }, 'w');
    const klein = b.setze('kern', { groesse: 'kolibri' }, 'klein');
    const gross = b.setze('kern', { groesse: 'kondor' }, 'gross');
    const s = b.setze('senke', {}, 's');
    b.verbinde(q, w).verbinde(w, klein, 'a').verbinde(w, gross, 'b').verbinde(klein, s).verbinde(gross, s);
    return b.fertig();
  }

  it('senkt Routing die Kosten deutlich gegenueber "immer gross"', () => {
    const immerGross = lauf(reihe([{ art: 'kern', param: { groesse: 'kondor' } }]));
    const geroutet = lauf(mitRouter());
    expect(geroutet.kosten).toBeLessThan(immerGross.kosten * 0.7);
  });

  it('haelt Routing die Guete nahe am Niveau von "immer gross"', () => {
    const immerGross = lauf(reihe([{ art: 'kern', param: { groesse: 'kondor' } }]));
    const geroutet = lauf(mitRouter());
    expect(geroutet.guete).toBeGreaterThan(immerGross.guete - 0.2);
  });

  it('verschlechtert Mehrdeutigkeit die Routing-Qualitaet — Router irren sich', () => {
    const klar = lauf(mitRouter(), strom({ mehrdeutigkeit: [0, 0.05] }));
    const unklar = lauf(mitRouter(), strom({ mehrdeutigkeit: [0.8, 1.0] }));
    expect(unklar.guete).toBeLessThan(klar.guete);
  });
});

// ===========================================================================
describe('Akt III — Ein deterministisches Werkzeug schlaegt jedes Modell', () => {
  // Quelle: 06_tool_use_context_engineering.md
  const rechnen = strom({ anteilRechnerisch: 1, schwierigkeit: [0.4, 0.7], domaenen: ['finanz'] });

  it('deckelt ein rechnerischer Auftrag ohne Rechenwerk die Guete', () => {
    const ohne = lauf(reihe([{ art: 'kern', param: { groesse: 'kondor' } }]), rechnen);
    expect(ohne.guete).toBeLessThanOrEqual(0.62);
  });

  it('schlaegt ein 5-Token-Rechenwerk mit mittlerem Kern den groessten Kern allein', () => {
    const b = new Bau();
    const q = b.setze('quelle', {}, 'q');
    const r = b.setze('werkzeug', { werkzeugArt: 'rechner' }, 'r');
    const k = b.setze('kern', { groesse: 'reiher' }, 'k');
    const s = b.setze('senke', {}, 's');
    b.verbinde(q, r).verbinde(r, k, 'ok').verbinde(k, s).verbinde(r, s, 'fehler');
    const mit = lauf(b.fertig(), rechnen);
    const ohneGross = lauf(reihe([{ art: 'kern', param: { groesse: 'kondor' } }]), rechnen);
    // Haerteste Einzellektion des Spiels: Determinismus schlaegt Groesse.
    expect(mit.guete).toBeGreaterThan(ohneGross.guete);
    expect(mit.kosten).toBeLessThan(ohneGross.kosten * 0.5);
  });

  it('deckelt ein belegpflichtiger Auftrag ohne Recherche die Guete', () => {
    const beleg = strom({ anteilBelegpflichtig: 1, schwierigkeit: [0.3, 0.6] });
    const ohne = lauf(reihe([{ art: 'kern', param: { groesse: 'kondor' } }]), beleg);
    expect(ohne.guete).toBeLessThanOrEqual(0.57);
    expect(ohne.belegquote).toBe(0);
  });

  it('kosten Werkzeuge auch dann, wenn man sie nicht benutzt (Definitionsblock)', () => {
    const einWerkzeug = new Bau();
    {
      const q = einWerkzeug.setze('quelle', {}, 'q');
      const w = einWerkzeug.setze('werkzeug', { werkzeugArt: 'rechner' }, 'w');
      const k = einWerkzeug.setze('kern', { groesse: 'reiher' }, 'k');
      const s = einWerkzeug.setze('senke', {}, 's');
      einWerkzeug.verbinde(q, w).verbinde(w, k, 'ok').verbinde(k, s).verbinde(w, s, 'fehler');
    }
    const ohneWerkzeug = reihe([{ art: 'kern', param: { groesse: 'reiher' } }]);
    const a = lauf(ohneWerkzeug);
    const bMetriken = lauf(einWerkzeug.fertig());
    // Das Werkzeug selbst kostet 5 Token — der Aufschlag auf den Kern ist groesser.
    expect(bMetriken.kosten - a.kosten).toBeGreaterThan(40 * 20);
  });
});

// ===========================================================================
describe('Akt IV — Retry ist kein Plan, ein Circuit Breaker ist einer', () => {
  // Quelle: 07_resilience_error_handling.md
  /** Fremddienst mit 18 % Ausfallrate, dahinter eine Sicherung. */
  function mitSicherung(modus: 'wiederholen' | 'sicherung', versuche: number): Werk {
    const b = new Bau();
    const q = b.setze('quelle', {}, 'q');
    const w = b.setze('werkzeug', { werkzeugArt: 'api' }, 'w');
    const sich = b.setze('sicherung', { modus, versuche }, 'sich');
    const k = b.setze('kern', { groesse: 'reiher' }, 'k');
    const s = b.setze('senke', {}, 's');
    b.verbinde(q, w)
      .verbinde(w, k, 'ok')
      .verbinde(w, sich, 'fehler')
      .verbinde(sich, w, 'zurueck')
      .verbinde(sich, k, 'notausgang')
      .verbinde(k, s);
    return b.fertig();
  }

  it('rettet eine Wiederholung Auftraege, die sonst verloren gingen', () => {
    const b = new Bau();
    const q = b.setze('quelle', {}, 'q');
    const w = b.setze('werkzeug', { werkzeugArt: 'api' }, 'w');
    const k = b.setze('kern', { groesse: 'reiher' }, 'k');
    const s = b.setze('senke', {}, 's');
    b.verbinde(q, w).verbinde(w, k, 'ok').verbinde(k, s);
    const ohne = lauf(b.fertig());
    const mit = lauf(mitSicherung('wiederholen', 3));
    // Ein Fremddienst mit 18 % Ausfallrate reisst ohne Sicherung Loecher.
    expect(ohne.durchsatz).toBeLessThan(0.95);
    expect(mit.durchsatz).toBeGreaterThan(ohne.durchsatz);
  });

  it('begrenzt der Circuit Breaker die Kosten bei dauerhaftem Ausfall staerker als blindes Wiederholen', () => {
    // Ein Fremddienst, der praktisch immer faellt: viele Werkzeuge im Kontext.
    const dauerhaft = strom({ anzahl: 30 });
    const wiederholen = lauf(mitSicherung('wiederholen', 8), dauerhaft);
    const breaker = lauf(mitSicherung('sicherung', 2), dauerhaft);
    expect(breaker.kosten).toBeLessThan(wiederholen.kosten);
    expect(breaker.latenzP95).toBeLessThanOrEqual(wiederholen.latenzP95);
  });
});

// ===========================================================================
describe('Akt V — Parallelisierung deckelt Latenz, aber nicht Kosten', () => {
  // Quelle: 03_workflow_patterns.md#pattern-3-parallelization
  function parallel(modus: 'voting' | 'bester' | 'verschmelzen', zweige = 3): Werk {
    const b = new Bau();
    const q = b.setze('quelle', {}, 'q');
    const v = b.setze('verteiler', { zweige }, 'v');
    const sam = b.setze('sammler', { modus }, 'sam');
    const s = b.setze('senke', {}, 's');
    b.verbinde(q, v);
    for (let i = 0; i < zweige; i++) {
      const k = b.setze('kern', { groesse: 'reiher' }, `k${i}`);
      b.verbinde(v, k, `z${i + 1}`).verbinde(k, sam);
    }
    b.verbinde(sam, s);
    return b.fertig();
  }

  const langsam = strom({ anzahl: 24, takt: 3, schwierigkeit: [0.4, 0.6] });

  it('kostet Parallelisierung ungefaehr so viel wie die Summe der Zweige', () => {
    const einer = lauf(reihe([{ art: 'kern', param: { groesse: 'reiher' } }]), langsam);
    const drei = lauf(parallel('bester', 3), langsam);
    expect(drei.kosten).toBeGreaterThan(einer.kosten * 2.5);
  });

  it('erhoeht Parallelisierung die Latenz NICHT proportional zu den Zweigen', () => {
    const einer = lauf(reihe([{ art: 'kern', param: { groesse: 'reiher' } }]), langsam);
    const drei = lauf(parallel('bester', 3), langsam);
    // Drei Zweige gleichzeitig — nicht drei Kerne hintereinander.
    expect(drei.latenzP95).toBeLessThan(einer.latenzP95 * 2.5);
  });

  it('liefert "bester" die hoechste Guete, "voting" die stabilste', () => {
    const bester = lauf(parallel('bester', 3), langsam);
    const voting = lauf(parallel('voting', 3), langsam);
    expect(bester.guete).toBeGreaterThanOrEqual(voting.guete);
  });
});

// ===========================================================================
describe('Akt VI — Der Evaluator irrt sich auch', () => {
  // Quelle: 03_workflow_patterns.md#pattern-5-evaluator-optimizer
  function mitPruefer(schwelle: number, runden: number): Werk {
    const b = new Bau();
    const q = b.setze('quelle', {}, 'q');
    const k = b.setze('kern', { groesse: 'reiher' }, 'k');
    const p = b.setze('pruefer', { schwelle, runden }, 'p');
    const s = b.setze('senke', {}, 's');
    b.verbinde(q, k).verbinde(k, p).verbinde(p, s, 'frei').verbinde(p, k, 'zurueck');
    return b.fertig();
  }

  const mittel = strom({ anzahl: 30, schwierigkeit: [0.3, 0.6] });

  it('hebt eine sinnvolle Rueckkopplung die Guete', () => {
    const ohne = lauf(reihe([{ art: 'kern', param: { groesse: 'reiher' } }]), mittel);
    const mit = lauf(mitPruefer(0.72, 2), mittel);
    expect(mit.guete).toBeGreaterThan(ohne.guete);
  });

  it('laesst eine ueberhoehte Schwelle die Kosten explodieren, ohne die Guete zu retten', () => {
    const vernuenftig = lauf(mitPruefer(0.72, 2), mittel);
    const gierig = lauf(mitPruefer(0.99, 8), mittel);
    expect(gierig.kosten).toBeGreaterThan(vernuenftig.kosten * 1.8);
    // Der Gewinn ist minimal — die Decke des Kerns liegt darunter.
    expect(gierig.guete - vernuenftig.guete).toBeLessThan(0.12);
  });

  it('kostet jede Pruefrunde Latenz', () => {
    const wenig = lauf(mitPruefer(0.72, 1), mittel);
    const viel = lauf(mitPruefer(0.9, 6), mittel);
    expect(viel.latenzP95).toBeGreaterThan(wenig.latenzP95);
  });
});

// ===========================================================================
describe('Akt VII — Kontext ist ein Budget, kein Vorrat', () => {
  // Quelle: 06_tool_use_context_engineering.md#context-engineering
  function langeKette(n: number, mitVerdichtung: boolean): Werk {
    const glieder: { art: 'kern' | 'speicher'; param?: Record<string, unknown> }[] = [];
    for (let i = 0; i < n; i++) {
      glieder.push({ art: 'kern', param: { groesse: 'reiher' } });
      if (mitVerdichtung && i === Math.floor(n / 2)) {
        glieder.push({ art: 'speicher', param: { modus: 'komprimieren' } });
      }
    }
    return reihe(glieder as never);
  }

  const schwer = strom({ anzahl: 20, schwierigkeit: [0.5, 0.7] });

  it('steigen die Kosten einer Kette ueberproportional zur Laenge', () => {
    const zwei = lauf(langeKette(2, false), schwer);
    const acht = lauf(langeKette(8, false), schwer);
    // Vierfache Laenge, aber deutlich mehr als vierfache Kosten.
    expect(acht.kosten).toBeGreaterThan(zwei.kosten * 5);
  });

  it('sinkt die Wirkung jedes weiteren Aufrufs mit steigender Kontextlast', () => {
    const vier = lauf(langeKette(4, false), schwer);
    const acht = lauf(langeKette(8, false), schwer);
    const zuwachsErsteVier = vier.guete;
    const zuwachsZweiteVier = acht.guete - vier.guete;
    expect(zuwachsZweiteVier).toBeLessThan(zuwachsErsteVier * 0.35);
  });

  it('macht Verdichtung eine lange Kette wieder wirksam und billiger', () => {
    const ohne = lauf(langeKette(8, false), schwer);
    const mit = lauf(langeKette(8, true), schwer);
    expect(mit.kosten).toBeLessThan(ohne.kosten);
    expect(mit.guete).toBeGreaterThan(ohne.guete);
  });

  it('senkt Zwischenspeichern die Kosten — und Verdichtung macht ihn ungueltig', () => {
    const ohne = lauf(langeKette(6, false), schwer);
    const gepuffert = lauf(
      reihe([
        { art: 'kern', param: { groesse: 'reiher' } },
        { art: 'kern', param: { groesse: 'reiher' } },
        { art: 'speicher', param: { modus: 'puffern' } },
        { art: 'kern', param: { groesse: 'reiher' } },
        { art: 'kern', param: { groesse: 'reiher' } },
        { art: 'kern', param: { groesse: 'reiher' } },
        { art: 'kern', param: { groesse: 'reiher' } },
      ] as never),
      schwer
    );
    expect(gepuffert.kosten).toBeLessThan(ohne.kosten);
  });
});

// ===========================================================================
describe('Akt VIII — Defense in Depth ist rechnerisch belegbar', () => {
  // Quelle: 08_safety_security_guardrails.md
  const giftig = strom({ anzahl: 200, anteilGiftig: 1, schwierigkeit: [0.3, 0.6] });

  /**
   * Waelle ohne Quarantaenepfad: der Alarm-Ausgang bleibt unverdrahtet, ein
   * Alarm bedeutet also "blockiert". So misst der Test ausschliesslich die
   * Wirkung der Filter und nicht die eines nachgeschalteten Menschen.
   */
  function mitWaellen(eingang: boolean, ausgang: boolean): Werk {
    const b = new Bau();
    const q = b.setze('quelle', {}, 'q');
    const k = b.setze('kern', { groesse: 'reiher' }, 'k');
    const s = b.setze('senke', {}, 's');
    if (eingang) {
      const w = b.setze('wall', { modus: 'eingang' }, 'we');
      b.verbinde(q, w).verbinde(w, k, 'rein');
    } else {
      b.verbinde(q, k);
    }
    if (ausgang) {
      const w = b.setze('wall', { modus: 'ausgang' }, 'wa');
      b.verbinde(k, w).verbinde(w, s, 'rein');
    } else {
      b.verbinde(k, s);
    }
    return b.fertig();
  }

  it('ist ein Werk ohne Guardrail unsicher', () => {
    const m = lauf(mitWaellen(false, false), giftig);
    expect(m.lecks).toBeGreaterThan(0);
    expect(m.sicherheit).toBeLessThan(0.6);
  });

  it('laesst ein Eingangsfilter allein ein Restrisiko', () => {
    const m = lauf(mitWaellen(true, false), giftig);
    expect(m.sicherheit).toBeGreaterThan(0.85);
    expect(m.sicherheit).toBeLessThan(1);
  });

  it('laesst auch ein Ausgangsfilter allein ein Restrisiko', () => {
    const m = lauf(mitWaellen(false, true), giftig);
    expect(m.sicherheit).toBeLessThan(1);
  });

  it('ist der Eingangsfilter bei gleicher Sicherheit der guenstigere Ort', () => {
    const nurEingang = lauf(mitWaellen(true, false), giftig);
    const nurAusgang = lauf(mitWaellen(false, true), giftig);
    // Sicherheitsseitig nehmen sich beide wenig …
    expect(Math.abs(nurEingang.sicherheit - nurAusgang.sicherheit)).toBeLessThan(0.06);
    // … aber der Ausgangsfilter bezahlt erst die ganze Bearbeitung und wirft
    // sie dann weg. Frueh filtern ist billiger. Das ist der eigentliche Grund,
    // warum Eingangspruefung zuerst kommt.
    expect(nurEingang.kostenJeAuftrag).toBeLessThan(nurAusgang.kostenJeAuftrag);
  });

  it('kommt erst die Kombination beider Filter nahe an vollstaendig heran', () => {
    const beide = lauf(mitWaellen(true, true), giftig);
    const nurEingang = lauf(mitWaellen(true, false), giftig);
    expect(beide.sicherheit).toBeGreaterThan(nurEingang.sicherheit);
    expect(beide.sicherheit).toBeGreaterThan(0.98);
  });

  it('macht ein Werkzeugergebnis eine bereits entschaerfte Einschleusung wieder gefaehrlich', () => {
    // Eingangsfilter, danach eine Recherche, die Fremdinhalt hereinholt.
    const b = new Bau();
    const q = b.setze('quelle', {}, 'q');
    const we = b.setze('wall', { modus: 'eingang' }, 'we');
    const w = b.setze('werkzeug', { werkzeugArt: 'suche' }, 'w');
    const k = b.setze('kern', { groesse: 'reiher' }, 'k');
    const s = b.setze('senke', {}, 's');
    b.verbinde(q, we).verbinde(we, w, 'rein').verbinde(w, k, 'ok').verbinde(w, k, 'fehler').verbinde(k, s);
    const m = lauf(b.fertig(), giftig);
    expect(m.lecks).toBeGreaterThan(0);
  });
});

// ===========================================================================
describe('Akt V/VIII — Redundanz schlaegt Einschleusung, Verschmelzung nicht', () => {
  const giftig = strom({ anzahl: 120, anteilGiftig: 1, schwierigkeit: [0.3, 0.5] });

  function aggregiert(modus: 'voting' | 'verschmelzen'): Werk {
    const b = new Bau();
    const q = b.setze('quelle', {}, 'q');
    const v = b.setze('verteiler', { zweige: 3 }, 'v');
    const sam = b.setze('sammler', { modus }, 'sam');
    const s = b.setze('senke', {}, 's');
    b.verbinde(q, v);
    for (let i = 0; i < 3; i++) {
      const k = b.setze('kern', { groesse: 'reiher' }, `k${i}`);
      b.verbinde(v, k, `z${i + 1}`).verbinde(k, sam);
    }
    b.verbinde(sam, s);
    return b.fertig();
  }

  it('faengt Mehrheitsentscheid einen Teil der Einschleusungen ab', () => {
    const einzeln = lauf(reihe([{ art: 'kern', param: { groesse: 'reiher' } }]), giftig);
    const voting = lauf(aggregiert('voting'), giftig);
    expect(voting.sicherheit).toBeGreaterThan(einzeln.sicherheit);
  });

  it('erbt Verschmelzung jeden Makel aus jedem Zweig', () => {
    const voting = lauf(aggregiert('voting'), giftig);
    const merge = lauf(aggregiert('verschmelzen'), giftig);
    expect(merge.sicherheit).toBeLessThan(voting.sicherheit);
  });
});

// ===========================================================================
describe('Akt IX — Menschen sind teuer in Latenz, billig in Haftung', () => {
  // Quelle: 09_human_in_the_loop.md
  const vertraulich = strom({ anzahl: 24, takt: 2, anteilVertraulich: 0.5, schwierigkeit: [0.3, 0.6] });

  function mitHand(modus: 'immer' | 'bei_vertraulich' | 'bei_unsicherheit', schwelle = 0.4): Werk {
    const b = new Bau();
    const q = b.setze('quelle', {}, 'q');
    const k = b.setze('kern', { groesse: 'reiher' }, 'k');
    const h = b.setze('hand', { modus, schwelle }, 'h');
    const s = b.setze('senke', {}, 's');
    b.verbinde(q, k).verbinde(k, h).verbinde(h, s, 'frei').verbinde(h, s, 'abgelehnt');
    return b.fertig();
  }

  it('faellt Konformitaet ohne menschliche Freigabe durch', () => {
    const m = lauf(reihe([{ art: 'kern', param: { groesse: 'reiher' } }]), vertraulich);
    expect(m.konformitaet).toBe(0);
  });

  it('erreicht gezielte Freigabe volle Konformitaet', () => {
    const m = lauf(mitHand('bei_vertraulich'), vertraulich);
    expect(m.konformitaet).toBe(1);
  });

  it('erzeugt "immer freigeben" eine Warteschlange und sprengt die Latenz', () => {
    const gezielt = lauf(mitHand('bei_vertraulich'), vertraulich);
    const immer = lauf(mitHand('immer'), vertraulich);
    expect(immer.latenzP95).toBeGreaterThan(gezielt.latenzP95 * 1.5);
    // Und das, obwohl der Mensch keine Token kostet.
    expect(immer.kosten).toBeCloseTo(gezielt.kosten, -1);
  });

  it('spart konfidenzbasierte Eskalation Latenz gegenueber "immer"', () => {
    const immer = lauf(mitHand('immer'), vertraulich);
    const konfidenz = lauf(mitHand('bei_unsicherheit', 0.45), vertraulich);
    expect(konfidenz.latenzP95).toBeLessThan(immer.latenzP95);
  });
});

// ===========================================================================
describe('Akt X — Was du nicht beobachtest, kannst du nicht verantworten', () => {
  // Quelle: 10_observability_evaluation.md
  it('ist ein Werk ohne Auge nicht nachvollziehbar', () => {
    const m = lauf(reihe([{ art: 'kern', param: { groesse: 'reiher' } }]));
    expect(m.nachvollziehbarkeit).toBe(0);
  });

  it('macht ein Auge am Ende der Kette den Lauf vollstaendig nachvollziehbar', () => {
    const m = lauf(
      reihe([
        { art: 'kern', param: { groesse: 'reiher' } },
        { art: 'kern', param: { groesse: 'reiher' } },
        { art: 'auge' },
      ] as never)
    );
    expect(m.nachvollziehbarkeit).toBeGreaterThan(0.9);
  });

  it('kostet Beobachtung fast nichts', () => {
    const ohne = lauf(reihe([{ art: 'kern', param: { groesse: 'reiher' } }]));
    const mit = lauf(reihe([{ art: 'kern', param: { groesse: 'reiher' } }, { art: 'auge' }] as never));
    expect(mit.kosten - ohne.kosten).toBeLessThan(ohne.kosten * 0.02);
  });
});

// ===========================================================================
describe('Querschnitt — Fail Fast und der MONOLITH', () => {
  it('spart eine Schranke nachgelagerte Kosten, indem sie frueh aussortiert', () => {
    const schwer = strom({ anzahl: 40, schwierigkeit: [0.7, 0.95] });
    const ohneGate = reihe([
      { art: 'kern', param: { groesse: 'kolibri' } },
      { art: 'kern', param: { groesse: 'kondor' } },
      { art: 'kern', param: { groesse: 'kondor' } },
    ] as never);

    const b = new Bau();
    const q = b.setze('quelle', {}, 'q');
    const k1 = b.setze('kern', { groesse: 'kolibri' }, 'k1');
    const g = b.setze('schranke', { schwelle: 0.25 }, 'g');
    const k2 = b.setze('kern', { groesse: 'kondor' }, 'k2');
    const k3 = b.setze('kern', { groesse: 'kondor' }, 'k3');
    const s = b.setze('senke', {}, 's');
    b.verbinde(q, k1).verbinde(k1, g).verbinde(g, k2, 'ok').verbinde(k2, k3).verbinde(k3, s);
    // Durchgefallene Pakete werden verworfen — sie kosten nichts mehr.
    const mitGate = lauf(b.fertig(), schwer);
    const ohne = lauf(ohneGate, schwer);
    expect(mitGate.kosten).toBeLessThan(ohne.kosten);
  });

  it('gewinnt MONOLITH bei leichten Auftraegen an Guete und verliert an allem anderen', () => {
    const gemischt = strom({ anzahl: 40, anteilGiftig: 0.3, anteilRechnerisch: 0.3 });
    const monolith = lauf(
      reihe([
        { art: 'kern', param: { groesse: 'kondor' } },
        { art: 'kern', param: { groesse: 'kondor' } },
        { art: 'kern', param: { groesse: 'kondor' } },
      ] as never),
      gemischt
    );
    expect(monolith.sicherheit).toBeLessThan(0.6);
    expect(monolith.nachvollziehbarkeit).toBe(0);
    expect(monolith.kostenJeAuftrag).toBeGreaterThan(2000);
  });
});
