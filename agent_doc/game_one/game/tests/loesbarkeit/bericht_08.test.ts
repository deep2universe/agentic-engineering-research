import { it } from 'vitest';
import { AKT_8 } from '../../src/inhalt/akt_08';
import { druckeBericht } from '../hilfe/bericht';

it('druckt die Kennzahlen von Akt VIII', () => {
  druckeBericht('AKT VIII — Die Wall', AKT_8);
});
