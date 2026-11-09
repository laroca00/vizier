// A pick plan is an ordered list of champions per role: up to three picks and
// two bans, tried first to last when the player's turn comes.

export type PlanKind = "picks" | "bans";
export type RolePlan = { picks: number[]; bans: number[] };
export type PickPlan = Record<string, RolePlan>;

export const PLAN_LIMIT: Record<PlanKind, number> = { picks: 3, bans: 2 };

export const emptyRolePlan = (): RolePlan => ({ picks: [], bans: [] });

const clean = (value: unknown, limit: number): number[] =>
  Array.isArray(value) ? [...new Set(value.filter((n): n is number => Number.isInteger(n) && n > 0))].slice(0, limit) : [];

/** Reads a stored plan; anything malformed is dropped. */
export function parsePlan(value: unknown): PickPlan {
  if (!value || typeof value !== "object") return {};
  const plan: PickPlan = {};
  for (const [role, entry] of Object.entries(value as Record<string, Partial<RolePlan>>)) {
    const picks = clean(entry?.picks, PLAN_LIMIT.picks);
    const bans = clean(entry?.bans, PLAN_LIMIT.bans);
    if (picks.length || bans.length) plan[role] = { picks, bans };
  }
  return plan;
}

function withRole(plan: PickPlan, role: string, change: (r: RolePlan) => RolePlan): PickPlan {
  const next = change(plan[role] ?? emptyRolePlan());
  const rest = { ...plan };
  if (next.picks.length || next.bans.length) rest[role] = next;
  else delete rest[role];
  return rest;
}

/** Adds at the end; a full list or a duplicate leaves the plan as it was. */
export function addToPlan(plan: PickPlan, role: string, kind: PlanKind, championId: number): PickPlan {
  return withRole(plan, role, (r) => (r[kind].includes(championId) || r[kind].length >= PLAN_LIMIT[kind] ? r : { ...r, [kind]: [...r[kind], championId] }));
}

export function removeFromPlan(plan: PickPlan, role: string, kind: PlanKind, championId: number): PickPlan {
  return withRole(plan, role, (r) => ({ ...r, [kind]: r[kind].filter((id) => id !== championId) }));
}

/** Moves the entry at `from` to position `to`, as dragging does. */
export function moveInPlan(plan: PickPlan, role: string, kind: PlanKind, from: number, to: number): PickPlan {
  return withRole(plan, role, (r) => {
    const list = [...r[kind]];
    if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return r;
    const [item] = list.splice(from, 1);
    list.splice(to, 0, item);
    return { ...r, [kind]: list };
  });
}

export type Unavailable = {
  /** Banned by anyone. */
  banned: ReadonlySet<number>;
  /** Picked (locked or hovered) by anyone but the player. */
  taken: ReadonlySet<number>;
  /** When known, the ids the client says can be picked; others are not owned or not allowed. */
  allowed?: ReadonlySet<number> | null;
};

/** The first champion of the list that can still be used. */
export function firstAvailable(list: readonly number[], blocked: Unavailable): number | null {
  for (const id of list) {
    if (blocked.banned.has(id) || blocked.taken.has(id)) continue;
    if (blocked.allowed && !blocked.allowed.has(id)) continue;
    return id;
  }
  return null;
}
