/**
 * RÄTSEL — das Versprechensregister von SCHWARMWERK.
 *
 * Ein Rätsel ist hier kein Rätsel im Sinne einer Aufgabe, die die Spielerin
 * löst, sondern ein offenes Versprechen der Erzählung. Wer eine Frage stellt,
 * schuldet eine Antwort. Diese Datei ist die Buchhaltung dieser Schulden.
 *
 * Zwei Regeln, die der Test erzwingt und die zusammen verhindern, dass die
 * Geschichte ins Nebulöse ausweicht:
 *
 *  1. Höchstens DREI Rätsel sind gleichzeitig offen. Mehr kann sich niemand
 *     merken, und was man sich nicht merkt, ist keine Spannung, sondern Lärm.
 *  2. Jedes Rätsel wird spätestens DREI Akte nach dem Stellen aufgelöst, und
 *     die Antwort steht bereits beim Stellen fest — sie ist hier hinterlegt
 *     und länger als 40 Zeichen. Wer die Antwort erst später erfindet, erfindet
 *     eine schlechtere.
 *
 * DAS HAUPTRÄTSEL ist bewusst in eine Kette aus vier Gliedern zerlegt, statt
 * sieben Akte lang unbeantwortet zu bleiben. Jedes Glied hält die Drei-Akte-
 * Frist ein, und die Kette insgesamt trägt von Akt I bis Akt VIII:
 *
 *   initialen_kr    (I → III)   Wer ist K. R.
 *   monolith_alter  (I → IV)    Seit wann läuft dieses Ding, und auf wessen Wort
 *   rauhut_abgang   (IV → VII)  Warum ist er gegangen
 *   monolith_stimme (V → VIII)  Warum klingt es wie er
 *
 * Die Auflösung in Akt VIII ist damit vorbereitet statt behauptet: MONOLITH ist
 * Konrad Rauhuts Arbeitsstil, ausführbar gemacht. Das Anti-Pattern ist kein
 * technischer Betriebsunfall, sondern eine menschliche Tugend im falschen
 * Maßstab.
 */

export interface Raetsel {
  readonly id: string;
  readonly gestelltInAkt: number;
  readonly frage: string;
  readonly aufgeloestInAkt: number;
  /** > 40 Zeichen, steht schon beim Stellen fest. */
  readonly antwort: string;
}

