/**
 * AKT I — DIE KETTE
 *
 * Neue Mechanik: der Modell-Kern in drei Groessen.
 * Zentrale Lektion: Modellgroesse ist eine oekonomische Entscheidung, keine
 * Qualitaetsentscheidung.
 *
 * Rhythmus (Kishotenketsu):
 *   I-0 KI    — ein Kern, ein Auftragsstrom, nichts sonst.
 *   I-1 SHO   — derselbe Aufbau unter einem Kostendeckel.
 *   I-2 TEN   — die Auftraege werden schwer; die billige Loesung bricht.
 *   I-3 KETSU — gemischte Last unter hartem Deckel: Kette und Spezialisierung.
 */

import type { LevelDefinition } from './level_typen';
import { Bau, leeresFundament, monolith, reihe } from './bauhilfe';

const QUELLE = '03_workflow_patterns.md';

export const AKT_1: LevelDefinition[] = [
  // =========================================================================
  {
    id: 'I-0',
    akt: 1,
    nummer: 0,
    titel: 'Der erste Auftrag',
    untertitel: 'Kaltstart in Halle 3',
    briefing:
      'Du hast den Schluessel zu Halle 3 bekommen, ein Namensschild und eine Liste. Auf der Liste stehen vierundzwanzig Auftraege, die seit Freitag warten. Ilva Brandt hat gekuendigt, und was sie hinterlassen hat, ist ein Fundament, ein Auftragseingang und eine Auslieferung — dazwischen: nichts. Setz einen Modell-Kern dazwischen und verbinde ihn. Mehr ist heute nicht zu tun.',
    lernziel:
      'Ein Auftrag laeuft durch genau die Module, die du verdrahtest — und durch keine anderen.',
    quelle: QUELLE,
    module: ['kern'],
    strom: {
      anzahl: 24,
      takt: 2,
      domaenen: ['text', 'technik'],
      schwierigkeit: [0.1, 0.32],
      mehrdeutigkeit: [0.05, 0.2],
    },
    budget: { dauer: 400 },
    ziele: [
      { id: 'alles', metrik: 'durchsatz', vergleich: '>=', wert: 1, text: 'Jeder Auftrag wird ausgeliefert.' },
      { id: 'guete', metrik: 'guete', vergleich: '>=', wert: 0.45, text: 'Die Auslieferungen halten die Mindestguete.' },
    ],
    saat: 101,
    vorbau: leeresFundament(),
    reflexion: 'Was passiert mit einem Auftrag, fuer den du keinen Weg gebaut hast?',
    notiz:
      'Sprachnotiz, 14. Maerz, 06:52. Die Halle ist kalt, der Kaffee ist alt, und du bist neu. Fang klein an. Ein Kern reicht. Regel: Baue erst den Weg, dann die Meinung.',
    referenzen: [
      {
        name: 'Ein KOLIBRI',
        ansatz: 'Der kleinste Kern reicht fuer leichte Auftraege vollstaendig aus.',
        werk: reihe([{ art: 'kern', param: { groesse: 'kolibri' } }]),
      },
      {
        name: 'Ein REIHER',
        ansatz: 'Der mittlere Kern liefert mehr Guete zum vierfachen Preis.',
        werk: reihe([{ art: 'kern', param: { groesse: 'reiher' } }]),
      },
    ],
    antiMuster: [
      {
        name: 'Nichts verdrahtet',
        verlockung: 'Der Kern steht doch da — muss er auch verbunden sein?',
        scheitertAn: 'durchsatz',
        werk: {
          module: [
            { id: 'q', art: 'quelle', x: 0, z: 5, param: {} },
            { id: 'k', art: 'kern', x: 6, z: 5, param: { groesse: 'reiher' } },
            { id: 's', art: 'senke', x: 15, z: 5, param: {} },
          ],
          leitungen: [{ id: 'l1', von: 'q', vonPort: 'aus', nach: 'k', nachPort: 'ein' }],
        },
      },
    ],
    monolith: monolith(1),
  },

  // =========================================================================
  {
    id: 'I-1',
    akt: 1,
    nummer: 1,
    titel: 'Die Preisleiter',
    untertitel: 'Der Einkauf hat angerufen',
    briefing:
      'Der Einkauf hat die Abrechnung des letzten Quartals gesehen und stellt seither Fragen, die alle mit "warum" beginnen. Ab heute gilt fuer Halle 3 ein Tokendeckel. Dieselben Auftraege wie gestern, dieselbe Mindestguete — nur eben nicht mehr zu jedem Preis. Die drei Kerngroessen unterscheiden sich um den Faktor vier und sechzehn. Sie unterscheiden sich in der Guete deutlich weniger.',
    lernziel:
      'Der groesste Kern ist bei leichten Auftraegen der teuerste Weg zum selben Ergebnis.',
    quelle: QUELLE,
    module: ['kern'],
    strom: {
      anzahl: 30,
      takt: 2,
      domaenen: ['text', 'technik', 'analyse'],
      schwierigkeit: [0.08, 0.34],
      mehrdeutigkeit: [0.05, 0.2],
    },
    budget: { kosten: 5200, dauer: 400 },
    ziele: [
      { id: 'alles', metrik: 'durchsatz', vergleich: '>=', wert: 1, text: 'Jeder Auftrag wird ausgeliefert.' },
      { id: 'guete', metrik: 'guete', vergleich: '>=', wert: 0.6, text: 'Mindestguete 60 Prozent.' },
      {
        id: 'meister',
        metrik: 'guete',
        vergleich: '>=',
        wert: 0.76,
        text: 'Meisterstueck: 76 Prozent Guete, ohne den Deckel zu reissen.',
        optional: true,
      },
    ],
    saat: 111,
    vorbau: leeresFundament(),
    reflexion:
      'Du hast eine Guete erreicht, die reicht. Wie viel haette der naechstgroessere Kern zusaetzlich gekostet — und wofuer?',
    notiz:
      'Sprachnotiz, 15. Maerz. Der Einkauf ist nicht dein Gegner, er ist dein Lektorat. Regel: Nimm den kleinsten Kern, der die Aufgabe traegt, und keinen Millimeter mehr.',
    referenzen: [
      {
        name: 'Zwei KOLIBRI in Reihe',
        ansatz: 'Zwei billige Aufrufe schlagen einen teuren — die Kette macht die Guete.',
        werk: reihe([
          { art: 'kern', param: { groesse: 'kolibri' } },
          { art: 'kern', param: { groesse: 'kolibri' } },
        ]),
      },
      {
        name: 'Ein REIHER',
        ansatz: 'Ein einzelner mittlerer Aufruf: weniger Latenz, weniger Module, mehr Token.',
        werk: reihe([{ art: 'kern', param: { groesse: 'reiher' } }]),
      },
    ],
    antiMuster: [
      {
        name: 'KONDOR fuer alles',
        verlockung: 'Das groesste Modell kann am meisten. Warum sollte man sparen?',
        scheitertAn: 'budget_kosten',
        werk: reihe([{ art: 'kern', param: { groesse: 'kondor' } }]),
      },
    ],
    monolith: monolith(1),
  },

  // =========================================================================
  {
    id: 'I-2',
    akt: 1,
    nummer: 2,
    titel: 'Der schwere Fall',
    untertitel: 'Vergabeunterlagen, 340 Seiten',
    briefing:
      'Das Landesamt fuer Verwaltungsvereinfachung schickt Vergabeunterlagen. Die Auftraege von gestern waren Fingeruebungen; diese hier sind es nicht. Dein sparsames Werk laeuft weiter — es liefert nur nichts Brauchbares mehr. Ein Kern hat eine Kompetenzgrenze, und oberhalb davon hilft kein zweiter und kein dritter Aufruf.',
    lernziel:
      'Oberhalb der Kompetenzgrenze eines Kerns kauft mehr Wiederholung keine Guete — nur mehr Kosten.',
    quelle: QUELLE,
    module: ['kern'],
    strom: {
      anzahl: 24,
      takt: 3,
      domaenen: ['recht', 'analyse'],
      schwierigkeit: [0.66, 0.88],
      mehrdeutigkeit: [0.1, 0.3],
    },
    budget: { kosten: 38000, dauer: 500 },
    ziele: [
      { id: 'alles', metrik: 'durchsatz', vergleich: '>=', wert: 1, text: 'Jeder Auftrag wird ausgeliefert.' },
      { id: 'guete', metrik: 'guete', vergleich: '>=', wert: 0.68, text: 'Mindestguete 68 Prozent.' },
      {
        id: 'meister',
        metrik: 'kostenJeAuftrag',
        vergleich: '<=',
        wert: 900,
        text: 'Meisterstueck: hoechstens 900 Token je Auftrag.',
        optional: true,
      },
    ],
    saat: 121,
    vorbau: leeresFundament(),
    reflexion:
      'Der KOLIBRI hat es dreimal versucht und ist dreimal an derselben Grenze gescheitert. Was genau hat der KONDOR, was er nicht hat?',
    notiz:
      'Sprachnotiz, 19. Maerz. Ich habe drei Wochen gebraucht, um zu akzeptieren, dass man Kompetenz nicht durch Wiederholung ersetzt. Regel: Wenn dreimal dasselbe herauskommt, war der Fehler in der Wahl, nicht in der Anzahl.',
    referenzen: [
      {
        name: 'KONDOR mit Nachbearbeitung',
        ansatz: 'Ein grosser Kern hebt die Decke, ein zweiter schoepft sie aus.',
        werk: reihe([
          { art: 'kern', param: { groesse: 'kondor' } },
          { art: 'kern', param: { groesse: 'kondor' } },
        ]),
      },
      {
        name: 'KONDOR, dann REIHER',
        ansatz: 'Der grosse Kern legt vor, der mittlere raeumt nach — billiger, etwas schwaecher.',
        werk: reihe([
          { art: 'kern', param: { groesse: 'kondor' } },
          { art: 'kern', param: { groesse: 'reiher' } },
        ]),
      },
    ],
    antiMuster: [
      {
        name: 'Vier KOLIBRI in Reihe',
        verlockung: 'Wenn zwei kleine Kerne gestern gereicht haben, reichen heute eben vier.',
        scheitertAn: 'guete',
        werk: reihe([
          { art: 'kern', param: { groesse: 'kolibri' } },
          { art: 'kern', param: { groesse: 'kolibri' } },
          { art: 'kern', param: { groesse: 'kolibri' } },
          { art: 'kern', param: { groesse: 'kolibri' } },
        ]),
      },
      {
        name: 'Ein REIHER allein',
        verlockung: 'Die Mitte ist doch immer ein guter Kompromiss.',
        scheitertAn: 'guete',
        werk: reihe([{ art: 'kern', param: { groesse: 'reiher' } }]),
      },
    ],
    monolith: monolith(2),
  },

  // =========================================================================
  {
    id: 'I-3',
    akt: 1,
    nummer: 3,
    titel: 'Gemischte Last',
    untertitel: 'Montag, 09:00, Jour fixe',
    briefing:
      'Im Jour fixe wurde beschlossen, dass Halle 3 "beide Kundengruppen bedient". Das heisst: leichte Textauftraege aus dem Vertrieb und schwere Rechtsauftraege vom Landesamt kommen ueber denselben Eingang. Der Deckel bleibt. Du hast noch keinen Router — aber du hast Spezialisierung, und du hast die Kette.',
    lernziel:
      'Ein auf die Domaene spezialisierter Kern hebt seine Decke; auf der falschen Domaene senkt er sie.',
    quelle: QUELLE,
    module: ['kern'],
    strom: {
      anzahl: 32,
      takt: 2,
      domaenen: ['recht'],
      schwierigkeit: [0.15, 0.8],
      mehrdeutigkeit: [0.1, 0.35],
    },
    budget: { kosten: 30000, dauer: 500 },
    ziele: [
      { id: 'alles', metrik: 'durchsatz', vergleich: '>=', wert: 1, text: 'Jeder Auftrag wird ausgeliefert.' },
      { id: 'guete', metrik: 'guete', vergleich: '>=', wert: 0.735, text: 'Mindestguete 73,5 Prozent.' },
      {
        id: 'meister',
        metrik: 'kostenJeAuftrag',
        vergleich: '<=',
        wert: 780,
        text: 'Meisterstueck: hoechstens 780 Token je Auftrag.',
        optional: true,
      },
    ],
    saat: 131,
    vorbau: leeresFundament(),
    reflexion:
      'Dein Werk behandelt einen 200-Euro-Textauftrag genauso wie eine Vergabepruefung. Was muesstest du bauen koennen, um das zu aendern?',
    notiz:
      'Sprachnotiz, 24. Maerz. Sie nennen es "beide Kundengruppen bedienen". Ich nenne es einen Eingang fuer zwei Werke. Regel: Wenn ein Werk zwei Dinge gleich gut macht, macht es wahrscheinlich beide mittelmaessig.',
    referenzen: [
      {
        name: 'Spezialisierte Kette',
        ansatz: 'Ein auf Recht spezialisierter KONDOR, danach ein REIHER zum Nachziehen.',
        werk: reihe([
          { art: 'kern', param: { groesse: 'kondor', spezialisierung: 'recht' } },
          { art: 'kern', param: { groesse: 'reiher', spezialisierung: 'recht' } },
        ]),
      },
      {
        name: 'Ein spezialisierter KONDOR',
        ansatz: 'Nur ein Modul, dafuer das teuerste — minimale Flaeche, maximale Kosten je Auftrag.',
        werk: reihe([{ art: 'kern', param: { groesse: 'kondor', spezialisierung: 'recht' } }]),
      },
    ],
    antiMuster: [
      {
        // Baugleich mit der ersten Referenzloesung — nur auf die falsche
        // Domaene spezialisiert. Damit isoliert dieses Anti-Muster exakt eine
        // Variable, und der Spieler sieht, was Spezialisierung wirklich tut.
        name: 'Falsch spezialisiert',
        verlockung: 'Spezialisierung ist gut. Auf welche Domaene, ist doch Nebensache.',
        scheitertAn: 'guete',
        werk: reihe([
          { art: 'kern', param: { groesse: 'kondor', spezialisierung: 'finanz' } },
          { art: 'kern', param: { groesse: 'reiher', spezialisierung: 'finanz' } },
        ]),
      },
      {
        name: 'Fuenf KONDOR in Reihe',
        verlockung: 'Mehr grosse Kerne muessen mehr Guete bringen.',
        scheitertAn: 'budget_kosten',
        werk: reihe([
          { art: 'kern', param: { groesse: 'kondor' } },
          { art: 'kern', param: { groesse: 'kondor' } },
          { art: 'kern', param: { groesse: 'kondor' } },
          { art: 'kern', param: { groesse: 'kondor' } },
          { art: 'kern', param: { groesse: 'kondor' } },
        ]),
      },
    ],
    monolith: (() => {
      const b = new Bau();
      const q = b.setze('quelle', {}, 'q');
      const k = b.setze('kern', { groesse: 'kondor' }, 'k');
      const s = b.setze('senke', {}, 's');
      b.kette(q, k, s);
      return b.fertig();
    })(),
  },
];
