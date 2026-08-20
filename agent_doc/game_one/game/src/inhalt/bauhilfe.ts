/**
 * Baukasten fuer Werke. Wird von Level-Referenzloesungen, Anti-Mustern,
 * Tests und der Evolutionskammer benutzt.
 *
 * Rein und ohne Seiteneffekte: er erzeugt nur Datenstrukturen.
 */

import type { Leitung, Modul, ModulArt, ModulParameter, Werk } from '../sim/typen';

export class Bau {
  private readonly module: Modul[] = [];
  private readonly leitungen: Leitung[] = [];
  private readonly zaehler = new Map<string, number>();
  private spalte = 0;
  private zeile = 0;

  /** Legt ein Modul an und liefert seine Id zurueck. */
  setze(art: ModulArt, param: ModulParameter = {}, id?: string, x?: number, z?: number): string {
    const praefix = art.slice(0, 1);
    const n = (this.zaehler.get(praefix) ?? 0) + 1;
    this.zaehler.set(praefix, n);
    const echteId = id ?? `${praefix}${n}`;
    this.module.push({ id: echteId, art, x: x ?? this.spalte++, z: z ?? this.zeile, param });
    return echteId;
  }

  /** Setzt die Schreibposition fuer die naechsten Module (Zweige uebereinander). */
  bei(x: number, z: number): this {
    this.spalte = x;
    this.zeile = z;
    return this;
  }

  verbinde(von: string, nach: string, vonPort = 'aus', nachPort = 'ein'): this {
    this.leitungen.push({ id: `l${this.leitungen.length + 1}`, von, vonPort, nach, nachPort });
    return this;
  }

  /** Verkettet Module ueber ihre Standardports. */
  kette(...ids: string[]): this {
    for (let i = 0; i + 1 < ids.length; i++) this.verbinde(ids[i]!, ids[i + 1]!);
    return this;
  }

  fertig(): Werk {
    return { module: this.module, leitungen: this.leitungen };
  }
}

/** Quelle → Module in Reihe → Senke. Der haeufigste Aufbau. */
export function reihe(glieder: readonly { art: ModulArt; param?: ModulParameter }[]): Werk {
  const b = new Bau();
  const q = b.setze('quelle', {}, 'q');
  const ids = glieder.map((g) => b.setze(g.art, g.param ?? {}));
  const s = b.setze('senke', {}, 's');
  b.kette(q, ...ids, s);
  return b.fertig();
}

/** Nur Quelle und Senke, unverbunden — Startzustand eines leeren Levels. */
export function leeresFundament(): Werk {
  return {
    module: [
      { id: 'q', art: 'quelle', x: 0, z: 4, param: {} },
      { id: 's', art: 'senke', x: 14, z: 4, param: {} },
    ],
    leitungen: [],
  };
}

/** Der Antagonist: ein einzelner grosser Kern, dreimal hintereinander. */
export function monolith(stufen = 3): Werk {
  return reihe(Array.from({ length: stufen }, () => ({ art: 'kern' as const, param: { groesse: 'kondor' as const } })));
}
