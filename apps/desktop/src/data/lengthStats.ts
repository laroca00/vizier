import { hasEnoughGames } from "./confidence";

export type LengthBucket = { bucket: number; games: number; winRate: number };

/** Minutes each bucket covers, in the order the API numbers them. */
export const LENGTH_LABELS = ["< 20", "20–25", "25–30", "30–35", "35+"];

/** The three phases the draft read talks about, as the buckets that make them up. */
export const PHASE_BUCKETS = { early: [0, 1], mid: [2, 3], late: [4] } as const;
export type LengthPhase = keyof typeof PHASE_BUCKETS;

export type PhaseRate = { games: number; winRate: number };

/** Games and win rate of each phase, summed over its buckets; a phase without games is null. */
export function phaseRates(lengths: LengthBucket[] | undefined): Record<LengthPhase, PhaseRate | null> {
  const result = { early: null, mid: null, late: null } as Record<LengthPhase, PhaseRate | null>;
  if (!lengths) return result;
  for (const phase of Object.keys(PHASE_BUCKETS) as LengthPhase[]) {
    const rows = lengths.filter((l) => (PHASE_BUCKETS[phase] as readonly number[]).includes(l.bucket));
    const games = rows.reduce((sum, r) => sum + r.games, 0);
    if (games > 0) result[phase] = { games, winRate: rows.reduce((sum, r) => sum + r.games * r.winRate, 0) / games };
  }
  return result;
}

/** True when every phase has a sample whose interval says something; then data may replace the hand-kept curve. */
export function lengthsAreThick(lengths: LengthBucket[] | undefined): boolean {
  const rates = phaseRates(lengths);
  return Object.values(rates).every((r) => r !== null && hasEnoughGames(r.games, r.winRate));
}
