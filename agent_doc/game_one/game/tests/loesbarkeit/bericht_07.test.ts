import { it } from 'vitest';
import { AKT_7 } from '../../src/inhalt/akt_07';
import { druckeBericht } from '../hilfe/bericht';

it('druckt die Kennzahlen von Akt VII', () => {
  druckeBericht('AKT VII — Der Speicher', AKT_7);
});
