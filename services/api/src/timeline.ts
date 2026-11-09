// What Vizier reads from a match-v5 timeline.

export type TimelineEvent = {
  type: string;
  timestamp: number;
  participantId?: number;
  itemId?: number;
  beforeId?: number;
  afterId?: number;
  skillSlot?: number;
  levelUpType?: string;
  killerId?: number;
  victimId?: number;
  assistingParticipantIds?: number[];
  position?: { x: number; y: number };
  monsterType?: string;
  buildingType?: string;
  killerTeamId?: number;
  teamId?: number;
};

export type TimelineFrame = {
  timestamp: number;
  participantFrames: Record<
    string,
    { totalGold: number; xp: number; minionsKilled: number; jungleMinionsKilled: number; level: number }
  >;
  events: TimelineEvent[];
};

export type Timeline = { info: { frames: TimelineFrame[] } };

// Purchases in the first minute are the starting items.
const START_WINDOW_MS = 60_000;
const MAX_PURCHASES = 30;
const MAX_SKILL_LEVELS = 18;

export type BuildPath = { startItems: number[]; skillOrder: number[]; purchases: number[]; /** Seconds into the game, one per purchase. */ purchaseTimes: number[] };

/** Per participant id: starting items, skill slots in level-up order, purchases net of undos. */
export function buildPaths(timeline: Timeline): Map<number, BuildPath> {
  const paths = new Map<number, BuildPath>();
  const path = (id: number) => {
    let p = paths.get(id);
    if (!p) paths.set(id, (p = { startItems: [], skillOrder: [], purchases: [], purchaseTimes: [] }));
    return p;
  };
  const events = timeline.info.frames.flatMap((f) => f.events).sort((a, b) => a.timestamp - b.timestamp);
  for (const e of events) {
    if (!e.participantId) continue;
    const p = path(e.participantId);
    if (e.type === "ITEM_PURCHASED" && e.itemId) {
      p.purchases.push(e.itemId);
      p.purchaseTimes.push(Math.round(e.timestamp / 1000));
      if (e.timestamp <= START_WINDOW_MS) p.startItems.push(e.itemId);
    } else if (e.type === "ITEM_UNDO" && e.beforeId) {
      // An undo names the item it took back in beforeId.
      const at = p.purchases.lastIndexOf(e.beforeId);
      if (at >= 0) {
        p.purchases.splice(at, 1);
        p.purchaseTimes.splice(at, 1);
      }
      const startAt = p.startItems.lastIndexOf(e.beforeId);
      if (startAt >= 0 && e.timestamp <= START_WINDOW_MS) p.startItems.splice(startAt, 1);
    } else if (e.type === "SKILL_LEVEL_UP" && e.skillSlot && e.levelUpType !== "EVOLVE") {
      if (p.skillOrder.length < MAX_SKILL_LEVELS) p.skillOrder.push(e.skillSlot);
    }
  }
  for (const p of paths.values()) {
    p.purchases = p.purchases.slice(0, MAX_PURCHASES);
    p.purchaseTimes = p.purchaseTimes.slice(0, MAX_PURCHASES);
  }
  return paths;
}

export type GoldGraph = {
  /** Blue team (100) total gold minus red team (200), one value per minute. */
  goldDiff: number[];
  objectives: { minute: number; teamId: number; type: string }[];
};

export function goldGraph(timeline: Timeline, teamOf: (participantId: number) => number): GoldGraph {
  const goldDiff = timeline.info.frames.map((frame) => {
    let diff = 0;
    for (const [id, pf] of Object.entries(frame.participantFrames)) {
      diff += teamOf(Number(id)) === 100 ? pf.totalGold : -pf.totalGold;
    }
    return diff;
  });
  const objectives = timeline.info.frames
    .flatMap((f) => f.events)
    .flatMap((e) => {
      const minute = Math.round(e.timestamp / 6000) / 10;
      if (e.type === "ELITE_MONSTER_KILL" && e.killerTeamId) return [{ minute, teamId: e.killerTeamId, type: e.monsterType ?? "MONSTER" }];
      // Building events name the team that lost the building.
      if (e.type === "BUILDING_KILL" && e.teamId) return [{ minute, teamId: e.teamId === 100 ? 200 : 100, type: e.buildingType ?? "BUILDING" }];
      return [];
    });
  return { goldDiff, objectives };
}

