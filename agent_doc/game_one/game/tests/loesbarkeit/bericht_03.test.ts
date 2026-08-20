import { it } from 'vitest';
import { AKT_3 } from '../../src/inhalt/akt_03';
import { druckeBericht } from '../hilfe/bericht';

it('druckt die Kennzahlen von Akt III', () => {
  druckeBericht('AKT III — Das Werkzeug', AKT_3);
});
