import { beforeAll, describe, expect, it } from "vitest";
import { emptyCatalog } from "./archetypes.ts";
import { createApp } from "./app.ts";
import { MemoryStore } from "./store.ts";
import { Crawler } from "./crawler.ts";
import type { RiotClient } from "./riot/client.ts";
import type { Match, Participant } from "./riot/types.ts";
import { rollup } from "./rollup.ts";
import { buildHistory, comparePatch, snapshotClosedPatch, snapshotLimits } from "./snapshots.ts";
import { docKey, statDocs } from "./statDocs.ts";
import { sampleLimits } from "./stats.ts";
import { fakeD1 } from "./test/fakeD1.ts";

const noRiot = { get: async () => null } as unknown as RiotClient;
const noCatalog = async () => emptyCatalog();
const DAY = 86_400_000;

const perks = {
  statPerks: { offense: 5008, flex: 5008, defense: 5011 },
  styles: [
    { description: "primaryStyle", style: 8100, selections: [{ perk: 8112 }, { perk: 8143 }, { perk: 8138 }, { perk: 8106 }] },
    { description: "subStyle", style: 8300, selections: [{ perk: 8345 }, { perk: 8347 }] },
  ],
};

function player(id: number, teamId: number, championId: number, win: boolean, item: number): Participant {
  return { puuid: `p${id}`, participantId: id, teamId, championId, teamPosition: "MIDDLE", win, totalMinionsKilled: 200, neutralMinionsKilled: 0, summoner1Id: 4, summoner2Id: 14, item0: item, perks };
}

function game(n: number, version: string, start: number, win: boolean, item: number): Match {
  return {
    metadata: { matchId: `TR1_${n}`, participants: [] },
    info: { gameVersion: version, queueId: 420, gameStartTimestamp: start, gameDuration: 1800, participants: [player(1, 100, 103, win, item), player(6, 200, 238, !win, item)] },
  };
}

async function seed(db: D1Database, from: number, count: number, version: string, start: number, item: number) {
  const crawler = new Crawler(db, noRiot);
  for (let n = from; n < from + count; n++) await crawler.save(game(n, version, start, n % 4 !== 0, item));
}

beforeAll(() => {
  Object.assign(sampleLimits, { priorGames: 50, tierGames: 10, pairGames: 10 });
  Object.assign(snapshotLimits, { newestGames: 10, buildGames: 5 });
});

describe("build snapshots", () => {
  it("keeps the closed patch's build once the newest patch has volume", async () => {
    const { db } = fakeD1();
    await seed(db, 1, 12, "16.20.1", 1 * DAY, 3157);
    await seed(db, 100, 12, "16.21.1", 5 * DAY, 3089);
    await rollup(db, noCatalog);

    expect(await snapshotClosedPatch(db)).toBe(2);
    const history = await buildHistory(db, 103, "MIDDLE");
    expect(history?.snapshots).toHaveLength(1);
    expect(history?.snapshots[0]).toMatchObject({ patch: "16.20", games: 12 });
    expect(history?.snapshots[0].items[0]).toMatchObject({ id: 3157 });
  });

  it("writes a patch only once", async () => {
    const { db } = fakeD1();
    await seed(db, 1, 12, "16.20.1", 1 * DAY, 3157);
    await seed(db, 100, 12, "16.21.1", 5 * DAY, 3089);
    await rollup(db, noCatalog);
    await snapshotClosedPatch(db);
    expect(await snapshotClosedPatch(db)).toBe(0);
  });

  it("waits while the newest patch has only a few games", async () => {
    const { db } = fakeD1();
    await seed(db, 1, 12, "16.20.1", 1 * DAY, 3157);
    await seed(db, 100, 3, "16.21.1", 5 * DAY, 3089);
    await rollup(db, noCatalog);
    expect(await snapshotClosedPatch(db)).toBe(0);
  });

  it("does nothing with a single patch", async () => {
    const { db } = fakeD1();
    await seed(db, 1, 12, "16.20.1", 1 * DAY, 3157);
    await rollup(db, noCatalog);
    expect(await snapshotClosedPatch(db)).toBe(0);
    expect(await buildHistory(db, 103, "MIDDLE")).toBeNull();
  });

  it("publishes the history as a doc and serves it from the route", async () => {
    const { db } = fakeD1();
    await seed(db, 1, 12, "16.20.1", 1 * DAY, 3157);
    await seed(db, 100, 12, "16.21.1", 5 * DAY, 3089);
    await rollup(db, noCatalog);
    await snapshotClosedPatch(db);

    const docs = new Map<string, unknown>();
    for await (const [key, value] of statDocs(db)) docs.set(key, value);
    expect(docs.get(docKey.buildHistory(103, "MIDDLE"))).toMatchObject({ snapshots: [{ patch: "16.20" }] });

    // The Worker serves the published doc; the route returns empty history when none was published.
    const { db: remote } = fakeD1();
    await remote.prepare("INSERT INTO stat_docs (key, body, updated_at) VALUES (?, ?, ?)").bind(docKey.buildHistory(103, "MIDDLE"), JSON.stringify(docs.get(docKey.buildHistory(103, "MIDDLE"))), 1).run();
    const app = createApp(new MemoryStore(), { statsDb: remote });
    const ok = await app.request("/v1/builds/history/103?position=MIDDLE");
    expect(ok.status).toBe(200);
    expect(((await ok.json()) as { snapshots: unknown[] }).snapshots).toHaveLength(1);
    const none = await app.request("/v1/builds/history/266?position=TOP");
    expect(await none.json()).toEqual({ snapshots: [] });
    expect((await app.request("/v1/builds/history/103")).status).toBe(400);
  });
});

describe("comparePatch", () => {
  it("orders by number, not text", () => {
    expect(comparePatch("16.10", "16.9")).toBeGreaterThan(0);
    expect(["16.9", "16.21", "15.24"].sort(comparePatch)).toEqual(["15.24", "16.9", "16.21"]);
  });
});
