/**
 * Setzt korrekte Umlaute in deutschen Prosatexten des Quelltexts.
 *
 * WICHTIG — was NICHT angefasst wird und warum:
 *
 * Bezeichner bleiben ASCII (`guete`, `groesse`, `flaeche`, `pruefer`). Das ist
 * bewusst: Bezeichner sind kein deutscher Fliesstext, sondern Programmtext, und
 * ASCII-Bezeichner sind auf jeder Tastatur, in jedem Terminal, in jeder
 * Fehlermeldung und in jedem Suchwerkzeug zuverlaessig. Ausserdem sind mehrere
 * dieser Namen Schluessel in serialisierten Datenstrukturen — eine Umbenennung
 * waere eine Datenformataenderung, keine Rechtschreibkorrektur.
 *
 * Umlaute gehoeren dorthin, wo Menschen lesen:
 *   1. in alle Kommentare,
 *   2. in alle Zeichenketten, die Prosa enthalten (Laenge >= MINDESTLAENGE).
 *
 * Kurze Zeichenketten bleiben unangetastet, weil dort die Metrik- und
 * Modulschluessel liegen ('guete', 'quelle', 'groesse'). Diese Grenze ist der
 * ganze Trick: Prosa ist lang, Schluessel sind kurz.
 *
 * Aufruf:  node werkzeuge/umlaute.mjs [--pruefe]
 *          --pruefe aendert nichts, sondern meldet nur, was zu tun waere.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const MINDESTLAENGE = 18;

/**
 * Wortliste. Reihenfolge ist bedeutsam: laengere Formen zuerst, damit
 * "Auftraegen" nicht als "Auftraege" + "n" zerfaellt.
 */
