import { AKT_5 } from '../../src/inhalt/akt_05';
import { pruefeAkt } from '../hilfe/level_pruefung';

pruefeAkt('Akt V — Der Chor', AKT_5, {
  werk: AKT_5[1]!.referenzen[0]!.werk,
  name: AKT_5[1]!.referenzen[0]!.name,
});
