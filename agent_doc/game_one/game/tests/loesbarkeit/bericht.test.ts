/**
 * Balance-Bericht über die gesamte Kampagne.
 * Aufruf: npx vitest run tests/lösbarkeit/bericht.test.ts
 */
import { it } from 'vitest';
import { AKTE } from '../../src/inhalt/kampagne';
import { druckeBericht } from '../hilfe/bericht';

it('druckt die Kennzahlen aller Level', () => {
  for (const akt of AKTE) druckeBericht(`AKT ${akt.nummer} — ${akt.titel}`, akt.level);
});
