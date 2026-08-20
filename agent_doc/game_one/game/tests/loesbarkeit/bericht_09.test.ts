import { it } from 'vitest';
import { AKT_9 } from '../../src/inhalt/akt_09';
import { druckeBericht } from '../hilfe/bericht';

it('druckt die Kennzahlen von Akt IX', () => {
  druckeBericht('AKT IX — Die Hand', AKT_9);
});
