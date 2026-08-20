import { it } from 'vitest';
import { AKT_4 } from '../../src/inhalt/akt_04';
import { druckeBericht } from '../hilfe/bericht';

it('druckt die Kennzahlen von Akt IV', () => {
  druckeBericht('AKT IV — Die Sicherung', AKT_4);
});
