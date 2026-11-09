import { beforeAll, describe, expect, it } from "vitest";
import { emptyCatalog } from "./archetypes.ts";
import { createApp } from "./app.ts";
import { aggregateBuild } from "./builds.ts";
import { Crawler } from "./crawler.ts";
import type { RiotClient } from "./riot/client.ts";
import type { Match, Participant } from "./riot/types.ts";
import { pruneRaw, rollup } from "./rollup.ts";
import { docKey, statDocs } from "./statDocs.ts";
import { arenaDuos, arenaItems, augmentChampions, augmentStats, benchStats, itemTimes, laneStats, sampleLimits, tierList } from "./stats.ts";
import { MemoryStore } from "./store.ts";
import { fakeD1 } from "./test/fakeD1.ts";

const DAY = 86_400_000;
const noRiot = { get: async () => null } as unknown as RiotClient;
const noCatalog = async () => emptyCatalog();

const perks = {
  statPerks: { offense: 5008, flex: 5008, defense: 5011 },
  styles: [
    { description: "primaryStyle", style: 8100, selections: [{ perk: 8112 }, { perk: 8143 }, { perk: 8138 }, { perk: 8106 }] },
    { description: "subStyle", style: 8300, selections: [{ perk: 8345 }, { perk: 8347 }] },
  ],
};

function player(id: number, teamId: number, championId: number, win: boolean): Participant {
  return {
    puuid: `p${id}`, participantId: id, teamId, championId, teamPosition: "MIDDLE", win,
    totalMinionsKilled: 200, neutralMinionsKilled: 0, summoner1Id: 4, summoner2Id: 14, item0: 3157, perks,
  };
}

function game(n: number, win: boolean, start = n): Match {
  return {
    metadata: { matchId: `TR1_${n}`, participants: [] },
    info: { gameVersion: "16.21.1", queueId: 420, gameStartTimestamp: start, gameDuration: 1800, participants: [player(1, 100, 103, win), player(6, 200, 238, !win)] },
  };
}

async function seed(db: D1Database, from: number, count: number, start?: number) {
  const crawler = new Crawler(db, noRiot);
  for (let n = from; n < from + count; n++) await crawler.save(game(n, n % 4 !== 0, start));
}

// The fixtures hold a handful of games, so they use the small sample limits these tests were written for.
beforeAll(() => Object.assign(sampleLimits, { priorGames: 50, tierGames: 10, pairGames: 10 }));

describe("rollup", () => {
  it("counts each row once, however often it runs", async () => {
    const { db } = fakeD1();
    await seed(db, 1, 12);
    expect(await rollup(db, noCatalog)).toBe(24);
    expect(await rollup(db, noCatalog)).toBe(0);
    await seed(db, 13, 4);
    await rollup(db, noCatalog);

    const tiers = await tierList(db, "MIDDLE");
    expect(tiers.champions.find((c) => c.championId === 103)).toMatchObject({ games: 16, winRate: 0.75 });
    expect(await aggregateBuild(db, 103, "MIDDLE", 238)).toMatchObject({ vs: 238, games: 16 });
  });

  it("deletes raw rows after a few days but keeps their counts", async () => {
    const { db, sqlite } = fakeD1();
    const now = 10 * DAY;
    await seed(db, 1, 12, now - 5 * DAY);
    await seed(db, 13, 12, now - DAY);
    await rollup(db, noCatalog);
    await pruneRaw(db, now);

    const left = sqlite.prepare("SELECT COUNT(DISTINCT match_id) AS n FROM participant_stats").get();
    expect(left).toEqual({ n: 12 });
    expect((await tierList(db, "MIDDLE")).champions.find((c) => c.championId === 103)?.games).toBe(24);
  });
});

