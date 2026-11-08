import type { TierEntry } from "./api";

export type Mover = { championId: number; position: string; games: number; change: number };
export type Movers = { winRateUp: Mover[]; winRateDown: Mover[]; pickRateUp: Mover[]; pickRateDown: Mover[] };

// A change from fewer games than this is mostly noise between two patches.
export const MIN_MOVER_GAMES = 150;
// Smaller moves than half a point are not worth a headline.
const MIN_CHANGE = 0.005;
const SHOWN = 3;

function top(rows: Mover[], direction: 1 | -1): Mover[] {
  return rows
    .filter((r) => direction * r.change >= MIN_CHANGE)
    .sort((a, b) => direction * (b.change - a.change) || b.games - a.games)
    .slice(0, SHOWN);
}

/** The biggest risers and fallers in win rate and pick rate over every role's tier list. */
export function metaMovers(byRole: { position: string; champions: TierEntry[] }[]): Movers {
  const rows = byRole.flatMap(({ position, champions }) => champions.filter((c) => c.games >= MIN_MOVER_GAMES).map((c) => ({ position, c })));
  const pick = (read: (c: TierEntry) => number | null | undefined): Mover[] =>
    rows.flatMap(({ position, c }) => {
      const change = read(c);
      return change == null ? [] : [{ championId: c.championId, position, games: c.games, change }];
    });
  const win = pick((c) => c.winRateChange);
  const pickRate = pick((c) => c.pickRateChange);
  return { winRateUp: top(win, 1), winRateDown: top(win, -1), pickRateUp: top(pickRate, 1), pickRateDown: top(pickRate, -1) };
}
