const IN_GAME = new Set(["GameStart", "InProgress", "Reconnect"]);

export type GameEdge = "start" | "end" | null;

/** The step into a running game, or out of one; every other phase change is ignored. */
export function gameEdge(previous: string | null, next: string | null): GameEdge {
  const was = previous !== null && IN_GAME.has(previous);
  const is = next !== null && IN_GAME.has(next);
  if (!was && is) return "start";
  if (was && !is) return "end";
  return null;
}

/** The League client coming up, from not running or still connecting. */
export function clientOpened(previous: string, next: string): boolean {
  return next === "connected" && previous !== "connected";
}

export type TrayAction = "champ_select" | "overlay";

export const isTrayAction = (value: unknown): value is TrayAction => value === "champ_select" || value === "overlay";
