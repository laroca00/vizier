import { describe, expect, it } from "vitest";
import { emptyCatalog } from "./archetypes.ts";
import { createApp } from "./app.ts";
import { rollup } from "./rollup.ts";
import { docKey, regionDocs, splitRank } from "./statDocs.ts";
import { MemoryStore } from "./store.ts";
import { fakeD1 } from "./test/fakeD1.ts";

function game(sqlite: ReturnType<typeof fakeD1>["sqlite"], id: string, group: string, win: boolean, bans = "") {
  sqlite.prepare("INSERT INTO crawled_matches (match_id, patch, game_start, queue_id, bans, rank_group) VALUES (?, '16.21', 1000, 420, ?, ?)").run(id, bans, group);
  const row = sqlite.prepare(
    `INSERT INTO participant_stats (match_id, patch, champion_id, team_position, win, runes, spells, items, opponent_champion_id, duration, queue_id, team_id, rank_group)
     VALUES (?, '16.21', ?, 'MIDDLE', ?, '8100:8300:8112,8143,8138,8106:8345,8347:5008,5008,5011', '4,14', '3157', ?, 1800, 420, ?, ?)`,
  );
  row.run(id, 103, win ? 1 : 0, 64, 100, group);
  row.run(id, 64, win ? 0 : 1, 103, 200, group);
}

async function seeded() {
  const local = fakeD1();
  // Ahri: TR 40 games (30 wins) in emerald, EUW 120 (60 wins) in diamond, KR 50 (50 wins) in gold.
  for (let i = 0; i < 40; i++) game(local.sqlite, `TR1_${i}`, "emerald", i < 30, "238");
  for (let i = 0; i < 120; i++) game(local.sqlite, `EUW1_${i}`, "diamond", i < 60, "238");
  for (let i = 0; i < 50; i++) game(local.sqlite, `KR_${i}`, "gold", true);
  await rollup(local.db, async () => ({ ...emptyCatalog(), finished: new Set([3157]) }));
  return local;
}

describe("region docs", () => {
  it("splits tier lists and overviews by platform and bracket", async () => {
    const { db } = await seeded();
    const docs = new Map<string, any>();
    for await (const [key, value] of regionDocs(db, "emerald_plus")) docs.set(key, value);
    // Gold games are outside Emerald+, so KR has no doc.
    expect([...docs.keys()].filter((k) => k.startsWith("tierregion:")).sort()).toEqual(["tierregion:420:MIDDLE:euw", "tierregion:420:MIDDLE:tr"]);
    const tier = { tr: docs.get("tierregion:420:MIDDLE:tr"), euw: docs.get("tierregion:420:MIDDLE:euw") };
    expect(tier.tr.champions.find((c: { championId: number }) => c.championId === 103)).toMatchObject({ games: 40, winRate: 0.75 });
    expect(tier.euw.champions.find((c: { championId: number }) => c.championId === 103)).toMatchObject({ games: 120, winRate: 0.5 });
    const champion = docs.get("champregions:420:103");
    expect(champion.ANY.tr).toMatchObject({ games: 40, winRate: 0.75 });
    expect(champion.MIDDLE.euw).toMatchObject({ games: 120 });
    expect(champion.ANY.kr).toBeUndefined();
    // Bans are counted per region against that region's own games.
    expect(champion.ANY.tr.banRate).toBeNull();

    const all = new Map<string, any>();
    for await (const [key, value] of regionDocs(db, "all")) all.set(key, value);
    expect(all.get("tierregion:420:MIDDLE:kr:r=all").champions.find((c: { championId: number }) => c.championId === 103)).toMatchObject({ games: 50, winRate: 1 });
    expect(splitRank("champregions:420:103:r=all")).toEqual({ base: "champregions:420:103", bracket: "all" });
  });

  it("the pooled Emerald+ doc is unchanged by the region counts", async () => {
    const { sqlite } = await seeded();
    const pooled = sqlite.prepare("SELECT SUM(games) AS g FROM stat_counts WHERE kind = 'pool' AND champion_id = 103").get() as { g: number };
    // TR and EUW only (KR is not in the pool), Emerald+ groups only.
    expect(pooled.g).toBe(160);
  });
});