const WOERTER = [
  ['ausschliesslich', 'ausschließlich'], ['Ausschliesslich', 'Ausschließlich'],
  ['grundsaetzlich', 'grundsätzlich'], ['Grundsaetzlich', 'Grundsätzlich'],
  ['vollstaendig', 'vollständig'], ['Vollstaendig', 'Vollständig'],
  ['selbstverstaendlich', 'selbstverständlich'],
  ['Nachvollziehbarkeit', 'Nachvollziehbarkeit'],
  ['Referenzloesung', 'Referenzlösung'], ['referenzloesung', 'referenzlösung'],
  ['Referenzloesungen', 'Referenzlösungen'],
  ['Verhaeltnis', 'Verhältnis'], ['tatsaechlich', 'tatsächlich'], ['Tatsaechlich', 'Tatsächlich'],
  ['zusaetzlich', 'zusätzlich'], ['Zusaetzlich', 'Zusätzlich'],
  ['schliesslich', 'schließlich'], ['Schliesslich', 'Schließlich'],
  ['unabhaengig', 'unabhängig'], ['Unabhaengig', 'Unabhängig'],
  ['abhaengig', 'abhängig'], ['Abhaengig', 'Abhängig'], ['abhaengt', 'abhängt'],
  ['Abhaengigkeit', 'Abhängigkeit'], ['Abhaengigkeiten', 'Abhängigkeiten'],
  ['Moeglichkeit', 'Möglichkeit'], ['moeglichst', 'möglichst'], ['moeglich', 'möglich'],
  ['Loesbarkeit', 'Lösbarkeit'], ['Loesungsweg', 'Lösungsweg'], ['Loesungswege', 'Lösungswege'],
  ['Loesungen', 'Lösungen'], ['Loesung', 'Lösung'], ['loesen', 'lösen'], ['geloest', 'gelöst'],
  ['aufgeloest', 'aufgelöst'], ['ausgeloest', 'ausgelöst'], ['loest', 'löst'],
  ['Auftraegen', 'Aufträgen'], ['Auftraege', 'Aufträge'], ['auftraege', 'aufträge'],
  ['Auftraegs', 'Auftrags'],
  ['Ausgaenge', 'Ausgänge'], ['ausgaenge', 'ausgänge'], ['Ausgaengen', 'Ausgängen'],
  ['Eingaenge', 'Eingänge'], ['eingaenge', 'eingänge'], ['Eingaengen', 'Eingängen'],
  ['Ausfaelle', 'Ausfälle'], ['Ausfaellen', 'Ausfällen'], ['ausfaellt', 'ausfällt'],
  ['Behoerde', 'Behörde'], ['Behoerden', 'Behörden'],
  ['oeffentlich', 'öffentlich'], ['Oeffentlich', 'Öffentlich'], ['oeffnet', 'öffnet'],
  ['oekonomisch', 'ökonomisch'], ['Oekonomie', 'Ökonomie'], ['oekonomische', 'ökonomische'],
  ['hoechstens', 'höchstens'], ['Hoechst', 'Höchst'], ['hoeher', 'höher'], ['hoehere', 'höhere'],
  ['erhoeht', 'erhöht'], ['Erhoehung', 'Erhöhung'], ['hoeren', 'hören'], ['gehoert', 'gehört'],
  ['Massstab', 'Maßstab'], ['massgeblich', 'maßgeblich'], ['Massnahme', 'Maßnahme'],
  ['gemaess', 'gemäß'], ['Gemaess', 'Gemäß'],
  ['Verstoesse', 'Verstöße'], ['Verstoessen', 'Verstößen'], ['Verstoss', 'Verstoß'],
  ['verstoesst', 'verstößt'],
  ['Strasse', 'Straße'], ['Fussabdruck', 'Fußabdruck'], ['Fusszeile', 'Fußzeile'],
  ['Qualitaet', 'Qualität'], ['Konformitaet', 'Konformität'], ['Realitaet', 'Realität'],
  ['Kapazitaet', 'Kapazität'], ['Intensitaet', 'Intensität'], ['Aktivitaet', 'Aktivität'],
  ['Autonomie', 'Autonomie'],
  ['Groessenordnung', 'Größenordnung'], ['Groessen', 'Größen'], ['Groesse', 'Größe'],
  ['groessere', 'größere'], ['groesser', 'größer'], ['groesste', 'größte'], ['groessten', 'größten'],
  ['Guetestufe', 'Gütestufe'], ['Guetestufen', 'Gütestufen'],
  ['Mindestguete', 'Mindestgüte'], ['Bildguete', 'Bildgüte'],
  ['Gueltigkeit', 'Gültigkeit'], ['ungueltig', 'ungültig'], ['gueltig', 'gültig'],
  ['Schluessel', 'Schlüssel'], ['schluessel', 'schlüssel'],
  ['Pruefung', 'Prüfung'], ['Prueferin', 'Prüferin'], ['Pruefer', 'Prüfer'],
  ['pruefen', 'prüfen'], ['prueft', 'prüft'], ['geprueft', 'geprüft'], ['Pruefsumme', 'Prüfsumme'],
  ['ueberpruefen', 'überprüfen'], ['Ueberpruefung', 'Überprüfung'],
  ['Flaeche', 'Fläche'], ['Flaechen', 'Flächen'], ['flaechen', 'flächen'],
  ['naemlich', 'nämlich'], ['naechste', 'nächste'], ['naechsten', 'nächsten'],
  ['spaeter', 'später'], ['spaetestens', 'spätestens'],
  ['staerker', 'stärker'], ['Staerke', 'Stärke'], ['verstaerkt', 'verstärkt'],
  ['waehrend', 'während'], ['Waehrend', 'Während'], ['waehlen', 'wählen'], ['gewaehlt', 'gewählt'],
  ['aendern', 'ändern'], ['Aenderung', 'Änderung'], ['aendert', 'ändert'], ['geaendert', 'geändert'],
  ['veraendert', 'verändert'], ['unveraendert', 'unverändert'],
  ['Erklaerung', 'Erklärung'], ['erklaert', 'erklärt'],
  ['zuverlaessig', 'zuverlässig'], ['verlaesslich', 'verlässlich'],
  ['zurueck', 'zurück'], ['Zurueck', 'Zurück'], ['rueckgaengig', 'rückgängig'],
  ['Rueckkopplung', 'Rückkopplung'], ['Rueckmeldung', 'Rückmeldung'],
  ['ueberproportional', 'überproportional'], ['ueberhaupt', 'überhaupt'],
  ['Uebersicht', 'Übersicht'], ['uebernimmt', 'übernimmt'], ['uebertragen', 'übertragen'],
  ['ueberschreitet', 'überschreitet'], ['uebrig', 'übrig'], ['ueblich', 'üblich'],
  ['ueber', 'über'], ['Ueber', 'Über'],
  ['fuehrt', 'führt'], ['Fuehrung', 'Führung'], ['ausgefuehrt', 'ausgeführt'],
  ['durchgefuehrt', 'durchgeführt'], ['eingefuehrt', 'eingeführt'], ['fuehren', 'führen'],
  ['erfuellt', 'erfüllt'], ['Erfuellung', 'Erfüllung'], ['fuellt', 'füllt'], ['Fuellstand', 'Füllstand'],
  ['fuer', 'für'], ['Fuer', 'Für'],
  ['muessen', 'müssen'], ['Muessen', 'Müssen'], ['muesste', 'müsste'],
  ['koennen', 'können'], ['Koennen', 'Können'], ['koennte', 'könnte'], ['koenntest', 'könntest'],
  ['duerfen', 'dürfen'], ['duerfte', 'dürfte'], ['darueber', 'darüber'], ['dafuer', 'dafür'],
  ['wuerde', 'würde'], ['wuerden', 'würden'], ['wuerfelt', 'würfelt'],
  ['laeuft', 'läuft'], ['laesst', 'lässt'], ['faellt', 'fällt'], ['haelt', 'hält'],
  ['traegt', 'trägt'], ['schlaegt', 'schlägt'], ['gilt', 'gilt'],
  ['waere', 'wäre'], ['waeren', 'wären'], ['haette', 'hätte'], ['haetten', 'hätten'],
  ['Hoehe', 'Höhe'], ['hoehere', 'höhere'],
  ['Laenge', 'Länge'], ['Laengs', 'Längs'], ['laengs', 'längs'],
  ['Waende', 'Wände'], ['waende', 'wände'],
  ['Traeger', 'Träger'], ['traeger', 'träger'],
  ['Koerper', 'Körper'], ['Huelle', 'Hülle'], ['Werkzeugausfaelle', 'Werkzeugausfälle'],
  ['Erloes', 'Erlös'], ['Ertraege', 'Erträge'],
  ['taeglich', 'täglich'], ['Maerz', 'März'], ['Saeule', 'Säule'], ['Saeulen', 'Säulen'],
  ['aeussere', 'äußere'], ['aeusserst', 'äußerst'], ['ausserdem', 'außerdem'],
  ['Ausserdem', 'Außerdem'], ['ausserhalb', 'außerhalb'], ['Ausserhalb', 'Außerhalb'],
  ['heisst', 'heißt'], ['Heisst', 'Heißt'], ['weiss', 'weiß'], ['schliesst', 'schließt'],
  ['schliesse', 'schließe'], ['Schliessen', 'Schließen'], ['reissen', 'reißen'], ['reisst', 'reißt'],
  ['gross', 'groß'], ['Gross', 'Groß'], ['grosse', 'große'], ['grossen', 'großen'],
  ['grosser', 'großer'], ['grosses', 'großes'],
  ['Domaene', 'Domäne'], ['Domaenen', 'Domänen'],
  ['Bedienbarkeit', 'Bedienbarkeit'],
  ['saemtliche', 'sämtliche'], ['regelmaessig', 'regelmäßig'], ['zulaessig', 'zulässig'],
  ['unzulaessig', 'unzulässig'], ['Genauigkeit', 'Genauigkeit'],
  ['Kuehlrippen', 'Kühlrippen'], ['kuehl', 'kühl'], ['Kuehlung', 'Kühlung'],
  ['Stueck', 'Stück'], ['Meisterstueck', 'Meisterstück'], ['Fundstueck', 'Fundstück'],
  ['Fundstuecke', 'Fundstücke'], ['Fundstuecken', 'Fundstücken'],
  ['zunaechst', 'zunächst'], ['naeher', 'näher'], ['Naehe', 'Nähe'],
  ['erwuenscht', 'erwünscht'], ['Wuensche', 'Wünsche'], ['wuenscht', 'wünscht'],
  ['Verfuegung', 'Verfügung'], ['verfuegbar', 'verfügbar'], ['verfuegt', 'verfügt'],
  ['ungefaehr', 'ungefähr'], ['gefaehrlich', 'gefährlich'], ['Gefaehrdung', 'Gefährdung'],
  ['erfaehrt', 'erfährt'], ['bewaehrt', 'bewährt'], ['gewaehrleistet', 'gewährleistet'],
  ['Erwaegung', 'Erwägung'], ['erwaehnt', 'erwähnt'],
  ['Schaetzung', 'Schätzung'], ['schaetzt', 'schätzt'], ['geschaetzt', 'geschätzt'],
  ['Anhaenge', 'Anhänge'], ['haengt', 'hängt'], ['zusammenhaengend', 'zusammenhängend'],
  ['Zusammenhaenge', 'Zusammenhänge'],
  ['erhaelt', 'erhält'], ['enthaelt', 'enthält'], ['verhaelt', 'verhält'],
  ['Verhaltnis', 'Verhältnis'],
  ['naiv', 'naiv'], ['aehnlich', 'ähnlich'], ['Aehnlich', 'Ähnlich'],
  ['waechst', 'wächst'], ['naechstes', 'nächstes'],
  ['Ueberblick', 'Überblick'], ['Uebergang', 'Übergang'], ['Uebernahme', 'Übernahme'],
  ['einschliesslich', 'einschließlich'], ['beschliesst', 'beschließt'],
  ['Beschluss', 'Beschluss'], ['Fluss', 'Fluss'],
  ['Praezision', 'Präzision'], ['praezise', 'präzise'], ['Praeferenz', 'Präferenz'],
  ['Praefix', 'Präfix'], ['praesent', 'präsent'],
  ['Repraesentation', 'Repräsentation'],
  ['staendig', 'ständig'], ['bestaendig', 'beständig'], ['Bestaendigkeit', 'Beständigkeit'],
  ['Zustaende', 'Zustände'], ['zustaende', 'zustände'], ['Umstaende', 'Umstände'],
  ['Abstaende', 'Abstände'], ['Widerstaende', 'Widerstände'],
  ['taeuscht', 'täuscht'], ['Enttaeuschung', 'Enttäuschung'],
];


