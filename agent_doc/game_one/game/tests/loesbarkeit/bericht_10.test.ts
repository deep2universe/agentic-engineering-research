import { it } from 'vitest';
import { AKT_10 } from '../../src/inhalt/akt_10';
import { druckeBericht } from '../hilfe/bericht';

it('druckt die Kennzahlen von Akt X', () => {
  druckeBericht('AKT X — Das Auge', AKT_10);
});
