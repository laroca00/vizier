import { describe, expect, it } from "vitest";
import { clientOpened, isTrayAction, gameEdge } from "./followClient";

describe("gameEdge", () => {
  it("finds the start and the end of a game", () => {
    expect(gameEdge("ChampSelect", "GameStart")).toBe("start");
    expect(gameEdge("GameStart", "InProgress")).toBeNull();
    expect(gameEdge("InProgress", "WaitingForStats")).toBe("end");
    expect(gameEdge("InProgress", "Reconnect")).toBeNull();
    expect(gameEdge("Lobby", "Matchmaking")).toBeNull();
  });
  it("treats a client that closed mid-game as an end", () => {
    expect(gameEdge("InProgress", null)).toBe("end");
  });
});

describe("clientOpened", () => {
  it("fires once on the step to connected", () => {
    expect(clientOpened("disconnected", "connected")).toBe(true);
    expect(clientOpened("connecting", "connected")).toBe(true);
    expect(clientOpened("connected", "connected")).toBe(false);
    expect(clientOpened("connected", "disconnected")).toBe(false);
  });
});

describe("isTrayAction", () => {
  it("accepts only the two menu actions", () => {
    expect(isTrayAction("overlay")).toBe(true);
    expect(isTrayAction("show")).toBe(false);
  });
});