/**
 * Wortstaemme statt ganzer Woerter. Deutsche Komposita sind unbegrenzt
 * ("Leitungsfuehrung", "Werkzeugausfaelle", "reihenfolgeunabhaengig") — eine
 * Wortliste kann sie nicht einholen, eine Stammliste schon.
 *
 * Jeder Eintrag ist so gewaehlt, dass er in deutschem Fliesstext eindeutig ist.
 * Reihenfolge: laengere Staemme zuerst.
 */
const STAEMME = [
  ['selbstverstaend', 'selbstverständ'], ['ausschliess', 'ausschließ'],
  ['unabhaeng', 'unabhäng'], ['abhaeng', 'abhäng'], ['zuverlaess', 'zuverläss'],
  ['vollstaend', 'vollständ'], ['grundsaetz', 'grundsätz'], ['zusaetz', 'zusätz'],
  ['regelmaess', 'regelmäß'], ['gemaess', 'gemäß'], ['zulaess', 'zuläss'],
  ['beruecks', 'berücks'], ['ueberpruef', 'überprüf'], ['ueber', 'über'],
  ['oeffentl', 'öffentl'], ['oeffn', 'öffn'], ['oekonom', 'ökonom'], ['oekolog', 'ökolog'],
  ['schliess', 'schließ'], ['verstoess', 'verstöß'], ['verstoss', 'verstoß'],
  ['massstab', 'maßstab'], ['massgeb', 'maßgeb'], ['massnahm', 'maßnahm'],
  ['aeusser', 'äußer'], ['ausser', 'außer'], ['heiss', 'heiß'], ['weiss', 'weiß'],
  ['gross', 'groß'], ['groess', 'größ'],
  ['fussab', 'fußab'], ['fusszeil', 'fußzeil'],
  ['pruef', 'prüf'], ['fuehr', 'führ'], ['erfuell', 'erfüll'], ['fuell', 'füll'],
  ['gefaehr', 'gefähr'], ['erklaer', 'erklär'], ['bewaehr', 'bewähr'], ['gewaehr', 'gewähr'],
  ['waehr', 'währ'], ['waehl', 'wähl'], ['erwaehn', 'erwähn'], ['erwaeg', 'erwäg'],
  ['moeg', 'mög'], ['loes', 'lös'], ['gueltig', 'gültig'], ['zurueck', 'zurück'],
  ['naechst', 'nächst'], ['naeher', 'näher'], ['naemlich', 'nämlich'], ['naehe', 'nähe'],
  ['haeng', 'häng'], ['faell', 'fäll'], ['laeuf', 'läuf'], ['laess', 'läss'],
  ['traeg', 'träg'], ['schlaeg', 'schläg'], ['haelt', 'hält'], ['haelf', 'hälf'],
  ['staend', 'ständ'], ['staerk', 'stärk'], ['schaetz', 'schätz'], ['spaet', 'spät'],
  ['muess', 'müss'], ['koenn', 'könn'], ['duerf', 'dürf'], ['wuerd', 'würd'],
  ['wuerf', 'würf'], ['waer', 'wär'], ['haett', 'hätt'],
  ['hoehe', 'höhe'], ['hoech', 'höch'], ['hoeher', 'höher'], ['erhoeh', 'erhöh'],
  ['hoer', 'hör'], ['gehoer', 'gehör'],
  ['laeng', 'läng'], ['flaech', 'fläch'], ['raeum', 'räum'], ['saeul', 'säul'],
  ['waend', 'wänd'], ['haend', 'händ'], ['laend', 'länd'], ['staedt', 'städt'],
  ['raend', 'ränd'], ['blaett', 'blätt'], ['plaetz', 'plätz'], ['saetz', 'sätz'],
  ['kaest', 'käst'], ['daempf', 'dämpf'], ['zaehl', 'zähl'], ['aehnl', 'ähnl'],
  ['taeusch', 'täusch'], ['haeufig', 'häufig'], ['laeuft', 'läuft'],
  ['kuehl', 'kühl'], ['stueck', 'stück'], ['ruecks', 'rücks'], ['rueck', 'rück'],
  ['fuer', 'für'], ['tuer', 'tür'], ['ueblich', 'üblich'], ['uebung', 'übung'],
  ['guete', 'güte'], ['muend', 'münd'], ['wuensch', 'wünsch'],
  ['verfueg', 'verfüg'], ['genueg', 'genüg'], ['unterstuetz', 'unterstütz'],
  ['schluess', 'schlüss'], ['fluess', 'flüss'], ['gefuehl', 'gefühl'],
  ['aend', 'änd'], ['veraend', 'veränd'],
  ['qualitaet', 'qualität'], ['realitaet', 'realität'], ['kapazitaet', 'kapazität'],
  ['aktivitaet', 'aktivität'], ['konformitaet', 'konformität'], ['intensitaet', 'intensität'],
  ['identitaet', 'identität'], ['stabilitaet', 'stabilität'], ['komplexitaet', 'komplexität'],
  ['praezis', 'präzis'], ['praesent', 'präsent'], ['praefer', 'präfer'],
  ['raetsel', 'rätsel'], ['maerz', 'märz'], ['taeglich', 'täglich'],
  ['behoerde', 'behörde'], ['behoerd', 'behörd'], ['stoer', 'stör'],
  ['betraeg', 'beträg'], ['ertraeg', 'erträg'], ['auftraeg', 'aufträg'],
  ['ausgaeng', 'ausgäng'], ['eingaeng', 'eingäng'], ['gaeng', 'gäng'],
  ['ausfaell', 'ausfäll'], ['anfaell', 'anfäll'], ['zufaell', 'zufäll'],
  ['kuend', 'künd'], ['gruend', 'gründ'], ['begruend', 'begründ'], ['muend', 'münd'],
  ['buerg', 'bürg'], ['wuerd', 'würd'], ['huell', 'hüll'], ['fuehl', 'fühl'],
  ['bemueh', 'bemüh'], ['gemuet', 'gemüt'], ['nuetz', 'nütz'], ['stuetz', 'stütz'],
  ['schuetz', 'schütz'], ['uebrig', 'übrig'], ['ueblich', 'üblich'],
  ['betraecht', 'beträcht'], ['naechtl', 'nächtl'], ['maessig', 'mäßig'],
  ['gefaess', 'gefäß'], ['strass', 'straß'], ['bloed', 'blöd'], ['boes', 'bös'],
  ['schoen', 'schön'], ['groebs', 'gröbs'], ['troest', 'tröst'], ['zoeger', 'zöger'],
  ['koerper', 'körper'], ['foerder', 'förder'], ['woert', 'wört'], ['erloes', 'erlös'],
  ['aermer', 'ärmer'], ['aerger', 'ärger'], ['maerkt', 'märkt'], ['staerk', 'stärk'],
  ['erwaehl', 'erwähl'], ['aeuss', 'äuß'], ['praemi', 'prämi'], ['naeh', 'näh'],
  ['auftraeg', 'aufträg'], ['betraeg', 'beträg'], ['vertraeg', 'verträg'],
  ['antraeg', 'anträg'], ['nachtraeg', 'nachträg'], ['uebertraeg', 'überträg'],
  ['domaen', 'domän'], ['saeub', 'säub'], ['tatsaech', 'tatsäch'],
];