describe("augments", () => {
  it("counts Arena augments per champion and overall", async () => {
    const { db } = fakeD1();
    const crawler = new Crawler(db, noRiot);
    for (let n = 1; n <= 12; n++) {
      const top4 = n % 3 !== 0;
      const match = game(n, top4);
      match.metadata.matchId = `TR1_A${n}`;
      match.info.queueId = 1700;
      match.info.participants = [
        // Arena counts a top-four placement as a win.
        { ...player(1, 100, 103, false), teamPosition: "", placement: top4 ? 2 : 6, playerAugment1: 7, playerAugment2: n % 2 ? 9 : 11 } as Participant,
        { ...player(2, 200, 238, false), teamPosition: "", placement: top4 ? 6 : 2, playerAugment1: 9 } as Participant,
      ];
      await crawler.save(match);
    }
    await rollup(db, noCatalog);
    const ahri = await augmentStats(db, 1700, 103);
    expect(ahri.games).toBe(12);
    expect(ahri.augments.find((a) => a.augmentId === 7)).toMatchObject({ games: 12, pickRate: 1, winRate: 0.667 });
    const all = await augmentStats(db, 1700, null);
    expect(all.augments.find((a) => a.augmentId === 9)?.games).toBe(18);
    expect((await augmentStats(db, 2400, null)).augments).toEqual([]);
  });

  it("rates augments against the champion's own rate and lists the champions each one suits", async () => {
    const { db } = fakeD1();
    const crawler = new Crawler(db, noRiot);
    for (let n = 1; n <= 40; n++) {
      // Ahri finishes top four in 3 of 4 games; augment 9 wins every game, 11 only half.
      const nine = n % 2 === 1;
      const top4 = nine || n % 4 === 0;
      const match = game(n, top4);
      match.metadata.matchId = `TR1_L${n}`;
      match.info.queueId = 1700;
      match.info.participants = [
        { ...player(1, 100, 103, false), teamPosition: "", placement: top4 ? 2 : 6, playerAugment1: nine ? 9 : 11 } as Participant,
        { ...player(2, 200, 238, false), teamPosition: "", placement: top4 ? 6 : 2, playerAugment1: 9 } as Participant,
      ];
      await crawler.save(match);
    }
    await rollup(db, noCatalog);
    const ahri = await augmentStats(db, 1700, 103);
    const nine = ahri.augments.find((a) => a.augmentId === 9)!;
    const eleven = ahri.augments.find((a) => a.augmentId === 11)!;
    expect(nine.delta).toBe(0.25);
    expect(eleven.delta).toBe(-0.25);
    expect(ahri.augments[0].augmentId).toBe(9);

    const suits = await augmentChampions(db, 1700);
    const forNine = suits.augments.find((a) => a.augmentId === 9)!;
    expect(forNine.champions.map((c) => c.championId)).toEqual([103, 238]);
    expect(forNine.champions[0]).toMatchObject({ games: 20, winRate: 1, delta: 0.25 });
    expect((await augmentChampions(db, 2400)).augments).toEqual([]);
  });
});

describe("arena duos", () => {
  it("pairs the two players of a subteam and counts a top-four finish as a win", async () => {
    const { db } = fakeD1();
    const crawler = new Crawler(db, noRiot);
    for (let n = 1; n <= 12; n++) {
      const top4 = n % 3 !== 0;
      const match = game(n, top4);
      match.metadata.matchId = `TR1_D${n}`;
      match.info.queueId = 1700;
      // Both sides share a teamId in this fixture; the subteam is what separates the duos.
      const arena = (id: number, subteam: number, champion: number, place: number) =>
        ({ ...player(id, 100, champion, false), teamPosition: "", placement: place, playerSubteamId: subteam }) as Participant;
      match.info.participants = [
        arena(1, 1, 103, top4 ? 2 : 6),
        arena(2, 1, 238, top4 ? 2 : 6),
        arena(3, 2, 64, top4 ? 6 : 2),
        arena(4, 2, 157, top4 ? 6 : 2),
      ];
      await crawler.save(match);
    }
    await rollup(db, noCatalog);
    const ahri = await arenaDuos(db, 103);
    expect(ahri.partners).toEqual([{ championId: 238, games: 12, winRate: 0.667 }]);
    expect((await arenaDuos(db, 64)).partners).toEqual([{ championId: 157, games: 12, winRate: 0.333 }]);
    expect((await arenaDuos(db, 999)).partners).toEqual([]);

    // The same games also carry item counts; player() buys item 3157 in every game.
    expect(await arenaItems(db, 103)).toMatchObject({ games: 12, items: [{ id: 3157, games: 12, pickRate: 1, winRate: 0.667 }] });
    expect((await arenaItems(db, 999)).items).toEqual([]);
  });
});

describe("lane stats", () => {
  // A timeline with a frame per minute up to 16, where gold and CS grow at a per-player rate.
  const timeline = (rates: Record<number, { gold: number; cs: number }>) => ({
    info: {
      frames: Array.from({ length: 17 }, (_, minute) => ({
        timestamp: minute * 60_000,
        participantFrames: Object.fromEntries(
          Object.entries(rates).map(([id, r]) => [id, { totalGold: r.gold * minute, xp: 0, minionsKilled: r.cs * minute, jungleMinionsKilled: 0, level: 1 }]),
        ),
        events: [],
      })),
    },
  });

  it("averages what a champion is ahead by against its lane opponent", async () => {
    const { db } = fakeD1();
    const crawler = new Crawler(db, noRiot);
    for (let n = 1; n <= 12; n++) {
      const match = game(n, true);
      match.metadata.matchId = `TR1_L${n}`;
      match.info.participants = [
        { ...player(1, 100, 103, true), firstBloodKill: n <= 3 },
        { ...player(6, 200, 238, false), firstBloodKill: false },
      ];
      await crawler.save(match, timeline({ 1: { gold: 400, cs: 8 }, 6: { gold: 350, cs: 7 } }));
    }
    await rollup(db, noCatalog);
    const lane = await laneStats(db, 103, "MIDDLE");
    expect(lane[238]).toEqual({ games: 12, csDiff10: 10, csDiff15: 15, goldDiff10: 500, goldDiff15: 750, firstBloodRate: 0.25 });
    expect((await laneStats(db, 238, "MIDDLE"))[103]).toMatchObject({ games: 12, csDiff10: -10, goldDiff15: -750, firstBloodRate: 0 });
    expect(await laneStats(db, 103, "TOP")).toEqual({});
  });

  it("skips games without timelines", async () => {
    const { db } = fakeD1();
    await seed(db, 1, 12);
    await rollup(db, noCatalog);
    expect(await laneStats(db, 103, "MIDDLE")).toEqual({});
  });
});

