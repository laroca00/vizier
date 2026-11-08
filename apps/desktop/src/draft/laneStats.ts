import type { LaneStat } from "../api";

export type LaneLine = { key: "cs10" | "cs15" | "gold10" | "gold15"; value: number };

/** The lead lines to show, or null while the sample is empty. Positive is ahead. */
export function laneLines(stat: LaneStat): LaneLine[] | null {
  if (!stat.games || stat.csDiff10 === undefined || stat.csDiff15 === undefined || stat.goldDiff10 === undefined || stat.goldDiff15 === undefined) return null;
  return [
    { key: "cs10", value: stat.csDiff10 },
    { key: "cs15", value: stat.csDiff15 },
    { key: "gold10", value: stat.goldDiff10 },
    { key: "gold15", value: stat.goldDiff15 },
  ];
}

/** "+12", "−3", "0": a minus sign that lines up with the plus. */
export function signedNumber(n: number, digits = 0): string {
  const rounded = Number(n.toFixed(digits));
  if (rounded === 0) return "0";
  return `${rounded > 0 ? "+" : "−"}${Math.abs(rounded).toFixed(digits)}`;
}
