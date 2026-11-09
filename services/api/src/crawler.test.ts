import { describe, expect, it } from "vitest";
import { emptyCatalog } from "./archetypes.ts";
import { aggregateBuild, parseRuneKey } from "./builds.ts";
import { Crawler, GROUP_TIERS, SEED_QUOTA, SEED_SIZE, pruneOldPatches, runeKey } from "./crawler.ts";
import type { RiotClient } from "./riot/client.ts";
import type { Match, Participant } from "./riot/types.ts";
import { rollup } from "./rollup.ts";
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

describe("Crawler in another region", () => {
  it("seeds KR Challenger only and asks the Asia host for games", async () => {
    const { db, sqlite } = fakeD1();
    const routings: string[] = [];
    const riot = {
      get: async (routing: string, _method: string, path: string) => {
        routings.push(`${routing} ${path.split("?")[0]}`);
        if (path.includes("challengerleagues")) return { entries: [{ puuid: "k" }] };
        if (path.includes("/ids?")) return path.includes("queue=420") ? ["KR_1"] : [];
        if (path.endsWith("KR_1")) return match("KR_1", [participant(103, true)]);
        return null;
      },
    } as unknown as RiotClient;
    const options = { region: "asia", platforms: ["kr"], leagues: "challenger", playersPerRun: 5, matchesPerRun: 5, extraMatchesPerRun: 0, timelinesPerRun: 0 } as const;
    expect(await new Crawler(db, riot, () => DAY, { ...options, platforms: [...options.platforms] }).run()).toEqual({ seeded: 1, matches: 1 });
    expect(routings.filter((r) => r.includes("league"))).toEqual(["kr /lol/league/v4/challengerleagues/by-queue/RANKED_SOLO_5x5"]);
    expect(routings.filter((r) => r.includes("/match/")).every((r) => r.startsWith("asia "))).toBe(true);
    expect(sqlite.prepare("SELECT puuid, region FROM crawl_players").all()).toEqual([{ puuid: "k", region: "asia" }]);
  });
});