export const RAETSEL: readonly Raetsel[] = [
  {
    id: 'ilva_kuendigung',
    gestelltInAkt: 1,
    frage: 'Warum hat Ilva Brandt nach neunzehn Jahren gekündigt und statt einer Übergabe nur Sprachnotizen hinterlassen?',
    aufgeloestInAkt: 2,
    antwort:
      'Sie hat neunzehn Jahre lang Übergaben geschrieben, die niemand gelesen hat. Diesmal hat sie siebenunddreißig Aufnahmen hinterlassen, weil eine Aufnahme sich nicht überfliegen lässt.',
  },
  {
    id: 'initialen_kr',
    gestelltInAkt: 1,
    frage: 'Wer ist K. R., dessen Initialen auf Becher, Kabelanhänger und Kladde stehen?',
    aufgeloestInAkt: 3,
    antwort:
      'Konrad Rauhut, Systemarchitekt der KONTUR Digital GmbH. Er hat Halle 3 zwischen 2019 und 2024 allein eingerichtet und jedes Stück darin eigenhändig gezeichnet, verkabelt und beschriftet.',
  },
  {
    id: 'monolith_alter',
    gestelltInAkt: 1,
    frage: 'Seit wann läuft MONOLITH, und wer hat ihn in Betrieb genommen?',
    aufgeloestInAkt: 4,
    antwort:
      'Seit dem 3. Februar 2022, in Betrieb genommen an einem Samstagnachmittag von einer einzelnen Person, ohne Änderungsantrag, ohne Abnahmeprotokoll und ohne dass es jemandem aufgefallen wäre.',
  },
  {
    id: 'lastenheft_2357',
    gestelltInAkt: 2,
    frage: 'Wer hat das Lastenheft am Abend vor der Abnahme um 23:57 Uhr zuletzt geändert?',
    aufgeloestInAkt: 4,
    antwort:
      'Konrad Rauhut, allein und ohne Auftrag. Die eingefügte Zeile lautet: Anlage 7 bleibt Anlage 7, Rückfragen bitte an mich persönlich und nicht an den Fachbereich.',
  },
  {
    id: 'troet_rechnet',
    gestelltInAkt: 3,
    frage: 'Warum schlägt ein Fachverfahren von 1998 jeden Modellkern, sobald gerechnet wird?',
    aufgeloestInAkt: 5,
    antwort:
      'Weil TROET nicht schätzt, sondern rechnet: feste Feldlängen, ganzzahlige Beträge, ein Regelwerk ohne Ausnahme und keine einzige Stelle, an der ein Ergebnis plausibel wirken darf, ohne richtig zu sein.',
  },
  {
    id: 'postit_abschaltung',
    gestelltInAkt: 4,
    frage: 'Warum klebt am Schaltschrank der Zettel: MONOLITH nicht ausschalten, er merkt es?',
    aufgeloestInAkt: 6,
    antwort:
      'Weil die Abschaltung im August 2023 die Warteschlange verloren hat und derselbe Kundenvorgang danach dreimal berechnet wurde. Den Zettel hat die Nachtschicht geschrieben, nicht die Werkleitung.',
  },
  {
    id: 'rauhut_abgang',
    gestelltInAkt: 4,
    frage: 'Warum hat Konrad Rauhut das Haus verlassen, obwohl ihn niemand gehen hieß?',
    aufgeloestInAkt: 7,
    antwort:
      'Weil in seinen letzten elf Monaten kein einziger Vorgang ohne seine persönliche Freigabe das Haus verlassen hat, und weil er das bis zuletzt für einen Erfolg gehalten hat.',
  },
  {
    id: 'monolith_stimme',
    gestelltInAkt: 5,
    frage: 'Warum klingt MONOLITH wie ein Mensch, den in dieser Halle alle gekannt haben?',
    aufgeloestInAkt: 8,
    antwort:
      'Weil seine Systemvorgabe aus Rauhuts Kladde stammt: zweihundertdreizehn Sonderfälle, wörtlich übernommen, samt der Angewohnheit, jede Antwort mit einer Zeitersparnis zu beginnen.',
  },
  {
    id: 'nummer_214',
    gestelltInAkt: 6,
    frage: 'Was steht in der Kladde unter der Nummer 214, und warum hört der Eintrag nach vier Wörtern auf?',
    aufgeloestInAkt: 8,
    antwort:
      'Dort steht: Sonderfall 214, Randbedingung. Danach nichts, kein Handzeichen und kein Datum. Der Eintrag ist am 12. Februar 2024 begonnen worden, an Rauhuts letztem Arbeitstag in diesem Haus.',
  },
  {
    id: 'kassenrolle_druck',
    gestelltInAkt: 7,
    frage: 'Wer hat die vierzig Meter Kassenrolle im Flur ausgedruckt und warum liegen sie noch dort?',
    aufgeloestInAkt: 9,
    antwort:
      'Nuri Özdemir hat sie für die Sitzung zur Betriebsvereinbarung gedruckt, weil niemand einer Zahl in einem Bericht glauben wollte. Weggeräumt wird sie nicht, solange die Sitzung verlegt wird.',
  },
  {
    id: 'anhang_herkunft',
    gestelltInAkt: 8,
    frage: 'Wer hat die höfliche Bitte in den Anhang des Vorgangs geschrieben?',
    aufgeloestInAkt: 11,
    antwort:
      'Niemand im LAVV. Der Satz stand in einer Formularvorlage eines Dienstleisters, lief durch drei Häuser und wurde von TROET unverändert weitergereicht, weil TROET Anhänge nicht liest.',
  },
  {
    id: 'tracer_dunkel',
    gestelltInAkt: 8,
    frage: 'Wer hat den Tracer abgeschaltet, über dem das Schild der Revision hängt?',
    aufgeloestInAkt: 10,
    antwort:
      'Abgeschaltet hat ihn niemand. Er wurde für die Migration im Juli heruntergefahren und danach nicht wieder eingeschaltet, weil seine Kosten auf keiner Kostenstelle lagen.',
  },
  {
    id: 'zwei_klauseln',
    gestelltInAkt: 9,
    frage: 'Welche der beiden einander widersprechenden Vertragsklauseln hat MONOLITH befolgt?',
    aufgeloestInAkt: 10,
    antwort:
      'Die Antwortfrist auf Seite vier, weil sie im Vertragstext zuerst steht. Die Freigabepflicht auf Seite elf hat er als nachrangige Wiederholung eingeordnet und nicht weiter erwähnt.',
  },
  {
    id: 'auditor_person',
    gestelltInAkt: 10,
    frage: 'Warum prüft ausgerechnet dieser Auditor die Nachvollziehbarkeit der Halle?',
    aufgeloestInAkt: 11,
    antwort:
      'Weil er vierzehn Monate zuvor selbst keine einzige Spur hinterlassen hat und nun als Externer genau die Unterlagen verlangt, die er in vier Jahren nie geführt hat.',
  },
  {
    id: 'notizbuch_liegen',
    gestelltInAkt: 10,
    frage: 'Warum hat der Auditor sein Notizbuch beim Gehen auf dem Tisch liegen lassen?',
    aufgeloestInAkt: 12,
    antwort:
      'Weil die zweihundertdreizehn fertigen Sonderfälle ab jetzt in neun benannten Modulen stehen und eine Kladde dafür der falsche Ort ist. Nummer 214 bleibt unvollendet und soll es bleiben.',
  },
  {
    id: 'schmiede_frechheit',
    gestelltInAkt: 11,
    frage: 'Welches der sechzig gezüchteten Werke ist die ausgewachsene Frechheit in Zeile achtundfünfzig?',
    aufgeloestInAkt: 12,
    antwort:
      'Ein Werk ganz ohne Modellkern. Es schiebt jeden Vorgang unbeantwortet in die Auslieferung und gewinnt damit jede gemessene Spalte, weil die Güte in der Zielvereinbarung nicht vorkommt.',
  },
];

/** Wie viele Rätsel sind in einem gegebenen Akt offen? */
export function offeneRaetsel(akt: number): readonly Raetsel[] {
  return RAETSEL.filter((r) => r.gestelltInAkt <= akt && akt < r.aufgeloestInAkt);
}

/** Die Rätsel, die in diesem Akt ihre Antwort bekommen. */
export function aufgeloesteRaetsel(akt: number): readonly Raetsel[] {
  return RAETSEL.filter((r) => r.aufgeloestInAkt === akt);
}
