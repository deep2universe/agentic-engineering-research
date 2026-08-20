/**
 * Einstiegspunkt. Haelt sich bewusst kurz: alles Fachliche liegt in `spiel/`.
 *
 * Die Debug-Schnittstelle wird ausschliesslich unter `__TEST__` eingehaengt.
 * Ein Test prueft gegen das echte Produktionsbundle, dass die Zeichenkette
 * `__spiel` darin nicht vorkommt — sonst koennte man im ausgelieferten Spiel
 * Metriken manipulieren und die Lernwirkung waere dahin.
 */

import './ui/stil.css';
import { Spiel } from './spiel/spiel';

async function starte(): Promise<void> {
  const leinwand = document.getElementById('leinwand');
  const oberflaeche = document.getElementById('oberflaeche');
  if (!(leinwand instanceof HTMLCanvasElement) || !oberflaeche) {
    throw new Error('Die Seite ist unvollstaendig: Leinwand oder Oberflaeche fehlen.');
  }

  const params = new URLSearchParams(location.search);
  const reduziert = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

  const spiel = await Spiel.erzeuge({
    leinwand,
    hudZiel: oberflaeche,
    erzwingeWebGL: params.get('forceWebGL') === '1',
    ohnePost: params.get('post') === '0',
    ohneSchleife: __TEST__ && params.get('schleife') !== '1',
    reduzierteBewegung: reduziert || params.get('ruhig') === '1',
    ...(params.get('guete') === 'niedrig'
      ? ({ guete: 'niedrig' } as const)
      : params.get('guete') === 'mittel'
        ? ({ guete: 'mittel' } as const)
        : {}),
  });

  leinwand.focus();

  if (__TEST__) {
    const { haengeDebugApiEin } = await import('./werkzeug/debug_api');
    haengeDebugApiEin(spiel);
  }

  // Bewegungsreduktion live nachfuehren.
  globalThis
    .matchMedia?.('(prefers-reduced-motion: reduce)')
    .addEventListener('change', (e) => spiel.setzeReduzierteBewegung(e.matches));
}

starte().catch((fehler: unknown) => {
  // eslint-disable-next-line no-console
  console.error('SCHWARMWERK konnte nicht starten:', fehler);
  const p = document.createElement('p');
  p.style.cssText = 'padding:2rem;color:#ffd9d9;font:16px system-ui';
  p.textContent =
    'SCHWARMWERK konnte nicht starten. Der Browser meldet: ' +
    (fehler instanceof Error ? fehler.message : String(fehler));
  document.body.append(p);
});