describe("Other modes", () => {
  it("follows the players of mode games and asks about their own mode, then the others", async () => {
    const { db, sqlite } = fakeD1();
    const asked: string[] = [];
    const riot = {
      get: async (_routing: string, _method: string, path: string) => {
        if (path.includes("challengerleagues")) return { entries: [] };
        if (path.includes("/ids?")) {
          asked.push(`${path.split("/by-puuid/")[1].split("/")[0]}:${new URLSearchParams(path.split("?")[1]).get("queue")}`);
          return [];
        }
        return null;
      },
    } as unknown as RiotClient;
    let now = 30 * DAY;
    const options = { region: "asia", platforms: ["kr"], leagues: "challenger", playersPerRun: 0, matchesPerRun: 5, extraMatchesPerRun: 2, timelinesPerRun: 0 } as const;
    const crawler = new Crawler(db, riot, () => now, { ...options, platforms: [...options.platforms] });
    await crawler.save(match("KR_1", [participant(103, true, { puuid: "aram1" })], { queueId: 450 }));
    await crawler.save(match("KR_3", [participant(157, true, { puuid: "ranked1" })]));
    expect(sqlite.prepare("SELECT puuid, queue_id FROM mode_players").all()).toEqual([{ puuid: "aram1", queue_id: 450 }]);
    // An even two-minute slot asks about the player's own mode.
    await crawler.run();
    expect(asked).toEqual(["aram1:450"]);
    // Odd slots go round every mode, Arena under its live queue.
    for (let slot = 1; slot < 24; slot += 2) {
      now = 30 * DAY + slot * 120_000;
      await crawler.run();
    }
    expect(new Set(asked)).toEqual(new Set(["aram1:450", "aram1:2400", "aram1:2401", "aram1:2403", "aram1:2405", "aram1:1750"]));
  });

  it("stores games of the live Arena queue as Arena", async () => {
    const { db, sqlite } = fakeD1();
    const options = { region: "asia", platforms: ["kr"], leagues: "challenger", playersPerRun: 0, matchesPerRun: 5, extraMatchesPerRun: 2, timelinesPerRun: 0 } as const;
    const crawler = new Crawler(db, {} as RiotClient, () => 30 * DAY, { ...options, platforms: [...options.platforms] });
    expect(await crawler.save(match("KR_9", [participant(64, false, { puuid: "duo1", perks: undefined, placement: 3 })], { queueId: 1750 }))).toBe(true);
    expect(sqlite.prepare("SELECT queue_id FROM crawled_matches").all()).toEqual([{ queue_id: 1700 }]);
    expect(sqlite.prepare("SELECT queue_id, win, runes FROM participant_stats").all()).toEqual([{ queue_id: 1700, win: 1, runes: "" }]);
    expect(sqlite.prepare("SELECT queue_id FROM mode_players").all()).toEqual([{ queue_id: 1700 }]);
  });

  it("stores ARAM games with augments as Mayhem", async () => {
    const { db, sqlite } = fakeD1();
    const options = { region: "asia", platforms: ["kr"], leagues: "challenger", playersPerRun: 0, matchesPerRun: 5, extraMatchesPerRun: 2, timelinesPerRun: 0 } as const;
    const crawler = new Crawler(db, {} as RiotClient, () => 30 * DAY, { ...options, platforms: [...options.platforms] });
    await crawler.save(match("KR_6", [participant(64, true, { puuid: "kiwi2", playerAugment1: 7 })], { queueId: 450 }));
    await crawler.save(match("KR_7", [participant(103, true, { puuid: "aram2" })], { queueId: 450 }));
    expect(sqlite.prepare("SELECT match_id, queue_id FROM crawled_matches ORDER BY match_id").all()).toEqual([
      { match_id: "KR_6", queue_id: 2400 },
      { match_id: "KR_7", queue_id: 450 },
    ]);
  });

  it("stores every ARAM Mayhem queue as Mayhem", async () => {
    const { db, sqlite } = fakeD1();
    const options = { region: "asia", platforms: ["kr"], leagues: "challenger", playersPerRun: 0, matchesPerRun: 5, extraMatchesPerRun: 2, timelinesPerRun: 0 } as const;
    const crawler = new Crawler(db, {} as RiotClient, () => 30 * DAY, { ...options, platforms: [...options.platforms] });
    expect(await crawler.save(match("KR_8", [participant(64, true, { puuid: "kiwi1" })], { queueId: 2403 }))).toBe(true);
    expect(sqlite.prepare("SELECT queue_id FROM crawled_matches").all()).toEqual([{ queue_id: 2400 }]);
    expect(sqlite.prepare("SELECT queue_id FROM mode_players").all()).toEqual([{ queue_id: 2400 }]);
  });

  it("has every player in a run look at a different mode, two weeks back", async () => {
    const { db, sqlite } = fakeD1();
    sqlite.prepare("INSERT INTO crawl_players (puuid, tier, region) VALUES ('a', 'CHALLENGER', 'asia'), ('b', 'CHALLENGER', 'asia'), ('c', 'CHALLENGER', 'asia')").run();
    const asked: { queue: string; start: number }[] = [];
    const riot = {
      get: async (_routing: string, _method: string, path: string) => {
        if (path.includes("challengerleagues")) return { entries: [] };
        const query = path.includes("/ids?") ? new URLSearchParams(path.split("?")[1]) : null;
        if (query && query.get("queue") !== "420") asked.push({ queue: query.get("queue")!, start: Number(query.get("startTime")) });
        return query ? [] : null;
      },
    } as unknown as RiotClient;
    const now = 30 * DAY;
    const options = { region: "asia", platforms: ["kr"], leagues: "challenger", playersPerRun: 3, matchesPerRun: 5, extraMatchesPerRun: 2, timelinesPerRun: 0 } as const;
    await new Crawler(db, riot, () => now, { ...options, platforms: [...options.platforms] }).run();
    expect(asked).toHaveLength(3);
    expect(new Set(asked.map((a) => a.queue)).size).toBe(3);
    expect(asked.every((a) => a.start === Math.floor((now - 14 * DAY) / 1000))).toBe(true);
  });
});

