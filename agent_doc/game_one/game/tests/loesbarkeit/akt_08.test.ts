import { AKT_8 } from '../../src/inhalt/akt_08';
import { pruefeAkt } from '../hilfe/level_pruefung';

pruefeAkt('Akt VIII — Die Wall', AKT_8, {
  werk: AKT_8[1]!.referenzen[0]!.werk,
  name: AKT_8[1]!.referenzen[0]!.name,
});
