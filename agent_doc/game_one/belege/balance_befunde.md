# Balance-Befunde und was daraus wurde

Beim Bau der zwölf Akte sind Eigenschaften des Simulationskerns aufgefallen, die
niemand entworfen hat. Diese Datei hält sie fest — auch die, gegen die bewusst
**nichts** unternommen wurde. Ein unerklärtes Balancing wird beim nächsten
Eingriff nämlich unweigerlich „repariert", und dabei geht die Lektion verloren,
die es zufällig getragen hat.

Alle Zahlen sind gemessen, Saat 4242, Strom 40 Aufträge im Takt 2.

---

## B-1 — Die Preisleiter kippt mit der Schwierigkeit

**Messung**

| Bau | leicht (0,1–0,35) | mittel (0,4–0,65) | schwer (0,75–0,98) |
|---|---|---|---|
| | Güte · T/A · p95 | Güte · T/A · p95 | Güte · T/A · p95 |
| 1× KOLIBRI | 0,507 · 40 · 1 | 0,374 · 40 · 1 | 0,014 · 40 · 1 |
| 2× REIHER | **0,819** · 352 · 4 | **0,811** · 352 · 4 | 0,476 · 352 · 4 |
| 1× KONDOR | 0,760 · 640 · 78 | 0,760 · 640 · 78 | **0,753** · 640 · 78 |

**Befund.** Bei leichter und mittlerer Last **dominiert** zweimal REIHER den
einen KONDOR auf allen drei Achsen: bessere Güte, halbe Kosten, ein Zwanzigstel
der Latenz. Der große Kern ist dort keine teure Alternative, sondern eine Falle.
Bei schwerer Last kehrt sich das vollständig um: 0,753 gegen 0,476, und keine
Kette mittlerer Kerne holt das auf.

**Entscheidung: unverändert lassen — und festschreiben.**

