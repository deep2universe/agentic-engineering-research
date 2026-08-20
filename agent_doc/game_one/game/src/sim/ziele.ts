/**
 * Auswertung von Levelzielen und Budgets.
 *
 * Getrennt von `simulation.ts`, weil die Simulation nichts ueber Level wissen
 * muss — sie liefert Metriken, und hier wird entschieden, ob das reicht.
 */

import type { Budget, Metriken, Ziel } from './typen';

export interface ZielStand {
  readonly ziel: Ziel;
  readonly erfuellt: boolean;
  readonly istWert: number;
  /** 0..1 fuer den Fortschrittsbalken im HUD. */
  readonly fortschritt: number;
  /** Formatierter Ist-Wert fuer die Anzeige. */
  readonly anzeige: string;
}

export interface Bewertung {
  readonly bestanden: boolean;
  readonly staende: readonly ZielStand[];
  readonly budgetVerstoesse: readonly string[];
  /** Die drei Wettbewerbsachsen. Niemals zu einem Score verrechnet. */
  readonly achsen: { kosten: number; latenz: number; flaeche: number };
}

const ANTEIL_METRIKEN = new Set<keyof Metriken>([
  'durchsatz',
  'guete',
  'sicherheit',
  'nachvollziehbarkeit',
  'konformitaet',
  'belegquote',
]);

function formatiere(metrik: keyof Metriken, wert: number): string {
  if (!Number.isFinite(wert)) return '∞';
  if (ANTEIL_METRIKEN.has(metrik)) return `${Math.round(wert * 100)} %`;
  if (metrik === 'kostenJeAuftrag' || metrik === 'kosten') return Math.round(wert).toLocaleString('de-DE');
  return String(Math.round(wert));
}

export function pruefeZiel(ziel: Ziel, m: Metriken): ZielStand {
  const ist = m[ziel.metrik];
  const erfuellt =
    ziel.vergleich === '>='
      ? ist >= ziel.wert
      : ziel.vergleich === '<='
        ? ist <= ziel.wert
        : Math.abs(ist - ziel.wert) < 1e-9;

  let fortschritt: number;
  if (erfuellt) fortschritt = 1;
  else if (ziel.vergleich === '>=') fortschritt = ziel.wert === 0 ? 1 : Math.max(0, Math.min(1, ist / ziel.wert));
  else if (ziel.vergleich === '<=') fortschritt = !Number.isFinite(ist) || ist === 0 ? 0 : Math.max(0, Math.min(1, ziel.wert / ist));
  else fortschritt = 0;

  return { ziel, erfuellt, istWert: ist, fortschritt, anzeige: formatiere(ziel.metrik, ist) };
}

export function pruefeBudget(budget: Budget, m: Metriken): string[] {
  const verstoesse: string[] = [];
  if (budget.kosten !== undefined && m.kosten > budget.kosten) {
    verstoesse.push(
      `Kostendeckel gerissen: ${Math.round(m.kosten).toLocaleString('de-DE')} von ${budget.kosten.toLocaleString('de-DE')} Token.`
    );
  }
  if (budget.latenz !== undefined && m.latenzP95 > budget.latenz) {
    verstoesse.push(`Latenzdeckel gerissen: p95 liegt bei ${m.latenzP95} statt hoechstens ${budget.latenz} Ticks.`);
  }
  if (budget.module !== undefined && m.flaeche > budget.module) {
    verstoesse.push(`Zu viele Module: ${m.flaeche} statt hoechstens ${budget.module}.`);
  }
  if (budget.dauer !== undefined && m.dauer > budget.dauer) {
    verstoesse.push(`Der Lauf dauert zu lange: ${m.dauer} statt hoechstens ${budget.dauer} Ticks.`);
  }
  return verstoesse;
}

export function bewerte(ziele: readonly Ziel[], budget: Budget, m: Metriken): Bewertung {
  const staende = ziele.map((z) => pruefeZiel(z, m));
  const budgetVerstoesse = pruefeBudget(budget, m);
  const pflicht = staende.filter((s) => !s.ziel.optional);
  return {
    bestanden: pflicht.every((s) => s.erfuellt) && budgetVerstoesse.length === 0,
    staende,
    budgetVerstoesse,
    achsen: { kosten: m.kostenJeAuftrag, latenz: m.latenzP95, flaeche: m.flaeche },
  };
}

/** Kurzformel eines Ziels fuer das HUD: "Guete ≥ 75 %". */
export function zielFormel(z: Ziel): string {
  const zeichen = z.vergleich === '>=' ? '≥' : z.vergleich === '<=' ? '≤' : '=';
  const name: Partial<Record<keyof Metriken, string>> = {
    durchsatz: 'Durchsatz',
    guete: 'Guete',
    kosten: 'Kosten',
    kostenJeAuftrag: 'Kosten/Auftrag',
    latenzP50: 'Latenz p50',
    latenzP95: 'Latenz p95',
    sicherheit: 'Sicherheit',
    nachvollziehbarkeit: 'Nachvollziehbarkeit',
    konformitaet: 'Konformitaet',
    belegquote: 'Belegquote',
    flaeche: 'Module',
    lecks: 'Lecks',
    geliefert: 'Geliefert',
    verworfen: 'Verworfen',
    dauer: 'Dauer',
  };
  return `${name[z.metrik] ?? z.metrik} ${zeichen} ${formatiere(z.metrik, z.wert)}`;
}