// Enough to cover laning and the early jungle clears.
export const PACE_MINUTES = 15;

/** Per participant id: total CS (lane plus jungle) at the end of minutes 1 to 15. */
export function csByMinute(timeline: Timeline): Map<number, number[]> {
  const result = new Map<number, number[]>();
  for (const frame of timeline.info.frames.slice(1, PACE_MINUTES + 1)) {
    for (const [id, pf] of Object.entries(frame.participantFrames)) {
      const list = result.get(Number(id)) ?? [];
      list.push(pf.minionsKilled + pf.jungleMinionsKilled);
      result.set(Number(id), list);
    }
  }
  return result;
}

/** Per participant id: champion level at the end of minutes 1 to 15. */
export function levelByMinute(timeline: Timeline): Map<number, number[]> {
  const result = new Map<number, number[]>();
  for (const frame of timeline.info.frames.slice(1, PACE_MINUTES + 1)) {
    for (const [id, pf] of Object.entries(frame.participantFrames)) {
      const list = result.get(Number(id)) ?? [];
      list.push(pf.level);
      result.set(Number(id), list);
    }
  }
  return result;
}

/** Cumulative kills, deaths, assists and the team's kills at the end of one minute. */
export type KdaPoint = { kills: number; deaths: number; assists: number; teamKills: number };

/**
 * Per participant id: kills, deaths, assists and own team kills at the end of
 * minutes 1 to 15. `teamOf` says which side a participant is on; executions
 * (no killer) count for nobody.
 */
export function kdaByMinute(timeline: Timeline, teamOf: (participantId: number) => number): Map<number, KdaPoint[]> {
  const ids = new Set<number>();
  for (const frame of timeline.info.frames) for (const id of Object.keys(frame.participantFrames)) ids.add(Number(id));
  const result = new Map<number, KdaPoint[]>([...ids].map((id) => [id, []]));
  const events = timeline.info.frames.flatMap((f) => f.events).filter((e) => e.type === "CHAMPION_KILL");
  for (let minute = 1; minute <= PACE_MINUTES; minute++) {
    const upTo = events.filter((e) => e.timestamp <= minute * 60_000);
    const teamKills = new Map<number, number>();
    for (const e of upTo) if (e.killerId) teamKills.set(teamOf(e.killerId), (teamKills.get(teamOf(e.killerId)) ?? 0) + 1);
    for (const [id, list] of result) {
      list.push({
        kills: upTo.filter((e) => e.killerId === id).length,
        deaths: upTo.filter((e) => e.victimId === id).length,
        assists: upTo.filter((e) => e.assistingParticipantIds?.includes(id)).length,
        teamKills: teamKills.get(teamOf(id)) ?? 0,
      });
    }
  }
  // A game that ended early has fewer frames; its series stays short so it is skipped.
  const covered = Math.min(PACE_MINUTES, timeline.info.frames.length - 1);
  for (const [id, list] of result) result.set(id, list.slice(0, Math.max(0, covered)));
  return result;
}

export const encodeKda = (points: KdaPoint[]) => points.map((p) => `${p.kills}.${p.deaths}.${p.assists}.${p.teamKills}`).join(",");

export function decodeKda(text: string | null): KdaPoint[] {
  return (text ?? "")
    .split(",")
    .filter(Boolean)
    .map((part) => {
      const [kills, deaths, assists, teamKills] = part.split(".").map(Number);
      return { kills, deaths, assists, teamKills };
    })
    .filter((p) => [p.kills, p.deaths, p.assists, p.teamKills].every(Number.isFinite));
}

/** Per participant id: total gold at the start of the given minute, or none when the game was shorter. */
export function goldAtMinute(timeline: Timeline, minute: number): Map<number, number> {
  const frame = timeline.info.frames[minute];
  const result = new Map<number, number>();
  if (!frame) return result;
  for (const [id, pf] of Object.entries(frame.participantFrames)) result.set(Number(id), pf.totalGold);
  return result;
}
