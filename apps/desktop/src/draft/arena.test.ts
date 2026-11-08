import { describe, expect, it } from "vitest";
import type { ChampSelect, DraftMember } from "../lcu";
import { duoPicks, isArena } from "./arena";

const member = (over: Partial<DraftMember>): DraftMember => ({ cellId: 0, championId: 0, pickIntent: 0, position: "", spells: [4, 14], isLocal: false, ...over });
const draft = (myTeam: DraftMember[]): ChampSelect => ({ myTeam, theirTeam: [], bans: [], phase: "BAN_PICK", turn: null, phaseEndsAt: 0 });

describe("isArena", () => {
  it("is a two-player team without roles", () => {
    expect(isArena(draft([member({ isLocal: true }), member({})]))).toBe(true);
  });
  it("is not a five-player team or a duo with roles", () => {
    expect(isArena(draft(Array.from({ length: 5 }, () => member({}))))).toBe(false);
    expect(isArena(draft([member({ position: "top" }), member({ position: "jungle" })]))).toBe(false);
  });
});

describe("duoPicks", () => {
  const duos = {
    patches: ["16.21"],
    games: 900,
    partners: [
      { championId: 1, games: 120, winRate: 0.7 },
      { championId: 2, games: 80, winRate: 0.65 },
      { championId: 3, games: 60, winRate: 0.6 },
    ],
  };
  it("drops taken champions, keeps the order and flags the pool", () => {
    expect(duoPicks(duos, new Set([1]), new Set([3]))).toEqual([
      { championId: 2, games: 80, winRate: 0.65, inPool: false },
      { championId: 3, games: 60, winRate: 0.6, inPool: true },
    ]);
  });
  it("limits the list", () => {
    expect(duoPicks(duos, new Set(), new Set(), 2)).toHaveLength(2);
  });
});
