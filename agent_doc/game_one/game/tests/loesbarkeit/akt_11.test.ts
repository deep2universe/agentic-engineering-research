import { AKT_11 } from '../../src/inhalt/akt_11';
import { pruefeAkt } from '../hilfe/level_pruefung';

pruefeAkt('Akt XI — Die Schmiede', AKT_11, {
  werk: AKT_11[1]!.referenzen[0]!.werk,
  name: AKT_11[1]!.referenzen[0]!.name,
});
