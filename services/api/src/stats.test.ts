import { beforeAll, describe, expect, it } from "vitest";
import { emptyCatalog } from "./archetypes.ts";
import { aggregateBuild, maxOrder } from "./builds.ts";
import { Crawler } from "./crawler.ts";
import { rollup } from "./rollup.ts";
import type { RiotClient } from "./riot/client.ts";
import type { Match, Participant } from "./riot/types.ts";
import { banSuggestions, sampleLimits, championOverview, counters, synergies, tierList } from "./stats.ts";
import { fakeD1 } from "./test/fakeD1.ts";

const noCatalog = async () => emptyCatalog();

const perks = {
  statPerks: { offense: 5008, flex: 5008, defense: 5011 },
  styles: [
    { description: "primaryStyle", style: 8100, selections: [{ perk: 8112 }, { perk: 8143 }, { perk: 8138 }, { perk: 8106 }] },
    { description: "subStyle", style: 8300, selections: [{ perk: 8345 }, { perk: 8347 }] },
  ],
};

function player(id: number, teamId: number, championId: number, win: boolean, cs: number): Participant {
  return {
    puuid: `p${id}`, participantId: id, teamId, championId, teamPosition: "MIDDLE", win,
    totalMinionsKilled: cs, neutralMinionsKilled: 0, deaths: 3, goldEarned: 12000, visionScore: 20,
    challenges: { laneMinionsFirst10Minutes: cs / 4, killParticipation: 0.5, teamDamagePercentage: 0.25 },
    summoner1Id: 4, summoner2Id: 14, item0: 3157, perks,
  };
}

async function seed(games: { me: number; them: number; win: boolean; version?: string }[]) {
  const { db } = fakeD1();
  const crawler = new Crawler(db, { get: async () => null } as unknown as RiotClient);
  let n = 0;
  for (const g of games) {
    n++;
    const match: Match = {
      metadata: { matchId: `TR1_${n}`, participants: [] },
      info: { gameVersion: g.version ?? "16.21.1", queueId: 420, gameStartTimestamp: n, gameDuration: 1800, participants: [player(1, 100, g.me, g.win, 210 + n), player(6, 200, g.them, !g.win, 180)] },
    };
    await crawler.save(match);
  }
  await rollup(db, noCatalog);
  return db;
}

// The fixtures hold a handful of games, so they use the small sample limits these tests were written for.
beforeAll(() => Object.assign(sampleLimits, { priorGames: 50, tierPriorGames: 50, tierGames: 10, pairGames: 10 }));

describe("maxOrder", () => {
  it("orders Q, W and E by when they reach rank 5", () => {
    expect(maxOrder("131241311132233322")).toEqual([1, 3, 2]);
  });
});

describe("tiers and bans", () => {
  it("ranks champions", async () => {
    const games = [
      ...Array.from({ length: 12 }, () => ({ me: 103, them: 238, win: true })),
      ...Array.from({ length: 12 }, () => ({ me: 7, them: 238, win: false })),
    ];
    const db = await seed(games);
    const tiers = await tierList(db, "MIDDLE");
    expect(tiers.champions[0].championId).toBe(103);
    expect(tiers.champions[0].tier).toBe("S");
    const bans = await banSuggestions(db);
    expect(bans.champions.map((c) => c.championId)).toContain(103);
  });

  it("falls back to every matchup when one has too few games", async () => {
    const db = await seed([
      ...Array.from({ length: 20 }, () => ({ me: 103, them: 238, win: true })),
      ...Array.from({ length: 3 }, () => ({ me: 103, them: 84, win: false })),
    ]);
    const vsZed = await aggregateBuild(db, 103, "MIDDLE", 238);
    expect(vsZed).toMatchObject({ vs: 238, games: 20, winRate: 1 });
    const vsAkali = await aggregateBuild(db, 103, "MIDDLE", 84);
    expect(vsAkali).toMatchObject({ vs: null, games: 23 });
  });
});

describe("champion pages", () => {
  it("summarises a champion and compares the two newest patches", async () => {
    const db = await seed([
      ...Array.from({ length: 10 }, (_, i) => ({ me: 103, them: 238, win: i < 4, version: "16.20.1" })),
      ...Array.from({ length: 10 }, (_, i) => ({ me: 103, them: 238, win: i < 6 })),
    ]);
    const overview = await championOverview(db, 103, null);
    // Pick rate is per match: Ahri is in every one of these.
    expect(overview).toMatchObject({ position: "MIDDLE", games: 20, winRate: 0.5, pickRate: 1, winRateChange: 0.2 });
    expect(overview?.positions).toEqual([{ position: "MIDDLE", games: 20, share: 1 }]);
    // Newest patch first, each with its own games.
    expect(overview?.patchRates?.map((p) => [p.games, p.winRate])).toEqual([[10, 0.6], [10, 0.4]]);
    expect(await championOverview(db, 1, null)).toBeNull();
  });

  it("lists matchups with enough games, hardest first", async () => {
    const db = await seed([
      ...Array.from({ length: 12 }, (_, i) => ({ me: 103, them: 238, win: i < 3 })),
      ...Array.from({ length: 12 }, (_, i) => ({ me: 103, them: 7, win: i < 9 })),
      ...Array.from({ length: 4 }, () => ({ me: 103, them: 84, win: true })),
    ]);
    const result = await counters(db, 103, "MIDDLE");
    expect(result.games).toBe(28);
    expect(result.matchups).toEqual([
      { championId: 238, games: 12, winRate: 0.25 },
      { championId: 7, games: 12, winRate: 0.75 },
    ]);
  });
});

