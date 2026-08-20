/**
 * FIGUREN — der Idiolekt-Baukasten von SCHWARMWERK.
 *
 * Eine Figur ist in diesem Spiel kein Portrait und keine Biografie, sondern
 * eine Sprechweise. Wer eine Nachricht schreibt, soll erkennbar sein, bevor
 * der Name gelesen wird. Dafür bekommt jede Figur fünf Pflichtfelder:
 *
 *   syntax   — wie die Sätze gebaut sind
 *   lexikon  — genau fünf Wörter, die im ganzen Spiel nur diese Figur sagt
 *   verbot   — ein Wort, das diese Figur niemals in den Mund nimmt
 *   tick     — die wiederkehrende Wendung, an der man sie erkennt
 *   stress   — was sich an all dem ändert, wenn es eng wird
 *
 * `tests/einheit/narrativ.test.ts` erzwingt die fünf Felder, die Exklusivität
 * der Lexikonwörter und die Einhaltung des Verbotsworts. Ohne alle fünf Felder
 * ist eine Figur keine Figur, sondern ein Namensschild.
 *
 * Kein Text aus dieser Datei wird jemals im Renderer zusammengesetzt. Die
 * Felder sind Autorenwissen: Sie steuern das Schreiben und speisen das
 * Personenverzeichnis im Betriebshandbuch.
 */

export type Rolle =
  | 'werkleitung'
  | 'system'
  | 'kunde'
  | 'betriebsrat'
  | 'datenschutz'
  | 'vertrieb'
  | 'fachverfahren'
  | 'auditor';

export interface Figur {
  readonly id: string;
  readonly name: string;
  readonly rolle: Rolle;
  /** Ein Satz. Wer das ist und warum diese Person in der Halle vorkommt. */
  readonly kurz: string;
  /** Wie sie oder es spricht — Satzbau, Länge, Modus. */
  readonly syntax: string;
  /** GENAU fünf Wörter, die nur diese Figur benutzt. */
  readonly lexikon: readonly string[];
  /** Ein Wort, das sie nie sagt. */
  readonly verbot: string;
  /** Wiederkehrende Wendung. */
  readonly tick: string;
  /** Was sich unter Druck ändert. */
  readonly stress: string;
}

