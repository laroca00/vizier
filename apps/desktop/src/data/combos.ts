import raw from "./combos.json";

// Ability sequences written by hand for Vizier, in plain words of its own.
// They are editorial: not measured, and written against one patch
// (`writtenFor`), so a later patch can have changed an ability they use.

export * from "./comboTypes";
import type { Combo } from "./comboTypes";

export type ComboDoc = { writtenFor: string; champions: { championId: string; combos: Combo[] }[] };

export const COMBOS = raw as ComboDoc;

const byChampion = new Map(COMBOS.champions.map((c) => [c.championId, c.combos]));

/** The champion's combos, by Data Dragon id. */
export const combosOf = (championId: string): Combo[] => byChampion.get(championId) ?? [];