describe("benchmark", () => {
  // CS grows by 8 a minute and the level by one every two minutes.
  const timeline = {
    info: {
      frames: Array.from({ length: 17 }, (_, minute) => ({
        timestamp: minute * 60_000,
        participantFrames: { 1: { totalGold: 0, xp: 0, minionsKilled: 8 * minute, jungleMinionsKilled: 0, level: 1 + Math.floor(minute / 2) } },
        events: [],
      })),
    },
  };

  async function seedBench(count: number) {
    const { db } = fakeD1();
    const crawler = new Crawler(db, noRiot);
    for (let n = 1; n <= count; n++) {
      const match = game(n, true);
      match.metadata.matchId = `TR1_B${n}`;
      match.info.participants = [player(1, 100, 103, true)];
      await crawler.save(match, timeline);
    }
    await rollup(db, noCatalog);
    return db;
  }

  it("averages CS and level at the sample minutes with their game counts", async () => {
    const db = await seedBench(20);
    const { minutes } = await benchStats(db, 103, "MIDDLE");
    expect(minutes.map((m) => m.minute)).toEqual([3, 5, 8, 10, 12, 15]);
    expect(minutes[3]).toEqual({ minute: 10, games: 20, cs: 80, level: 6 });
    expect(minutes[5]).toEqual({ minute: 15, games: 20, cs: 120, level: 8 });
    expect((await benchStats(db, 103, "TOP")).minutes).toEqual([]);
  });

  it("adds kills, deaths, assists and kill participation when timelines carried them", async () => {
    // The player kills at minute 2, dies at minute 4 and kills again at minute 6.
    const events = (minute: number) =>
      minute === 2
        ? [{ type: "CHAMPION_KILL", timestamp: 110_000, killerId: 1, victimId: 6, assistingParticipantIds: [] }]
        : minute === 4
          ? [{ type: "CHAMPION_KILL", timestamp: 230_000, killerId: 6, victimId: 1, assistingParticipantIds: [] }]
          : minute === 6
            ? [{ type: "CHAMPION_KILL", timestamp: 350_000, killerId: 1, victimId: 7, assistingParticipantIds: [] }]
            : [];
    const withKills = {
      info: { frames: timeline.info.frames.map((f, minute) => ({ ...f, events: events(minute) })) },
    };
    const { db } = fakeD1();
    const crawler = new Crawler(db, noRiot);
    for (let n = 1; n <= 20; n++) {
      const match = game(n, true);
      match.metadata.matchId = `TR1_K${n}`;
      match.info.participants = [player(1, 100, 103, true)];
      await crawler.save(match, withKills);
    }
    await rollup(db, noCatalog);
    const { minutes } = await benchStats(db, 103, "MIDDLE");
    const at = (m: number) => minutes.find((x) => x.minute === m)!;
    expect(at(3)).toMatchObject({ kdaGames: 20, kills: 1, deaths: 0, assists: 0, killParticipation: 1 });
    expect(at(8)).toMatchObject({ kills: 2, deaths: 1, assists: 0, killParticipation: 1 });
  });

  it("keeps CS and level when no game carried kills", async () => {
    const { minutes } = await benchStats(await seedBench(20), 103, "MIDDLE");
    expect(minutes[0].killParticipation).toBeUndefined();
  });

  it("hides minutes with too few games", async () => {
    expect((await benchStats(await seedBench(5), 103, "MIDDLE")).minutes).toEqual([]);
  });

  it("is published as a doc and served", async () => {
    const db = await seedBench(20);
    const keys: string[] = [];
    for await (const [key] of statDocs(db)) keys.push(key);
    expect(keys).toContain(docKey.bench(420, 103, "MIDDLE"));
  });
});

