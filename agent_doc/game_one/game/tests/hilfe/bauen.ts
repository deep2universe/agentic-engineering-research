/**
 * Kleiner Baukasten fuer Werke in Tests und Referenzloesungen.
 *
 * Er nimmt der Testschreibung die Buchhaltung ab (Ids, Ports, Positionen) und
 * macht die Absicht eines Aufbaus lesbar. Er ist bewusst NICHT Teil des
 * Spielcodes: die Simulation nimmt reine Datenstrukturen entgegen.
 */

import type { Modul, ModulArt, ModulParameter, Werk } from '../../src/sim/typen';

export class Bau {
  private readonly module: Modul[] = [];
  private readonly leitungen: { id: string; von: string; vonPort: string; nach: string; nachPort: string }[] = [];
  private zaehler = new Map<string, number>();
  private spalte = 0;

  /** Legt ein Modul an. Ohne Id wird eine sprechende vergeben (k1, k2, w1 …). */
  setze(art: ModulArt, param: ModulParameter = {}, id?: string, x?: number, z?: number): string {
    const praefix = art.slice(0, 1);
    const n = (this.zaehler.get(praefix) ?? 0) + 1;
    this.zaehler.set(praefix, n);
    const echteId = id ?? `${praefix}${n}`;
    this.module.push({
      id: echteId,
      art,
      x: x ?? this.spalte++,
      z: z ?? 0,
      param,
    });
    return echteId;
  }

  /** Verbindet zwei Module. Ports haben sinnvolle Vorgaben. */
  verbinde(von: string, nach: string, vonPort = 'aus', nachPort = 'ein'): this {
    this.leitungen.push({
      id: `l${this.leitungen.length + 1}`,
      von,
      vonPort,
      nach,
      nachPort,
    });
    return this;
  }

  /** Verkettet mehrere Module ueber ihre Standardports. */
  kette(...ids: string[]): this {
    for (let i = 0; i + 1 < ids.length; i++) this.verbinde(ids[i]!, ids[i + 1]!);
    return this;
  }

  fertig(): Werk {
    return { module: this.module, leitungen: this.leitungen };
  }
}

/** Quelle → (Module in Reihe) → Senke. Der haeufigste Aufbau in Tests. */
export function reihe(
  glieder: readonly { art: ModulArt; param?: ModulParameter }[]
): Werk {
  const b = new Bau();
  const q = b.setze('quelle', {}, 'q');
  const ids = glieder.map((g) => b.setze(g.art, g.param ?? {}));
  const s = b.setze('senke', {}, 's');
  b.kette(q, ...ids, s);
  return b.fertig();
}
