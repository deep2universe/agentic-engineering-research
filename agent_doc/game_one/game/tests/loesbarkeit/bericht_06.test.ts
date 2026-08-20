import { it } from 'vitest';
import { AKT_6 } from '../../src/inhalt/akt_06';
import { druckeBericht } from '../hilfe/bericht';

it('druckt die Kennzahlen von Akt VI', () => {
  druckeBericht('AKT VI — Die Prüferin', AKT_6);
});
