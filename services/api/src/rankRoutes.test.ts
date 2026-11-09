import { describe, expect, it } from "vitest";
import { createApp } from "./app.ts";
import { MemoryStore } from "./store.ts";
import { docKey } from "./statDocs.ts";
import { fakeD1 } from "./test/fakeD1.ts";

async function appWith(docs: Record<string, unknown>) {
  const { db } = fakeD1();
  await db.batch(Object.entries(docs).map(([key, body]) => db.prepare("INSERT INTO stat_docs (key, body, updated_at) VALUES (?, ?, 5)").bind(key, JSON.stringify(body))));
  return createApp(new MemoryStore(), { statsDb: db });
}

const json = async (app: ReturnType<typeof createApp>, path: string) => {
  const response = await app.request(path);
  return { status: response.status, body: (await response.json()) as Record<string, unknown> };
};

const docs = {
  [docKey.tierList(420, "MIDDLE")]: { patches: ["16.21"], games: 600, champions: [{ championId: 103 }] },
  [docKey.tierList(420, "MIDDLE", "gold_minus")]: { patches: ["16.21"], games: 40, champions: [{ championId: 7 }] },
  [docKey.champion(420, 103, "MIDDLE")]: { championId: 103, games: 600 },
  [docKey.champion(420, 103, "MIDDLE", "gold_minus")]: { championId: 103, games: 40 },
  [docKey.build(420, 103, "MIDDLE")]: { games: 600, vs: null },
  [docKey.build(420, 103, "MIDDLE", "gold_minus")]: { games: 40, vs: null },
  [docKey.matchupBuilds(103, "MIDDLE", "gold_minus")]: { 238: { games: 20, vs: 238 } },
  [docKey.counters(103, "MIDDLE", "gold_minus")]: { patches: [], games: 40, matchups: [] },
  [docKey.synergies(103, "MIDDLE", "gold_minus")]: { patches: [], games: 40, allies: [] },
  [docKey.lane(103, "MIDDLE", "gold_minus")]: { 238: { games: 12 } },
  [docKey.bench(420, 103, "MIDDLE", "gold_minus")]: { minutes: [{ minute: 10, games: 30 }] },
  [docKey.counters(103, "MIDDLE")]: { patches: [], games: 600, matchups: [] },
};

describe("?rank= on the stats routes", () => {
  it("answers Emerald+ without it, naming the bracket, and the asked bracket with it", async () => {
    const app = await appWith(docs);
    expect((await json(app, "/v1/tierlist/MIDDLE")).body).toMatchObject({ games: 600, rank: "emerald_plus", updatedAt: 5 });
    expect((await json(app, "/v1/tierlist/MIDDLE?rank=emerald_plus")).body).toMatchObject({ games: 600, rank: "emerald_plus" });
    expect((await json(app, "/v1/tierlist/MIDDLE?rank=gold_minus")).body).toMatchObject({ games: 40, rank: "gold_minus" });
    expect((await json(app, "/v1/champions/103?position=MIDDLE&rank=gold_minus")).body).toMatchObject({ games: 40, rank: "gold_minus" });
    expect((await json(app, "/v1/builds/103?position=MIDDLE&rank=gold_minus")).body).toMatchObject({ games: 40, rank: "gold_minus" });
    expect((await json(app, "/v1/builds/103?position=MIDDLE&vs=238&rank=gold_minus")).body).toMatchObject({ games: 20, vs: 238, rank: "gold_minus" });
    expect((await json(app, "/v1/champions/103/counters?position=MIDDLE&rank=gold_minus")).body).toMatchObject({ games: 40, rank: "gold_minus" });
    expect((await json(app, "/v1/champions/103/counters?position=MIDDLE")).body).toMatchObject({ games: 600, rank: "emerald_plus" });
    expect((await json(app, "/v1/champions/103/synergies?position=MIDDLE&rank=gold_minus")).body).toMatchObject({ games: 40, rank: "gold_minus" });
    expect((await json(app, "/v1/champions/103/lane?position=MIDDLE&vs=238&rank=gold_minus")).body).toMatchObject({ games: 12, rank: "gold_minus" });
    expect((await json(app, "/v1/champions/103/bench?position=MIDDLE&rank=gold_minus")).body).toMatchObject({ minutes: [{ minute: 10, games: 30 }], rank: "gold_minus" });
  });

  it("rejects an unknown rank on every route", async () => {
    const app = await appWith(docs);
    for (const path of [
      "/v1/tierlist/MIDDLE",
      "/v1/champions/103",
      "/v1/builds/103?position=MIDDLE",
      "/v1/champions/103/counters?position=MIDDLE",
      "/v1/champions/103/synergies?position=MIDDLE",
      "/v1/champions/103/lane?position=MIDDLE&vs=238",
      "/v1/champions/103/bench?position=MIDDLE",
    ]) {
      const joined = path.includes("?") ? "&" : "?";
      expect((await json(app, `${path}${joined}rank=bronze`)).status, path).toBe(400);
    }
  });

  it("says so when a bracket has no docs instead of using Emerald+", async () => {
    const app = await appWith(docs);
    expect((await json(app, "/v1/tierlist/MIDDLE?rank=master_plus")).body).toEqual({ patches: [], games: 0, champions: [], rank: "master_plus" });
    const missing = await json(app, "/v1/champions/103?position=MIDDLE&rank=diamond_plus");
    expect(missing.status).toBe(404);
    expect(missing.body.rank).toBe("diamond_plus");
    expect((await json(app, "/v1/champions/103/counters?position=MIDDLE&rank=all")).body).toEqual({ patches: [], games: 0, matchups: [], rank: "all" });
  });

  it("leaves other queues unsplit", async () => {
    const app = await appWith({ [docKey.tierList(450, "ALL")]: { patches: ["16.21"], games: 90, champions: [] } });
    expect((await json(app, "/v1/tierlist/ALL?queue=450&rank=gold_minus")).body).toMatchObject({ games: 90, rank: "emerald_plus" });
  });
});
