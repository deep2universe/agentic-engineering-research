import { it } from 'vitest';
import { AKT_11 } from '../../src/inhalt/akt_11';
import { druckeBericht } from '../hilfe/bericht';

it('druckt die Kennzahlen von Akt XI', () => {
  druckeBericht('AKT XI — Die Schmiede', AKT_11);
});
