import type { Participant } from "./riot/types.ts";
import type { Timeline } from "./timeline.ts";

const ROLES = ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"] as const;
type Role = (typeof ROLES)[number];
const SMITE = 11;
// The lanes' middle on the 14,820-wide map; a laner's average spot in the first minutes lands near one of them.
const LANE_CENTRE: Record<"TOP" | "MIDDLE" | "BOTTOM", { x: number; y: number }> = {
  TOP: { x: 1800, y: 12800 },
  MIDDLE: { x: 7400, y: 7400 },
  BOTTOM: { x: 12800, y: 1800 },
};
const FIRST_FRAME = 2;
const LAST_FRAME = 9;
// Cost units: a Smite carrier outside the jungle, or a jungler without Smite, is ruled out; the rest compete on distance or farm.
const RULED_OUT = 100;

export type FixedRoles = {
  /** Team position of every participant after the fix; unchanged where the game's own was fine. */
  positions: Map<Participant, string>;
  /** True when at least one team needed its roles inferred. */
  fixed: boolean;
};

const isRole = (value: string): value is Role => (ROLES as readonly string[]).includes(value);

function averageSpot(timeline: Timeline | null, participantId: number | undefined): { x: number; y: number } | null {
  if (!timeline || participantId === undefined) return null;
  const spots = timeline.info.frames
    .slice(FIRST_FRAME, LAST_FRAME + 1)
    .map((f) => f.participantFrames[String(participantId)]?.position)
    .filter((p): p is { x: number; y: number } => !!p);
  if (spots.length === 0) return null;
  return { x: spots.reduce((s, p) => s + p.x, 0) / spots.length, y: spots.reduce((s, p) => s + p.y, 0) / spots.length };
}

function permutations<T>(items: T[]): T[][] {
  if (items.length <= 1) return [items];
  return items.flatMap((item, i) => permutations([...items.slice(0, i), ...items.slice(i + 1)]).map((rest) => [item, ...rest]));
}

/**
 * Riot leaves teamPosition empty or gives two players one role in a few
 * games. A team's roles are then filled from what is left: Smite marks the
 * jungler, the lowest farm the support, and the average spot in the first
 * minutes (from the timeline) the three laners. A team that can't be told
 * apart keeps what the game said, so those players are skipped as before.
 */
export function fixRoles(info: { gameDuration: number; participants: Participant[] }, timeline: Timeline | null): FixedRoles {
  const positions = new Map<Participant, string>(info.participants.map((p) => [p, p.teamPosition]));
  let fixed = false;
  const teams = new Map<number | undefined, Participant[]>();
  for (const p of info.participants) teams.set(p.teamId, [...(teams.get(p.teamId) ?? []), p]);
  const minutes = Math.max(1, info.gameDuration / 60);

  for (const players of teams.values()) {
    if (players.length !== 5) continue;
    const count = (role: string) => players.filter((p) => p.teamPosition === role).length;
    if (ROLES.every((r) => count(r) === 1)) continue;
    const trusted = players.filter((p) => isRole(p.teamPosition) && count(p.teamPosition) === 1);
    const rest = players.filter((p) => !trusted.includes(p));
    const missing = ROLES.filter((r) => !trusted.some((p) => p.teamPosition === r));
    if (rest.length === 0 || rest.length !== missing.length) continue;

    const hasSmite = (p: Participant) => p.summoner1Id === SMITE || p.summoner2Id === SMITE;
    const spots = new Map(rest.map((p) => [p, averageSpot(timeline, p.participantId)]));
    const cost = (p: Participant, role: Role): number => {
      const smite = hasSmite(p);
      if (role === "JUNGLE") return smite ? 0 : RULED_OUT;
      if (smite) return RULED_OUT;
      if (role === "UTILITY") return (((p.totalMinionsKilled ?? 0) + (p.neutralMinionsKilled ?? 0)) / minutes) * 2;
      const spot = spots.get(p);
      if (!spot) return 0;
      return Math.hypot(spot.x - LANE_CENTRE[role].x, spot.y - LANE_CENTRE[role].y) / 1000;
    };
    // Two or more missing lanes can only be told apart by where the players stood.
    const lanes = missing.filter((r) => r === "TOP" || r === "MIDDLE" || r === "BOTTOM");
    if (lanes.length >= 2 && rest.some((p) => !hasSmite(p) && !spots.get(p))) continue;
    let best: Role[] | null = null;
    let bestCost = Infinity;
    for (const order of permutations([...missing])) {
      const total = rest.reduce((sum, p, i) => sum + cost(p, order[i]), 0);
      if (total < bestCost) {
        best = order;
        bestCost = total;
      }
    }
    // A jungler without Smite, or a Smite carrier in a lane, means the guess is wrong.
    if (!best || bestCost >= RULED_OUT) continue;
    rest.forEach((p, i) => positions.set(p, best![i]));
    fixed = true;
  }
  return { positions, fixed };
}
