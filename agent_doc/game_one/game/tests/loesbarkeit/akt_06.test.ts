import { AKT_6 } from '../../src/inhalt/akt_06';
import { pruefeAkt } from '../hilfe/level_pruefung';

pruefeAkt('Akt VI — Die Prüferin', AKT_6, {
  werk: AKT_6[1]!.referenzen[0]!.werk,
  name: AKT_6[1]!.referenzen[0]!.name,
});
