# Spielkonzept — SCHWARMWERK

Dieses Dokument beschreibt, **was für ein Spiel SCHWARMWERK ist und warum es so
gebaut ist**. Die Umsetzung steht in `game/`, die Prüfung in
`../verifikation/pruefstrategie.md`, die Quellen in `../_quellen.md`.

---

## 1. Der Auftrag

Erwachsene sollen Agentic Engineering und Orchestrierung lernen — nicht als
Vokabelliste, sondern als Urteilsvermögen. Zielgruppe sind Kolleginnen und
Kollegen eines deutschen IT-Dienstleisters mit privaten und öffentlichen Kunden:
Menschen, die Architekturentscheidungen treffen, Angebote kalkulieren und
gegenüber einem Vergabeamt begründen müssen, warum ein System so gebaut ist.

Solche Leute lassen sich nicht mit Punkten motivieren und nicht mit
Erklärvideos überzeugen. Sie überzeugt genau eine Sache: **ein Modell, in dem
ihre Entscheidungen messbare Folgen haben.**

---

## 2. Die Grundidee in einem Absatz

Du übernimmst Halle 3 der KONTUR Digital GmbH. Kundenvorgänge laufen als
leuchtende Pakete durch eine Anlage, die du aus Modulen baust: Modell-Kerne,
Weichen, Werkzeuge, Schranken, Sicherungen, Verteiler, Sammler, Prüferinnen,
Speicher, Wälle, menschliche Freigaben, Beobachtungspunkte. Jedes Modul kostet
Token, Ticks und Fläche. Jeder Auftrag bringt Schwierigkeit, Mehrdeutigkeit,
Vertraulichkeit und Belegpflicht mit. Am Ende eines Laufs stehen Zahlen da, und
die Zahlen sind das Urteil.

**Gegenspieler ist ein Anti-Pattern.** MONOLITH ist ein einzelner sehr großer
Kern, der alles selbst macht. Er ist nicht defekt und nicht bösartig — er war
vier Jahre lang das Beste, was die Halle hatte. Er wird nicht durch mehr Kraft
besiegt, sondern durch Zerlegung.

---

## 3. Genre und Vorbild

**Zachlike** — offenes Optimierungsrätsel nach dem Vorbild von *SpaceChem*,
*Opus Magnum* und *Shenzhen I/O*. Die entscheidende Eigenschaft dieses Genres:
Ein Rätsel hat keine feste Lösung. Es hat eine Menge von Lösungen, zwischen
denen man abwägen muss.

Daraus folgt die härteste Regel des Projekts:

> **Die drei Wettbewerbsachsen — Token je Auftrag, Latenz p95, Fläche — werden
> niemals zu einer Zahl verrechnet.**

Kein Score, keine Sterne, keine Währung, keine Bestenliste mit einem Sieger.
Güte, Sicherheit, Konformität und Belegquote sind **binäre Tore**: erfüllt oder
nicht. Wer aggregiert, kollabiert die Pareto-Front — und mit ihr die einzige
Entscheidung, die das Spiel lehren will.

Diese Regel ist keine Stilfrage. Sie ist der Unterschied zwischen „ich habe 87
Punkte" und „ich habe billiger gebaut und dafür Latenz bezahlt, und das war für
diesen Kunden richtig".

---

## 4. Aufbau: zwölf Akte, eine Mechanik je Akt

| Akt | Titel | Neue Mechanik | Lektion |
|---:|---|---|---|
| I | Die Kette | Modell-Kern in drei Größen | Modellgröße ist eine Kostenentscheidung, keine Qualitätsentscheidung |
| II | Die Weiche | Router | Wer sortiert, bevor er bezahlt, bezahlt weniger |
| III | Das Werkzeug | Rechenwerk, Bestand, Recherche, Fremddienst | Ein deterministisches Werkzeug schlägt jedes Modell bei Zahlen — und liegt danach im Kontext |
| IV | Die Sicherung | Schranke und Sicherung | Wiederholen ist kein Plan; rechtzeitig aufgeben ist einer |
| V | Der Chor | Verteiler und Sammler | Die Laufzeit eines Fan-out ist das Maximum, sein Preis die Summe |
| VI | Die Prüferin | Evaluator-Optimizer | Eine Prüfung, die selbst schätzt, verbessert im Mittel — im Einzelfall manchmal gar nichts |
| VII | Der Speicher | Verdichten, abrufen, abschotten, puffern | Kontext ist ein Budget, kein Vorrat |
| VIII | Die Wall | Eingangs- und Ausgangsfilter | Kein einzelner Filter hält alles; gestaffelt kostet Durchsatz |
| IX | Die Hand | Menschliche Freigabe | Menschen sind teuer in Latenz und billig in Haftung |
| X | Das Auge | Tracing | Was du nicht beobachtest, kannst du nicht verantworten |
| XI | Die Schmiede | Evolutionäre Suche | Du baust nicht die Anlage, du baust den Maßstab |
| XII | Monolith | keine — Ernte | Ein Monolith wird nicht abgeschaltet, sondern zerlegt |

