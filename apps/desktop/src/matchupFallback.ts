import type { Champion } from "./data/ddragon";
import { hasEnoughGames } from "./data/confidence";
import { similarChampions } from "./similar";

type Row = { championId: number; games: number; winRate: number };

export type StandIn = {
  /** Opponents of the same class and damage type that stand in, with their own games. */
  from: { champion: Champion; games: number }[];
  games: number;
  winRate: number;
};

const NEAREST = 12;
// Not a rate cut-off: a part this small only adds noise and one-off picks to the pool.
const MIN_PART_GAMES = 10;

/**
 * When the exact matchup is thin, the champion's record against the closest
 * opponents (same class and damage type, nearest base stats) pooled together.
 * Null while even the pool is too small to say anything.
 */
export function standInMatchup(matchups: Row[], opponent: Champion, champions: Iterable<Champion>): StandIn | null {
  const byKey = new Map(matchups.map((m) => [m.championId, m]));
  const from: StandIn["from"] = [];
  let games = 0;
  let wins = 0;
  for (const champion of similarChampions(opponent, [...champions], NEAREST)) {
    const row = byKey.get(champion.key);
    if (!row || row.games < MIN_PART_GAMES) continue;
    from.push({ champion, games: row.games });
    games += row.games;
    wins += row.games * row.winRate;
  }
  if (games === 0 || !hasEnoughGames(games, wins / games)) return null;
  return { from, games, winRate: wins / games };
}
