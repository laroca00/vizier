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
  it("seeds players, then saves only new ranked games", async () => {
    const { db, sqlite } = fakeD1();
    const now = 10 * DAY;
    const { riot, calls } = fakeRiot((path) => {
      if (path.includes("challengerleagues")) return { entries: [{ puuid: "a" }, { puuid: "b" }] };
      if (path.includes("/ids?")) return path.includes("/a/") ? ["TR1_1", "TR1_2"] : ["TR1_2", "TR1_3"];
      if (path.endsWith("TR1_1")) return match("TR1_1", [participant(103, true), participant(64, false, { teamPosition: "JUNGLE" })]);
      if (path.endsWith("TR1_2")) return match("TR1_2", [participant(103, false)], { gameDuration: 200 });
      if (path.endsWith("TR1_3")) return match("TR1_3", [participant(103, true)], { queueId: 450 });
      return null;
    });

    const result = await new Crawler(db, riot, () => now).run();
    expect(result).toEqual({ seeded: 2, matches: 1 });
    expect(calls.filter((c) => c.includes("/matches/TR1_"))).toHaveLength(3);
    expect(sqlite.prepare("SELECT COUNT(*) AS n FROM crawled_matches").get()).toEqual({ n: 3 });
    expect(sqlite.prepare("SELECT champion_id, team_position, win, spells, items FROM participant_stats ORDER BY champion_id").all()).toEqual([
      { champion_id: 64, team_position: "JUNGLE", win: 0, spells: "4,14", items: "3157,3020,3157" },
      { champion_id: 103, team_position: "MIDDLE", win: 1, spells: "4,14", items: "3157,3020,3157" },
    ]);

    // Same day: no reseed, and already crawled games are skipped.
    const second = await new Crawler(db, riot, () => now + 60_000).run();
    expect(second).toEqual({ seeded: 0, matches: 0 });
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
