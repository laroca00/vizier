import { rankOf, type Benchmarks, type Metric } from "./stats.ts";
import type { GameNumbers } from "./trends.ts";

// Post-game report card: each category is where the player's numbers fall in
// the Emerald+ distribution for their champion and role, 0 to 100.

export type Category = "farming" | "combat" | "survival" | "vision";

const CATEGORIES: { id: Category; metrics: { metric: Metric; higherIsBetter: boolean }[]; skip?: string[] }[] = [
  {
    id: "farming",
    metrics: [
      { metric: "cs_pm", higherIsBetter: true },
      { metric: "cs10", higherIsBetter: true },
    ],
    // Supports leave the minions to their carry.
    skip: ["UTILITY"],
  },
  {
    id: "combat",
    metrics: [
      { metric: "kill_participation", higherIsBetter: true },
      { metric: "damage_share", higherIsBetter: true },
    ],
  },
  { id: "survival", metrics: [{ metric: "deaths", higherIsBetter: false }] },
  { id: "vision", metrics: [{ metric: "vision_pm", higherIsBetter: true }] },
];

export type Score = { category: Category; score: number; metrics: { metric: Metric; value: number; median: number; score: number }[] };

/** Categories the benchmarks can rate; a category with no rated metric is left out. */
export function scoreGame(game: GameNumbers, bench: Benchmarks): { overall: number | null; scores: Score[] } {
  const scores: Score[] = [];
  for (const category of CATEGORIES) {
    if (category.skip?.includes(game.position)) continue;
    const metrics = category.metrics.flatMap(({ metric, higherIsBetter }) => {
      const value = game.values[metric];
      const distribution = bench.metrics[metric];
      if (value === undefined || !distribution) return [];
      const rank = rankOf(distribution, value);
      return [{ metric, value, median: distribution.quantiles[10], score: Math.round((higherIsBetter ? rank : 1 - rank) * 100) }];
    });
    if (metrics.length === 0) continue;
    scores.push({ category: category.id, score: Math.round(metrics.reduce((sum, m) => sum + m.score, 0) / metrics.length), metrics });
  }
  const overall = scores.length ? Math.round(scores.reduce((sum, s) => sum + s.score, 0) / scores.length) : null;
  return { overall, scores };
}

/** Minutes where the player's CS fell furthest below the median curve, worst first. */
export function weakestMinutes(mine: number[], median: number[], count = 3): number[] {
  return mine
    .map((cs, i) => ({ minute: i + 1, gap: (median[i] ?? cs) - cs }))
    .filter((m) => m.gap > 0)
    .sort((a, b) => b.gap - a.gap)
    .slice(0, count)
    .map((m) => m.minute);
}
