import { useSyncExternalStore } from "react";
import type { Champion } from "../data/ddragon";
import { analyzeComp, type Weakness } from "../data/traits";
import { emptyTeam, ROLES, type Team } from "./store";

// A Clash team planned ahead: up to five players with the roles they play and
// their champion pools, kept on this computer. The planner turns them into a
// draft that uses everyone's pool and covers what a team needs.

export type Role = (typeof ROLES)[number];
export type ClashPlayer = { id: string; name: string; /** Preferred first. */ roles: Role[]; pool: number[] };

export const MAX_PLAYERS = 5;
const MAX_POOL = 12;
// More candidates per player would only slow the search; the best few by tier decide it.
const CANDIDATES = 6;

const TIER_POINTS: Record<string, number> = { S: 4, A: 3, B: 2, C: 1, D: 0 };
const ROLE_POINTS = [3, 2];

/** Each player's role, best preferences first; null for players past the fifth. */
export function assignRoles(players: ClashPlayer[]): Map<string, Role> {
  const people = players.slice(0, MAX_PLAYERS);
  let best: { score: number; roles: Role[] } = { score: -1, roles: [] };
  const permute = (left: Role[], chosen: Role[]) => {
    if (chosen.length === people.length) {
      const score = chosen.reduce((sum, role, i) => {
        const at = people[i].roles.indexOf(role);
        return sum + (at < 0 ? 0 : (ROLE_POINTS[at] ?? 1));
      }, 0);
      if (score > best.score) best = { score, roles: [...chosen] };
      return;
    }
    for (const role of left) permute(left.filter((r) => r !== role), [...chosen, role]);
  };
  permute([...ROLES], []);
  return new Map(people.map((p, i) => [p.id, best.roles[i]]));
}

export type ClashPick = { playerId: string; role: Role; championId: number; /** True when the pool had nothing for the role. */ offRole: boolean };
export type ClashPlan = { team: Team; picks: ClashPick[]; /** Players whose whole pool is taken or banned. */ empty: string[]; weaknesses: Weakness[] };

type Context = {
  champions: Map<number, Champion>;
  /** The champion's tier in a role, or undefined when it isn't played there. */
  tierOf: (championId: number, role: Role) => string | undefined;
  unavailable: Set<number>;
  /** False while the role tier lists couldn't be loaded; then no pick counts as off role. */
  rolesKnown?: boolean;
};

/** How well a whole team fits together: a frontline, a way to start fights, someone to peel, mixed damage. */
function compScore(team: Champion[]): number {
  const report = analyzeComp(team);
  let score = 0;
  if (report.tanks > 0) score += 3;
  if (report.engage > 0) score += 2;
  if (report.peel > 0) score += 1;
  if (report.magic >= 0.3 && report.magic <= 0.7) score += 2;
  return score;
}

export function planDraft(players: ClashPlayer[], ctx: Context): ClashPlan {
  const roles = assignRoles(players);
  const options = players.slice(0, MAX_PLAYERS).map((p) => {
    const role = roles.get(p.id)!;
    const free = p.pool.filter((id) => !ctx.unavailable.has(id) && ctx.champions.has(id));
    const inRole = free.filter((id) => ctx.tierOf(id, role) !== undefined);
    const offRole = inRole.length === 0 && ctx.rolesKnown !== false;
    const list = (inRole.length === 0 ? free : inRole)
      .map((id) => ({ id, points: TIER_POINTS[ctx.tierOf(id, role) ?? ""] ?? 0 }))
      .sort((a, b) => b.points - a.points)
      .slice(0, CANDIDATES);
    return { player: p, role, offRole, list };
  });

  const active = options.filter((o) => o.list.length > 0);
  let best: { score: number; ids: number[] } = { score: -Infinity, ids: [] };
  const search = (i: number, ids: number[], points: number) => {
    if (i === active.length) {
      const score = points + compScore(ids.map((id) => ctx.champions.get(id)!));
      if (score > best.score) best = { score, ids: [...ids] };
      return;
    }
    for (const c of active[i].list) {
      // One champion per team.
      if (ids.includes(c.id)) continue;
      search(i + 1, [...ids, c.id], points + c.points);
    }
  };
  search(0, [], 0);

  const team = emptyTeam();
  const picks: ClashPick[] = active
    .map((o, i) => ({ playerId: o.player.id, role: o.role, championId: best.ids[i], offRole: o.offRole }))
    .filter((p) => p.championId !== undefined);
  for (const p of picks) team[ROLES.indexOf(p.role)] = p.championId;
  const chosen = picks.map((p) => ctx.champions.get(p.championId)!);
  const empty = options.filter((o) => o.list.length === 0 || !picks.some((p) => p.playerId === o.player.id)).map((o) => o.player.id);
  return { team, picks, empty, weaknesses: chosen.length >= 4 ? analyzeComp(chosen).weaknesses : [] };
}

// Storage.

const KEY = "vizier.clash";
const listeners = new Set<() => void>();
const isRole = (r: unknown): r is Role => typeof r === "string" && (ROLES as readonly string[]).includes(r);

export function parseClash(raw: string | null): ClashPlayer[] {
  try {
    const list = JSON.parse(raw ?? "[]");
    return (Array.isArray(list) ? list : [])
      .filter((p) => p && typeof p.id === "string")
      .slice(0, MAX_PLAYERS)
      .map((p) => ({
        id: p.id,
        name: String(p.name ?? "").slice(0, 24),
        roles: (Array.isArray(p.roles) ? p.roles.filter(isRole) : []).slice(0, 2),
        pool: (Array.isArray(p.pool) ? p.pool.filter((n: unknown): n is number => typeof n === "number") : []).slice(0, MAX_POOL),
      }));
  } catch {
    return [];
  }
}

function read(): ClashPlayer[] {
  try {
    return parseClash(localStorage.getItem(KEY));
  } catch {
    return [];
  }
}

let current = read();

export function useClashPlayers(): ClashPlayer[] {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => current,
  );
}

function write(next: ClashPlayer[]) {
  current = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Kept for this session.
  }
  for (const listener of listeners) listener();
}

export function addPlayer(name: string, role: Role | null) {
  if (current.length >= MAX_PLAYERS) return;
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  write([...current, { id, name: name.slice(0, 24), roles: role ? [role] : [], pool: [] }]);
}

export function updatePlayer(id: string, patch: Partial<Omit<ClashPlayer, "id">>) {
  write(current.map((p) => (p.id === id ? { ...p, ...patch, pool: (patch.pool ?? p.pool).slice(0, MAX_POOL) } : p)));
}

export function removePlayer(id: string) {
  write(current.filter((p) => p.id !== id));
}
