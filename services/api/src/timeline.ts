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

export type BuildPath = { startItems: number[]; skillOrder: number[]; purchases: number[] };

/** Per participant id: starting items, skill slots in level-up order, purchases net of undos. */
export function buildPaths(timeline: Timeline): Map<number, BuildPath> {
  const paths = new Map<number, BuildPath>();
  const path = (id: number) => {
    let p = paths.get(id);
    if (!p) paths.set(id, (p = { startItems: [], skillOrder: [], purchases: [] }));
    return p;
  };
  const events = timeline.info.frames.flatMap((f) => f.events).sort((a, b) => a.timestamp - b.timestamp);
  for (const e of events) {
    if (!e.participantId) continue;
    const p = path(e.participantId);
    if (e.type === "ITEM_PURCHASED" && e.itemId) {
      p.purchases.push(e.itemId);
      if (e.timestamp <= START_WINDOW_MS) p.startItems.push(e.itemId);
    } else if (e.type === "ITEM_UNDO" && e.beforeId) {
      // An undo names the item it took back in beforeId.
      const at = p.purchases.lastIndexOf(e.beforeId);
      if (at >= 0) p.purchases.splice(at, 1);
      const startAt = p.startItems.lastIndexOf(e.beforeId);
      if (startAt >= 0 && e.timestamp <= START_WINDOW_MS) p.startItems.splice(startAt, 1);
    } else if (e.type === "SKILL_LEVEL_UP" && e.skillSlot && e.levelUpType !== "EVOLVE") {
      if (p.skillOrder.length < MAX_SKILL_LEVELS) p.skillOrder.push(e.skillSlot);
    }
  }
  for (const p of paths.values()) p.purchases = p.purchases.slice(0, MAX_PURCHASES);
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
