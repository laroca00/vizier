import { describe, expect, it } from "vitest";
import { createApp } from "./app.ts";
import { docKey } from "./statDocs.ts";
import { MemoryStore } from "./store.ts";
import { fakeD1 } from "./test/fakeD1.ts";

async function setup(docs: Record<string, unknown>) {
  const { db } = fakeD1();
  for (const [key, body] of Object.entries(docs)) {
    await db.prepare("INSERT INTO stat_docs (key, body, updated_at) VALUES (?, ?, 5)").bind(key, JSON.stringify(body)).run();
  }
  return createApp(new MemoryStore(), { statsDb: db });
}

const get = async (app: Awaited<ReturnType<typeof setup>>, path: string) => {
  const response = await app.request(path);
  return { status: response.status, body: (await response.json()) as Record<string, unknown> };
};

describe("?rank=", () => {
  const docs = {
    [docKey.tierList(420, "MIDDLE")]: { patches: ["16.21"], games: 100, champions: [] },
    [docKey.tierList(420, "MIDDLE", "gold_minus")]: { patches: ["16.21"], games: 900, champions: [] },
    [docKey.champion(420, 103, "MIDDLE", "all")]: { games: 99 },
    [docKey.counters(103, "MIDDLE", "diamond_plus")]: { patches: [], games: 7, matchups: [] },
    [docKey.synergies(103, "MIDDLE", "master_plus")]: { patches: [], games: 3, allies: [] },
    [docKey.bench(420, 103, "MIDDLE", "platinum_plus")]: { minutes: [1] },
    [docKey.lane(103, "MIDDLE", "gold_minus")]: { 5: { games: 12 } },
    [docKey.build(420, 103, "MIDDLE", "all")]: { games: 50, variants: [], situational: [] },
    [docKey.tierList(420, "MIDDLE", "emerald_plus", "tr")]: { patches: [], games: 40, champions: [{ championId: 103, games: 40, winRate: 0.6, pickRate: 0.2, tier: "A", winRateChange: null, banRate: 0.1 }] },
    [docKey.champion(420, 103, "MIDDLE")]: { position: "MIDDLE", games: 10, winRate: 0.5, pickRate: 0.1, tier: "B", winRateChange: null, banRate: 0 },
    [docKey.matchupBuilds(103, "MIDDLE", "all")]: { 5: { games: 20, vs: 5 } },
  };

  it("means Emerald+ when missing and names the bracket in the answer", async () => {
    const app = await setup(docs);
    const plain = await get(app, "/v1/tierlist/MIDDLE");
    expect(plain.body).toMatchObject({ games: 100, rank: "emerald_plus", updatedAt: 5 });
    expect((await get(app, "/v1/tierlist/MIDDLE?rank=emerald_plus")).body.games).toBe(100);
  });

  it("reads the bracket's own doc and never falls back to another bracket", async () => {
    const app = await setup(docs);
    expect((await get(app, "/v1/tierlist/MIDDLE?rank=gold_minus")).body).toMatchObject({ games: 900, rank: "gold_minus" });
    expect((await get(app, "/v1/tierlist/MIDDLE?rank=master_plus")).body).toMatchObject({ games: 0, rank: "master_plus" });
    expect((await get(app, "/v1/champions/103?position=MIDDLE&rank=all")).body.games).toBe(99);
    expect((await get(app, "/v1/champions/103?position=MIDDLE&rank=diamond_plus")).status).toBe(404);
  });

  it("covers counters, synergies, bench, lane and builds", async () => {
    const app = await setup(docs);
    expect((await get(app, "/v1/champions/103/counters?position=MIDDLE&rank=diamond_plus")).body).toMatchObject({ games: 7, rank: "diamond_plus" });
    expect((await get(app, "/v1/champions/103/synergies?position=MIDDLE&rank=master_plus")).body.games).toBe(3);
    expect((await get(app, "/v1/champions/103/bench?position=MIDDLE&rank=platinum_plus")).body.minutes).toEqual([1]);
    expect((await get(app, "/v1/champions/103/lane?position=MIDDLE&vs=5&rank=gold_minus")).body).toMatchObject({ games: 12, rank: "gold_minus" });
    expect((await get(app, "/v1/builds/103?position=MIDDLE&rank=all")).body).toMatchObject({ games: 50, rank: "all" });
    expect((await get(app, "/v1/builds/103?position=MIDDLE&vs=5&rank=all")).body).toMatchObject({ games: 20, vs: 5 });
  });

  it("cuts the tier list and champion overview by region, for Emerald+ and all ranks only", async () => {
    const app = await setup(docs);
    expect((await get(app, "/v1/tierlist/MIDDLE?region=tr")).body).toMatchObject({ games: 40, region: "tr", rank: "emerald_plus" });
    // A region without a published list reads as empty, not as the pooled list.
    expect((await get(app, "/v1/tierlist/MIDDLE?region=kr")).body).toMatchObject({ games: 0, region: "kr" });
    expect((await get(app, "/v1/champions/103?position=MIDDLE&region=tr")).body).toMatchObject({ games: 40, winRate: 0.6, tier: "A", region: "tr" });
    expect((await get(app, "/v1/champions/103?position=MIDDLE&region=euw")).body).toMatchObject({ games: 0, tier: null });
    expect((await app.request("/v1/tierlist/MIDDLE?region=xx")).status).toBe(400);
    expect((await app.request("/v1/tierlist/MIDDLE?region=tr&rank=gold_minus")).status).toBe(400);
  });

  it("serves the rank curve doc, empty when none is published", async () => {
    const withDoc = await setup({ [docKey.rankCurve(420)]: { patches: ["16.21"], brackets: ["all"], champions: [{ championId: 103, position: "MIDDLE", b: { all: [50, 0.5, 0.1] } }] } });
    expect((await get(withDoc, "/v1/meta/rank-curve")).body.champions).toHaveLength(1);
    expect((await get(await setup({}), "/v1/meta/rank-curve")).body.champions).toEqual([]);
  });

  it("rejects unknown brackets on every bracketed route", async () => {
    const app = await setup(docs);
    for (const path of [
      "/v1/tierlist/MIDDLE",
      "/v1/champions/103",
      "/v1/champions/103/counters?position=MIDDLE",
      "/v1/champions/103/synergies?position=MIDDLE",
      "/v1/champions/103/bench?position=MIDDLE",
      "/v1/champions/103/lane?position=MIDDLE&vs=5",
      "/v1/builds/103?position=MIDDLE",
    ]) {
      const joiner = path.includes("?") ? "&" : "?";
      expect((await app.request(`${path}${joiner}rank=bronze`)).status).toBe(400);
    }
  });
});
