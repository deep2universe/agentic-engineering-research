// Grafana Faro: Browser-Observability (Logs, Fehler, Web Vitals, Events) -> Alloy -> Loki.
// Collector-URL per Vite-Env: VITE_FARO_URL (Compose: http://localhost:12347/collect,
// Rancher: http://localhost:30105/collect).
import { initializeFaro, getWebInstrumentations, LogLevel } from '@grafana/faro-web-sdk'

export const faro = initializeFaro({
  url: import.meta.env.VITE_FARO_URL ?? 'http://localhost:12347/collect',
  app: {
    name: 'react-faro-demo',
    version: '1.0.0',
    environment: 'dev',
  },
  // Standard: Fehler (window.onerror), console.*, Web Vitals, Session-Tracking
  instrumentations: [...getWebInstrumentations({ captureConsole: true })],
})

export { LogLevel }
