import type { BanSuggestions, Counters } from "../api";
import { hasEnoughGames, wilson } from "../data/confidence";

/** A matchup counts as a problem only when its whole 95% interval is under 50%. */
const clearlyBelowEven = (winRate: number, games: number) => wilson(winRate, games).high < 0.5;

export type BanReason =
  | { kind: "meta"; winRate: number; games: number }
  | { kind: "hard"; vs: number; winRate: number; games: number }
  | { kind: "team"; allies: number[]; winRate: number; games: number };

export type BanPick = { championId: number; reasons: BanReason[]; score: number };

const MIN_META_GAMES = 150;
const SHOWN_BANS = 6;

type Input = {
  meta: BanSuggestions | null;
  /** Counters of the champion the player plays or hovers: its win rate against each opponent. */
  own: { championId: number; counters: Counters } | null;
  /** Counters of the allies already picked, with their champion ids. */
  allies: { championId: number; counters: Counters }[];
  /** Already banned or picked. */
  unavailable: Set<number>;
};

/**
 * Bans from three sources, merged per champion so the reasons add up: strong
 * in the meta, a hard matchup for the player's champion, or strong into the
 * allies picked so far. A champion named by several sources ranks higher.
 */
export function planBans({ meta, own, allies, unavailable }: Input): BanPick[] {
  const picks = new Map<number, BanPick>();
  const add = (championId: number, reason: BanReason, score: number) => {
    if (unavailable.has(championId)) return;
    const entry = picks.get(championId) ?? { championId, reasons: [], score: 0 };
    entry.reasons.push(reason);
    entry.score += score;
    picks.set(championId, entry);
  };

  for (const c of meta?.champions ?? []) {
    if (c.games < MIN_META_GAMES) continue;
    add(c.championId, { kind: "meta", winRate: c.winRate, games: c.games }, 1 + Math.max(0, c.winRate - 0.5) * 10);
  }

  if (own) {
    for (const m of own.counters.matchups) {
      if (!hasEnoughGames(m.games, m.winRate) || !clearlyBelowEven(m.winRate, m.games)) continue;
      add(m.championId, { kind: "hard", vs: own.championId, winRate: m.winRate, games: m.games }, 1.5 + (0.5 - m.winRate) * 10);
    }
  }

  // Against the allies, a champion counts when it beats at least one of them clearly.
  const byEnemy = new Map<number, { allies: number[]; wins: number; games: number }>();
  for (const ally of allies) {
    for (const m of ally.counters.matchups) {
      if (!hasEnoughGames(m.games, m.winRate) || !clearlyBelowEven(m.winRate, m.games)) continue;
      const row = byEnemy.get(m.championId) ?? { allies: [], wins: 0, games: 0 };
      row.allies.push(ally.championId);
      row.wins += (1 - m.winRate) * m.games;
      row.games += m.games;
      byEnemy.set(m.championId, row);
    }
  }
  for (const [championId, row] of byEnemy) {
    const winRate = row.wins / row.games;
    // Pooled over several allies, the same rule holds: the enemy has to beat them clearly.
    if (winRate < 0.5 || wilson(winRate, row.games).low <= 0.5) continue;
    add(championId, { kind: "team", allies: row.allies, winRate, games: row.games }, row.allies.length + (winRate - 0.5) * 10);
  }

  return [...picks.values()].sort((a, b) => b.reasons.length - a.reasons.length || b.score - a.score).slice(0, SHOWN_BANS);
}
