import { describe, expect, it } from "vitest";
import { flowOf, inQueueFlow, lobbyRoles, wantsFill, type Lobby } from "./clientFlow";
import type { LcuStatus } from "./lcu";

const connected = (phase: string | null): LcuStatus => ({ state: "connected", summoner: null, phase, lastGameId: null, region: null });
const lobby = (first: string | null, second: string | null): Lobby => ({ queueId: 420, firstPosition: first, secondPosition: second });

describe("flowOf", () => {
  it("maps the client's phases", () => {
    expect(flowOf({ state: "disconnected" })).toBe("closed");
    expect(flowOf({ state: "connecting" })).toBe("closed");
    expect(flowOf(connected(null))).toBe("idle");
    expect(flowOf(connected("None"))).toBe("idle");
    expect(flowOf(connected("Lobby"))).toBe("lobby");
    expect(flowOf(connected("Matchmaking"))).toBe("queue");
    expect(flowOf(connected("ReadyCheck"))).toBe("readyCheck");
    expect(flowOf(connected("ChampSelect"))).toBe("champSelect");
    expect(flowOf(connected("InProgress"))).toBe("inGame");
    expect(flowOf(connected("PreEndOfGame"))).toBe("afterGame");
    expect(flowOf(connected("SomethingNew"))).toBe("idle");
  });
  it("knows the queue steps", () => {
    expect(inQueueFlow("lobby") && inQueueFlow("queue") && inQueueFlow("readyCheck")).toBe(true);
    expect(inQueueFlow("champSelect")).toBe(false);
  });
});

describe("lobbyRoles", () => {
  it("lists the picked roles once, in order", () => {
    expect(lobbyRoles(lobby("MIDDLE", "BOTTOM"))).toEqual(["MIDDLE", "BOTTOM"]);
    expect(lobbyRoles(lobby("MIDDLE", "MIDDLE"))).toEqual(["MIDDLE"]);
  });
  it("is empty for fill, no pick or no lobby", () => {
    expect(lobbyRoles(lobby("FILL", null))).toEqual([]);
    expect(lobbyRoles(lobby(null, null))).toEqual([]);
    expect(lobbyRoles(null)).toEqual([]);
  });
  it("notices fill", () => {
    expect(wantsFill(lobby("MIDDLE", "FILL"))).toBe(true);
    expect(wantsFill(lobby("MIDDLE", "TOP"))).toBe(false);
  });
});
