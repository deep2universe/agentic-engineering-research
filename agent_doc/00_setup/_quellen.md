# Quellen

Hinweis: Der Großteil der Ergebnisse stammt aus **praktischen Tests in der Sandbox** (Kommandos und
Ausgaben, siehe Skripte). Die folgenden Web-Quellen dienten zur Bestätigung der Workarounds.

## Suchstring: "kubelet failCgroupV1 cgroup v1 kubernetes 1.35 fail-cgroupv1 flag"

- **URL:** https://kubernetes.io/blog/2026/10/06/kubernetes-cgroups-v2-shift/
  **Zusammenfassung:** Kubernetes-Blog: Kubelet startet ab `failCgroupV1=true` (Default seit 1.35) nicht mehr auf cgroup-v1-Nodes; Override `failCgroupV1: false` als temporäre Maßnahme. Grundlage für Workaround #2.
  **Datum:** 2026-10-15

- **URL:** https://kubernetes.dev/resources/keps/5573
  **Zusammenfassung:** KEP-5573 „Remove cgroup v1 support“ – Optionen: Migration auf cgroup v2 (empfohlen) oder explizit `FailCgroupV1=false`.
  **Datum:** 2026-10-15

- **URL:** https://sysdig.com/blog/kubernetes-1-35-whats-new
  **Zusammenfassung:** Überblick Kubernetes 1.35; cgroup-Version prüfen mit `stat -fc %T /sys/fs/cgroup`.
  **Datum:** 2026-10-15

## Suchstring: "containerd restrict_oom_score_adj CRI config"

- **URL:** https://github.com/cpuguy83/containerd/blob/main/docs/cri/config.md
  **Zusammenfassung:** CRI-Config-Doku: `restrict_oom_score_adj` begrenzt den OOM-Score-Adj von Containern auf den Wert von containerd – gedacht für Umgebungen ohne Recht, OOMScoreAdj zu senken. Grundlage für Workaround #3.
  **Datum:** 2026-10-15

- **URL:** https://github.com/containerd/cri/blob/2fc62db8146ce66f27b37306ad5fda34207835f3/docs/config.md
  **Zusammenfassung:** Ältere CRI-Doku mit derselben Option unter `[plugins.cri]` (Tabellenname versionsabhängig; containerd 2.x: `io.containerd.cri.v1.runtime`).
  **Datum:** 2026-10-15

- **URL:** https://containerd.io/docs/1.7/cri/config/
  **Zusammenfassung:** Offizielle containerd-1.7-CRI-Konfigurationsreferenz.
  **Datum:** 2026-10-15

## Suchstring: "SONAR_ES_BOOTSTRAP_CHECKS_DISABLE sonarqube docker"

- **URL:** https://community.sonarsource.com/t/sonarqube-will-not-start-in-docker-container/56250
  **Zusammenfassung:** SonarSource-Community: Startprobleme durch ES-Bootstrap-Checks; Umgebungsvariable zum Deaktivieren (nur Dev).
  **Datum:** 2026-10-15

- **URL:** https://community.sonarsource.com/t/max-file-descriptors-error-docker-container-on-windows-host-windows-server-2019/33031
  **Zusammenfassung:** Gleiches Fehlerbild „max file descriptors too low“ wie in der Sandbox; Bug SONAR-13997 bei Env-Parsing erwähnt.
  **Datum:** 2026-10-15

- **URL:** https://engineering.monstar-lab.com/en/post/2024/02/06/Setup-Sonarqube-with-Docker/
  **Zusammenfassung:** Tutorial mit `-e SONAR_ES_BOOTSTRAP_CHECKS_DISABLE=true` für Nicht-Produktions-Setups.
  **Datum:** 2026-10-15

## Suchstring: "loki4j logback appender 2.0 configuration batch timeoutMs labels structuredMetadata"

- **URL:** https://redirect.github.com/loki4j/loki-logback-appender
  **Zusammenfassung:** Projektseite des Loki4j-Logback-Appenders (Labels/Metadata aus Patterns, MDC, KV). Batch-Timeout-Default (60 s) wurde praktisch per Logback-Status-Ausgabe bestätigt.
  **Datum:** 2026-10-15

