# Memory Patterns fuer AI Agents (2025/2026)

## 1. Ueberblick

Memory ist eine der kritischsten Komponenten moderner AI Agents. Die Faehigkeit von LLMs, Informationen ueber erweiterte Sitzungen hinweg zu behalten, bleibt durch feste Context Windows und unkontrollierte Memory-Akkumulation begrenzt. Mit zunehmender Dialoglaenge werden fruehere kontextuelle Signale komprimiert oder verworfen, was zu Verlust von Persona-Konsistenz, Entity Drift und faktischer Instabilitaet fuehrt.

---

## 2. Memory-Typen

### 2.1 Short-Term Memory (In-Context Memory)

Short-Term Memory bezieht sich auf die Informationen, die im Context Window des LLM verfuegbar sind. Dies umfasst:

- Informationen aus der aktuellen Konversation
- Informationen, die aus vergangenen Konversationen eingefuegt wurden
- Aktuelle Tool-Ergebnisse und Reasoning-Schritte

Short-Term Memory ist der "Live-Context": juengste Turns, Reasoning-Outputs, Tool-Ergebnisse und abgerufene Dokumente. Dieser Raum ist **brutal endlich** und sollte schlank gehalten werden -- gerade genug Konversationshistorie, um den Thread koheaerent und Entscheidungen fundiert zu halten.

### 2.2 Long-Term Memory (Out-of-Context Memory)

Long-Term Memory bezieht sich auf Informationen, die in externem Speicher abgelegt werden, wie z.B. Vektor- oder Graph-Datenbanken. LTM dient als Wissensbasis des Agents und speichert diverse Informationen fuer zukuenftige Nutzung.

### 2.3 Episodic Memory

Episodic Memory erfasst spezifische Ereignisse und Interaktionen:
- Konversationshistorie oder Zusammenfassungen wichtiger Vorkommnisse
- Metadata wie Zeitstempel und Teilnehmer
- Beispiel: "User hat API-Dokumentation fuer Webhook-Setup angefragt"
- Temporale Marker bewahren, wann Konversationen stattfanden

### 2.4 Semantic Memory

Semantic Memory haelt extrahiertes Wissen ohne Ereignis-Context:
- Generalisiert ueber Interaktionen hinweg
- Beispiel: "User programmiert in TypeScript" oder "bevorzugt async/await gegenueber Promises"
- Keine Verknuepfung mit spezifischen Zeitstempeln

### 2.5 Procedural Memory

Procedural Memory kodiert Verhaltensmuster:
- Welche Code-Formatierung der User erwartet
- Wie mehrstufige Antworten zu strukturieren sind
- Leitet Ausfuehrungslogik statt abrufbare Fakten zu speichern

---

## 3. Memory-Architektur-Patterns

### 3.1 Static STM mit Trigger-basiertem LTM

Traditionelles Pattern, bei dem Short-Term Memory statisch verwaltet wird und Long-Term Memory durch definierte Trigger aktiviert wird.

### 3.2 Static STM mit Agent-basiertem LTM

Erweitertes Pattern, bei dem ein Agent aktiv entscheidet, wann und wie Long-Term Memory genutzt wird.

### 3.3 Unified Memory Management (Agentic Memory)

Das neueste Pattern (Januar 2026): Memory-Operationen werden als **Tool-basierte Aktionen** exponiert. LLM Agents entscheiden autonom, was und wann sie speichern, abrufen, aktualisieren, zusammenfassen oder verwerfen. Dies integriert LTM und STM Management direkt in die Agent-Policy und ermoeglicht End-to-End-Optimierung.

### 3.4 OS-inspirierte Memory-Architektur (Letta/MemGPT)

Letta (vormals MemGPT) fuehrt ein **LLM-as-Operating-System**-Paradigma ein mit drei Tiers:

1. **Core Memory** (immer im Context, wie RAM): Enthaelt persistente Informationen, die immer sichtbar sind. Diese Bloecke sind in System Instructions eingebettet und bleiben stets im Context.
2. **Archival Memory** (externer durchsuchbarer Vector Store, wie Disk): Langfristiger Speicher fuer grosse Mengen an Informationen.
3. **Recall Memory** (Konversationshistorie): Abrufbare vergangene Interaktionen.