describe("Emerald+ seeding", () => {
  it("samples the apex leagues, asks every Emerald and Diamond division and replaces the old list", async () => {
    const { db, sqlite } = fakeD1();
    sqlite.prepare("INSERT INTO crawl_players (puuid, tier, region) VALUES ('old', 'MASTER', 'europe'), ('k', 'CHALLENGER', 'asia')").run();
    const leaguePaths: string[] = [];
    const riot = {
      get: async (routing: string, _method: string, path: string) => {
        if (!path.includes("/league/")) return null;
        leaguePaths.push(`${routing} ${path}`);
        if (path.includes("/masterleagues")) return { entries: Array.from({ length: 1000 }, (_, i) => ({ puuid: `${routing}-m${i}` })) };
        if (path.includes("leagues/by-queue")) return { entries: [] };
        return [{ puuid: `${routing}-${path.split("RANKED_SOLO_5x5/")[1]}` }];
      },
    } as unknown as RiotClient;
    await new Crawler(db, riot, () => DAY).run();

    const divisions = leaguePaths.filter((p) => p.startsWith("tr1 ") && p.includes("/entries/"));
    expect(divisions).toHaveLength(20);
    for (const division of ["I", "II", "III", "IV"]) {
      expect(divisions.filter((p) => p.includes(`EMERALD/${division}?`))).toHaveLength(3);
      expect(divisions.filter((p) => p.includes(`DIAMOND/${division}?`))).toHaveLength(2);
    }
    const tiers = sqlite.prepare("SELECT tier, COUNT(*) AS n FROM crawl_players WHERE region = 'europe' GROUP BY tier ORDER BY tier").all();
    // 600 of each platform's 1,000 Masters; one player per division page.
    expect(tiers).toEqual([
      { tier: "DIAMOND", n: 16 },
      { tier: "EMERALD", n: 24 },
      { tier: "MASTER", n: 1200 },
    ]);
    expect(sqlite.prepare("SELECT puuid FROM crawl_players WHERE puuid IN ('old', 'k')").all()).toEqual([{ puuid: "k" }]);
  });
});

