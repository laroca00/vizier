import type { ChampSelect } from "./lcu";
import { firstAvailable, type RolePlan } from "./pickPlan";

export type AutopilotMode = "off" | "hover" | "lock";

export type Step = {
  kind: "pick" | "ban";
  championId: number;
  /** Lock now, rather than only hover. */
  lock: boolean;
};

type Input = {
  draft: ChampSelect;
  plan: RolePlan | undefined;
  mode: AutopilotMode;
  /** Lock this many seconds before the timer ends; 0 locks as soon as it is the player's turn. */
  lockSeconds: number;
  secondsLeft: number;
  /** Ids the client lists as pickable or bannable for the open action; null when unknown. */
  allowed: ReadonlySet<number> | null;
};

/** What Vizier would do on this tick, or null when it should do nothing. */
export function nextStep({ draft, plan, mode, lockSeconds, secondsLeft, allowed }: Input): Step | null {
  const turn = draft.turn;
  if (mode === "off" || !turn?.mine || !plan) return null;
  const me = draft.myTeam.find((m) => m.isLocal);
  if (!me) return null;
  if (turn.kind === "pick" && me.championId !== 0) return null;
  const list = turn.kind === "pick" ? plan.picks : plan.bans;
  // Locked champions of everyone else are gone; hovers can still be overridden.
  const taken = new Set([...draft.myTeam, ...draft.theirTeam].filter((m) => !m.isLocal && m.championId > 0).map((m) => m.championId));
  const championId = firstAvailable(list, { banned: new Set(draft.bans), taken: turn.kind === "pick" ? taken : new Set(), allowed });
  if (championId === null) return null;
  const lock = mode === "lock" && (lockSeconds <= 0 || secondsLeft <= lockSeconds);
  return { kind: turn.kind, championId, lock };
}

/** Plain words for the banner: what happens next. */
export function describeStep(mode: AutopilotMode, lockSeconds: number): "hover" | "lockNow" | "lockLater" {
  if (mode !== "lock") return "hover";
  return lockSeconds <= 0 ? "lockNow" : "lockLater";
}
