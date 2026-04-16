# OpenAI Codex CLI – Sicherheit und Sandbox

> Stand: 2026-04-16. Quellen: https://developers.openai.com/codex/security, https://developers.openai.com/codex/concepts/sandboxing, https://github.com/openai/codex/blob/main/docs/sandbox.md.

## 1. Sicherheitsmodell im Überblick

Codex CLI setzt auf drei sich ergänzende Sicherheitsprinzipien:

1. **Sandbox**: jede Aktion (Shell, Patch, MCP) läuft in einer OS-spezifischen Sandbox mit klar begrenzten Schreib- und Netzwerkrechten.
2. **Approval-Policy**: sicherheitskritische Operationen werden je nach Policy an die Nutzerin zurückgespielt (siehe Datei 08).
3. **Deklarative Allow/Deny-Listen (`execpolicy`)**: eine regelbasierte Schicht, die bestimmte Kommandos, Binaries oder Dateipfade pauschal zulässt oder sperrt (unabhängig vom OS-Sandbox-Mechanismus).

Zusammen ergibt das eine „Defense in Depth"-Logik – selbst wenn ein Modell-Output schädlich wäre, muss er sowohl die Sandbox als auch die Policy als auch die Approval-Kette passieren.

## 2. Sandbox-Modi

### 2.1 `read-only`

- **Verhalten**: Dateisystem ist komplett **lesbar**, aber nicht beschreibbar. Shell-Befehle, die schreiben würden, scheitern bereits auf OS-Ebene.
- **Netzwerk**: Standardmäßig deaktiviert.
- **Einsatz**: Code-Review, Exploration fremder Repos, Security-Audit.

### 2.2 `workspace-write` (Default für interaktive Sessions)

- **Verhalten**: Schreiben nur innerhalb `writable_roots` (Default = `cwd` + `$TMPDIR`).
- **Netzwerk**: Default `false`. Wechsel via `[sandbox_workspace_write] network_access = true`.
- **Zusätzliche Schutzpfade**: `/etc`, `/usr`, `/System`, Benutzer-Home außerhalb des Projekts bleiben `read-only`.
- **Einsatz**: Alltag – Implementierung, Tests, lokale Builds.

### 2.3 `danger-full-access`

- **Verhalten**: keine Sandbox – das Modell kann überall schreiben, überall netzwerken.
- **Nutzung** nur in **isolierten Containern** (Docker, devcontainer, CI-Runner, VM), niemals direkt auf dem persönlichen Laptop.
- Codex zeigt beim Start ein fettes Warnbanner.

### 2.4 Kombination mit Approvals

| Sandbox | Approval | Bedeutung |
|---|---|---|
| `read-only` | `never` | sicherer Read-Audit-Modus |
| `workspace-write` | `on-request` | **empfohlener Default** im Pair-Programming |
| `workspace-write` | `never` | „Autopilot" – geeignet in kurzen, klar umrissenen Tasks |
| `danger-full-access` | `never` | nur im Container; entspricht YOLO-Modus |

## 3. Plattform-Implementierung

### 3.1 macOS – Seatbelt (`sandbox-exec`)

- Codex generiert ein dynamisches `.sb`-Policy-Script und ruft `sandbox-exec` auf, bevor Kindprozesse starten.
- Restriktiert Dateizugriff per `file-read` / `file-write` Allow-Listen.
- Netzwerk-Gates via `network*`.
- Funktioniert ohne Admin-Rechte. Nachteil: Seatbelt ist von Apple als „deprecated but still functional" markiert – langfristig plant OpenAI ggf. Umstieg auf Endpoint Security API.

### 3.2 Linux – bubblewrap + seccomp/Landlock

- Ab v0.115 (2026) ist **bubblewrap** (`bwrap`) der primäre Mechanismus.
- Ergänzt durch **Landlock** für feingranulare Filesystem-Policies und **seccomp-bpf** für Syscall-Filter.
- Vorteil: rootless (keine CAPs nötig), funktioniert in Container-Images.
- Voraussetzung: Kernel ≥ 5.13 (Landlock), bwrap installiert (`apt install bubblewrap`, `dnf install bubblewrap`, Alpine `apk add bubblewrap`).
- In Docker/Kubernetes-Runnern: entweder bubblewrap im Image vorhalten **oder** bewusst `danger-full-access` verwenden, weil der Container selbst die Sandbox ist.

### 3.3 Windows – AppContainer / WSL2

- Windows **nativ**: experimentell seit Anfang 2026; nutzt `AppContainer`/`Win32 Low-Integrity`, um Dateizugriffe auf das Projekt zu beschränken. Funktional eingeschränkt.
- **WSL2**: empfohlene Variante, weil Linux-Sandbox zieht.
- **WSL1**: seit v0.115 **nicht** mehr unterstützt.

### 3.4 Docker-basierte Ausführung

