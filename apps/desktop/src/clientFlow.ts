import type { LcuStatus } from "./lcu";

// Where the player is in the League client, in the few steps Vizier's pages
// care about. The client's own phase names are mapped once, here.

export type Lobby = {
  queueId: number;
  /** `TOP`, `JUNGLE`, `MIDDLE`, `BOTTOM`, `UTILITY` or `FILL`; null until picked. */
  firstPosition: string | null;
  secondPosition: string | null;
};

export type Flow = "closed" | "idle" | "lobby" | "queue" | "readyCheck" | "champSelect" | "inGame" | "afterGame";

const BY_PHASE: Record<string, Flow> = {
  None: "idle",
  Lobby: "lobby",
  Matchmaking: "queue",
  ReadyCheck: "readyCheck",
  ChampSelect: "champSelect",
  GameStart: "inGame",
  InProgress: "inGame",
  Reconnect: "inGame",
  WaitingForStats: "afterGame",
  PreEndOfGame: "afterGame",
  EndOfGame: "afterGame",
};

export function flowOf(lcu: LcuStatus): Flow {
  if (lcu.state !== "connected") return "closed";
  return (lcu.phase && BY_PHASE[lcu.phase]) || "idle";
}

/** Phases before the game in which the player is waiting on the queue. */
export const inQueueFlow = (flow: Flow) => flow === "lobby" || flow === "queue" || flow === "readyCheck";

const ROLES = ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"];

/** The roles the player picked in the lobby; empty for fill, no pick or a mode without roles. */
export function lobbyRoles(lobby: Lobby | null): string[] {
  if (!lobby) return [];
  return [lobby.firstPosition, lobby.secondPosition].filter((r, i, all): r is string => !!r && ROLES.includes(r) && all.indexOf(r) === i);
}

/** Whether the lobby picked fill, so any role can come up. */
export const wantsFill = (lobby: Lobby | null) => lobby?.firstPosition === "FILL" || lobby?.secondPosition === "FILL";