Ein Produktionsagent hat das zunächst als Fehler gemeldet („der KONDOR ist
ökonomisch nie richtig, das entwertet die beworbene Preisleiter 1:4:16"). Die
Messung zeigt, dass die Hälfte der Aussage stimmt und die andere nicht: Die
Leiter ist nicht entwertet, sie ist **schwierigkeitsabhängig**. Und genau das
ist die richtige Lektion, weil sie im Fach genauso gilt — zwei Durchgänge mit
einem mittleren Modell schlagen einen Durchgang mit dem größten, bis die Aufgabe
hart genug wird.

Festgeschrieben in `didaktischer_vertrag.test.ts` als zwei Zusicherungen:
„DOMINIERT eine Kette mittlerer Kerne den großen bei leichter Last auf allen
drei Achsen" und „KEHRT SICH das Verhältnis bei schweren Aufträgen um".

---

## B-2 — Der große Kern sättigt einen schnellen Strom

**Befund.** `KERN.dauer` ist beim KONDOR 4, der Strom liefert alle 2 Ticks. Die
Warteschlange wächst unbegrenzt; `latenzP95` misst am Ende die Länge des Staus
und nicht mehr die Architektur. Zwischen „kein Stau" (p95 ≈ 2) und „voller Stau"
(p95 ≈ 78) liegt fast nichts. Die Latenzachse ist in Akt I damit nahezu binär.

**Entscheidung: unverändert lassen.**

Das ist keine Panne, sondern die Erfahrung, um die es geht: Ein einzelner
Arbeiter skaliert nicht mit dem Eingang. Genau deshalb gibt es ab Akt V den
VERTEILER. Wer diese Zahl entschärft, nimmt Akt V seinen Anlass — und muss
zudem die Budgets aller 48 Level neu einmessen.

Festgeschrieben als „SÄTTIGT ein einzelner großer Kern einen schnellen
Auftragsstrom".

---

## B-3 — Spezialisierung wirkt auf dem größten Kern kaum

**Befund.** `SPEZIALISIERUNG_BONUS` ist additiv (0,09) und die Güte-Decke wird
auf 1,0 geklemmt. Beim KONDOR (`basisDeckel` 0,99) bleiben davon 0,01 übrig.
Spezialisierung wirkt real nur auf KOLIBRI (0,86) und REIHER (0,93).

**Entscheidung: unverändert lassen, aber im Inhalt berücksichtigt.**

Ein multiplikativer Bonus auf die verbleibende Lücke wäre technisch sauberer.
Er würde aber sämtliche Güte-Ziele verschieben. Wichtiger ist, dass die Wirkung
nicht *falsch* ist: Ein Spitzenmodell ist auf einer Fachdomäne kaum noch zu
verbessern — das ist plausibel und obendrein wahr. Akt II-3 legt seine
Fachbahnen deshalb bewusst auf REIHER aus, nicht auf KONDOR.

**Offen für eine spätere Fassung:** `deckel = basis + (1 − basis) × bonusAnteil`
statt `basis + bonus`. Dann wirkt Spezialisierung überall gleich stark
*relativ*, statt beim größten Kern zu verpuffen.

---

## B-4 — Die Weiche ist unterhalb hoher Mehrdeutigkeit fehlerfrei

**Befund.** Das Routing-Rauschen ist `0,06 + mehrdeutigkeit × 0,5 × 0,35`. Bei
`mehrdeutigkeit ≤ 0,2` liegt die Streuung unter 0,095 — die Weiche irrt sich
praktisch nie. Fehlerkosten entstehen erst ab etwa 0,5.

**Entscheidung: unverändert lassen.**

Das ist ein steiler Übergang, aber ein didaktisch nützlicher: Akt II lehrt in
den ersten Leveln „sortieren lohnt sich" auf einem sauberen Strom, und das
TEN-Level II-2 („Unscharfe Akten") dreht die Mehrdeutigkeit hoch und bricht
damit die Lösung des Vorlevels. Wäre die Kurve flach, gäbe es diesen Bruch
nicht — und der Kishotenketsu-Rhythmus des Akts hinge in der Luft.

---

## B-5 — Ein KOLIBRI-Aufruf allein reicht nie

**Befund.** Eine einzelne KOLIBRI-Bearbeitung erreicht selbst bei leichten
Aufträgen nur etwa 0,50 Güte. „Ein kleiner Kern reicht" ist also erst ab zwei
Aufrufen wahr, und jede Sparbahn kostet mindestens zwei Module.

**Entscheidung: unverändert lassen.**

Es kostet in Routing-Leveln eine Modulzeile, die didaktisch wenig beiträgt —
aber die Alternative wäre ein KOLIBRI, der bei leichter Last allein durchkommt,
und damit hätte Akt I kein Problem mehr, das zu lösen wäre.

---

## B-6 — Widerspruch in der Produktionsbibel, Abschnitt 5.4

Die Bibel fordert für die Akte I–IV, dass eine naive Direktverdrahtung
(Quelle → KONDOR → Senke) **immer** besteht (Kaizen-Prinzip: der
Pflichtteilnehmer eines Workshops kommt durch, der Enthusiast optimiert
freiwillig).

Das ist mit der ebenfalls geforderten Trade-off-Pflicht unvereinbar: In allen
vier Leveln von Akt II reißt „KONDOR für alles" das Kostenkriterium — und das
soll es auch, sonst gäbe es keinen Anlass für die Weiche.

**Entscheidung: Kaizen-Zusage gilt nur noch für Akt I.**

Ab Akt II ist der Trade-off Pflicht. Wer den Workshop-Fall abdecken will,
braucht dafür einen eigenen Modus mit gelockerten Budgets, nicht eine
Aufweichung der Level. Abschnitt 5.4 der Bibel ist damit auf Akt I begrenzt.

---

## Was daraus für künftige Eingriffe folgt

Jede Änderung an `balance.ts` verschiebt Budgets in allen 48 Leveln. Die
Reihenfolge ist deshalb nicht verhandelbar:

1. `npx vitest run tests/einheit/didaktischer_vertrag.test.ts` — bricht eine
   Lektion?
2. `npx vitest run tests/loesbarkeit/bericht_*.test.ts --reporter=verbose` —
   die gemessenen Kennzahlen aller Referenzen und Anti-Muster.
3. Budgets aus diesen Messwerten neu setzen, **nicht** schätzen.
4. `npx vitest run` und `npm run e2e`.

Besonders eng, und damit als Erstes betroffen: II-0 (Kostenziel 335 zwischen
Referenz 318 und Anti-Muster 352) und II-3 (Budget 12200 zwischen Referenz
11778 und Anti-Muster 12672).
