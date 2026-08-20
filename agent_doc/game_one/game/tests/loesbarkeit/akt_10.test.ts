import { AKT_10 } from '../../src/inhalt/akt_10';
import { pruefeAkt } from '../hilfe/level_pruefung';

pruefeAkt('Akt X — Das Auge', AKT_10, {
  werk: AKT_10[1]!.referenzen[0]!.werk,
  name: AKT_10[1]!.referenzen[0]!.name,
});