/** Wendet die Stammersetzung mit Beachtung der Gross-/Kleinschreibung an. */
function ersetzeStaemme(text) {
  let out = text;
  for (const [von, nach] of STAEMME) {
    const gross = von[0].toUpperCase() + von.slice(1);
    const grossNach = nach[0].toUpperCase() + nach.slice(1);
    // Auch Versalien: Modulnamen im Katalog sind durchgehend gross gesetzt.
    const versal = von.toUpperCase();
    const versalNach = nach.toUpperCase();
    out = out
      .split(von).join(nach)
      .split(gross).join(grossNach)
      .split(versal).join(versalNach);
  }
  return out;
}


function ersetze(text) {
  // Zwei Bereiche bleiben unangetastet, weil dort Programmtext steht und kein
  // Fliesstext: Abschnitte in Backticks (Bezeichner, Dateinamen in Kommentaren)
  // und Ausdruecke in Template-Literalen (${...}). Der zweite Fall hat beim
  // ersten Anlauf reihenweise Bezeichner zerstoert.
  const teile = text.split(/(`[^`]*`|\$\{[^{}]*\})/);
  return teile
    .map((t) => {
      if ((t.startsWith('`') && t.endsWith('`') && t.length > 1) || t.startsWith('${')) return t;
      let out = t;
      for (const [von, nach] of WOERTER) {
        if (von === nach) continue;
        out = out.replace(new RegExp(`(?<![A-Za-z])${von}(?![A-Za-z])`, 'g'), nach);
      }
      return ersetzeStaemme(out);
    })
    .join('');
}

/**
 * Zerlegt eine TypeScript-Datei in Bereiche. Bewusst ein einfacher Scanner
 * statt eines Parsers: er muss nur Kommentare und Zeichenketten sicher
 * erkennen, nicht den Code verstehen.
 */
function bearbeite(quelle) {
  let out = '';
  let i = 0;
  const n = quelle.length;
  let geaendert = 0;

  const uebernimm = (text, alsProsa) => {
    if (!alsProsa) {
      out += text;
      return;
    }
    const neu = ersetze(text);
    if (neu !== text) geaendert++;
    out += neu;
  };

  while (i < n) {
    const c = quelle[i];
    const c2 = quelle[i + 1];

    if (c === '/' && c2 === '/') {
      const ende = quelle.indexOf('\n', i);
      const bis = ende === -1 ? n : ende;
      uebernimm(quelle.slice(i, bis), true);
      i = bis;
      continue;
    }
    if (c === '/' && c2 === '*') {
      const ende = quelle.indexOf('*/', i + 2);
      const bis = ende === -1 ? n : ende + 2;
      uebernimm(quelle.slice(i, bis), true);
      i = bis;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      const anfuehrung = c;
      let j = i + 1;
      while (j < n) {
        if (quelle[j] === '\\') {
          j += 2;
          continue;
        }
        if (quelle[j] === anfuehrung) break;
        if (anfuehrung !== '`' && quelle[j] === '\n') break; // unbeendet, Notausstieg
        j++;
      }
      const bis = Math.min(n, j + 1);
      const inhalt = quelle.slice(i + 1, bis - 1);
      // Nur Prosa anfassen. Kurze Zeichenketten sind Schluessel.
      // Prosa ist: enthaelt ein Leerzeichen, ODER enthaelt einen Grossbuchstaben
      // (Schluessel im Code sind durchgehend klein und snake_case), ODER ist
      // lang genug, um kein Schluessel sein zu koennen.
      // Pfade und Modulbezeichner sind niemals Prosa — auch dann nicht, wenn
      // sie lang sind. Der erste Anlauf hat genau daran alle Import-Pfade
      // zerstoert.
      const istPfad = /^[./@#]/.test(inhalt) || (inhalt.includes('/') && !/\s/.test(inhalt));
      const istProsa =
        !istPfad && (/\s/.test(inhalt) || /[A-ZÄÖÜ]/.test(inhalt) || inhalt.length >= MINDESTLAENGE);
      out += anfuehrung;
      uebernimm(inhalt, istProsa);
      out += quelle.slice(bis - 1, bis);
      i = bis;
      continue;
    }
    out += c;
    i++;
  }
  return { text: out, geaendert };
}

function sammleDateien(wurzel, treffer = []) {
  for (const name of readdirSync(wurzel)) {
    if (name === 'node_modules' || name === 'dist') continue;
    const pfad = join(wurzel, name);
    if (statSync(pfad).isDirectory()) sammleDateien(pfad, treffer);
    else if (name.endsWith('.ts') && !name.endsWith('.d.ts')) treffer.push(pfad);
  }
  return treffer;
}

const nurPruefen = process.argv.includes('--pruefe');
const dateien = [...sammleDateien('src'), ...sammleDateien('tests'), ...sammleDateien('werkzeuge')];
let summe = 0;
let betroffen = 0;
for (const pfad of dateien) {
  const alt = readFileSync(pfad, 'utf8');
  const { text, geaendert } = bearbeite(alt);
  if (text !== alt) {
    betroffen++;
    summe += geaendert;
    if (!nurPruefen) writeFileSync(pfad, text);
    console.log(`${nurPruefen ? 'zu aendern' : 'gesetzt'}: ${pfad} (${geaendert} Stellen)`);
  }
}
console.log(`\n${betroffen} Dateien, ${summe} Textstellen.`);
process.exit(nurPruefen && betroffen > 0 ? 1 : 0);
