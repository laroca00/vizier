import { beforeAll, describe, expect, it } from "vitest";
import { emptyCatalog } from "./archetypes.ts";
import { createApp } from "./app.ts";
import { aggregateBuild } from "./builds.ts";
import { Crawler } from "./crawler.ts";
import type { RiotClient } from "./riot/client.ts";
import type { Match, Participant } from "./riot/types.ts";
import { pruneRaw, rollup } from "./rollup.ts";
import { docKey, statDocs } from "./statDocs.ts";
import { arenaDuos, augmentStats, sampleLimits, tierList } from "./stats.ts";
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
    expect(await (await app.request("/v1/tierlist/ALL?queue=450")).json()).toEqual({ patches: [], games: 0, champions: [] });
  });
});
