import { beforeAll, describe, expect, it } from "vitest";
import { emptyCatalog } from "./archetypes.ts";
import { createApp } from "./app.ts";
import { aggregateBuild } from "./builds.ts";
import { Crawler } from "./crawler.ts";
import type { RiotClient } from "./riot/client.ts";
import type { Match, Participant } from "./riot/types.ts";
import { pruneRaw, rollup } from "./rollup.ts";
import { docKey, statDocs } from "./statDocs.ts";
import { sampleLimits, tierList } from "./stats.ts";
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