describe("the TR and EUW Emerald+ pool", () => {
  async function saveGames(db: D1Database, prefix: string, count: number, me: number, win: boolean, bans: number[] = []) {
    const crawler = new Crawler(db, { get: async () => null } as unknown as RiotClient);
    for (let n = 1; n <= count; n++) {
      const match: Match = {
        metadata: { matchId: `${prefix}_${me}_${n}`, participants: [] },
        info: {
          gameVersion: "16.21.1",
          queueId: 420,
          gameStartTimestamp: n,
          gameDuration: 1800,
          participants: [player(1, 100, me, win, 200), player(6, 200, 238, !win, 180)],
          teams: [{ teamId: 100, bans: bans.map((championId) => ({ championId, pickTurn: 1 })) }],
        },
      };
      await crawler.save(match);
    }
  }

  it("keeps KR games out of tiers, pick and ban rates but in builds", async () => {
    const { db } = fakeD1();
    await saveGames(db, "TR1", 12, 103, true, [84]);
    await saveGames(db, "KR", 12, 7, true, [84, 157]);
    await rollup(db, noCatalog);

    const tiers = await tierList(db, "MIDDLE");
    expect(tiers.champions.map((c) => c.championId).sort()).toEqual([103, 238]);
    expect(tiers.games).toBe(24);
    // Per match, out of the 12 pool games; Ahri is in all of them.
    expect(tiers.champions.find((c) => c.championId === 103)).toMatchObject({ pickRate: 1, banRate: 0 });
    expect(await championOverview(db, 103, null)).toMatchObject({ banRate: 0, pickRate: 1 });
    // LeBlanc was only played in KR: no tier, but her build is still there.
    expect(await aggregateBuild(db, 7, "MIDDLE", null)).toMatchObject({ games: 12 });
  });

  it("counts bans per pool match", async () => {
    const { db } = fakeD1();
    await saveGames(db, "EUW1", 10, 103, true, [238]);
    await saveGames(db, "TR1", 10, 7, false);
    await rollup(db, noCatalog);
    const tiers = await tierList(db, "MIDDLE");
    expect(tiers.champions.find((c) => c.championId === 238)?.banRate).toBe(0.5);
  });

  it("backfills the pool once from rows rolled up before it existed", async () => {
    const { db, sqlite } = fakeD1();
    await saveGames(db, "TR1", 12, 103, true, [84]);
    await rollup(db, noCatalog);
    const before = await tierList(db, "MIDDLE");

    // As if these rows had been rolled up by the version without pool counts.
    sqlite.prepare("DELETE FROM stat_counts WHERE kind LIKE 'pool%'").run();
    sqlite.prepare("DELETE FROM crawl_state WHERE key = 'pool_backfilled'").run();
    await rollup(db, noCatalog);
    await rollup(db, noCatalog);
    expect(await tierList(db, "MIDDLE")).toEqual(before);
  });
});

describe("synergies and queues", () => {
  it("ranks teammates by how the champion does with them", async () => {
    const { db } = fakeD1();
    const crawler = new Crawler(db, { get: async () => null } as unknown as RiotClient);
    const jungler = (id: number, champion: number, win: boolean) => ({ ...player(id, 100, champion, win, 50), teamPosition: "JUNGLE" });
    for (let n = 1; n <= 20; n++) {
      const withLee = n <= 10;
      const win = withLee ? n <= 8 : n <= 13;
      const match: Match = {
        metadata: { matchId: `TR1_${n}`, participants: [] },
        info: {
          gameVersion: "16.21.1", queueId: 420, gameStartTimestamp: n, gameDuration: 1800,
          participants: [player(1, 100, 103, win, 200), jungler(2, withLee ? 64 : 104, win), player(6, 200, 238, !win, 180)],
        },
      };
      await crawler.save(match);
    }
    await rollup(db, noCatalog);
    const result = await synergies(db, 103, "MIDDLE");
    expect(result.allies).toEqual([
      { championId: 64, position: "JUNGLE", games: 10, winRate: 0.8 },
      { championId: 104, position: "JUNGLE", games: 10, winRate: 0.3 },
    ]);
  });

  it("keeps ARAM games out of ranked tiers and builds", async () => {
    const { db } = fakeD1();
    const crawler = new Crawler(db, { get: async () => null } as unknown as RiotClient);
    for (let n = 1; n <= 12; n++) {
      const match: Match = {
        metadata: { matchId: `TR1_${n}`, participants: [] },
        info: { gameVersion: "16.21.1", queueId: 450, gameStartTimestamp: n, gameDuration: 1200, participants: [player(1, 100, 103, true, 50), player(6, 200, 238, false, 50)] },
      };
      await crawler.save(match);
    }
    await rollup(db, noCatalog);
    expect((await tierList(db, "MIDDLE")).champions).toEqual([]);
    expect(await aggregateBuild(db, 103, null, null)).toBeNull();
    const aram = await tierList(db, "", 450);
    expect(aram.champions.map((c) => [c.championId, c.tier])).toEqual([[103, "S"], [238, "D"]]);
    expect((await championOverview(db, 103, null, 450))?.games).toBe(12);
  });
});
