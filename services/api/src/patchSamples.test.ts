import { beforeAll, describe, expect, it } from "vitest";
import { championOverview, sampleLimits, tierList } from "./stats.ts";
import { fakeD1 } from "./test/fakeD1.ts";

beforeAll(() => Object.assign(sampleLimits, { priorGames: 50, tierGames: 10, pairGames: 10, listGames: 10 }));

function seed(sqlite: ReturnType<typeof fakeD1>["sqlite"], newest: number) {
  sqlite.prepare("INSERT INTO stat_matches (patch, queue_id, games, last_start) VALUES ('16.22', 420, 50, 2000), ('16.21', 420, 500, 1000)").run();
  const insert = sqlite.prepare("INSERT INTO stat_counts_g (rank_group, patch, queue_id, team_position, champion_id, kind, value, games, wins) VALUES ('emerald', ?, 420, 'MIDDLE', 103, ?, '', ?, ?)");
  for (const kind of ["games", "pool"]) {
    insert.run("16.21", kind, 300, 150);
    if (newest > 0) insert.run("16.22", kind, newest, Math.round(newest * 0.6));
  }
}

describe("per-patch samples", () => {
  it("come with tier rows and the champion overview, newest first", async () => {
    const { db, sqlite } = fakeD1();
    seed(sqlite, 12);
    const row = (await tierList(db, "MIDDLE")).champions.find((c) => c.championId === 103);
    expect(row?.byPatch).toEqual([
      { patch: "16.22", games: 12, winRate: 0.583 },
      { patch: "16.21", games: 300, winRate: 0.5 },
    ]);
    expect((await championOverview(db, 103, "MIDDLE"))?.byPatch).toEqual(row?.byPatch);
  });

  it("list a patch without games as zero", async () => {
    const { db, sqlite } = fakeD1();
    seed(sqlite, 0);
    const row = (await tierList(db, "MIDDLE")).champions.find((c) => c.championId === 103);
    expect(row?.byPatch?.[0]).toEqual({ patch: "16.22", games: 0, winRate: 0 });
  });
});