- **URL:** https://central.sonatype.com/artifact/com.github.loki4j/loki-logback-appender
  **Zusammenfassung:** Maven-Central-Eintrag (verwendet: 2.1.0).
  **Datum:** 2026-10-15

- **URL:** https://grafana.com/docs/loki/latest/get-started/labels/structured-metadata/
  **Zusammenfassung:** Loki Structured Metadata (nicht indiziert, Limits 64 KB / 128 Einträge pro Zeile).
  **Datum:** 2026-10-15

## Suchstring: "Grafana Alloy faro.receiver React Faro Web SDK collect endpoint"

- **URL:** https://grafana.com/docs/alloy/next/reference/components/faro/faro.receiver.md
  **Zusammenfassung:** Alloy `faro.receiver`: nimmt Faro-Web-SDK-Telemetrie an, Default-Listener 127.0.0.1:12347 (daher `listen_address = "0.0.0.0"`), CORS konfigurierbar, Output Logs → Loki.
  **Datum:** 2026-10-15

- **URL:** https://grafana.com/docs/grafana-cloud/observe-and-act/send-data/alloy/reference/components/otelcol/otelcol.receiver.faro.md
  **Zusammenfassung:** Alternative Komponente `otelcol.receiver.faro` (für Grafana Cloud Frontend Observability).
  **Datum:** 2026-10-15

- **URL:** https://stackharbor.com/en/knowledge-base/grafana-faro-frontend-rum-deploy/
  **Zusammenfassung:** Drittquelle: Faro-SDK sendet per POST an `/collect` (praktisch bestätigt).
  **Datum:** 2026-10-15

## Suchstring: "Rancher docker install single node privileged k3s config.yaml custom CA /etc/rancher/ssl"

- **URL:** https://ranchermanager.docs.rancher.com/getting-started/installation-and-upgrade/other-installation-methods/rancher-on-a-single-node-with-docker
  **Zusammenfassung:** Offizielle Anleitung Single-Node-Docker-Install (`--privileged`, Ports 80/443, `rancher/rancher:latest`).
  **Datum:** 2026-10-15

- **URL:** https://ranchermanager.docs.rancher.com/getting-started/installation-and-upgrade/other-installation-methods/air-gapped-helm-cli-install/docker-install-commands
  **Zusammenfassung:** Docker-Install-Kommandos inkl. Private-CA (`/etc/rancher/ssl/cacerts.pem`) – erklärt, warum das Image `SSL_CERT_DIR=/etc/rancher/ssl` setzt (in der Sandbox überschrieben).
  **Datum:** 2026-10-15

- **URL:** https://forums.suse.com/t/rancher-2-xdocker-install-single-node/20120
  **Zusammenfassung:** SUSE-Forum: TLS-Probleme nach CA-Wechsel bei bestehender Installation.
  **Datum:** 2026-10-15

## Suchstring: (keine Websuche) – praktisch genutzte Endpunkte/Registries

- **URL:** https://registry-1.docker.io/v2/
  **Zusammenfassung:** Docker Hub; Images `rancher/rancher`, `rancher/k3s`, `postgres:16-alpine`, `sonarqube:community`, `grafana/grafana`, `prom/prometheus`, `grafana/loki`, `grafana/alloy`.
  **Datum:** 2026-10-15

- **URL:** https://repo.maven.apache.org/maven2/
  **Zusammenfassung:** Maven Central; Versionen per `maven-metadata.xml` ermittelt (Spring Boot 4.1.1, Loki4j 2.1.0, sonar-maven-plugin 5.8.0.7211, JaCoCo 0.8.15).
  **Datum:** 2026-10-15

- **URL:** https://registry.npmjs.org/
  **Zusammenfassung:** npm; `create-vite`, `@grafana/faro-web-sdk` 2.12.1, `playwright` 1.64.
  **Datum:** 2026-10-15