describe("?region= on the routes", () => {
  async function appOver() {
    const local = await seeded();
    const { db } = local;
    const put = db.prepare("INSERT INTO stat_docs (key, body, updated_at) VALUES (?, ?, 7)");
    const statements = [];
    for (const bracket of ["emerald_plus", "all"] as const) {
      for await (const [key, value] of regionDocs(db, bracket)) statements.push(put.bind(key, JSON.stringify(value)));
    }
    await db.batch(statements);
    return createApp(new MemoryStore(), { statsDb: db });
  }
  const get = async (app: Awaited<ReturnType<typeof appOver>>, path: string) => {
    const response = await app.request(path);
    return { status: response.status, body: (await response.json()) as any };
  };

  it("serves a region's tier list and champion overview", async () => {
    const app = await appOver();
    const tr = await get(app, "/v1/tierlist/MIDDLE?region=tr");
    expect(tr.body).toMatchObject({ region: "tr", rank: "emerald_plus", games: 80 });
    expect((await get(app, "/v1/tierlist/MIDDLE?region=kr&rank=all")).body).toMatchObject({ region: "kr", rank: "all" });
    expect((await get(app, "/v1/champions/103?position=MIDDLE&region=euw")).body).toMatchObject({ region: "euw", games: 120, rank: "emerald_plus" });
    expect((await get(app, "/v1/champions/103?region=kr&rank=all")).body).toMatchObject({ region: "kr", games: 50 });
  });

  it("answers empty or 404 for a region without data and rejects unknown ones", async () => {
    const app = await appOver();
    expect((await get(app, "/v1/tierlist/MIDDLE?region=kr")).body).toEqual({ patches: [], games: 0, champions: [], rank: "emerald_plus", region: "kr" });
    expect((await get(app, "/v1/champions/103?region=kr")).status).toBe(404);
    // Region docs exist for Emerald+ and all only.
    expect((await get(app, "/v1/champions/103?region=tr&rank=gold_minus")).status).toBe(404);
    expect((await get(app, "/v1/tierlist/MIDDLE?region=na")).status).toBe(400);
    expect((await get(app, "/v1/champions/103?region=na")).status).toBe(400);
    // Without it, today's pooled answer.
    expect((await get(app, "/v1/tierlist/MIDDLE")).body.region).toBeUndefined();
  });

  it("keys", () => {
    expect(docKey.tierRegion("TOP", "kr")).toBe("tierregion:420:TOP:kr");
    expect(docKey.championRegions(1, "all")).toBe("champregions:420:1:r=all");
  });
});

describe("rank curve", () => {
  it("lays the six brackets side by side and serves it", async () => {
    const { db, sqlite } = fakeD1();
    // Ahri: 60 silver games (all wins), 80 emerald games (40 wins), 70 diamond games (14 wins).
    for (let i = 0; i < 60; i++) game(sqlite, `EUW1_s${i}`, "silver", true);
    for (let i = 0; i < 80; i++) game(sqlite, `EUW1_e${i}`, "emerald", i < 40);
    for (let i = 0; i < 70; i++) game(sqlite, `EUW1_d${i}`, "diamond", i < 14);
    await rollup(db, async () => ({ ...emptyCatalog(), finished: new Set([3157]) }));
    const { rankCurveDocs } = await import("./statDocs.ts");
    const docs: [string, any][] = [];
    for await (const doc of rankCurveDocs(db)) docs.push(doc as [string, any]);
    expect(docs.map(([key]) => key)).toEqual(["rankcurve:420"]);
    const curve = docs[0][1];
    expect(curve.brackets).toEqual(["all", "gold_minus", "platinum_plus", "emerald_plus", "diamond_plus", "master_plus"]);
    const ahri = curve.entries.find((e: { championId: number; position: string }) => e.championId === 103 && e.position === "MIDDLE");
    expect(ahri.points[0]).toMatchObject([210, 0.543, expect.any(Number)]);
    expect(ahri.points[1]).toMatchObject([60, 1, expect.any(Number)]);
    expect(ahri.points[3]).toMatchObject([150, 0.36, expect.any(Number)]);
    expect(ahri.points[4]).toMatchObject([70, 0.2, expect.any(Number)]);
    expect(ahri.points[5]).toBeNull();

    await db.prepare("INSERT INTO stat_docs (key, body, updated_at) VALUES ('rankcurve:420', ?, 9)").bind(JSON.stringify(curve)).run();
    const app = createApp(new MemoryStore(), { statsDb: db });
    expect(((await (await app.request("/v1/meta/rank-curve")).json()) as any).entries.length).toBe(curve.entries.length);
    const empty = createApp(new MemoryStore(), { statsDb: fakeD1().db });
    expect(await (await empty.request("/v1/meta/rank-curve")).json()).toMatchObject({ entries: [] });
  });
});