**Virtual Context Management**: Aehnlich wie ein Betriebssystem Daten zwischen "virtuellem Speicher" (unbegrenzt) und "physischem Speicher" (begrenzt) verschiebt, verschiebt das System Daten zwischen "Virtual Context" (alle verfuegbaren Daten) und "Physical Context" (tatsaechliches Context Window).

**Self-Editing Memory**: Agents sind **aktive Teilnehmer** ihres eigenen Memory Managements. Sie rufen explizit Memory-Management-Funktionen auf, um Informationen zwischen Tiers zu verschieben.

---

## 4. Memory Frameworks (2026)

### 4.1 Mem0

- **Typ**: Open-Source, 48K+ GitHub Stars
- **Staerke**: Ausgereifteste Long-Term Memory-Loesung in 2026
- **Architektur**: Universelle Memory-Schicht fuer AI Apps
- **Besonderheit**: Ermoeglicht AI Apps, kontinuierlich aus vergangenen User-Interaktionen zu lernen
- **Performance**: Graph-Variante (Mem0g) erreicht hoechste F1 (51.55) und J (58.13) Scores bei Temporal Reasoning Tasks

### 4.2 Zep

- **Typ**: Production-grade mit Hybrid Vector+Graph-Architektur
- **Staerke**: Stark fuer langfristige Agent-Sessions
- **Architektur**: Temporal Knowledge Graph mit der Open-Source Graphiti-Bibliothek
- **Besonderheit**: Integriert Semantic und Episodic Memory mit Entity und Community Summaries
- **Performance**: Hoechste F1 (49.56) und J (76.60) Scores in Open-Domain-Settings

### 4.3 Letta (MemGPT)

- **Typ**: Platform fuer stateful Agents
- **Staerke**: OS-inspirierte Memory-Architektur mit Virtual Context Management
- **Besonderheit**: Self-Editing Memory, Agents verwalten ihren eigenen Speicher aktiv
- **Status 2026**: Unterstuetzt Skills und Subagents, bringt vorgefertigte Skills fuer Advanced Memory mit

### 4.4 LangChain/LangGraph Memory

- **Typ**: Modulare Bausteine fuer Agent-Workflows
- **Staerke**: Graph-basierter Ansatz fuer stateful Multi-Agent Applications
- **Besonderheit**: Explizites State Management und Control Flow

---

## 5. Hierarchical Summarization

Ein zentrales Pattern fuer Memory Management:

- Aeltere Konversationssegmente werden komprimiert, waehrend wesentliche Informationen erhalten bleiben
- Progressiv kompaktere Zusammenfassungen werden generiert, je aelter die Information wird
- Juengste Austausche bleiben woertlich erhalten, aeltere Inhalte werden in Zusammenfassungsform komprimiert

---

## 6. Multi-Layered Memory Architecture (2026)

Ein Forschungsthema von Maerz 2026: Experimentelle Evaluation der langfristigen Context-Retention durch geschichtete Short-Term, Working und Long-Term Memory-Systeme.

Hierarchische Memory-Architekturen sind ein **Hauptfokusbereich 2026**, die es Modellen ermoeglichen, grosse Informationsmengen ueber erweiterte Interaktionen hinweg zu verarbeiten und zu erinnern.

---

## 7. Best Practices

1. **Memory als Tool-Aktionen exponieren** -- Agents sollten autonom ueber Speichern, Abrufen und Loeschen entscheiden koennen.
2. **Hierarchische Summarization einsetzen** -- aeltere Informationen progressiv komprimieren.
3. **Drei Memory-Scopes als Standard** implementieren: Episodic, Semantic, Procedural.
4. **Virtual Context Management** nutzen (OS-inspirierter Ansatz).
5. **Context Pruning** -- veraltete oder widerspruchliche Informationen entfernen, wenn neue Details eintreffen.
6. **Wichtige Fakten extern persistieren** statt sie im Context Window mitzufuehren.
7. **Temporal Markers** fuer Episodic Memory beibehalten, um zeitliche Zuordnung zu ermoeglichen.
