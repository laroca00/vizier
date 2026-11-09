import type { Params } from "../../i18n";
import type { Timer } from "../live";

export const thousands = (gold: number) => `${gold > 0 ? "+" : gold < 0 ? "−" : ""}${(Math.abs(gold) / 1000).toFixed(1)}k`;

const TIMER_NAMES = { dragon: "Ejder", baron: "Baron" } as const;
const LANE_NAMES = { top: "üst", mid: "orta", bot: "alt" } as const;

export function timerLabel(timer: Timer, t: (text: string, params?: Params) => string) {
  if (timer.kind !== "inhibitor") return t(TIMER_NAMES[timer.kind]);
  return t(timer.ours ? "Bizim {lane} inhibitör" : "Rakip {lane} inhibitör", { lane: t(LANE_NAMES[timer.lane ?? "mid"]) });
}