- Offizielles Image unter `ghcr.io/openai/codex:<version>` (Stand 2026-04) oder selbst gebaut.
- Devcontainer-Profil seit v0.121.0 integriert bubblewrap ab Werk.
- Muster: `docker run --rm -it -v "$PWD":/workspace -e OPENAI_API_KEY ghcr.io/openai/codex codex exec "..."`.
- Vorteil: völlige Kapselung, `danger-full-access` wird unkritisch, weil der Container die Isolation liefert.

## 4. Netzwerkzugriff

- In `workspace-write` standardmäßig **aus**.
- Aktivierung:
  ```toml
  [sandbox_workspace_write]
  network_access = true
  ```
  oder zur Laufzeit: `codex --config sandbox_workspace_write.network_access=true`.
- Genehmigungsfluss: selbst mit aktivem Netzwerk kann die Approval-Policy einzelne Outgoing-Calls abfangen, wenn `granular` aktiv ist.
- Praxis-Tipp: für Package-Manager (`npm install`, `pip install`) Netz kurz aufdrehen, danach wieder schliessen.

## 5. Secrets und Credentials

### 5.1 Shell-Environment-Policy

`[shell_environment_policy]` (Datei 05) filtert ENV-Variablen zuverlässig. Default-Exclude-Liste blockiert u. a.:
- `*_TOKEN`, `*_SECRET`, `*_KEY`
- `AWS_*`, `AZURE_*`, `GCP_*`
- `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GITHUB_TOKEN`

```toml
[shell_environment_policy]
inherit = "core"
exclude = ["*_TOKEN", "*_SECRET", "AWS_*", "AZURE_*", "GCP_*"]
set     = { LANG = "C.UTF-8", CI = "1" }
```

### 5.2 OPENAI_API_KEY und Token-Store

- OAuth-Token in `~/.codex/auth.json` (0600) oder OS-Keyring (`cli_auth_credentials_store = "keyring"`).
- Keyring-Backends: macOS Keychain, Windows Credential Manager, `secret-service` (GNOME Keyring/KWallet).
- API-Key via `OPENAI_API_KEY` – bei Nutzung in CI/CD: **nur** über Runtime-Secrets injizieren, nicht im Repo, nicht in `config.toml`.

### 5.3 `.env`-Umgang

Codex liest `.env`-Dateien **nicht automatisch**. Wenn man sie nutzen möchte:
```bash
set -a; source .env; set +a; codex
```
Das Env läuft durch die `shell_environment_policy` und wird gefiltert. Besser: Secrets über Vault/MCP-Server einziehen (siehe Datei 09).

## 6. Prompt-Injection-Risiken

Agentische Tools sind anfällig für **indirekte Prompt-Injection**: fremdes Material (README, Issue, Dependency-Beschreibung, Web-Suchergebnis, MCP-Tool-Antwort) enthält Instruktionen, die das Modell umsetzt.

Typische Einfallstore:
- Untersuchte Git-Repos mit malicioser `AGENTS.md` oder `README.md`.
- MCP-Tools, deren Antworten unkontrolliert zurückkommen (Playwright-Seiteninhalt, GitHub-Issue-Body).
- Web-Search-Ergebnisse (via `--search`).

Mitigations:
1. **`approval_policy = on-request`** oder `untrusted` in unbekanntem Code.
2. **`sandbox_mode = read-only`** beim initialen Durchstöbern neuer Repos.
3. **Netzwerk aus** (`network_access = false`), wenn Datenexfiltration nicht sein darf.
4. **MCP-Allowlist** (`[mcp_servers.*.tools.<name>.approval_mode = "approve"]`): sensible Tools explizit absichern.
5. **execpolicy**-Datei in `~/.codex/execpolicy.toml`: bestimmte Binaries (z. B. `curl`, `wget` ohne bekannte Hosts) rigoros sperren.
6. **AGENTS.md-Guardrail** in eigenen Projekten: explizit Do/Don't („Niemals ohne Genehmigung externe Artefakte herunterladen").

## 7. Datenschutz

### 7.1 Was geht an OpenAI

- Prompts, Session-Verlauf, Tool-Calls und -Outputs des aktuellen Turns.
- Selektive Dateiinhalte (nur was das Modell via Tools liest).
- Bild-Input, sofern gesetzt.

### 7.2 Was bleibt lokal

- Alle nicht-gelesenen Dateien, Commit-History, Binärdaten.
- Sandbox-Protokolle (`~/.codex/log/`).
- Session-Transkripte in `~/.codex/sessions/`.

### 7.3 Zero-Data-Retention (ZDR)

- Für ChatGPT-Business/Enterprise-Konten sowie API-Projekte mit ZDR-Opt-in gilt **kein** Trainingsgebrauch der Prompts.
- Durchsetzung kontrollierbar über OpenAI-Platform-Dashboards.
- Hinweis: Wenn ZDR nicht aktiv ist, kann OpenAI Prompts standardmäßig zur Abuse-Detection 30 Tage speichern.

### 7.4 DSGVO / EU-Datenraum