describe("item completion times", () => {
  it("averages the first time a finished item was bought", async () => {
    const { db } = fakeD1();
    const crawler = new Crawler(db, noRiot);
    const finishedCatalog = async () => ({ ...emptyCatalog(), finished: new Set([3157]) });
    for (let n = 1; n <= 12; n++) {
      const match = game(n, true);
      match.metadata.matchId = `TR1_T${n}`;
      match.info.participants = [player(1, 100, 103, true)];
      const events = [
        { type: "ITEM_PURCHASED", timestamp: 100_000, participantId: 1, itemId: 1052 },
        { type: "ITEM_PURCHASED", timestamp: (n % 2 ? 600_000 : 720_000), participantId: 1, itemId: 3157 },
        { type: "ITEM_PURCHASED", timestamp: 900_000, participantId: 1, itemId: 3157 },
      ];
      await crawler.save(match, { info: { frames: [{ timestamp: 0, participantFrames: {}, events }] } });
    }
    await rollup(db, finishedCatalog);
    expect(await itemTimes(db, 103, "MIDDLE")).toEqual({ 3157: { games: 12, minute: 11 } });
    expect(await itemTimes(db, 103, "TOP")).toEqual({});
  });
});

describe("rune and skill detail", () => {
  it("counts every single rune and lists the common skill orders with their share", async () => {
    const { db } = fakeD1();
    const crawler = new Crawler(db, noRiot);
    const levels = (slots: number[]) => ({
      info: {
        frames: [
          {
            timestamp: 0,
            participantFrames: {},
            events: slots.map((skillSlot, i) => ({ type: "SKILL_LEVEL_UP", timestamp: i * 1000, participantId: 1, skillSlot, levelUpType: "NORMAL" })),
          },
        ],
      },
    });
    for (let n = 1; n <= 12; n++) {
      const order = n <= 9 ? [1, 2, 3, 1, 1, 4, 1, 2, 1, 2, 4, 2, 2, 3, 3, 4, 3, 3] : [2, 1, 3, 2, 2, 4, 2, 1, 2, 1, 4, 1, 1, 3, 3, 4, 3, 3];
      await crawler.save(game(n, n % 3 !== 0), levels(order));
    }
    await rollup(db, noCatalog);
    const build = await aggregateBuild(db, 103, "MIDDLE");
    expect(build?.perkGames).toBe(12);
    expect(build?.perks.find((p) => p.id === 8112)).toEqual({ id: 8112, games: 12, winRate: 0.667 });
    expect(build?.perks.some((p) => p.id === 0)).toBe(false);
    expect(build?.perks.map((p) => p.id)).toEqual(expect.arrayContaining([8143, 8345, 5008, 5011]));
    expect(build?.skillOptions.map((o) => [o.games, o.share])).toEqual([[9, 0.75], [3, 0.25]]);
    expect(build?.skillOptions[0].maxOrder).toEqual([1, 2, 3]);
    expect(build?.skillOptions[0].firstLevels).toEqual([1, 2, 3]);
  });
});

describe("stat docs", () => {
  it("publishes what the API serves, and the API reads it back", async () => {
    const { db } = fakeD1();
    await seed(db, 1, 20);
    await rollup(db, noCatalog);

    const insert = db.prepare("INSERT INTO stat_docs (key, body, updated_at) VALUES (?, ?, 0)");
    const keys: string[] = [];
    for await (const [key, value] of statDocs(db)) {
      keys.push(key);
      if (value !== null) await insert.bind(key, JSON.stringify(value)).run();
    }
    expect(keys).toEqual(
      expect.arrayContaining([
        docKey.tierList(420, "MIDDLE"),
        docKey.champion(420, 103, "MIDDLE"),
        docKey.build(420, 103, "MIDDLE"),
        docKey.matchupBuilds(103, "MIDDLE"),
        docKey.counters(103, "MIDDLE"),
        docKey.buildIndex(),
      ]),
    );

    const app = createApp(new MemoryStore(), { statsDb: db });
    const list = (await (await app.request("/v1/tierlist/MIDDLE")).json()) as { champions: { championId: number }[] };
    expect(list.champions.map((c) => c.championId)).toContain(103);
    expect(await (await app.request("/v1/builds/103?position=MIDDLE&vs=238")).json()).toMatchObject({ vs: 238, games: 20 });
    // Too few games against this opponent: the champion's overall build.
    expect(await (await app.request("/v1/builds/103?position=MIDDLE&vs=84")).json()).toMatchObject({ vs: null, games: 20 });
    expect((await app.request("/v1/builds/1?position=MIDDLE")).status).toBe(404);
    const index = (await (await app.request("/v1/builds/index")).json()) as { builds: { championId: number; position: string; games: number }[] };
    expect(index.builds).toContainEqual(expect.objectContaining({ championId: 103, position: "MIDDLE", games: 20 }));
    // No ARAM games were crawled, so nothing was published for it.
    expect(await (await app.request("/v1/tierlist/ALL?queue=450")).json()).toEqual({ patches: [], games: 0, champions: [], rank: "emerald_plus" });
  });
});
