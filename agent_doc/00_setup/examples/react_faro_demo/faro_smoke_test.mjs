// Smoke-Test: React-App im Headless-Chromium oeffnen, Button klicken, Faro-Daten senden lassen.
// Aufruf: node faro_smoke_test.mjs [app-url]   (Default: http://localhost:4173 = `npm run preview`)
// Danach in Loki pruefen: {source="faro"} |= "react-faro-demo"
import { chromium } from 'playwright'
import { existsSync } from 'node:fs'

const url = process.argv[2] ?? 'http://localhost:4173'
const browser = await chromium.launch({
  // Sandbox: Chromium ist vorinstalliert, passt aber nicht zu jeder Playwright-Version
  // ("Executable doesn't exist ...") -> festen Pfad nutzen. Nie `playwright install` ausfuehren.
  executablePath: process.env.CHROMIUM_PATH
    || (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined),
})
const page = await browser.newPage()
const faroRequests = []
page.on('request', (r) => { if (r.url().includes('/collect')) faroRequests.push(r.url()) })
page.on('requestfailed', (r) => { if (r.url().includes('/collect')) console.error('Faro-Request fehlgeschlagen:', r.failure()?.errorText) })

await page.goto(url, { waitUntil: 'networkidle' })
await page.getByRole('button', { name: /count/i }).click()
await page.getByRole('button', { name: /count/i }).click()
await page.waitForTimeout(3000)            // Faro batcht (Default ~250 ms) + Puffer
await browser.close()

console.log(`Faro-Requests an Collector: ${faroRequests.length}`)
process.exit(faroRequests.length > 0 ? 0 : 1)
