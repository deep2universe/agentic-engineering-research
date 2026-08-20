import { AKT_3 } from '../../src/inhalt/akt_03';
import { pruefeAkt } from '../hilfe/level_pruefung';

pruefeAkt('Akt III — Das Werkzeug', AKT_3, {
  werk: AKT_3[1]!.referenzen[0]!.werk,
  name: AKT_3[1]!.referenzen[0]!.name,
});
