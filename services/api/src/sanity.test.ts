import { describe, expect, it } from "vitest";
import { sanityChecks } from "./sanity.ts";
import { fakeD1 } from "./test/fakeD1.ts";

/** Adds counts straight to the grouped table: 'games' per champion and role, and 'matches'. */
function counts(sqlite: ReturnType<typeof fakeD1>["sqlite"], opts: { champions: number; perChampion: number; wins: number; matches: number | null }) {
  sqlite.prepare("INSERT INTO stat_matches (patch, queue_id, games, last_start) VALUES ('16.21', 420, 100, 1000)").run();
  const insert = sqlite.prepare("INSERT INTO stat_counts_g (rank_group, patch, queue_id, team_position, champion_id, kind, value, games, wins) VALUES ('emerald', '16.21', 420, ?, ?, ?, ?, ?, ?)");
  for (let c = 1; c <= opts.champions; c++) insert.run("TOP", c, "games", "", opts.perChampion, Math.round(opts.perChampion * opts.wins));
  if (opts.matches !== null) insert.run("", 0, "matches", "EUW1", opts.matches, 0);
}

describe("sanityChecks", () => {
  it("passes a healthy bracket", async () => {
    const { db, sqlite } = fakeD1();
    counts(sqlite, { champions: 20, perChampion: 500, wins: 0.5, matches: 1000 });
    expect(await sanityChecks(db, "emerald_plus")).toEqual({ ok: true, problems: [], skipped: [] });
  });

  it("holds a bracket whose win rate drifts from 50%", async () => {
    const { db, sqlite } = fakeD1();
    counts(sqlite, { champions: 20, perChampion: 500, wins: 0.56, matches: 1000 });
    const result = await sanityChecks(db, "emerald_plus");
    expect(result.ok).toBe(false);
    expect(result.problems[0]).toMatch(/win rate over all champions is 56\.0%/);
  });

  it("holds a bracket with too many or too few players a game", async () => {
    const many = fakeD1();
    counts(many.sqlite, { champions: 20, perChampion: 500, wins: 0.5, matches: 950 });
    expect((await sanityChecks(many.db, "emerald_plus")).problems[0]).toMatch(/10\.53 players a game/);
    const few = fakeD1();
    counts(few.sqlite, { champions: 20, perChampion: 500, wins: 0.5, matches: 1400 });
    expect((await sanityChecks(few.db, "emerald_plus")).ok).toBe(false);
  });

  it("holds a bracket where one champion has more games than were played", async () => {
    const { db, sqlite } = fakeD1();
    counts(sqlite, { champions: 20, perChampion: 500, wins: 0.5, matches: 1000 });
    sqlite.prepare("UPDATE stat_counts_g SET games = 1200, wins = 600 WHERE champion_id = 1").run();
    sqlite.prepare("UPDATE stat_counts_g SET games = 300, wins = 150 WHERE champion_id = 2").run();
    const result = await sanityChecks(db, "emerald_plus");
    expect(result.problems.some((p) => p.startsWith("champion 1 has 1200 games out of 1000"))).toBe(true);
  });

  it("skips the game-count checks when the counts are from before games were counted, and thin brackets", async () => {
    const old = fakeD1();
    counts(old.sqlite, { champions: 20, perChampion: 500, wins: 0.5, matches: null });
    expect(await sanityChecks(old.db, "emerald_plus")).toMatchObject({ ok: true, skipped: ["game counts are incomplete after the upgrade"] });
    const thin = fakeD1();
    counts(thin.sqlite, { champions: 3, perChampion: 50, wins: 0.9, matches: 15 });
    expect(await sanityChecks(thin.db, "gold_minus")).toMatchObject({ ok: true, skipped: [expect.stringContaining("player rows")] });
  });
});
