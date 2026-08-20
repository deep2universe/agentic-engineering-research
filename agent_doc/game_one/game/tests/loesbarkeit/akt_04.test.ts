import { AKT_4 } from '../../src/inhalt/akt_04';
import { pruefeAkt } from '../hilfe/level_pruefung';

pruefeAkt('Akt IV — Die Sicherung', AKT_4, {
  werk: AKT_4[1]!.referenzen[0]!.werk,
  name: AKT_4[1]!.referenzen[0]!.name,
});
