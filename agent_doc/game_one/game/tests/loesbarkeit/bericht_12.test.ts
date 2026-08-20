import { it } from 'vitest';
import { AKT_12 } from '../../src/inhalt/akt_12';
import { druckeBericht } from '../hilfe/bericht';

it('druckt die Kennzahlen von Akt XII', () => {
  druckeBericht('AKT XII — Monolith', AKT_12);
});
