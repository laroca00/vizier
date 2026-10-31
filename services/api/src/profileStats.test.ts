import { describe, expect, it } from "vitest";
import { championPool, ladderPoints, lpHistory, recordLp } from "./profileStats.ts";
import type { Match } from "./riot/types.ts";
import { fakeD1 } from "./test/fakeD1.ts";

const game = (championId: number, win: boolean, k: number): Match => ({
  metadata: { matchId: `TR1_${Math.random()}`, participants: [] },
  info: {
    gameVersion: "16.21.1", queueId: 420, gameStartTimestamp: 1, gameDuration: 1800,
    participants: [{ puuid: "me", championId, teamPosition: "MIDDLE", win, kills: k, deaths: 2, assists: 4 }, { puuid: "x", championId: 1, teamPosition: "MIDDLE", win: !win }],
  },
});

describe("championPool", () => {
  it("counts games, wins and KDA per champion, most played first", () => {
    const pool = championPool([game(103, true, 5), game(238, false, 1), game(103, false, 3)], "me");
    expect(pool).toEqual([
      { championId: 103, games: 2, wins: 1, kills: 8, deaths: 4, assists: 8 },
      { championId: 238, games: 1, wins: 0, kills: 1, deaths: 2, assists: 4 },
    ]);
  });
});

describe("LP history", () => {
  it("places ranks on one ladder", () => {
    expect(ladderPoints("IRON", "IV", 0)).toBe(0);
    expect(ladderPoints("EMERALD", "II", 45)).toBe(5 * 400 + 200 + 45);
    expect(ladderPoints("MASTER", "I", 120)).toBe(2920);
  });

  it("only records a queue when the standing changed", async () => {
    const { db } = fakeD1();
    const solo = { queueType: "RANKED_SOLO_5x5", tier: "EMERALD", rank: "II", leaguePoints: 45, wins: 60, losses: 50 };
    expect(await recordLp(db, "me", [solo], 1)).toBe(1);
    expect(await recordLp(db, "me", [solo], 2)).toBe(0);
    expect(await recordLp(db, "me", [{ ...solo, leaguePoints: 66, wins: 61 }], 3)).toBe(1);
    const history = await lpHistory(db, "me", "RANKED_SOLO_5x5");
    expect(history.map((h) => [h.at, h.lp, h.points])).toEqual([
      [1, 45, 2245],
      [3, 66, 2266],
    ]);
  });
});
