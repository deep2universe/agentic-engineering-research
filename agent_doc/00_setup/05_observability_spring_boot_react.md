# 05 – Logging & Monitoring für Spring Boot und React (Grafana-Stack)

**Status: ✅ End-to-End getestet** – Metriken, Backend-Logs, Frontend-Logs/-Events/-Web-Vitals
landen in Grafana (Compose **und** Rancher).

## Architektur

```
 Spring Boot ──/actuator/prometheus──▶ Prometheus ◀──remote-write── Alloy ◀── OTLP (4317/4318)
      │                                    ▲                          ▲        (optional: Backend-
      └──Loki4j-Appender (HTTP push)──▶ Loki ◀──────────────────────┤         Logs/Metriken via OTel)
                                           ▲                          │
 React (Browser) ── Grafana Faro SDK ──────┴──── POST /collect ──── Alloy faro.receiver (12347)
                                           │
                                       Grafana (Datasources + Dashboard provisioniert)
```

| Komponente | Version (getestet) | Rolle | Compose-Port | Rancher-Port |
|---|---|---|---|---|
| Grafana | 13.2.4 | UI, Dashboards, Explore | 3000 | 30102 |
| Prometheus | 3.15.0 | Metriken (Scrape + Remote-Write-Receiver) | 9090 | 30103 |
| Loki | 3.7.8 | Logs | 3100 | 30104 |
| Grafana Alloy | 1.20.1 | Collector: Faro (Frontend), OTLP (Backend) | 12347 / 4317 / 4318 / UI 12345 | 30105 / 30107 / 30106 / 30108 |

Konfigurationen (eine Quelle für beide Varianten): `scripts/config/prometheus.yml`,
`config.alloy`, `grafana/datasources.yaml`, `grafana/dashboards.yaml`, `grafana/devstack_overview.json`.
Loki nutzt die Default-Config des Images (`/etc/loki/local-config.yaml`).

**Nicht enthalten:** Tracing-Backend (Tempo). Erweiterung: `grafana/tempo` als Service, in
`config.alloy` `traces = [otelcol.exporter.otlp.tempo.input]` ergänzen, Datasource Tempo hinzufügen.

## Spring Boot – was nötig ist

Vorlage: `examples/spring_boot_demo` (Spring Boot 4.1.1, Java 21). `start.spring.io` ist gesperrt →
Projekt von dort kopieren.

**1. Abhängigkeiten (pom.xml)**
```xml
<dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-actuator</artifactId></dependency>
<dependency><groupId>io.micrometer</groupId><artifactId>micrometer-registry-prometheus</artifactId></dependency>
<dependency><groupId>com.github.loki4j</groupId><artifactId>loki-logback-appender</artifactId><version>2.1.0</version></dependency>
```
(Spring Boot 4: Web-Starter heißt `spring-boot-starter-webmvc`, Test-Starter `spring-boot-starter-webmvc-test`.)

**2. application.properties**
```properties
spring.application.name=spring-boot-demo
management.endpoints.web.exposure.include=health,info,prometheus,metrics
management.metrics.tags.application=${spring.application.name}
loki.url=http://localhost:3100/loki/api/v1/push      # Rancher: 30104
```

**3. `logback-spring.xml`** – Loki4j-Appender mit Labels `app`, `host`, Structured Metadata `level/thread/logger`.
Wichtig: **`<batch><timeoutMs>2000</timeoutMs></batch>`** – Default ist 60 s, sonst erscheinen Logs
erst nach einer Minute (bzw. beim Shutdown). Debug: `<statusListener class="ch.qos.logback.core.status.OnConsoleStatusListener"/>`.

**4. Prometheus-Scrape** – `prometheus.yml` Job `spring-boot` scrapt
`host.docker.internal:8080/actuator/prometheus` (App läuft auf dem Host). Weitere Apps als Target
ergänzen, dann `docker compose restart prometheus`. **Kein** statisches `application`-Label im
Scrape-Job setzen (Kollision → `exported_application`).
In der Rancher-Variante löst `host.docker.internal` nicht auf → App im Cluster deployen oder
Target auf die Host-IP des Docker-Bridge-Netzes setzen (nicht getestet).

**Getestet:** `curl localhost:8080/hello` ×3 → `http_server_requests_seconds_count{uri="/hello"} 3` in Prometheus,
Target `spring-boot` = `up`; Logzeilen `hello called with name=…` in Loki unter `{app="spring-boot-demo"}`.

**Alternative (OTel):** Statt Loki4j/Scrape kann die App per OTLP an Alloy senden
(`http://localhost:4318`), Alloy leitet Logs → Loki und Metriken → Prometheus (Remote-Write) weiter.
Der Pfad Alloy-OTLP → Loki/Prometheus ist per `90_verify.sh` getestet; eine Spring-OTel-App selbst nicht.

## React – was nötig ist

Vorlage: `examples/react_faro_demo` (Vite 8, React 19, `@grafana/faro-web-sdk` 2.12).

```bash
npm install @grafana/faro-web-sdk
```
`src/faro.ts`:
```ts
import { initializeFaro, getWebInstrumentations } from '@grafana/faro-web-sdk'
export const faro = initializeFaro({
  url: import.meta.env.VITE_FARO_URL ?? 'http://localhost:12347/collect',   // Rancher: 30105
  app: { name: 'react-faro-demo', version: '1.0.0', environment: 'dev' },
  instrumentations: [...getWebInstrumentations({ captureConsole: true })],
})
```
In `main.tsx` als Erstes importieren. Eigene Signale: `faro.api.pushLog([...])`, `faro.api.pushEvent('name', {...})`,
`faro.api.pushError(err)`. Alloy `faro.receiver` hat CORS `*` und schreibt nach Loki mit Label `source="faro"`.

**Getestet:** Headless-Chromium (Playwright) öffnet die App, klickt 2× → in Loki
`{source="faro"} |= "react-faro-demo"`: Logs (`kind=log`), Events (`kind=event`, `counter_clicked`),
Web Vitals (`kind=measurement`).

```bash
cd agent_doc/00_setup/examples/react_faro_demo
npm install && npm run build
npx vite preview --port 4173 &
node faro_smoke_test.mjs http://localhost:4173     # nutzt /opt/pw-browsers/chromium
```

## Grafana

- Login `admin`/`admin`, Datasources `Prometheus` (uid `prometheus`) und `Loki` (uid `loki`) provisioniert.
- Dashboard **„Devstack: Spring Boot + React“** (uid `devstack-overview`, Ordner Devstack):
  Requests/s und p95-Latenz je URI, JVM-Heap, 5xx-Rate, Backend-Logs, Frontend-Faro-Logs; Variable `$app`.
- grafana.com ist gesperrt → Community-Dashboards (z. B. JVM Micrometer) nicht per ID importierbar;
  JSON ggf. manuell einfügen.
- Nützliche Queries:
  - `sum by (uri) (rate(http_server_requests_seconds_count{application="spring-boot-demo"}[1m]))`
  - `{app="spring-boot-demo"} |= "ERROR"`
  - `{source="faro"} | logfmt | kind="exception"`
  - Loki-Selektoren brauchen einen nicht-leeren Matcher: `{app=~".+"}` statt `{app=~".*"}`.

## Funktionstest

`scripts/90_verify.sh compose|rancher` prüft u. a.: Loki-Push+Query, Faro-Collect → Loki,
OTLP-Logs → Loki, OTLP-Metrik → Prometheus (Remote-Write), Grafana-Datasource-Proxy für beide
Datasources, Dashboard provisioniert. Ergebnis: **22/22** in beiden Varianten.
