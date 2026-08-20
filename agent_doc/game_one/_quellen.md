# Quellen — SCHWARMWERK

Dieses Verzeichnis enthält die Produktion des Lernspiels **SCHWARMWERK — Ein Werk
in zwölf Akten** zum Thema Agentic Engineering und Orchestrierung.

Die Quellen sind nach Suchstring gruppiert. Jede Gruppe nennt die Fundstellen,
eine Zusammenfassung und das Datum der Recherche. Wo eine Quelle eine konkrete
Entscheidung im Code trägt, ist die betroffene Datei genannt — eine Quelle, die
nirgends wirkt, gehört nicht in diese Liste.

---

## Suchstring: "three.js WebGPURenderer TSL RenderPipeline post-processing GTAO red channel occlusion"

- **URL:** https://threejs.org/docs/pages/GTAONode.html
  **Zusammenfassung:** Referenz des `GTAONode`. Belegt zwei Dinge, die das
  Projekt teuer gelernt hat: Der Node ist ein Addon und muss ausdrücklich aus
  `three/addons/tsl/display/GTAONode.js` importiert werden, und die Verdeckung
  liegt **im Rotkanal**. Die kanonische Verknüpfung lautet
  `scenePassColor.mul(vec4(vec3(aoPassOutput.r), 1))`. Genau hier lag der
  teuerste Fehler der Produktion: eine Multiplikation mit der *ganzen* Textur
  löscht Grün und Blau aus und erzeugt ein reines Rotbild. Wirksam in
  `game/src/engine/renderwerk.ts`; Post-mortem in
  `belege/renderer_spike_ergebnis.md`.
  **Datum:** 2026-08-20

- **URL:** https://threejs.org/manual/en/webgpurenderer.html
  **Zusammenfassung:** Offizielles Handbuch zum `WebGPURenderer`. Belegt, dass
  der neue Post-Processing-Stack MRT eingebaut hat, dass Effektketten als
  Node-Komposition in TSL geschrieben werden und dass WebGL2 kein zweiter
  Renderer ist, sondern ein Backend derselben Klasse. Trägt die
  Grundsatzentscheidung E-01 der Produktionsbibel: ein Renderer, zwei Backends,
  kein GLSL.
  **Datum:** 2026-08-20

- **URL:** https://github.com/mrdoob/three.js/issues/28754
  **Zusammenfassung:** Diskussion zur Konfigurierbarkeit des
  Post-Processing-Ausgabepuffers. Hintergrund für
  `outputBufferType: THREE.HalfFloatType` — ohne Halbfloat bricht die
  Helligkeitsschwelle des Bloom im hohen Dynamikbereich ab.
  **Datum:** 2026-08-20

- **URL:** https://github.com/mrdoob/three.js/issues/29797
  **Zusammenfassung:** GTAO ist mit `logarithmicDepthBuffer` unverträglich.
  Grund, weshalb das Projekt beim linearen Tiefenpuffer bleibt.
  **Datum:** 2026-08-20

---

## Suchstring: "three.js physically correct lighting r155 candela useLegacyLights point light intensity units"

- **URL:** https://discourse.threejs.org/t/updates-to-lighting-in-three-js-r155/53733
  **Zusammenfassung:** Der Umstellungs-Thread zu r155. Belegt, dass der
  Legacy-Modus seit r155 standardmäßig aus ist, dass `useLegacyLights`
  abgekündigt ist und dass `color * intensity` als Lichtstärke in **Candela**
  gelesen wird. Das ist die Begründung dafür, dass die Punktlichter der Halle
  bei 26 cd stehen und nicht bei den zunächst gesetzten 55 — bei 55 brennt eine
  Halle dieser Größe vollständig aus. Wirksam in `game/src/welt/halle.ts`.
  **Datum:** 2026-08-20

- **URL:** https://threejs.org/examples/webgl_lights_physical.html
  **Zusammenfassung:** Referenzbeispiel für physikalische Lichteinheiten.
  Diente als Vergleichsmaßstab beim Einmessen der Halle auf eine mittlere
  Bildhelligkeit von 30 bis 45 von 255.
  **Datum:** 2026-08-20

---

## Suchstring: "Chrome 130 WebGL headless --enable-unsafe-swiftshader SwiftShader deprecation warning"