describe("all-rank seeding", () => {
  const options = { region: "asia", platforms: ["kr"], leagues: "all", playersPerRun: 0, matchesPerRun: 5, extraMatchesPerRun: 0, timelinesPerRun: 0 } as const;
  const pageOf = (path: string) => Number(new URLSearchParams(path.split("?")[1]).get("page"));
  // A ladder where every division has `pages` full pages.
  function ladder(pages: number, fail: (tier: string) => boolean = () => false) {
    const asked: string[] = [];
    const riot = {
      get: async (_routing: string, _method: string, path: string) => {
        if (!path.includes("/league/")) return null;
        asked.push(path);
        if (path.includes("leagues/by-queue")) return { entries: Array.from({ length: 900 }, (_, i) => ({ puuid: `${path.split("/")[4]}-${i}` })) };
        const [, tier, division] = path.match(/SOLO_5x5\/(\w+)\/(\w+)\?/)!;
        if (fail(tier)) return null;
        const page = pageOf(path);
        if (page > pages) return [];
        return Array.from({ length: 205 }, (_, i) => ({ puuid: `${tier}-${division}-${page}-${i}` }));
      },
    } as unknown as RiotClient;
    return { riot, asked };
  }
  const crawler = (db: D1Database, riot: RiotClient) => new Crawler(db, riot, () => DAY, { ...options, platforms: [...options.platforms] });

  it("meets every group's quota and spreads seeds over random pages", async () => {
    const { db, sqlite } = fakeD1();
    const { riot, asked } = ladder(8);
    await crawler(db, riot).run();
    const rows = sqlite.prepare("SELECT tier, COUNT(*) AS n FROM crawl_players GROUP BY tier").all() as { tier: string; n: number }[];
    const byGroup = (group: keyof typeof GROUP_TIERS) => rows.filter((r) => GROUP_TIERS[group].includes(r.tier)).reduce((sum, r) => sum + r.n, 0);
    for (const group of Object.keys(SEED_QUOTA) as (keyof typeof SEED_QUOTA)[]) {
      const quota = Math.round(SEED_SIZE * SEED_QUOTA[group]);
      // Rounded up per division, never short.
      expect(byGroup(group)).toBeGreaterThanOrEqual(quota);
      expect(byGroup(group)).toBeLessThan(quota + 8);
    }
    const pages = new Set(asked.filter((p) => p.includes("/GOLD/")).map(pageOf));
    expect([...pages].every((n) => n >= 1 && n <= 30)).toBe(true);
  });

  it("learns an upper bound for a division's last page from empty pages and stays inside it", async () => {
    const { db, sqlite } = fakeD1();
    await crawler(db, ladder(2).riot).run();
    const bounds = new Map((sqlite.prepare("SELECT key, value FROM crawl_state WHERE key LIKE 'last_page:%'").all() as { key: string; value: string }[]).map((r) => [r.key, Number(r.value)]));
    expect(bounds.size).toBeGreaterThan(0);
    for (const bound of bounds.values()) expect(bound).toBeLessThan(30);
    // A later seed never asks past what it learned.
    sqlite.prepare("DELETE FROM crawl_state WHERE key = 'seeded_at:asia'").run();
    const again = ladder(2);
    await crawler(db, again.riot).run();
    for (const path of again.asked.filter((p) => p.includes("/entries/"))) {
      const [, tier, division] = path.match(/SOLO_5x5\/(\w+)\/(\w+)\?/)!;
      expect(pageOf(path)).toBeLessThanOrEqual(bounds.get(`last_page:kr:${tier}:${division}`) ?? 30);
    }
  });

  it("keeps a tier's old players when its pages fail", async () => {
    const { db, sqlite } = fakeD1();
    sqlite.prepare("INSERT INTO crawl_players (puuid, tier, region) VALUES ('old-gold', 'GOLD', 'asia'), ('old-silver', 'SILVER', 'asia')").run();
    await crawler(db, ladder(3, (tier) => tier === "GOLD").riot).run();
    const players = sqlite.prepare("SELECT puuid FROM crawl_players WHERE tier IN ('GOLD', 'SILVER') AND puuid LIKE 'old-%'").all();
    expect(players).toEqual([{ puuid: "old-gold" }]);
    expect((sqlite.prepare("SELECT COUNT(*) AS n FROM crawl_players WHERE tier = 'SILVER'").get() as { n: number }).n).toBeGreaterThan(100);
  });

  it("leaves the pool alone when nothing comes back", async () => {
    const { db, sqlite } = fakeD1();
    sqlite.prepare("INSERT INTO crawl_players (puuid, tier, region) VALUES ('old', 'GOLD', 'asia')").run();
    await crawler(db, ladder(3, () => true).riot).run();
    expect(sqlite.prepare("SELECT puuid FROM crawl_players WHERE puuid = 'old'").all()).toHaveLength(1);
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
    expect(paths.get(1)).toEqual({ startItems: [1056, 2003], skillOrder: [1, 3], purchases: [1056, 2003, 6655], purchaseTimes: [10, 12, 400] });
  });
});

describe("aggregateBuild", () => {
  it("ranks runes, spells and items for a champion and position", async () => {
    const { db } = fakeD1();
    const crawler = new Crawler(db, fakeRiot(() => null).riot);
    await crawler.save(match("TR1_1", [participant(103, true)]));
    await crawler.save(match("TR1_2", [participant(103, true)]));
    await crawler.save(match("TR1_3", [participant(103, false, { perks: perks(8128), item1: 6655 })]));
    await rollup(db, async () => emptyCatalog());

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
