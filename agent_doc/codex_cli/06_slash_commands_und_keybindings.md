# OpenAI Codex CLI – Slash-Commands und Keybindings

> Stand: 2026-04-16. Quellen: https://developers.openai.com/codex/cli/slash-commands, https://github.com/openai/codex/blob/main/docs/slash_commands.md, eigene Verifikation gegen v0.121.0.

## 1. Slash-Commands in der TUI

Alle TUI-Slash-Commands (Eingabe beginnt mit `/`):

| Command | Wirkung |
|---|---|
| `/init` | erzeugt ein projektweites `AGENTS.md`-Gerüst im aktuellen Repo (analysiert Sprache, Tests, Build) |
| `/status` | zeigt Session-Info: Modell, Profil, Approval/Sandbox, Provider, Token-Usage, aktive MCPs |
| `/model [name]` | wechselt Modell (`/model gpt-5.3-codex`); ohne Argument Auswahl-Menü |
| `/approvals [mode]` | Approval-Policy während Session umschalten (`untrusted`, `on-request`, `never`, `granular`) |
| `/sandbox [mode]` | Sandbox-Mode live wechseln (`read-only`, `workspace-write`, `danger-full-access`) |
| `/clear` | Session beenden und neues Gespräch in derselben TUI starten |
| `/compact` | Kontext zusammenfassen und Verlauf kürzen, um Token-Budget zu schonen |
| `/resume` | frühere Session auswählen und fortsetzen |
| `/new` | neue Session – alter Verlauf bleibt erhalten |
| `/diff` | aktuellen Git-Diff (Working Tree) im TUI anzeigen lassen |
| `/undo` | letzten Patch rückgängig machen (oder auf bestimmte Turn-ID zurücksetzen) |
| `/review` | strukturierter Review-Prompt auf aktuellem Diff oder PR (agentischer Review-Modus) |
| `/mcp` | zeigt verfügbare MCP-Server + -Tools; `/mcp reload` lädt Server neu |
| `/prompts` | listet eingelesene Custom-Prompts (`.codex/prompts/` und `~/.codex/prompts/`) |
| `/memory` | Gedächtnis-Mode steuern (`/memory on|off|reset`, seit v0.121.0) |
| `/help` | Übersicht aller Commands |
| `/logout` | Credentials entfernen |
| `/quit` oder `/exit` | TUI beenden |

### 1.1 Argumente

Viele Commands akzeptieren Argumente: `/model gpt-5.3-codex`, `/approvals never`, `/sandbox read-only`. Ohne Argument erscheint meist ein interaktives Auswahlmenü.

### 1.2 Custom Slash-Commands

Jede Markdown-Datei in `.codex/prompts/<name>.md` oder `~/.codex/prompts/<name>.md` wird als `/name` registriert. Inhalte sind Prompt-Templates mit Platzhaltern:

```markdown
<!-- .codex/prompts/add-test.md -->
Schreibe Tests für {{args}}.

Anforderungen:
- vitest, kein weiteres Framework
- Coverage ≥ 90 % auf der Zieldatei
- keine Netzwerk-Calls, nur lokale Fixtures
```

Aufruf in der TUI:
```
/add-test src/utils/parse.ts
```

Platzhalter:
- `{{args}}` – gesamter Rest-String hinter dem Command-Namen
- `{{arg1}}`, `{{arg2}}` – gesplittete Argumente (sofern unterstützt)
- `{{cwd}}`, `{{branch}}`, `{{user}}` – Meta-Informationen

## 2. Keybindings in der TUI

