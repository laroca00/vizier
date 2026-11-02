import { useSyncExternalStore } from "react";

// What the player keeps for themselves: their champion pool, notes and goals.
// It stays on this computer, like the settings.

export type GoalMetric = "cs_pm" | "deaths" | "vision_pm" | "kill_participation" | "kda";

export type Goal = { id: string; metric: GoalMetric; target: number };

export type PoolPick = { championId: number; position: string | null };

export type Personal = {
  pool: PoolPick[];
  /** "c:103" for a champion, "m:103:238" for Ahri against Zed. */
  notes: Record<string, string>;
  goals: Goal[];
};

const DEFAULTS: Personal = { pool: [], notes: {}, goals: [] };
const KEY = "vizier.personal";
const listeners = new Set<() => void>();

function read(): Personal {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
  } catch {
    return DEFAULTS;
  }
}

let current = read();

// The overlay window reads the same notes and goals.
window.addEventListener("storage", (event) => {
  if (event.key !== KEY) return;
  current = read();
  for (const listener of listeners) listener();
});

function update(patch: (p: Personal) => Partial<Personal>) {
  current = { ...current, ...patch(current) };
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    // Kept for this session.
  }
  for (const listener of listeners) listener();
}

export function usePersonal(): Personal {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => current,
  );
}

export const inPool = (p: Personal, championId: number) => p.pool.some((x) => x.championId === championId);

export function togglePool(championId: number, position: string | null) {
  update((p) => ({
    pool: inPool(p, championId) ? p.pool.filter((x) => x.championId !== championId) : [...p.pool, { championId, position }],
  }));
}

export const championNoteKey = (championId: number) => `c:${championId}`;
export const matchupNoteKey = (championId: number, opponentId: number) => `m:${championId}:${opponentId}`;

export function setNote(key: string, text: string) {
  update((p) => {
    const notes = { ...p.notes };
    if (text.trim()) notes[key] = text;
    else delete notes[key];
    return { notes };
  });
}

/** The matchups the player wrote notes for, as opponent ids. */
export function notedMatchups(p: Personal, championId: number): number[] {
  const prefix = `m:${championId}:`;
  return Object.keys(p.notes)
    .filter((k) => k.startsWith(prefix))
    .map((k) => Number(k.slice(prefix.length)));
}

export function addGoal(metric: GoalMetric, target: number) {
  update((p) => ({ goals: [...p.goals.filter((g) => g.metric !== metric), { id: `${metric}:${Date.now()}`, metric, target }] }));
}

export function removeGoal(id: string) {
  update((p) => ({ goals: p.goals.filter((g) => g.id !== id) }));
}