**Genau eine neue Modulart je Akt.** Vier Level je Akt. Weiter kommt, wer drei
von vier besteht — ein einzelnes zu schweres Pflichtlevel ist die häufigste
Abbruchursache in Spielen dieser Art.

### Der Rhythmus innerhalb eines Akts: Kishotenketsu

`nummer % 4` bestimmt die Rolle:

- **ki** (Einführung) — das neue Modul isoliert, ohne Störfaktoren.
- **sho** (Verbindung) — das neue Modul trifft auf eine bekannte Mechanik.
- **ten** (Bruch) — die Schwäche des Moduls macht die bisherige Lösung ungültig.
- **ketsu** (Synthese) — alles zusammen, unter hartem Budget.

Die asymmetrische Wendung im dritten von vier Teilen ist das Merkmal dieser
Erzählform. Im Spiel ist sie **beweispflichtig**: Ein Test prüft, dass die
Referenzlösung des SHO-Levels im TEN-Level tatsächlich durchfällt. Ohne diesen
Beweis wäre der Rhythmus eine Absichtserklärung.

---

## 5. Warum ein Anti-Pattern der Gegner ist

Ein Lernspiel über Architektur braucht einen Gegner, den man nicht erschießen
kann. MONOLITH ist der ausführbar gewordene Arbeitsstil eines Kollegen, der
jahrelang jeden Prompt selbst geschrieben hat und dabei der Beste war. Was ihm
fehlt, ist keine Fähigkeit, sondern eine Fuge.

Das hat drei Konsequenzen für den Entwurf:

1. **MONOLITH liefert Kennzahlen, keine Drohungen.** In jedem Auftrag steht,
   was er mit derselben Aufgabe erreicht hat. Manchmal ist er besser als der
   erste eigene Versuch. Das soll er auch sein.
2. **Sein Angebot steht unkommentiert im Auftrag.** Es ist bequem, plausibel
   und falsch. Stünde eine Warnung daneben, wäre die Versuchung keine mehr.
3. **Er duzt bis Akt VIII und siezt ab Akt IX.** Dieser eine Pronomenwechsel
   ersetzt eine ganze Zwischensequenz.

---

## 6. Didaktik

### Lernen durch Konsequenz, nicht durch Text

