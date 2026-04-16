# OpenAI Codex CLI – Übersicht und Grundlagen

> Stand: 2026-04-16. Bezugsobjekt: das **neue OpenAI Codex CLI** (Open-Source, Rust-basiert, Apache‑2.0), nicht zu verwechseln mit dem alten Codex‑Modell von 2021 oder anderen Tools wie GitHub Copilot CLI, Claude Code, Cursor oder Aider.

## 1. Was ist Codex CLI?

Codex CLI ist OpenAIs **lokal laufender, agentischer Coding‑Assistent für das Terminal**. Er kann ein Repository inspizieren, Dateien lesen und schreiben, Shell‑Befehle ausführen und ganze Aufgaben weitgehend autonom erledigen – jeweils unter konfigurierbarer Sandbox‑ und Approval‑Kontrolle. Codex CLI nutzt die OpenAI **Responses API** als Backend und ist als kompaktes Rust‑Binary ohne Laufzeit‑Abhängigkeiten verteilt (https://github.com/openai/codex).

Offizielle Definition aus der README: *"Codex CLI is a coding agent from OpenAI that runs locally on your computer. It can inspect your repository, edit files, and run commands."* (https://github.com/openai/codex)

### Abgrenzung zu „Codex" 2021

| Begriff | Bedeutung | Aktiv? |
|---|---|---|
| **Codex (2021)** | Ein in 2021 von OpenAI veröffentlichtes Code‑Modell, Basis der ersten GitHub‑Copilot‑Generation. Über die API 2023 deprecated. | nein (deprecated) |
| **Codex CLI (2025/2026)** | Open‑Source Terminal‑Agent mit eigener Modellfamilie (GPT‑5/5.x‑Codex), Sandboxing, MCP. | ja (aktiv, GA) |
| **Codex Cloud** | Die in ChatGPT integrierte Cloud‑Variante des Codex‑Agents („Tasks"), läuft in containerisierten Umgebungen. | ja (aktiv) |
| **Codex IDE Extension** | VS Code/Cursor/Windsurf‑Erweiterung, teilt Agent und Konfiguration mit dem CLI. | ja (aktiv) |

Der Name „Codex" wurde bewusst recycelt; die heutige Marke bezeichnet die **agentische Produktfamilie**, nicht mehr das alte Modell. Das Modell hinter dem Agenten ist heute typischerweise ein Mitglied der **GPT‑5‑Codex‑Reihe** (siehe Datei 03).

## 2. Geschichte und Releases

### Zeitlicher Abriss

| Datum | Ereignis |
|---|---|
| 2025-04-16 | Erste Veröffentlichung als TypeScript/Node‑Implementierung mit React‑basiertem `ink`‑TUI; npm‑Paket `@openai/codex` erscheint, Apache‑2.0‑Lizenz. |
| 2025-05-30 | Ankündigung des Rust‑Rewrites. Erste Beta verfügbar via `npm i -g @openai/codex@native` (https://www.infoq.com/news/2025/06/codex-cli-rust-native-rewrite/). |
| 2025-06 / 2025-07 | Schrittweiser Rollout der Rust‑Version, Parität mit der TypeScript‑Version, Homebrew‑Cask wechselt auf Rust‑Binary; Version 0.2.0 markiert die offizielle Umstellung. |
| 2025-09 | Veröffentlichung des Modells **GPT‑5‑Codex** als Standard‑Modell für ChatGPT‑Login‑Nutzer. |
| 2025-12 | Rust‑Version wird auch für npm‑Installation der Default; TypeScript‑CLI wird formal eingestellt (https://mer.vin/2025/12/ai-cli-tools-comparison-why-openai-switched-to-rust-while-claude-code-stays-with-typescript/). |
| 2026-02-05 | **GPT‑5.3‑Codex** veröffentlicht, „most capable agentic coding model to date", 25 % schneller als 5.2‑Codex (https://openai.com/index/introducing-gpt-5-3-codex/). |
| 2026-03-19 | v0.116.0 mit Enterprise‑Features (https://www.augmentcode.com/learn/openai-codex-cli-enterprise). |
| 2026-04-15 | Aktuelle stabile Version **v0.121.0** (Marketplace‑Installs, Ctrl+R‑History, Memory‑Mode, Realtime‑API‑Erweiterungen, devcontainer‑Profil mit bubblewrap). |

> Quelle Releases: https://github.com/openai/codex/releases (Stand 2026-04-16: 640+ getaggte Releases).

### Lizenz und Community

- **Lizenz:** Apache‑2.0 (https://github.com/openai/codex).
- **Sprachverteilung:** ca. **94,9 % Rust**, kleinere Anteile TypeScript (für IDE‑Bridge / SDKs) und Build‑Skripte.
- **Repo‑Größe (Stand 2026-04):** ≈ 67k Stars, 9k Forks, 400+ Contributors. Damit eines der meistbeachteten Open‑Source AI‑Dev‑Tools.

## 3. Zielgruppen und Einsatzzwecke

Codex CLI ist für drei klar erkennbare Nutzungsmuster gebaut:

1. **Interaktiver Terminal‑Coder.** Entwickler:innen rufen `codex` in einem Repo auf und bearbeiten Aufgaben dialogisch in einem Ratatui‑basierten TUI – inkl. Diff‑Vorschau, Approval‑Prompts und Slash‑Commands.
2. **Headless Agent für CI/CD.** Über `codex exec "<prompt>"` lässt sich Codex nicht‑interaktiv in Pipelines einbetten. Die offizielle GitHub Action `openai/codex-action@v1` verpackt diesen Modus für Reviews, Patches und Migrationen (https://developers.openai.com/codex/github-action).
3. **Backbone in Multi‑Agent‑Systemen.** Codex kann selbst als **MCP‑Server** laufen (`codex mcp`) und stellt Tools wie `codex()` und `codex-reply()` bereit, die etwa vom OpenAI Agents SDK aus genutzt werden (https://developers.openai.com/codex/guides/agents-sdk).

Typische Einsatzzwecke laut Doku, Cookbook und Praxisberichten:
- Refactorings, Bugfixes, Bibliotheks‑Upgrades in großen Codebasen.
- Generierung & Pflege von Tests.
- Repo‑Onboarding („was tut dieses Repo?") und Migrations‑Tasks.
- Automatisches PR‑Review und CI‑Quality‑Gates per GitHub Action.
- Lokale Skripting‑/Ops‑Tasks unter Sandbox‑Schutz.

## 4. Beziehung zu ChatGPT, Codex Cloud, IDE‑Extension, GitHub Action

Codex CLI ist eines von **vier Frontends** desselben Codex‑Agentensystems – sie teilen Modell‑Backend (Responses API), Konfiguration und in weiten Teilen die Tool‑Schnittstellen:

| Oberfläche | Zweck | Beziehung zum CLI |
|---|---|---|
| **Codex CLI** | Lokales Terminal‑Tool. | Referenz‑Implementierung. |
| **Codex IDE Extension** (VS Code, Cursor, Windsurf, JetBrains) | Inline‑Agent in der IDE. | Nutzt denselben Agent‑Kern und liest dieselbe `~/.codex/config.toml` (https://developers.openai.com/codex/ide). |
| **Codex Cloud** (in ChatGPT Plus/Pro/Business/Edu/Enterprise) | Asynchrone Tasks in Cloud‑Sandboxes, mit Pull‑Requests als Output. | Eigene Ausführungsumgebung; CLI ist die *lokale* Variante des gleichen Agents. |
| **Codex GitHub Action** (`openai/codex-action@v1`) | CI/CD‑Wrapper. | Installiert das CLI im Runner und ruft `codex exec` auf. |

Der **ChatGPT‑Login** (siehe Datei 02) verbindet alle vier Oberflächen mit demselben Konto und denselben Plan‑Quoten; dieselben Credits aus ChatGPT Plus/Pro/Business/Edu/Enterprise gelten überall (https://help.openai.com/en/articles/11369540-using-codex-with-your-chatgpt-plan).

## 5. Hauptversprechen

Aus den offiziellen Materialien lassen sich fünf zentrale Versprechen ableiten:

1. **Lokal & Offline‑freundlich.** Code, Filesystem‑Zugriff und Tool‑Ausführung passieren auf der Maschine der Nutzer:in. Nur Modellaufrufe gehen an OpenAI (https://github.com/openai/codex).
2. **Sandbox by default.** macOS via **Seatbelt**, Linux via **Landlock/seccomp** bzw. ab v0.115 **bubblewrap**, Windows experimentell via **AppContainer** – mit Modi `read-only`, `workspace-write`, `danger-full-access` (https://developers.openai.com/codex/concepts/sandboxing).
3. **Approval‑Modi explizit.** `untrusted`, `on-request`, `never`, `granular` (frühere `on-failure` ist deprecated) erlauben kalibrierten Mensch‑in‑der‑Schleife‑Betrieb (https://developers.openai.com/codex/agent-approvals-security).
4. **Erweiterbar via MCP.** STDIO‑ und Streaming‑HTTP‑MCP‑Server lassen sich pro Projekt oder global einbinden; parallele Tool‑Calls und OAuth gegen MCP‑Server werden unterstützt (https://developers.openai.com/codex/mcp).
5. **Open Source, Apache‑2.0.** Forks und Eigenbauten sind ausdrücklich möglich; Custom‑Provider (Azure OpenAI, OpenRouter, lokale Inferenz) lassen sich über `model_providers` in `config.toml` definieren.

## 6. Aktueller Versionsstand (Stand 2026-04-16)

| Distribution | Version | Quelle |
|---|---|---|
| GitHub Releases (stable) | **v0.121.0** (2026‑04‑15) | https://github.com/openai/codex/releases |
| GitHub Releases (alpha) | v0.122.0‑alpha.1 (2026‑04‑15) | ebd. |
| npm `@openai/codex` | 0.121.0 (latest) | https://www.npmjs.com/package/@openai/codex |
| Homebrew Cask `codex` | spiegelt GitHub Release | `brew info --cask codex` |

Highlights der jüngeren Releases:
- **v0.121.0 (2026‑04‑15):** Marketplace‑Installation für Plugins (GitHub, Git‑URLs, lokale Verzeichnisse); TUI Prompt‑History mit Ctrl+R; Memory‑Mode‑Steuerung und Reset; MCP/Plugin mit parallelen Tool‑Calls; Realtime‑API‑Erweiterungen; sicheres devcontainer‑Profil mit **bubblewrap**.
- **v0.116.0 (2026‑03‑19):** Enterprise‑Features (https://www.augmentcode.com/learn/openai-codex-cli-enterprise) – u. a. erweiterte Auth‑Optionen, Proxy‑/CA‑Handling.
- **v0.115:** Linux‑Sandbox auf bubblewrap migriert (Folge: WSL1‑Support entfällt) (https://codex.danielvaughan.com/2026/04/01/codex-cli-windows-native-sandbox-wsl/).

## 7. Kurz‑Glossar (für die folgenden Dokumente)

- **AGENTS.md** – Markdown‑Kontextdatei (global in `~/.codex/AGENTS.md`, projektweit im Repo, lokal pro Verzeichnis), die Codex *vor jeder Arbeit* einliest. Mit `AGENTS.override.md` lassen sich Defaults überschreiben (https://developers.openai.com/codex/guides/agents-md).
- **Profile** – Benannte Presets in `config.toml`, kombinieren `model`, `model_provider`, `approval_policy`, `sandbox_mode`, `model_reasoning_effort` etc.
- **MCP** – Model Context Protocol; standardisierte Tool‑Schnittstelle, die Codex sowohl als Client als auch (experimentell) als Server unterstützt.
- **Responses API** – die HTTP‑API von OpenAI, über die Codex CLI die Modelle anspricht. Ersetzt seit GPT‑5 die alte Chat‑Completions‑Semantik für agentische Workflows.
- **Codex Cloud** – ChatGPT‑seitiger Codex‑Agent mit eigener Container‑Sandbox.
- **CODEX_HOME** – Umgebungsvariable, die das Konfigurations‑/State‑Verzeichnis von Codex setzt (Default: `~/.codex`).

## 8. Referenzen (Auswahl)

- GitHub Repo: https://github.com/openai/codex
- Releases: https://github.com/openai/codex/releases
- npm Paket: https://www.npmjs.com/package/@openai/codex
- Offizielle Doku: https://developers.openai.com/codex und https://developers.openai.com/codex/cli
- Rust‑Rewrite Diskussion: https://github.com/openai/codex/discussions/1174
- InfoQ‑Bericht zum Rewrite (2025‑06): https://www.infoq.com/news/2025/06/codex-cli-rust-native-rewrite/
- Ankündigung GPT‑5.3‑Codex: https://openai.com/index/introducing-gpt-5-3-codex/