| Taste / Chord | Wirkung |
|---|---|
| `Enter` | Prompt absenden (im Single-Line-Modus) |
| `Ctrl+J` | Zeilenumbruch im Prompt |
| `Esc` | Aktuelle Anfrage abbrechen / Approval ablehnen |
| `Ctrl+C` | doppelt drücken, um TUI zu verlassen |
| `Ctrl+D` | TUI beenden (wenn Eingabefeld leer) |
| `Tab` | Vervollständigung (Commands, Profile, Modelle) |
| `Shift+Tab` | Approval-Mode während Approval-Popup zyklen |
| `Ctrl+R` | Prompt-History-Suche (seit v0.121.0) |
| `Ctrl+L` | Bildschirm/Scrollback leeren (TUI redraw) |
| `Ctrl+U` | aktuelle Prompt-Zeile löschen |
| `Ctrl+W` | letztes Wort im Prompt löschen |
| `Pfeil hoch/runter` | History blättern |
| `PgUp/PgDn` | Scrollback |
| `Ctrl+B` | Scrollback-Modus (Lesen großer Ausgaben) |
| `Ctrl+Y` | TUI pausieren (nützlich in `screen`/`tmux`) |
| `Ctrl+Z` | Terminal-Suspend (Standardverhalten) |

### 2.1 Approval-Popup-Keys

Während ein Approval-Popup angezeigt wird, stehen folgende Kürzel zur Verfügung:

| Taste | Wirkung |
|---|---|
| `y` / `Enter` | Einmal genehmigen |
| `a` | Für gesamte Session genehmigen |
| `n` / `Esc` | Ablehnen |
| `e` | Kommando **e**ditieren, bevor es ausgeführt wird |
| `Shift+Tab` | Mode wechseln (Approve once / Approve session / Deny) |

## 3. Bild-Input in der TUI

- **Drag & Drop**: Bilddatei ins Terminalfenster ziehen (funktioniert mit iTerm2, WezTerm, Kitty, Ghostty).
- **Clipboard-Paste**: `Ctrl+V` (oder `Cmd+V` auf macOS) bei kopiertem Bild.
- **Prompt-Argument**: `/image pfad.png` (bzw. per Flag `codex --image ui.png`).

Jedes Bild wird in die aktuelle Anfrage eingebettet und an das Modell geschickt.

## 4. Cheat-Sheet

### 4.1 „Die Top 10"

1. `Ctrl+R` – blitzschnell alte Prompts wiederfinden.
2. `/compact` – bevor der Kontext explodiert.
3. `/sandbox workspace-write` + `/approvals on-request` – gute Defaults.
4. `Shift+Tab` im Approval – Modus wechseln, ohne neu zu starten.
5. `/diff` – letzten Stand mit Git abgleichen.
6. `/undo` – letzten Patch zurückziehen.
7. `/status` – schnelles Debug: Welches Modell und Profil läuft?
8. `Esc` – Modelllauf abbrechen, wenn er in die falsche Richtung geht.
9. `/prompts` – eigene Templates auflisten.
10. `/memory off` – in heikleren Projekten bewusst deaktivieren.

### 4.2 Mnemonics

- **I**nit ⇒ AGENTS.md.  
- **C**lear ⇒ vergiss alles.  
- **C**ompact ⇒ fasse zusammen.  
- **R**eview ⇒ kritischer Blick aufs Diff.  
- **U**ndo ⇒ Rückgängig.  

## 5. Accessibility

- `--screen-reader` beim Start deaktiviert Animationen, ANSI-Spielereien und Banner, sodass Screenreader (NVDA, VoiceOver, Orca) den Inhalt vorlesen können.
- `NO_COLOR=1` schaltet Farben ab (alternative zu `--color never`).
- Monochrome Chat-Composer (`[tui] alternate_screen = false`) kann für einige Terminals stabiler sein.

## 6. Non-interactive `codex exec` – Äquivalente zu Slash-Commands

Auch ohne TUI gibt es Entsprechungen:

| TUI-Command | `exec`-Äquivalent |
|---|---|
| `/init` | `codex exec "Erzeuge AGENTS.md für das aktuelle Repo"` |
| `/review` | `codex exec "Review den aktuellen Diff" --ask-for-approval never --sandbox read-only` |
| `/diff` | `git diff \| codex exec --json -` (stdin-Prompt) |
| `/compact` | in exec nicht nötig, weil Session kurzlebig ist |
| `/model` | `codex exec --model gpt-5.3-codex` |

## 7. Referenzen

- Slash-Commands: https://developers.openai.com/codex/cli/slash-commands
- TUI-Design: https://github.com/openai/codex/blob/main/docs/tui-alternate-screen.md
- Keybindings-Diskussionen: https://github.com/openai/codex/issues?q=keybinding