Kein Level erklärt seine Lektion, bevor sie erfahrbar war. Die Reihenfolge ist
immer: bauen → laufen lassen → Zahlen sehen → verstehen, warum. Die
Reflexionsfrage kommt **nach** dem Bestehen und ist eine Frage, keine
Zusammenfassung („Ein Kern deines Werks ist so groß geblieben wie MONOLITH. Was
hat die Zerlegung dann überhaupt gebracht?").

### Jede Zusage ist ein Test

Was das Spiel behauptet, steht in `tests/einheit/didaktischer_vertrag.test.ts`
als ausführbare Behauptung — 43 Stück. Beispiele:

- Ein KOLIBRI reicht bei leichten Aufträgen und scheitert bei schweren,
  unabhängig davon, wie oft man ihn aufruft.
- Bei leichter Last **dominiert** eine Kette mittlerer Kerne den einen großen
  auf allen drei Achsen; bei schwerer Last kehrt sich das um.
- Blinde Spezialisierung ist auf einem gemischten Strom im Erwartungswert
  negativ.
- Liegen private Daten, nicht vertrauenswürdiger Inhalt und ein ungefilterter
  Ausgang auf **einem** Pfad, fällt die Sicherheit auf null — als
  Graph-Invariante, nicht als Prozentregler.

Diese Datei hat beim ersten Lauf fünf echte Balance-Fehler aufgedeckt.

### Übertragung in den Betriebsalltag

Die Modulnamen sind deutsch und beschreiben die Funktion, nicht das Werkzeug
(Weiche statt Router, Wall statt Guardrail, Auge statt Tracing, Werk statt
Pipeline). Der englische Fachbegriff steht jeweils als Untertitel dabei. Wer
das Spiel gespielt hat, erkennt das Muster im Architekturdiagramm wieder — und
umgekehrt.

Die Aufträge sind Vorgänge eines deutschen IT-Dienstleisters: Vergabeprüfung,
Systemmigration, Abrechnung, Redaktion. Die Zwänge sind echte Zwänge — DSGVO,
Vergaberecht, Betriebsrat, Belegpflicht. Rechtsbezüge bleiben unbeziffert
(„sechsstellig", „seit vorletztem Jahr"), weil ein Lernspiel, das eine falsche
Schwelle als Fakt präsentiert, bei genau der Person Glaubwürdigkeit verliert,
die es überzeugen muss.

---

## 7. Der Akt XI im Besonderen: Evolution

Akt XI dreht die Aufgabe um. Bis dahin baust du die Anlage. Ab dort baust du
den **Selektionsdruck** und lässt bauen.

Die Werkbank der Schmiede stellt drei Dinge zur Wahl: Suchziele (höchstens zwei
der vier Kennzahlen), harte Bedingungen, und den Aufwand in Individuen und
Generationen. Dann läuft eine echte evolutionäre Suche über die Parameter des
Werks — Turnierselektion, Elitismus, Inselmodell mit Migration, MAP-Elites-
Archiv, Pareto-Front statt Einzelsieger.

**Der didaktische Kern steckt in einer Auslassung.** Die harten Bedingungen sind
die Ziele des Levels — dieselben, an denen am Ende ohnehin gemessen wird. Sie
sind aber **nicht vorausgewählt.** Das Spiel weiß, was zählt, und sagt es der
Suche nicht von selbst. Wer nur auf Kosten optimiert und die Gütevorgabe nicht
zuschaltet, bekommt eine Anlage, die die Suche glänzend besteht und den Auftrag
verfehlt.

Das ist Goodharts Gesetz als Spielzug statt als Zitat. Und weil so etwas sonst
als Balancing-Fehler gemeldet wird, benennt das Spiel es beim Namen, sobald es
auftritt: „Die Suche hat die Kosten fast verdoppelt, ohne dass die Güte
nennenswert steigt. Sie erfüllt deine Kennzahl — sie löst nicht deine Aufgabe."

Nebenbedingungen werden nach Debs constrained dominance behandelt und **nicht**
als Strafterm. Der Unterschied ist didaktisch entscheidend: Mit einem Strafterm
ließe sich ein Sicherheitsverstoß durch genug Ersparnis freikaufen, und genau
diese Denkweise soll das Spiel abtrainieren.

---

## 8. Ton und Atmosphäre

Eine Backsteinhalle von 1957, nachträglich mit Technik gefüllt. Kalt in der
Fläche, warm nur dort, wo Technik arbeitet. Das Auge wird ohne Anleitung zum
Fundament in der Mitte gezogen.

**Humorvoll, aber intellektuell.** Der Ton ist trocken und beobachtend, nie
albern. Grundtechnik ist „Zitat statt Pointe": Es stehen plausible Dokumente
herum, ohne angehängte Bewertung. Die Bewertung liefert die Leserin selbst — und
zwar über Prozesse, Formulare und Anreize, niemals über die Menschen, die darin
arbeiten.

Fünf Erzählkanäle, die sich nie gegenseitig blockieren:

1. **Kalter Einstieg** — einmal je Akt, vor dem Auftrag. Beschreibt, was zu
   sehen ist, und erklärt nichts.
2. **MONOLITHs Angebot** — im Auftrag, neben seinen Zahlen.
3. **Schlusssatz** — einmal je Akt, höchstens 160 Zeichen, ohne Bewertung.
4. **Fundstücke** — Gegenstände in der Halle, vollkommen freiwillig, ohne
   Belohnung. Jedes hat ein Vorher und ein Nachher; ohne beides wäre es
   Dekoration.
5. **Rätsel** — als offene Frage im Auftrag, als Auflösung beim Aktwechsel.

---

## 9. Technische Leitentscheidungen und ihre Gründe

| Entscheidung | Grund |
|---|---|
| **Alles prozedural, keine externe Datei** | Kein CDN, kein Lizenzrisiko, kein Ladebalken. Das Spiel läuft aus einem Verzeichnis heraus, auch im abgeschotteten Behördennetz. |
| **Deterministische Simulation** | Node und Browser liefern bitgleich dasselbe. Das ist die Voraussetzung für Zeit-Debugger, Wiedergabe, Bildvergleiche — und für die Aussage „die Zahlen im Kurs stimmen mit denen zu Hause überein". |
| **Ein hashbasierter RNG ohne fortlaufenden Strom** | Reihenfolgeunabhängigkeit. Kein Ergebnis hängt daran, in welcher Reihenfolge Module ausgewertet werden. |
| **Ganzzahl-Nachschlagetabellen statt `Math.exp`** | Transzendente Funktionen sind über Plattformen hinweg nicht bitgleich. |
| **Aller Text im DOM, keiner im Canvas** | Screenreader, scharfe Schrift auf Retina, echtes Textmarkieren. |
| **Vollständige Tastaturbedienung** | Barrierefreiheit — und ein Trainer, der ohne Maus vorführen kann. |
| **Keine rechte Maustaste, kein Mittelklick** | Mac-Trackpad. Orbit liegt auf `⌥` und Ziehen. |

---

## 10. Was das Spiel bewusst NICHT tut

- **Keine Punkte, keine Sterne, keine Bestenliste mit einem Sieger.** Siehe
  Abschnitt 3.
- **Kein Zeitdruck.** Die Simulationsgeschwindigkeit ist frei wählbar bis
  60-fach, und Pausieren kostet nichts. Wer nachdenken will, soll nachdenken.
- **Kein Scheitern mit Verlust.** Ein nicht bestandener Auftrag kostet nur einen
  weiteren Versuch. Es gibt nichts zu verlieren außer der Zeit, die man
  freiwillig investiert.
- **Keine Erklärung vor der Erfahrung.** Kein Tutorial-Text sagt vorher, was
  gleich passieren wird.
- **Keine Bewertung von Menschen.** Kritisiert werden Prozesse, Formulare und
  Anreize — nie die Kolleginnen und Kollegen, die darin arbeiten. Auch nicht
  Konrad Rauhut, dessen Arbeitsstil der Gegner des Spiels ist.
