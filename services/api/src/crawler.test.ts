import { describe, expect, it } from "vitest";
import { aggregateBuild, parseRuneKey } from "./builds.ts";
import { Crawler, pruneOldPatches, runeKey } from "./crawler.ts";
import type { RiotClient } from "./riot/client.ts";
import type { Match, Participant } from "./riot/types.ts";
import { fakeD1 } from "./test/fakeD1.ts";

const DAY = 86_400_000;

function perks(keystone: number): Participant["perks"] {
  return {
    statPerks: { offense: 5008, flex: 5008, defense: 5011 },
    styles: [
      { description: "primaryStyle", style: 8100, selections: [{ perk: keystone }, { perk: 8143 }, { perk: 8138 }, { perk: 8106 }] },
      { description: "subStyle", style: 8300, selections: [{ perk: 8345 }, { perk: 8347 }] },
    ],
  };
}

function participant(championId: number, win: boolean, extra: Partial<Participant> = {}): Participant {
  return {
    puuid: `p${championId}`,
    championId,
    teamPosition: "MIDDLE",
    win,
    summoner1Id: 14,
    summoner2Id: 4,
    item0: 3157,
    item1: 3020,
    item2: 3157,
    perks: perks(8112),
    ...extra,
  };
}

function match(id: string, participants: Participant[], overrides: Partial<Match["info"]> = {}): Match {
  return {
    metadata: { matchId: id, participants: participants.map((p) => p.puuid) },
    info: { gameVersion: "16.21.1.1", queueId: 420, gameStartTimestamp: 1000, gameDuration: 1800, participants, ...overrides },
  };
}

function fakeRiot(routes: (path: string) => unknown) {
  const calls: string[] = [];
  const riot = {
    get: async (_routing: string, _method: string, path: string) => {
      calls.push(path);
      return routes(path) ?? null;
    },
  } as unknown as RiotClient;
  return { riot, calls };
}

describe("runeKey", () => {
  it("round-trips through parseRuneKey in LCU order", () => {
    const key = runeKey(perks(8112))!;
    expect(key).toBe("8100:8300:8112,8143,8138,8106:8345,8347:5008,5008,5011");
    expect(parseRuneKey(key)).toEqual({
      primaryStyle: 8100,
      subStyle: 8300,
      perks: [8112, 8143, 8138, 8106, 8345, 8347, 5008, 5008, 5011],
    });
  });

  it("rejects incomplete pages", () => {
    expect(runeKey(undefined)).toBeNull();
  });
});

describe("Crawler", () => {
  it("seeds players, then saves only new games from stored queues", async () => {
    const { db, sqlite } = fakeD1();
    const now = 10 * DAY;
    const { riot, calls } = fakeRiot((path) => {
      if (path.includes("challengerleagues")) return { entries: [{ puuid: "a" }, { puuid: "b" }] };
      if (path.includes("/ids?")) {
        if (!path.includes("queue=420")) return [];
        return path.includes("/a/") ? ["TR1_1", "TR1_2"] : ["TR1_2", "TR1_3"];
      }
      if (path.endsWith("TR1_1")) return match("TR1_1", [participant(103, true), participant(64, false, { teamPosition: "JUNGLE" })]);
      if (path.endsWith("TR1_2")) return match("TR1_2", [participant(103, false)], { gameDuration: 200 });
      if (path.endsWith("TR1_3")) return match("TR1_3", [participant(103, true)], { queueId: 450 });
      return null;
    });

    const result = await new Crawler(db, riot, () => now).run();
    // TR and EUW leagues are both asked; this fake answers the same two players for each.
    expect(result).toEqual({ seeded: 4, matches: 2 });
    expect(calls.filter((c) => c.includes("/matches/TR1_") && !c.endsWith("/timeline"))).toHaveLength(3);
    expect(calls.filter((c) => c.endsWith("/timeline")).length).toBeLessThanOrEqual(2);
    expect(sqlite.prepare("SELECT COUNT(*) AS n FROM crawled_matches").get()).toEqual({ n: 3 });
    // TR1_2 is a remake; TR1_3 is ARAM, stored without a role.
    expect(sqlite.prepare("SELECT champion_id, team_position, win, queue_id FROM participant_stats ORDER BY match_id, champion_id").all()).toEqual([
      { champion_id: 64, team_position: "JUNGLE", win: 0, queue_id: 420 },
      { champion_id: 103, team_position: "MIDDLE", win: 1, queue_id: 420 },
      { champion_id: 103, team_position: "", win: 1, queue_id: 450 },
    ]);

    // Same day: no reseed, and already crawled games are skipped.
    const second = await new Crawler(db, riot, () => now + 60_000).run();
    expect(second).toEqual({ seeded: 0, matches: 0 });
  });
});

