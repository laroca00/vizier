import type { ChampionOverview } from "../api";
import { hasEnoughGames } from "./confidence";

type Jungle = NonNullable<ChampionOverview["jungle"]>;
export type JunglePath = Jungle["paths"][number] & { share: number };

/** Fewer games than this on a route say little about how a jungler starts. */
const MIN_PATH_GAMES = 30;

/**
 * The most played first route of a jungler, with the share of their games it
 * covers, or null when no route has a sample that means something.
 */
export function topPath(jungle: Jungle | undefined): JunglePath | null {
  if (!jungle || jungle.games === 0) return null;
  const best = [...jungle.paths].sort((a, b) => b.games - a.games)[0];
  if (!best || best.games < MIN_PATH_GAMES || !hasEnoughGames(best.games, best.winRate)) return null;
  return { ...best, share: best.games / jungle.games };
}
