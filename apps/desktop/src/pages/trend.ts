export type Trend = "up" | "down" | "flat";

// A change this small is noise from one patch to the next.
const FLAT_UNDER = 0.0005;

export function trendOf(change: number | null | undefined): Trend | null {
  if (change == null) return null;
  return Math.abs(change) < FLAT_UNDER ? "flat" : change > 0 ? "up" : "down";
}

const ARROWS: Record<Trend, string> = { up: "▲", down: "▼", flat: "▬" };

/** A rate change in percentage points with an arrow, e.g. "▲ +1.2". */
export function changeText(change: number | null | undefined): string {
  const trend = trendOf(change);
  if (trend === null) return "–";
  const points = Math.abs(change! * 100).toFixed(1);
  return `${ARROWS[trend]} ${trend === "flat" ? "0.0" : `${trend === "up" ? "+" : "−"}${points}`}`;
}
