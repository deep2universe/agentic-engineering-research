import { AKT_12 } from '../../src/inhalt/akt_12';
import { pruefeAkt } from '../hilfe/level_pruefung';

pruefeAkt('Akt XII — Monolith', AKT_12, {
  werk: AKT_12[1]!.referenzen[0]!.werk,
  name: AKT_12[1]!.referenzen[0]!.name,
});
