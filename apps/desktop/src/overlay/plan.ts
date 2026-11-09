import type { Counters } from "../api";
import { confidenceOf, type Confidence } from "../data/confidence";
import type { Threat } from "../draft/threats";

/** The card stays up for the first two minutes, while players walk to lane. */
export const PLAN_UNTIL = 120;

export type Plan = {
  opponent: string;
  /** Data Dragon id, for the icon. */
  opponentKey: string;
  /** The matchup from our side; null when the sample can't carry a number. */
  matchup: { winRate: number; games: number; confidence: Confidence } | null;
  threat: Threat | null;
  note: string | null;
};

/** Our champion's record against the lane opponent, only when the data is good enough to read. */
export function matchupRecord(counters: Counters | null, opponentId: number | null): Plan["matchup"] {
  if (!counters || opponentId === null) return null;
  const row = counters.matchups.find((m) => m.championId === opponentId);
  if (!row) return null;
  const confidence = confidenceOf({ games: row.games, winRate: row.winRate, patches: counters.patches });
  return confidence === "insufficient" ? null : { winRate: row.winRate, games: row.games, confidence };
}

/** Whether the card shows at this game time: early, and only with something to say. */
export function planShown(time: number, plan: Plan | null, editing: boolean): boolean {
  if (!plan) return false;
  if (editing) return true;
  return time < PLAN_UNTIL && (plan.matchup !== null || plan.threat !== null || plan.note !== null);
}
