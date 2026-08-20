import { AKT_2 } from '../../src/inhalt/akt_02';
import { pruefeAkt } from '../hilfe/level_pruefung';

pruefeAkt('Akt II — Die Weiche', AKT_2, {
  werk: AKT_2[1]!.referenzen[0]!.werk,
  name: AKT_2[1]!.referenzen[0]!.name,
});
