/**
 * Ermittelt das zu benutzende Chromium und die Startflags.
 *
 * Hintergrund: In dieser Umgebung ist Chromium bereits unter
 * PLAYWRIGHT_BROWSERS_PATH vorinstalliert, aber mit einer anderen Build-Nummer
 * als die, die @playwright/test erwartet. `channel: 'chromium'` bzw. der
 * Standard-Download sind hier nicht verfuegbar, deshalb wird der Pfad zum
 * vollstaendigen Chromium (nicht zur chrome-headless-shell) explizit gesetzt.
 * Die Produktions-Bibel verlangt genau das volle Chromium, weil
 * chrome-headless-shell abweichend rendert.
 */
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const WURZEL = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';

export function chromiumPfad() {
  if (process.env.SCHWARMWERK_CHROMIUM) return process.env.SCHWARMWERK_CHROMIUM;
  if (!existsSync(WURZEL)) return undefined;
  const kandidaten = readdirSync(WURZEL)
    .filter((d) => d.startsWith('chromium-'))
    .sort()
    .reverse()
    .map((d) => join(WURZEL, d, 'chrome-linux', 'chrome'))
    .filter((p) => existsSync(p));
  return kandidaten[0];
}

/** SwiftShader-Flags: ohne `--enable-unsafe-swiftshader` gibt es ab Chrome 130 KEINEN WebGL-Kontext. */
export const FLAGS_WEBGL2 = [
  '--use-gl=angle',
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
  '--ignore-gpu-blocklist',
  '--disable-gpu-sandbox',
  '--no-sandbox',
  '--disable-dev-shm-usage',
  '--run-all-compositor-stages-before-draw',
  '--disable-new-content-rendering-timeout',
  '--disable-threaded-animation',
  '--disable-threaded-scrolling',
  '--disable-checker-imaging',
  '--disable-image-animation-resync',
  '--force-device-scale-factor=1',
  '--hide-scrollbars',
  '--mute-audio',
  '--font-render-hinting=none',
  '--disable-lcd-text',
];

export const FLAGS_WEBGPU = [
  '--enable-unsafe-webgpu',
  '--enable-features=Vulkan,UseSkiaRenderer',
  '--use-vulkan=swiftshader',
  '--use-webgpu-adapter=swiftshader',
  '--disable-gpu-sandbox',
  '--no-sandbox',
  '--disable-dev-shm-usage',
  '--force-device-scale-factor=1',
  '--hide-scrollbars',
  '--mute-audio',
];

export function startOptionen(modus = 'webgl2') {
  const pfad = chromiumPfad();
  return {
    headless: true,
    args: modus === 'webgpu' ? FLAGS_WEBGPU : FLAGS_WEBGL2,
    ...(pfad ? { executablePath: pfad } : {}),
  };
}