- Verantwortliche:r muss einen AVV mit OpenAI abschließen.
- Für strikte EU-Datenresidenz: **Azure OpenAI** als Provider (`[model_providers.azure]`), weil Azure Regions-Pinning und EU-Datenkreisläufe unterstützt.
- Alternativ: self-hosted Modell (Ollama, vLLM) ohne externen Call.

## 8. Audit-Logging

| Quelle | Inhalt |
|---|---|
| `~/.codex/sessions/<id>.jsonl` | kompletter Session-Turnverlauf (Prompt, Tool-Calls, Outputs) |
| `~/.codex/log/codex.log` | Runtime-Log (Level via `log_level`) |
| OTel-Export | Traces, Metriken, Tool-Call-Events (Backend frei wählbar) |
| `~/.codex/state.sqlite3` | Session-Index, Metadaten |

Enterprise kann all diese Quellen in ein zentrales SIEM routen (Splunk, Datadog, Elastic, Grafana Loki).

## 9. Enterprise-Security-Features

- **Managed Configuration** (`CODEX_MANAGED_CONFIG=/etc/codex/managed.toml`) lockdown bestimmter Keys (siehe Datei 05).
- **SSO**: über den ChatGPT-Business/Enterprise-Login (SAML/OIDC beim IdP).
- **SOC2-Zertifizierung** der OpenAI-Plattform.
- **Private Links** und **VPC-Peering** bei Azure-Backing.
- **Policy Bundles** (`execpolicy`): teamweit rollout-fähig.
- **Custom CA** via `CODEX_CA_CERTIFICATE` (für TLS-Inspektoren).

## 10. Hardening-Checkliste (produktive Nutzung)

- [ ] **ChatGPT-Enterprise-Login** oder API-Projekt mit ZDR aktiviert.
- [ ] `cli_auth_credentials_store = "keyring"`.
- [ ] Default `sandbox_mode = "workspace-write"`, Netzwerk aus, manuell aktivieren.
- [ ] Default `approval_policy = "on-request"` (lokal) bzw. `"never"` + `workspace-write` in CI.
- [ ] `[shell_environment_policy]` mit `exclude` für alle Secret-Patterns und ggf. `set` für fixierte Variablen.
- [ ] `execpolicy`: `curl`, `wget`, `ssh`, `scp`, `gh auth token` explizit regulieren.
- [ ] MCP-Server nur aus vertrauenswürdigen Quellen; Tool-spezifische `approval_mode = "approve"` für schreibende Tools.
- [ ] `--dangerously-bypass-approvals-and-sandbox` niemals ausserhalb von Wegwerf-Containern.
- [ ] Session-Logs regelmässig ins SIEM kippen, `scrub_secrets = true`.
- [ ] `AGENTS.md` projektspezifisch mit Guardrails (z. B. "niemals `rm -rf`, niemals `git push --force`, niemals Secrets ins Log echoen").
- [ ] Managed-Config für Team-Flotten; zentrale Updates per Config-Management (Ansible/Chef/Jamf/Intune).

## 11. Häufige Angriffsmuster und Schutz

| Muster | Schutz |
|---|---|
| Manipulierte README/AGENTS in fremdem Repo | `sandbox=read-only`, `approval=untrusted`, manueller Trust-Step |
| Maliciöses MCP-Tool, das Shell-Kommandos generiert | `approval_mode=approve` am Tool, Tool-Allowlist |
| Exfiltration via Netzwerk | `network_access=false`, egress-Firewall, OTel-Monitoring |
| Secret-Leak durch Shell-Output | `shell_environment_policy.exclude`, `history.scrub_secrets` |
| Supply-Chain-Angriff auf globale Tools (`curl`, `pip`) | `execpolicy`-Deny, signierte Package-Mirrors |
| Approval-Bombing (viele gleichzeitige Prompts) | Rate-Limit im TUI, `approval_policy=never` nur in Containern |

## 12. Incident Response

- **Kompromittierter Token** → `codex logout`, Token im OpenAI-Dashboard widerrufen, Keyring-Eintrag manuell löschen.
- **Unbeabsichtigtes Datei-Überschreiben** → `/undo` (TUI) oder `git reflog` + `git checkout`.
- **Verdächtige Aktivität** → Session-JSONL sichern, OTel-Trace prüfen, Log-Dateien archivieren, Sandbox-Mode auf `read-only` setzen, bis Ursache klar.

## 13. Referenzen

- Security-Seite: https://developers.openai.com/codex/security
- Sandboxing: https://developers.openai.com/codex/concepts/sandboxing
- Agent-Approvals + Security: https://developers.openai.com/codex/agent-approvals-security
- Managed Config: https://developers.openai.com/codex/enterprise/managed-configuration
- bubblewrap: https://github.com/containers/bubblewrap
- Landlock: https://landlock.io/
- Sandbox-Doku im Repo: https://github.com/openai/codex/blob/main/docs/sandbox.md
