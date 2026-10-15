# react_faro_demo

Minimal-Beispiel: Vite + React 19 + Grafana Faro Web SDK → Alloy (`faro.receiver`) → Loki → Grafana.
Details: `../../05_observability_spring_boot_react.md`.

```bash
npm install
VITE_FARO_URL=http://localhost:12347/collect npm run build   # Rancher: http://localhost:30105/collect
npx vite preview --port 4173 &
node faro_smoke_test.mjs http://localhost:4173               # Headless-Chromium klickt, Faro sendet
# Pruefen (Grafana Explore oder):
curl -sG localhost:3100/loki/api/v1/query_range --data-urlencode 'query={source="faro"} |= "react-faro-demo"'
```

Faro-Initialisierung: `src/faro.ts` (wird als Erstes in `src/main.tsx` importiert),
Beispiel-Event + Console-Log: `src/App.tsx`.
