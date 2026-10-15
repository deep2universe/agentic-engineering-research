import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { faro, LogLevel } from './faro'
import './index.css'
import App from './App.tsx'

// Faro so frueh wie moeglich initialisieren (Import oben), dann ein Start-Log senden.
faro.api.pushLog(['react-faro-demo started'], { level: LogLevel.INFO })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