- **URL:** https://chromium.googlesource.com/chromium/src/+/main/docs/gpu/swiftshader.md
  **Zusammenfassung:** Chromium-Dokumentation zum Software-Rasterizer. Belegt,
  dass die SwiftShader-Rückfallebene für WebGL nur noch mit
  `--enable-unsafe-swiftshader` verfügbar ist und dass die automatische
  Rückfallebene ab M139 entfällt. Ohne dieses Flag gibt es im Testlauf gar
  keinen WebGL-Kontext — alle Bildvergleiche wären dann schwarz und stillschweigend
  grün. Wirksam in `game/playwright.config.ts` und `game/werkzeuge/browser.mjs`.
  **Datum:** 2026-08-20

- **URL:** https://groups.google.com/a/chromium.org/g/blink-dev/c/yhFguWS_3pM
  **Zusammenfassung:** „Intent to Remove: SwiftShader Fallback". Nennt den
  Sicherheitsgrund (JIT im GPU-Prozess) und bestätigt ausdrücklich, dass der
  Testbetrieb auf Maschinen ohne GPU der unterstützte Anwendungsfall des Flags
  bleibt.
  **Datum:** 2026-08-20

---

## Suchstring: "Anthropic building effective agents workflow patterns orchestrator-workers evaluator-optimizer routing"

- **URL:** https://www.anthropic.com/engineering/building-effective-agents
  **Zusammenfassung:** Die fachliche Grundlage des gesamten Spiels. Beschreibt
  fünf zusammensetzbare Muster — Prompt Chaining, Routing, Parallelisierung,
  Orchestrator-Workers, Evaluator-Optimizer — und die Leitlinie, dass die
  erfolgreichsten Umsetzungen ohne schwere Rahmenwerke auskommen. Die
  Modulnamen des Spiels bilden diese Muster eins zu eins ab: KERN (Chaining),
  WEICHE (Routing), VERTEILER/SAMMLER (Parallelisierung), PRÜFERIN
  (Evaluator-Optimizer). Der Antagonist MONOLITH ist die Verneinung des
  Leitsatzes: ein einzelner großer Kern, der alles selbst macht. Wirksam in
  `game/src/sim/katalog.ts` und in der Aktstruktur.
  **Datum:** 2026-08-20

- **URL:** https://docs.spring.io/spring-ai/reference/api/effective-agents.html
  **Zusammenfassung:** Umsetzung derselben fünf Muster in einem konkreten
  Rahmenwerk. Diente als Gegenprobe, dass die Muster implementierungsnah und
  nicht nur begrifflich unterscheidbar sind — die Voraussetzung dafür, sie als
  getrennte Bauteile zu modellieren.
  **Datum:** 2026-08-20

---

## Suchstring: "Simon Willison lethal trifecta prompt injection private data untrusted content exfiltration"

- **URL:** https://simonwillison.net/2025/Jun/16/the-lethal-trifecta/
  **Zusammenfassung:** Die Originalquelle der „lethal trifecta": Zugriff auf
  private Daten, Kontakt mit nicht vertrauenswürdigen Inhalten und die
  Möglichkeit, nach außen zu kommunizieren. Jede Fähigkeit für sich ist
  harmlos, alle drei zusammen erlauben es fremdem Text, Daten abfließen zu
  lassen. Das Spiel setzt das **nicht** als Prozentregler um, sondern als
  Graph-Invariante: liegen alle drei Bedingungen auf einem Pfad, fällt die
  Sicherheitskennzahl deterministisch auf null. Wirksam in
  `game/src/sim/graph.ts` (`lethaleTrifecta`) und in Akt VIII.
  **Datum:** 2026-08-20

- **URL:** https://www.promptfoo.dev/blog/lethal-trifecta-testing/
  **Zusammenfassung:** Prüfverfahren gegen die Trifecta. Bestätigt die
  Modellierung als architektonische Eigenschaft statt als Modellverhalten —
  und damit die Entscheidung, sie im Spiel als Eigenschaft des Graphen und
  nicht als Zufallsereignis zu prüfen.
  **Datum:** 2026-08-20

- **URL:** https://www.hiddenlayer.com/research/the-lethal-trifecta-and-how-to-defend-against-it
  **Zusammenfassung:** Verteidigungsmuster. Trägt die Rolle der WALL im Spiel:
  eine Schranke am Ausgang, nicht nur am Eingang. Ein Werk, das nur eingehend
  filtert, besteht die Sicherheitsziele ab Akt VIII nicht.
  **Datum:** 2026-08-20