describe("buildPaths", () => {
  it("reads starting items, skill order and purchases net of undos", async () => {
    const { buildPaths } = await import("./timeline.ts");
    const events = [
      { type: "ITEM_PURCHASED", timestamp: 10_000, participantId: 1, itemId: 1056 },
      { type: "ITEM_PURCHASED", timestamp: 12_000, participantId: 1, itemId: 2003 },
      { type: "ITEM_PURCHASED", timestamp: 13_000, participantId: 1, itemId: 2003 },
      { type: "ITEM_UNDO", timestamp: 14_000, participantId: 1, beforeId: 2003, afterId: 0 },
      { type: "SKILL_LEVEL_UP", timestamp: 70_000, participantId: 1, skillSlot: 1, levelUpType: "NORMAL" },
      { type: "SKILL_LEVEL_UP", timestamp: 200_000, participantId: 1, skillSlot: 3, levelUpType: "NORMAL" },
      { type: "ITEM_PURCHASED", timestamp: 400_000, participantId: 1, itemId: 6655 },
    ];
    const paths = buildPaths({ info: { frames: [{ timestamp: 0, participantFrames: {}, events }] } });
    expect(paths.get(1)).toEqual({ startItems: [1056, 2003], skillOrder: [1, 3], purchases: [1056, 2003, 6655] });
  });
});

describe("aggregateBuild", () => {
  it("ranks runes, spells and items for a champion and position", async () => {
    const { db } = fakeD1();
    const crawler = new Crawler(db, fakeRiot(() => null).riot);
    await crawler.save(match("TR1_1", [participant(103, true)]));
    await crawler.save(match("TR1_2", [participant(103, true)]));
    await crawler.save(match("TR1_3", [participant(103, false, { perks: perks(8128), item1: 6655 })]));

    const build = await aggregateBuild(db, 103, "MIDDLE");
    expect(build).toMatchObject({ patches: ["16.21"], games: 3, winRate: 0.667 });
    expect(build!.runes[0]).toMatchObject({ perks: expect.arrayContaining([8112]), games: 2, winRate: 1 });
    expect(build!.spells).toEqual([{ ids: [4, 14], games: 3, winRate: 0.667 }]);
    expect(build!.items[0]).toEqual({ id: 3157, games: 3, winRate: 0.667 });
    expect(await aggregateBuild(db, 103, "TOP")).toBeNull();
  });
});

describe("pruneOldPatches", () => {
  it("keeps the two newest patches", async () => {
    const { db, sqlite } = fakeD1();
    const crawler = new Crawler(db, fakeRiot(() => null).riot);
    await crawler.save(match("TR1_1", [participant(1, true)], { gameVersion: "16.19.1", gameStartTimestamp: 1 }));
    await crawler.save(match("TR1_2", [participant(1, true)], { gameVersion: "16.20.1", gameStartTimestamp: 2 }));
    await crawler.save(match("TR1_3", [participant(1, true)], { gameVersion: "16.21.1", gameStartTimestamp: 3 }));
    await pruneOldPatches(db);
    expect(sqlite.prepare("SELECT DISTINCT patch FROM participant_stats ORDER BY patch").all()).toEqual([
      { patch: "16.20" },
      { patch: "16.21" },
    ]);
  });
});

describe("other queues", () => {
  it("keeps ranked bans on the match and counts an Arena top four as a win", async () => {
    const { db, sqlite } = fakeD1();
    const crawler = new Crawler(db, fakeRiot(() => null).riot);
    await crawler.save(
      match("TR1_10", [participant(103, true, { teamId: 100 })], {
        teams: [
          { teamId: 100, bans: [{ championId: 238, pickTurn: 1 }, { championId: -1, pickTurn: 2 }] },
          { teamId: 200, bans: [{ championId: 157, pickTurn: 6 }] },
        ],
      }),
    );
    await crawler.save(
      match(
        "TR1_11",
        [
          participant(103, false, { perks: undefined, placement: 3, playerAugment1: 11, playerAugment2: 42 }),
          participant(64, true, { perks: undefined, placement: 6 }),
        ],
        { queueId: 1700 },
      ),
    );
    expect(sqlite.prepare("SELECT match_id, queue_id, bans FROM crawled_matches ORDER BY match_id").all()).toEqual([
      { match_id: "TR1_10", queue_id: 420, bans: "238,157" },
      { match_id: "TR1_11", queue_id: 1700, bans: null },
    ]);
    expect(sqlite.prepare("SELECT champion_id, win, augments, runes, team_id FROM participant_stats WHERE match_id = 'TR1_11' ORDER BY champion_id").all()).toEqual([
      { champion_id: 64, win: 0, augments: null, runes: "", team_id: null },
      { champion_id: 103, win: 1, augments: "11,42", runes: "", team_id: null },
    ]);
  });
});
