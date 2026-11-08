import type { Rune, RuneStyle } from "./data/ddragon";

export type RuneCell = { rune: Rune; chosen: boolean; games: number | null; rate: number | null };
export type TreeRow = RuneCell[];

type Perks = { id: number; games: number }[] | undefined;

// A rate from a handful of games is noise; the rune is still shown, without a number.
const MIN_RATE_GAMES = 10;

/**
 * Rows of a rune tree for display: the chosen runes lit, the others with how
 * often they were taken. `perks` and `total` are the champion's games, so a
 * rate is only given when the numbers describe the same sample as the page.
 */
export function treeRows(style: RuneStyle, chosen: Set<number>, perks: Perks, total: number, skipKeystones = false): TreeRow[] {
  const games = new Map(perks?.map((p) => [p.id, p.games]));
  return style.slots.slice(skipKeystones ? 1 : 0).map((slot) =>
    slot.map((rune) => {
      const g = perks ? (games.get(rune.id) ?? 0) : null;
      return { rune, chosen: chosen.has(rune.id), games: g, rate: g !== null && total >= MIN_RATE_GAMES ? g / total : null };
    }),
  );
}

/** The page's runes split the way the client lays them out: 4 primary, 2 secondary, then shards. */
export function splitPage(perks: number[]) {
  return { primary: perks.slice(0, 4), secondary: perks.slice(4, 6), shards: perks.slice(6, 9) };
}
