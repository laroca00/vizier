import type { DraftTurn } from "../lcu";

export type LockState = { enabled: true } | { enabled: false; reason: "turn" | "ban" | "gone" };

/** Whether the player can hover or lock this champion now, and why not if they cannot. */
export function lockState(turn: DraftTurn | null | undefined, championId: number, gone: ReadonlySet<number>): LockState {
  if (!turn?.mine) return { enabled: false, reason: "turn" };
  if (turn.kind !== "pick") return { enabled: false, reason: "ban" };
  if (gone.has(championId)) return { enabled: false, reason: "gone" };
  return { enabled: true };
}
