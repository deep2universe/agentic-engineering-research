import { AKT_9 } from '../../src/inhalt/akt_09';
import { pruefeAkt } from '../hilfe/level_pruefung';

pruefeAkt('Akt IX — Die Hand', AKT_9, {
  werk: AKT_9[1]!.referenzen[0]!.werk,
  name: AKT_9[1]!.referenzen[0]!.name,
});
