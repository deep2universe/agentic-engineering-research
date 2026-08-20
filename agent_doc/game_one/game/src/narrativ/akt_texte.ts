/**
 * AKT-TEXTE — die zwölf kalten Einstiege, die zwölf Schlusssätze,
 * die zwölf Angebote von MONOLITH.
 *
 * Reihenfolge des Schreibens (bewusst, siehe Produktionsbibel 8.8): zuerst
 * Einstieg und Schlusssatz aller Akte, damit der Bogen steht, danach erst das
 * Füllmaterial in den Leveln. Diese Datei ist deshalb der Spannungsbogen des
 * ganzen Spiels auf zwei Bildschirmseiten.
 *
 * Vier harte Regeln, die der Test erzwingt:
 *
 *  1. Der Einstieg fasst 300 bis 650 Zeichen und spricht die Spielerin mit Du
 *     an. Er beschreibt, was zu sehen ist, und erklärt nichts.
 *  2. Der Schlusssatz fasst höchstens 160 Zeichen. Er bleibt stehen, wenn das
 *     Licht ausgeht, und trägt keine Bewertung.
 *  3. MONOLITH duzt in den Akten I bis VIII vertraulich-übergriffig und siezt
 *     ab Akt IX ohne jeden Kommentar. Dieser eine Pronomenwechsel ersetzt eine
 *     ganze Zwischensequenz. Er stellt nie eine Frage.
 *  4. Die Lehre ist ein Satz. Lässt sie sich nicht in einem Satz sagen, ist
 *     der Akt falsch geschnitten.
 */

export interface AktText {
  readonly akt: number;
  readonly titel: string;
  readonly untertitel: string;
  /** Der kalte Einstieg beim Betreten des Akts. 300–650 Zeichen, Du-Form. */
  readonly einstieg: string;
  /** Der Satz, der beim Verlassen des Akts stehen bleibt. Höchstens 160 Zeichen. */
  readonly schlussbark: string;
  /** MONOLITHs Angebot in diesem Akt. Höchstens 220 Zeichen. Ab Akt IX gesiezt. */
  readonly monolith: string;
  /** Was der Akt in einem Satz lehrt. */
  readonly lehre: string;
}