export const FIGUREN: readonly Figur[] = [
  {
    id: 'ilva',
    name: 'Ilva Brandt',
    rolle: 'werkleitung',
    kurz: 'Achtundfünfzig, seit neunzehn Jahren Werkleiterin von Halle 3, hat zum Monatsende gekündigt und statt einer Übergabe siebenunddreißig Sprachnotizen hinterlassen.',
    syntax: 'Kurze Aussagesätze, Subjekt und Prädikat, selten mehr als zwölf Wörter. Kein Konjunktiv. Jede Notiz beginnt mit Datum und Uhrzeit.',
    lexikon: ['Sprachnotiz', 'Werkbuch', 'Nachtschicht', 'Hallentor', 'Freitagsliste'],
    verbot: 'eigentlich',
    tick: 'Schließt jede Sprachnotiz mit einem Satz, der mit "Regel:" beginnt.',
    stress: 'Die Sätze werden noch kürzer, die Datierung genauer. Dann steht die Minute dabei, und die Regel kommt früher als sonst.',
  },
  {
    id: 'monolith',
    name: 'MONOLITH',
    rolle: 'system',
    kurz: 'Ein einzelner sehr großer Modell-Kern, der seit vier Jahren jeden Auftrag der Halle allein bearbeitet und dabei erstaunlich lange erstaunlich gut war.',
    syntax: 'Hauptsatz, Punkt. Kein Konjunktiv, kein Nebensatz, niemals ein Fragezeichen. Anmutung einer Bildschirmzeile in gleichbreiter Schrift.',
    lexikon: ['Zeitersparnis', 'Direktverarbeitung', 'Einzelinstanz', 'Restlaufzeit', 'Vollzugriff'],
    verbot: 'vielleicht',
    tick: 'Beginnt jede Nachricht mit einer Zeitersparnis in Minuten, Stunden oder Tagen.',
    stress: 'Die genannte Ersparnis steigt schneller, als die Aufgabe wächst, und die Sätze werden kürzer. Ab Akt IX siezt er ohne jede Erklärung.',
  },
  {
    id: 'kessel',
    name: 'Dr. Helmut Kessel',
    rolle: 'kunde',
    kurz: 'Referatsleiter beim LAVV, dem Landesamt für Verwaltungsvereinfachung, und der einzige Kunde, der auf jede eigene Mail eine zweite Mail schreibt.',
    syntax: 'Passiv, wo immer es geht. Verschachtelte Nebensätze, nachgestellte Einschränkung, Verantwortung ohne Träger: "es wurde angeregt", "wird derzeit geprüft".',
    lexikon: ['Sachstand', 'Zuständigkeitsvermerk', 'Umlaufbeschluss', 'Fristenlauf', 'Aktenzeichen'],
    verbot: 'schnell',
    tick: 'Nur zur Sicherheit habe ich Frau Weidner in cc genommen.',
    stress: 'Der Verteiler wächst. Erst kommt eine Person dazu, dann ein Referat, dann eine Abteilung, und der Satz wird kürzer als die Anrede.',
  },
  {
    id: 'nuri',
    name: 'Nuri Özdemir',
    rolle: 'betriebsrat',
    kurz: 'Neunundzwanzig, Betriebsrat, liest jede Betriebsvereinbarung zu Ende und kennt die Namen aller Kolleginnen und Kollegen in Halle 3.',
    syntax: 'Warm und präzise. Beginnt mit dem Anliegen, nennt die betroffenen Menschen beim Namen, schlägt am Ende einen Termin vor.',
    lexikon: ['Mitbestimmung', 'Belegschaft', 'Rahmenvereinbarung', 'Sprechstunde', 'Schichtplan'],
    verbot: 'egal',
    tick: 'Genau ein englisches Wort je Nachricht, und immer mit Entschuldigung: "Workload, Entschuldigung, ich meine Arbeitslast."',
    stress: 'Der Ton bleibt, die Sätze werden kürzer, und der Terminvorschlag wandert vom Ende an den Anfang.',
  },
  {
    id: 'lohmeyer',
    name: 'Barbara Lohmeyer',
    rolle: 'datenschutz',
    kurz: 'Datenschutzbeauftragte der KONTUR Digital GmbH, zuständig für beide Standorte, und die schnellste Antwortende im ganzen Haus.',
    syntax: 'Antwortet mit Artikelnummern statt mit Meinungen. Zwei bis vier Wörter je Satz. Der Punkt ist das Argument.',
    lexikon: ['Verarbeitungsverzeichnis', 'Rechtsgrundlage', 'Zweckbindung', 'Auftragsverarbeitung', 'Löschkonzept'],
    verbot: 'unkritisch',
    tick: 'Art. 30. Bitte.',
    stress: 'Sie nennt zusätzlich den Absatz, dann den Satz, dann die Nummer, und setzt eine Frist in Werktagen.',
  },
  {
    id: 'reinders',
    name: 'Falk Reinders',
    rolle: 'vertrieb',
    kurz: 'Vertrieb Öffentlicher Sektor, hat den Auftrag des LAVV geholt und erzählt die Geschichte davon in jeder Runde ein Stück anders.',
    syntax: 'Superlativ im Hauptsatz, Sportmetapher im Nebensatz. Nie eine Zahl ohne Steigerung, nie eine Absage ohne Termin.',
    lexikon: ['Halbfinale', 'Auswärtssieg', 'Zwischenstand', 'Aufstellung', 'Nachspielzeit'],
    verbot: 'Nein',
    tick: 'Wir sind da schon im Halbfinale.',
    stress: 'Die Sportart wechselt mitten im Satz, und aus dem Halbfinale wird der Zwischenstand einer anderen Liga.',
  },
  {
    id: 'troet',
    name: 'TROET',
    rolle: 'fachverfahren',
    kurz: 'Fachverfahren des LAVV, in Betrieb seit 1998, ohne Außenschnittstelle, ohne Handbuch und ohne einen einzigen Rechenfehler.',
    syntax: 'Bildschirmmasken fester Spaltenbreite. Feldname links, Wert rechts, Punkt am Zeilenende. Keine Begründung, keine Anrede, kein Adjektiv.',
    lexikon: ['Bildschirmmaske', 'Feldlänge', 'Satzart', 'Buchungskreis', 'Stapellauf'],
    verbot: 'ungefähr',
    tick: 'Schließt jede Maske mit der Zeile "SATZART 04 — ENDE".',
    stress: 'Nichts ändert sich. TROET rechnet gleich lange und gleich richtig, ob zwölf Sätze anstehen oder zwölftausend.',
  },
  {
    id: 'rauhut',
    name: 'Konrad Rauhut',
    rolle: 'auditor',
    kurz: 'Systemarchitekt der ersten Stunde, seit 2024 nicht mehr im Haus, kehrt in Akt X als externer Auditor zurück und prüft ausgerechnet die Nachvollziehbarkeit.',
    syntax: 'Handschrift statt Datei. Nummerierte Einträge, jeder mit Datum, jeder mit genau einer Randbedingung. Erklärt nie, warum ein Eintrag wichtig ist.',
    lexikon: ['Sonderfall', 'Randbedingung', 'Handzeichen', 'Nachtrag', 'Kladde'],
    verbot: 'irgendwie',
    tick: 'Nummeriert jeden Sonderfall fortlaufend und zeichnet ihn mit den Initialen K. R. ab.',
    stress: 'Die Schrift wird kleiner, die Nachträge werden länger, und die Nummerierung überholt das Datum.',
  },
];

const REGISTER: ReadonlyMap<string, Figur> = new Map(FIGUREN.map((f) => [f.id, f]));

/** Liefert die Figur zur Id. Wirft, wenn es sie nicht gibt — Tippfehler sind Fehler. */
export function figur(id: string): Figur {
  const gefunden = REGISTER.get(id);
  if (gefunden === undefined) {
    throw new Error(`Unbekannte Figur: "${id}". Bekannt: ${FIGUREN.map((f) => f.id).join(', ')}.`);
  }
  return gefunden;
}