---

## Suchstring: "context engineering LLM agents context rot long context degradation compaction sub-agents"

- **URL:** https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents
  **Zusammenfassung:** Kontext als Budget statt als Vorrat; Ziel ist die
  kleinste Menge tragfähiger Token. Nennt Kompaktierung und Sub-Agenten mit
  eigenen Kontextfenstern als die beiden tragenden Verfahren. Ist die
  Grundlage von Akt VII („Der Speicher") und der vier Betriebsarten des
  SPEICHER-Moduls: verdichten, abrufen, abschotten, puffern.
  **Datum:** 2026-08-20

- **URL:** https://www.morphllm.com/context-rot
  **Zusammenfassung:** Messbare Verschlechterung der Ausgabequalität mit
  wachsender Kontextlänge; in einer Untersuchung von 18 Modellen wurde
  ausnahmslos jedes schlechter, teils mit deutlichem Abfall jenseits einer
  Schwelle. Trägt die Balance-Konstanten `KONTEXT_SCHWELLE = 0.45` und
  `KONTEXT_KOSTEN_FAKTOR = 2.0` in `game/src/sim/balance.ts`: oberhalb von 45
  Prozent Füllstand verarbeitet ein Kern den Kontext nicht mehr, er schleppt
  ihn nur noch mit — und bezahlt ihn bei jedem Aufruf erneut.
  **Datum:** 2026-08-20

---

## Suchstring: "MAP-Elites illuminating search spaces quality diversity behavioural descriptor"

- **URL:** https://www.semanticscholar.org/paper/Illuminating-search-spaces-by-mapping-elites-Mouret-Clune/45373921f06a6efebefa6189d2dd80362ab0836e
  **Zusammenfassung:** Mouret und Clune, „Illuminating search spaces by mapping
  elites". Der Verhaltensraum wird in ein Raster zerlegt, jede Zelle hält das
  beste Individuum ihres Verhaltens. Entscheidend für das Spiel: Der
  Deskriptor beschreibt das **Verhalten**, nicht den Genotyp — sonst füllt sich
  das Regal mit Varianten desselben Werks. Wirksam in
  `game/src/sim/evolution.ts` (`verhaltenAus`, `baueArchiv`).
  **Datum:** 2026-08-20

- **URL:** https://arxiv.org/pdf/2003.03377
  **Zusammenfassung:** „Interactive Constrained MAP-Elites" — Untersuchung der
  Ausdrucksstärke der Merkmalsdimensionen bei interaktiver Nutzung. Bestätigt,
  dass ein Regal für Menschen nur dann lesbar ist, wenn seine Achsen
  fachlich benennbar sind. Deshalb sind die Achsen im Spiel Modulzahl und
  mittlere Durchlaufzeit je Auftrag und keine abstrakten Hauptkomponenten.
  **Datum:** 2026-08-20

---

## Suchstring: "Deb constrained dominance NSGA-II constraint handling feasible solution dominates infeasible"

- **URL:** https://www.egr.msu.edu/~kdeb/papers/k2012010.pdf
  **Zusammenfassung:** Deb u. a. zur mehrkriteriellen Optimierung mit
  Nebenbedingungen. Die Regel: x¹ dominiert x² unter Nebenbedingungen, wenn
  x¹ zulässig und x² unzulässig ist; wenn beide unzulässig sind und x¹ die
  kleinere Verletzungssumme hat; oder wenn beide zulässig sind und x¹ regulär
  dominiert. Das Spiel übernimmt genau diese Ordnung — und zwar aus einem
  didaktischen Grund: Mit einem Strafterm ließe sich ein Sicherheitsverstoß
  durch genug Ersparnis freikaufen. Genau diese Denkweise soll das Spiel
  abtrainieren. Wirksam in `game/src/sim/evolution.ts` (`vergleicheDeb`).
  **Datum:** 2026-08-20

- **URL:** https://arxiv.org/pdf/2206.13802
  **Zusammenfassung:** Übersichtsarbeit zu Verfahren der Nebenbedingungs-
  behandlung in populationsbasierten Algorithmen. Ordnet die Deb-Regel gegen
  Strafterme und Reparaturverfahren ein und begründet, warum sie für
  Aufgaben mit schwer erreichbarem zulässigem Bereich robust ist.
  **Datum:** 2026-08-20

---

## Suchstring: "Zachtronics puzzle design open-ended optimization histogram Kishotenketsu level design four act structure"

- **URL:** https://gdcvault.com/play/1025715/Open-Ended-Puzzle-Design-at
  **Zusammenfassung:** Zach Barth zur offenen Rätselgestaltung. Kernaussage:
  Rätsel ohne feste Lösung, dazu Histogramme über mehrere Kennzahlen — ohne
  dass eine Lösung dadurch zur besten erklärt würde. Trägt die härteste
  Gestaltungsregel des Projekts: Die drei Wettbewerbsachsen
  `kostenJeAuftrag`, `latenzP95` und `flaeche` werden **niemals** zu einer Zahl
  verrechnet. Es gibt keinen Score, keine Sterne, keine Währung. Wirksam in
  `game/src/ui/hud.ts` und `game/src/sim/ziele.ts`.
  **Datum:** 2026-08-20

- **URL:** https://en.wikipedia.org/wiki/Kish%C5%8Dtenketsu
  **Zusammenfassung:** Vierteilige Erzählstruktur: Einführung, Entwicklung,
  Wendung, Auflösung. Ihre Besonderheit ist die bewusste Asymmetrie — ein
  wesentliches Element wird bis zum dritten von vier Teilen zurückgehalten.
  Das Spiel überträgt das auf den Levelrhythmus: `nummer % 4` ergibt ki, sho,
  ten, ketsu, und das TEN-Level muss nachweislich die Referenzlösung des
  SHO-Levels brechen. Diese Zusicherung ist als Test formuliert, nicht als
  Vorsatz. Wirksam in `game/src/inhalt/level_typen.ts` und
  `game/tests/hilfe/level_pruefung.ts`.
  **Datum:** 2026-08-20

- **URL:** https://www.gamedeveloper.com/design/video-zachtronics-approach-to-open-ended-puzzle-design
  **Zusammenfassung:** Zusammenfassung desselben Vortrags. Nennt ausdrücklich,
  dass Zachtronics Rätsel veröffentlicht, die die Entwerfenden selbst nicht
  optimal gelöst haben. Das ist die Begründung dafür, dass jedes Level im
  Spiel **mehrere** Referenzlösungen mitbringt, von denen keine die andere
  dominieren darf, statt einer einzigen „richtigen".
  **Datum:** 2026-08-20

---

## Suchstring: "Web Audio API autoplay policy AudioContext suspended user gesture resume"

- **URL:** https://developer.chrome.com/blog/autoplay
  **Zusammenfassung:** Chromes Autoplay-Richtlinie. Ein `AudioContext`, der vor
  einer Nutzergeste entsteht, startet im Zustand `suspended`; `resume()` muss
  nach der ersten Geste gerufen werden. Trägt die erste harte Regel der
  Klangregie: Der Ton startet erst beim ersten Zeiger- oder Tastendruck, und
  bis dahin bleibt alles still, ohne dass irgendwo ein Fehler auftritt.
  Wirksam in `game/src/spiel/klangregie.ts` und `game/src/spiel/spiel.ts`
  (`bindeKlangstart`).
  **Datum:** 2026-08-20

- **URL:** https://developer.mozilla.org/en-US/docs/Web/API/AudioContext/resume
  **Zusammenfassung:** Referenz zu `resume()`. Bestätigt, dass ein wiederholter
  Aufruf unschädlich ist — die Grundlage dafür, dass `Klangregie.starte()`
  mehrfach gerufen werden darf und Fehler schluckt: ein stummes Spiel ist
  besser als ein abgestürztes.
  **Datum:** 2026-08-20

---

## Hinweis zur Vollständigkeit

Die zehn Spezialistenberichte, aus denen `belege/produktionsbibel.md`
konsolidiert wurde, sind in der Bibel selbst als Berichte 1 bis 10 referenziert
und dort inhaltlich vollständig verarbeitet. Diese Liste führt die Quellen, die
eine **im Code nachweisbare** Entscheidung tragen. Quellen, deren Aussage sich
nicht in einer Datei, einer Konstanten oder einem Test wiederfindet, sind
bewusst nicht aufgeführt — eine Literaturliste, die niemand einlösen kann, ist
keine Nachvollziehbarkeit, sondern Dekoration.
