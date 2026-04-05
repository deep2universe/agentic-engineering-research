# Tool-Beschreibungen und Schema-Design (JSON Schema für Tools)

## Überblick

Die Qualität von Tool-Beschreibungen und Input-Schemas hat direkten Einfluss darauf, wie zuverlässig ein LLM das richtige Tool auswählt und korrekte Parameter übergibt. Gut designte Schemas reduzieren Fehlzuweisungen um **40-60%**.

## Aufbau einer MCP Tool-Definition

Jedes MCP Tool wird durch drei Elemente definiert:

```json
{
  "name": "database_query",
  "description": "Führt eine SQL-Abfrage auf der Produktionsdatenbank aus...",
  "inputSchema": {
    "type": "object",
    "properties": { ... },
    "required": [ ... ]
  }
}
```

## 1. Tool-Name

### Konventionen
- **snake_case** oder **camelCase** (konsistent innerhalb eines Servers)
- Klar kategorisierend: Aktion + Kontext
- Der Name ist die Referenz, die das Modell beim Aufruf verwendet

### Beispiele

| Gut                    | Schlecht         | Grund                          |
|------------------------|------------------|-------------------------------|
| `database_query`       | `query`          | Zu generisch                  |
| `file_write`           | `write`          | Unklar, was geschrieben wird  |
| `git_commit_changes`   | `do_git_stuff`   | Vage, unpräzise               |
| `search_documents`     | `find`           | Fehlender Kontext             |

## 2. Tool-Beschreibung

### Struktur einer guten Beschreibung

Eine hochwertige Beschreibung enthält:

1. **Was** das Tool tut (funktionale Beschreibung)
2. **Wann** es verwendet werden soll (Anwendungsfälle)
3. **Was es nicht tut** (Abgrenzung, optional aber hilfreich)

### Beispiele

**Schlecht:**
```
"Wetterdaten abrufen"
```

**Gut:**
```
"Ruft aktuelle Wetterbedingungen für eine bestimmte Stadt ab.
Verwende dieses Tool, wenn der Nutzer nach Temperatur, Regen,
Luftfeuchtigkeit oder Vorhersage fragt. Nicht geeignet für
historische Wetterdaten -- verwende dafür weather_history."
```

**Schlecht:**
```
"Datenbankabfrage"
```

**Gut:**
```
"Führt eine schreibgeschützte SQL-SELECT-Abfrage auf der
Produktionsdatenbank aus. Geeignet für Datenanalyse und Reporting.
Unterstützt keine INSERT/UPDATE/DELETE-Operationen -- verwende
dafür database_write. Maximale Ergebnismenge: 1000 Zeilen."
```

## 3. Input Schema (JSON Schema)

### Grundstruktur

```json
{
  "type": "object",
  "properties": {
    "parameter_name": {
      "type": "string",
      "description": "Beschreibung des Parameters"
    }
  },
  "required": ["parameter_name"]
}
```

### Unterstützte Typen

| JSON Schema Type | Beschreibung                  | Beispiel                    |
|------------------|-------------------------------|-----------------------------|
| `string`         | Textuelle Werte               | Namen, Pfade, Queries       |
| `number`         | Numerische Werte (Float/Int)  | Koordinaten, Beträge        |
| `integer`        | Ganzzahlen                    | Anzahl, IDs                 |
| `boolean`        | Wahrheitswerte                | Flags, Optionen             |
| `array`          | Listen                        | Tags, IDs-Listen            |
| `object`         | Verschachtelte Objekte        | Konfiguration, Filter       |

### Validierungsmöglichkeiten

```json
{
  "type": "object",
  "properties": {
    "query": {
      "type": "string",
      "description": "SQL SELECT-Abfrage",
      "minLength": 5,
      "maxLength": 5000
    },
    "limit": {
      "type": "integer",
      "description": "Maximale Anzahl der Ergebniszeilen",
      "minimum": 1,
      "maximum": 1000,
      "default": 100
    },
    "format": {
      "type": "string",
      "description": "Ausgabeformat der Ergebnisse",
      "enum": ["json", "csv", "table"]
    },
    "tags": {
      "type": "array",
      "items": { "type": "string" },
      "description": "Filter-Tags",
      "maxItems": 10
    }
  },
  "required": ["query"]
}
```

### Required vs Optional

- **Required:** Parameter, die das Modell **immer** angeben muss
- **Optional:** Parameter mit sinnvollen Defaults
- Faustregel: So wenige Required-Parameter wie möglich, so viele wie nötig
- Wenn ein Parameter in `required` steht, priorisiert das Modell die Wert-Ermittlung

## 4. Output Schema (optional)

Seit der November-2025-Spezifikation können Tools ein **Output Schema** definieren:

```json
{
  "name": "get_user",
  "outputSchema": {
    "type": "object",
    "properties": {
      "name": { "type": "string" },
      "email": { "type": "string" },
      "role": { "type": "string", "enum": ["admin", "user", "viewer"] }
    },
    "required": ["name", "email"]
  }
}
```

- Server **muss** strukturierte Ergebnisse liefern, die dem Schema entsprechen
- Client **sollte** gegen das Schema validieren
- Ermöglicht zuverlässigeres Downstream-Processing

## 5. Design-Prinzipien

### Single Responsibility
- Jedes Tool erledigt **eine** klar abgegrenzte Aufgabe
- Lieber `search_users` + `get_user_details` als `manage_users`

### Selbstdokumentierend
- Beschreibungen und Parameter-Descriptions müssen so klar sein, dass kein zusätzliches Handbuch nötig ist
- Das LLM hat **nur** die Tool-Definition als Grundlage für seine Entscheidung

### Konsistent
- Einheitliches Namensschema über alle Tools eines Servers
- Gleiche Konzepte gleich benennen (z. B. immer `user_id`, nie mal `userId` und mal `uid`)

### Defensiv
- Input-Validierung auf Server-Seite, nicht nur im Schema
- Sinnvolle Fehlermeldungen bei ungültigen Parametern
- Timeouts und Rate-Limiting implementieren
- Keine API-Credentials in Responses leaken

### Rückgabeformat
- **Strukturierte Daten** (JSON), nicht HTML oder Fliesstext
- Klare, extrahierbare Felder
- Metadata mitliefern (IDs, Timestamps, Status)
- Genug Kontext für Folge-Tool-Aufrufe

## 6. Anti-Patterns

| Anti-Pattern                        | Problem                                    |
|-------------------------------------|--------------------------------------------|
| Zu viele Tools (>20 pro Server)     | LLM wird bei der Auswahl unsicher          |
| Vage Beschreibungen                 | Falsche Tool-Auswahl                       |
| Überlappende Tools                  | Ambiguität, inkonsistente Ergebnisse       |
| Fehlende Parameter-Descriptions     | LLM rät bei der Parameter-Befüllung        |
| Zu komplexe verschachtelte Schemas  | Höhere Fehlerrate bei der Generierung      |
| Alles als `required`                | Unnötige Halluzinationen für optionale Werte|
