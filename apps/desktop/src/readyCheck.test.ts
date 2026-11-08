import { describe, expect, it } from "vitest";
import { matchFound } from "./readyCheck";

describe("ready check alert", () => {
  it("fires when the ready check opens", () => {
    expect(matchFound("Matchmaking", "ReadyCheck")).toBe(true);
    expect(matchFound(null, "ReadyCheck")).toBe(true);
  });

  it("does not fire again while it stays open or for other phases", () => {
    expect(matchFound("ReadyCheck", "ReadyCheck")).toBe(false);
    expect(matchFound("ReadyCheck", "ChampSelect")).toBe(false);
    expect(matchFound("Lobby", "Matchmaking")).toBe(false);
  });
});
