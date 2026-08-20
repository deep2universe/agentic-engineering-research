import { AKT_7 } from '../../src/inhalt/akt_07';
import { pruefeAkt } from '../hilfe/level_pruefung';

pruefeAkt('Akt VII — Der Speicher', AKT_7, {
  werk: AKT_7[1]!.referenzen[0]!.werk,
  name: AKT_7[1]!.referenzen[0]!.name,
});
