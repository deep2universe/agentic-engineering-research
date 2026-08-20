import { it } from 'vitest';
import { AKT_2 } from '../../src/inhalt/akt_02';
import { druckeBericht } from '../hilfe/bericht';

it('druckt die Kennzahlen von Akt II', () => {
  druckeBericht('AKT II — Die Weiche', AKT_2);
});
