import { championKey, type LiveGame, type Timer } from "./live";

// First spawns on Summoner's Rift. Riot moves these now and then; patch them here.
const DRAGON_FIRST = 5 * 60;
const BARON_FIRST = 20 * 60;
// A window shorter than this is gone before anyone can walk to the objective.
const MIN_WINDOW = 8;

export type Fallen = { champion: string; ours: boolean; backAt: number };

/** Dead players and the game time they come back at, soonest first. */
export function fallenPlayers(game: LiveGame, myTeam: string): Fallen[] {
  return game.players
    .filter((p) => p.isDead && (p.respawnTimer ?? 0) > 0)
    .map((p) => ({ champion: championKey(p), ours: p.team === myTeam, backAt: game.gameTime + (p.respawnTimer ?? 0) }))
    .sort((a, b) => a.backAt - b.backAt);
}

export type Objective = "baron" | "dragon";

export type Window =
  | { kind: "push"; down: number; seconds: number; open: Objective[] }
  | { kind: "danger"; down: number; seconds: number };

/** Objectives that are up now: past their first spawn and not waiting on a respawn. */
export function openObjectives(objectives: Timer[], time: number): Objective[] {
  const waiting = (kind: Timer["kind"]) => objectives.some((o) => o.kind === kind && o.at > time);
  const open: Objective[] = [];
  if (time >= BARON_FIRST && !waiting("baron")) open.push("baron");
  if (time >= DRAGON_FIRST && !waiting("dragon")) open.push("dragon");
  return open;
}

/**
 * A plain read of the numbers: two or more players down on one side, more than
 * on the other, for long enough to matter. The seconds run until the first of
 * them is back, which is when the edge starts to shrink.
 */
export function readWindow(fallen: Fallen[], time: number, objectives: Timer[], rift: boolean): Window | null {
  const alive = fallen.filter((f) => f.backAt > time);
  const enemies = alive.filter((f) => !f.ours);
  const allies = alive.filter((f) => f.ours);
  const soonest = (list: Fallen[]) => Math.floor(Math.min(...list.map((f) => f.backAt)) - time);
  if (enemies.length >= 2 && enemies.length > allies.length) {
    const seconds = soonest(enemies);
    if (seconds < MIN_WINDOW) return null;
    return { kind: "push", down: enemies.length, seconds, open: rift ? openObjectives(objectives, time) : [] };
  }
  if (allies.length >= 2 && allies.length > enemies.length) {
    const seconds = soonest(allies);
    if (seconds < MIN_WINDOW) return null;
    return { kind: "danger", down: allies.length, seconds };
  }
  return null;
}