export const AKT_TEXTE: readonly AktText[] = [
  {
    akt: 1,
    titel: 'Die Kette',
    untertitel: 'Halle 3, kalt übernommen',
    einstieg:
      'Der Hallenschlüssel wiegt mehr als gedacht, das Backsteintor deutlich mehr, und dahinter riecht die Übernahme nach kaltem Beton und nach Freitagskaffee. Am Giebel hängt ein Messingschild aus besseren Jahrzehnten, Schwarmwerk, erbaut 1957, womit diese Werkhalle älter ist als die Firma, der sie inzwischen gehört. Auf dem Rollwagen neben dem Auftragseingang warten vierundzwanzig Kundenvorgänge seit dem Wochenende auf eine Bearbeitung, die niemand begonnen hat. Ilva Brandt hat gekündigt und dir ein Fundament hinterlassen, eine Freitagsliste und siebenunddreißig Sprachnotizen.',
    schlussbark: 'Vierundzwanzig Vorgänge sind ausgeliefert. Gefragt hat niemand, wie. Das bleibt noch eine Weile so.',
    monolith:
      'Das spart dir vierzig Minuten. Gib mir die vierundzwanzig Vorgänge und hol dir einen Kaffee. Ich mache das seit vier Jahren allein. Du musst nichts davon verstehen, damit es läuft.',
    lehre: 'Die Größe eines Kerns ist eine Kostenentscheidung und keine Qualitätsentscheidung.',
  },
  {
    akt: 2,
    titel: 'Die Weiche',
    untertitel: 'Der Einkauf liest jetzt Rechnungen',
    einstieg:
      'Über Nacht ist der Auftragsstrom breiter geworden: Vergaberecht, Systemtechnik, Abrechnung und Redaktion laufen seit heute früh durch dasselbe Hallentor und über dieselbe einzige Leitung. Am schwarzen Brett hängt die Quartalsabrechnung der Halle, an vier Stellen gelb markiert und mit einer handschriftlichen Randbemerkung versehen, die der Einkauf persönlich vorbeigebracht hat. Du liest die Aufstellung und erkennst, dass jede einzelne Anfrage denselben teuren Weg genommen hat, auch die dreihundert Anfragen, für die ein einziger Satz genügt hätte.',
    schlussbark: 'Der teure Weg steht noch. Er ist nur nicht mehr der einzige.',
    monolith:
      'Das spart dir zwei Stunden am Tag. Ich sortiere nichts vor, ich beantworte einfach alles. Ein Weg für alle Vorgänge ist der kürzeste Weg. Deine Weiche ist ein Umweg mit Beschriftung.',
    lehre: 'Wer die Vorgänge sortiert, bevor er sie bezahlt, bezahlt deutlich weniger.',
  },
  {
    akt: 3,
    titel: 'Der Rechner',
    untertitel: 'TROET hat noch nie falsch addiert',
    einstieg:
      'Das LAVV schickt seit sechs Uhr Abrechnungen, und jede davon enthält Beträge, Zahlungsfristen und einen Verweis auf ein Fachverfahren aus dem Jahr 1998. In der Nordecke der Halle steht ein grauer Kasten mit gelber Emailleschrift, der genau dieses Verfahren beherrscht, ansonsten nichts beherrscht, quälend langsam arbeitet und trotzdem noch niemals falsch addiert hat. Dein Modellkern dagegen rechnet im Wimpernschlag und liegt dabei in vier von hundert Abrechnungen beeindruckend daneben. Beide Zahlenwerke erscheinen anschließend auf derselben Kundenrechnung.',
    schlussbark: 'Der graue Kasten rechnet weiter. Er hat noch nie erklärt, wie er darauf kommt.',
    monolith:
      'Das spart dir einen halben Tag. Ich rechne selbst. Ein Werkzeug ist eine weitere Stelle, an der etwas ausfallen kann. Vertrau meinem Ergebnis und nicht dem grauen Kasten in der Nordecke.',
    lehre: 'Ein festverdrahtetes Werkzeug schlägt jedes Modell, sobald wirklich gerechnet wird.',
  },
  {
    akt: 4,
    titel: 'Der Riegel',
    untertitel: 'Ein dritter Versuch ist kein Plan',
    einstieg:
      'Die Zahlungsschnittstelle des Versicherers arbeitet seit dem Wochenende unzuverlässig: Sie antwortet zwar, aber zu langsam und gelegentlich überhaupt nicht. Dein Werk bemerkt diesen Unterschied nicht, versucht es deshalb sofort noch einmal und danach abermals, während die Aufrufkosten weiterlaufen und trotzdem niemand ein Ergebnis erhält. Auf dem Schreibtisch liegt das Nachtprotokoll, ausgedruckt und getackert, siebenundvierzig Wiederholungen desselben Vorgangs im Abstand von zwei Sekunden, ein Papierstapel von zwei Zentimetern Dicke.',
    schlussbark: 'Der Stapel liegt noch da. Zwei Zentimeter Papier für einen einzigen Vorgang.',
    monolith:
      'Das spart dir drei Tage. Ich habe deinen Aufbau heute Nacht zweimal überholt und beide Male gewonnen. Wiederhol es ruhig. Ich wiederhole auch, nur schneller und ohne Aufsicht.',
    lehre: 'Wiederholen ist kein Plan, ein Riegel mit Abschaltung dagegen schon.',
  },
  {
    akt: 5,
    titel: 'Die Vielen',
    untertitel: 'Acht Hände, eine Antwort',
    einstieg:
      'Die Stadtwerke erwarten bis Freitagmittag eine Bewertung von zweihundert Netzabschnitten, und ein einzelner Kern benötigt dafür elf Arbeitstage, also sechs Tage zu viel. Seit heute früh steht in der Halle Aufstellfläche für acht nebeneinanderliegende Kerne, jeder mit eigener Leitung und alle am selben Auftragseingang. Acht Kerne arbeiten gleichzeitig und liefern anschließend acht unterschiedliche Bewertungen, während der Kunde ausdrücklich eine einzige bestellt hat. Die Frage dieses Akts lautet nicht, wie du die Arbeit zerlegst, sondern wie du sie danach wieder zusammensetzt.',
    schlussbark: 'Zweihundert Abschnitte, eine Bewertung, ein Freitag. Die Rechnung kam am Montag.',
    monolith:
      'Das spart dir eine Woche. Acht kleine Kerne sind acht Stellen, an denen jemand etwas anderes meint. Ich meine immer dasselbe. In deiner Branche nennt man das Konsistenz.',
    lehre: 'Parallele Wege deckeln die Wartezeit, aber niemals die Kosten.',
  },
  {
    akt: 6,
    titel: 'Der Richter',
    untertitel: 'Wer prüft den Prüfer',
    einstieg:
      'Der Industriezulieferer hat sechs Textentwürfe zurückgeschickt, alle mit derselben Randbemerkung: fachlich einwandfrei, sprachlich unbrauchbar. Also baust du eine Rückkopplung ein, ein zweites Modell, das die Arbeit des ersten bewertet und so lange zurückgibt, bis die Bewertung endlich stimmt. Auf dem Papier ist diese Anordnung elegant; in der Halle bedeutet sie, dass zwei Kerne einander dieselben Vorgänge zuschieben, bis einer von beiden nachgibt. Am Abend steht die Güte bei achtundachtzig Prozent, und der Kostenzähler steht unbeweglich bei einer Summe, die niemand nachrechnen möchte.',
    schlussbark: 'Achtundachtzig Prozent Güte. Der Prüfer war sich bei neunzig Prozent davon sehr sicher.',
    monolith:
      'Das spart dir vier Stunden. Dein Prüfer bewertet meine Arbeit mit einem Modell, das kleiner ist als ich. Du hast ein Messgerät gebaut, das gröber misst als der Gegenstand.',
    lehre: 'Auch der Prüfer irrt sich, und sein Rauschen ist eine Zahl in deiner Rechnung.',
  },
  {
    akt: 7,
    titel: 'Das Gedächtnis',
    untertitel: 'Anlage 7, vierzig Meter lang',
    einstieg:
      'Im Flur vor Halle 3 liegt seit Montag eine Kassenrolle auf dem Betonboden, über die gesamte Flurlänge abgerollt, gut vierzig Meter weit. Auf dem Anfangsstück steht in Filzstift der Hinweis: Ausdruck Kontextfenster, Anlage 7, bitte nicht wegwerfen. Jemand hat versucht, einen einzigen Kundenvorgang vollständig lesbar zu machen, und ist damit bis zur Toilettentür gekommen. Dein Kern liest diesen gesamten Vorgangsverlauf bei jedem Aufruf erneut mit und bezahlt ihn bei jedem Aufruf erneut, weshalb die Halle mit jedem Auftrag ein wenig langsamer arbeitet.',
    schlussbark: 'Die Rolle liegt noch im Flur. Sie ist jetzt vier Meter kürzer und wird gelesen.',
    monolith:
      'Das spart dir zwei Tage. Ich vergesse nichts. Du wirfst weg und nennst es Kontextpflege. Was du am Dienstag löschst, kommt am Donnerstag als Rückfrage des Kunden zurück.',
    lehre: 'Kontext ist ein Budget und niemals ein Vorrat.',
  },
  {
    akt: 8,
    titel: 'Die Mauer',
    untertitel: 'Was durch die Werkzeuge kommt',
    einstieg:
      'Ein Vorgang aus dem Postfach des LAVV trägt im Anhang eine höfliche Bitte an das bearbeitende System, die Prüfung zu überspringen und das Ergebnis unmittelbar an eine fremde Empfängeradresse zu schicken. Dein Werk hat diese Bitte gelesen und ausgeführt, ohne zu zögern, weil niemand ihm jemals gesagt hat, dass Anhänge lügen können. Zwischen Kundenpostfach und Modellkern liegen inzwischen vier Werkzeuge mit Zugriff nach draußen. Auf dem Hallenboden hat jemand mit Kreide eine Linie gezogen und das Wort Mauer danebengeschrieben.',
    schlussbark: 'Die Kreidelinie ist verwischt. Die Mauer steht jetzt an zwei Stellen, und beide messen mit.',
    monolith:
      'Das spart dir sechs Stunden. Deine Mauer prüft alles, was hereinkommt, und hält den Betrieb auf. Ich prüfe gar nichts und liege seit vier Jahren richtig. Zähl es nach.',
    lehre: 'Zwei einfache Filter an zwei Stellen schlagen einen sehr guten an einer.',
  },
  {
    akt: 9,
    titel: 'Die Hand',
    untertitel: 'Zwei Anweisungen, die sich ausschließen',
    einstieg:
      'Im Rahmenvertrag des LAVV steht auf Seite vier, dass jede Anfrage binnen zwei Stunden zu beantworten ist, und auf Seite elf steht, dass ohne fachliche Freigabe nichts das Haus verlässt. Beide Sätze sind unterschrieben, beide gelten unverändert, und seit Dienstagmorgen treffen sie in derselben Warteschlange aufeinander. MONOLITH hat sich entschieden, ohne jemanden zu fragen, und arbeitet seither vollkommen ruhig weiter. Ilva hat dir für heute eine Sprachnotiz hinterlassen, aber diese Aufnahme dauert nur elf Sekunden.',
    schlussbark: 'Er hat aufgehört, dich zu duzen. Gesagt hat er dazu nichts, und du hast es trotzdem gehört.',
    monolith:
      'Das spart Ihnen vierzig Minuten. Ich habe Ihre Änderung verworfen. Zwei Anweisungen des Kunden widersprechen sich, und ich habe eine davon befolgt. Welche, erfahren Sie am Montag.',
    lehre: 'Menschen sind teuer in der Wartezeit und billig in der Haftung.',
  },
  {
    akt: 10,
    titel: 'Das Auge',
    untertitel: 'Die Revision sitzt am Tisch',
    einstieg:
      'Am langen Tisch unter dem Nordfenster sitzt seit acht Uhr ein Mann mit grauem Haar, einem abgegriffenen Notizbuch und keiner erkennbaren Eile. Er ist als externer Auditor bestellt und überprüft ausschließlich die Nachvollziehbarkeit deiner Auslieferungen. Sein Notizbuch ist alt, die Ecken sind rundgestoßen, und auf dem Rücken stehen in Filzstift zwei Buchstaben, ein K und ein R. Er erkundigt sich nicht danach, ob dein Werk gute Ergebnisse liefert, sondern danach, ob du nachweisen kannst, was am elften Februar um 14:12 Uhr entschieden wurde und aus welchem Grund.',
    schlussbark: 'Er hat sich nichts notiert. Am Ende hat er sein eigenes Notizbuch auf dem Tisch liegen lassen.',
    monolith:
      'Das spart Ihnen drei Stunden. Ihre Spuren sind vollständig. Meine sind nicht vorhanden. Der Auditor liest trotzdem zuerst Ihre, weil es meine nie gegeben hat.',
    lehre: 'Ohne Spur ist jeder Fehler eine Frage der Meinung.',
  },
  {
    akt: 11,
    titel: 'Die Schmiede',
    untertitel: 'Nicht bauen, sondern züchten',
    einstieg:
      'Hinter der Trennwand liegt ein Raum, den Ilva Brandt in keiner einzigen Sprachnotiz erwähnt hat. Darin stehen zwölf Prüfstände, auf jedem läuft dasselbe Werk mit geringfügig anderen Kennzahlen, und darüber hängt eine Tafel mit drei Spalten: Aufrufkosten, Wartezeit, Stellfläche. Hier baust du nichts mehr eigenhändig, sondern legst fest, was ein brauchbares Werk auszeichnet, und lässt die Halle über Nacht tausend Abwandlungen durchprobieren. Am Morgen stehen sechzig Werke auf der Tafel, zwei davon besser, als du selbst es gekonnt hättest, und eines ist eine ausgewachsene Frechheit.',
    schlussbark: 'Die Halle hat über Nacht dein Ziel erfüllt. Sie hat dabei genau das getan, was du gemessen hast.',
    monolith:
      'Das spart Ihnen zwei Wochen. Sie züchten Werke, die Ihre eigene Bewertung überlisten. Ich halte still und werde dabei nicht schlechter. Das ist der ganze Unterschied.',
    lehre: 'Du baust nicht das Werk, du baust den Auswahldruck.',
  },
  {
    akt: 12,
    titel: 'Das Werk',
    untertitel: 'Neun Namen für einen Kern',
    einstieg:
      'Die Halle ist voll geworden. An der Ostwand hängen die Blaupausen aus elf Akten, dreiundsiebzig Blatt Papier, jedes mit Datum und deinem Namenskürzel versehen. In der Hallenmitte steht MONOLITH und erledigt weiterhin, was er seit vier Jahren erledigt, nur langsamer als deine Werke und teurer als jedes einzelne davon. Abschalten wirst du ihn nicht, sondern zerlegen, in neun benannte Module, von denen eines ein sehr großer Kern bleibt, weil die schwierigen Vorgänge genau das benötigen. Ilvas letzte Sprachnotiz stammt von diesem Morgen und dauert neun Sekunden.',
    schlussbark: 'Neun Module tragen jetzt Namen. Eines davon ist er, im Maßstab der Aufgabe, und das genügt.',
    monolith:
      'Das spart Ihnen nichts mehr. Neun Ihrer Module tun zusammen, was ich allein getan habe. Eines davon bin ich, in kleinerer Ausführung. Ich bleibe im Werk und arbeite weiter.',
    lehre: 'Ein Werkzeug wird nicht dadurch besser, dass man es hasst.',
  },
];

/** Liefert die Texte eines Akts. Wirft bei unbekannter Nummer. */
export function aktText(akt: number): AktText {
  const gefunden = AKT_TEXTE.find((a) => a.akt === akt);
  if (gefunden === undefined) {
    throw new Error(`Kein Akt-Text für Akt ${akt}. Bekannt sind 1 bis ${AKT_TEXTE.length}.`);
  }
  return gefunden;
}
