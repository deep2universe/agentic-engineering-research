import { it } from 'vitest';
import { AKT_5 } from '../../src/inhalt/akt_05';
import { druckeBericht } from '../hilfe/bericht';

it('druckt die Kennzahlen von Akt V', () => {
  druckeBericht('AKT V — Der Chor', AKT_5);
});
