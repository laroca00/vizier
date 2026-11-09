import { describe, expect, it } from "vitest";
import { gameEdge } from "./followClient";

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
