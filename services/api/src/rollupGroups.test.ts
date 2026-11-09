import { BRACKETS, groupsOf, groupsSql } from "@vizier/shared/brackets";
import { describe, expect, it } from "vitest";
import { emptyCatalog } from "./archetypes.ts";
import { rollup } from "./rollup.ts";
import { fakeD1 } from "./test/fakeD1.ts";

const csv = (n: number, step: number) => Array.from({ length: n }, (_, i) => (i + 1) * step).join(",");
const catalog = async () => ({ ...emptyCatalog(), finished: new Set([3157, 6655]) });

/** One ranked game: two mid laners who face each other, with timeline data. */
function game(db: ReturnType<typeof fakeD1>["sqlite"], id: string, group: string | null, win: boolean, champion = 103) {
  db.prepare("INSERT INTO crawled_matches (match_id, patch, game_start, queue_id, bans, rank_group) VALUES (?, '16.21', 1000, 420, '238,157', ?)").run(id, group);
  const row = db.prepare(
    `INSERT INTO participant_stats (match_id, patch, champion_id, team_position, win, runes, spells, items, opponent_champion_id, duration, queue_id, team_id,
       start_items, skill_order, purchase_order, purchase_times, cs_minutes, level_minutes, gold10, gold15, first_blood, rank_group)
     VALUES (?, '16.21', ?, 'MIDDLE', ?, '8100:8300:8112,8143,8138,8106:8345,8347:5008,5008,5011', '4,14', '3157,6655', ?, 1800, 420, ?, '1056', '1231231231', '3157,6655,3157', '600,900,1200', ?, ?, 3400, 5200, 1, ?)`,
  );
  row.run(id, champion, win ? 1 : 0, 64, 100, csv(15, 7), csv(15, 1), group);
  row.run(id, 64, win ? 0 : 1, champion, 200, csv(15, 6), csv(15, 1), group);
}

function dump(sqlite: ReturnType<typeof fakeD1>["sqlite"]) {
  const q = (sql: string) => sqlite.prepare(sql).all();
  return {
    counts: q("SELECT * FROM stat_counts ORDER BY patch, queue_id, team_position, champion_id, kind, value"),
    lanes: q("SELECT * FROM lane_sums ORDER BY patch, team_position, champion_id, opponent_id"),
    bench: q("SELECT * FROM bench_sums ORDER BY patch, team_position, champion_id, minute"),
    items: q("SELECT * FROM item_time_sums ORDER BY patch, team_position, champion_id, item_id"),
    matches: q("SELECT * FROM stat_matches"),
  };
}

describe("rollup by tier group", () => {
  it("Emerald+ read through the old table names equals the old path", async () => {
    // Same Emerald+ games twice: carrying their groups, and as old rows without one.
    const grouped = fakeD1();
    const legacy = fakeD1();
    const emeraldPlus = ["emerald", "diamond", "master_plus", "emerald", "diamond"];
    emeraldPlus.forEach((g, i) => {
      game(grouped.sqlite, `EUW1_${i}`, g, i % 2 === 0);
      game(legacy.sqlite, `EUW1_${i}`, null, i % 2 === 0);
    });
    // Lower ranks only exist in the grouped database, and must not leak into the Emerald+ views.
    ["silver", "gold", "iron_bronze"].forEach((g, i) => game(grouped.sqlite, `EUW1_9${i}`, g, true, 157));

    await rollup(grouped.db, catalog);
    await rollup(legacy.db, catalog);
    expect(dump(grouped.sqlite).counts.length).toBeGreaterThan(20);
    expect(dump(grouped.sqlite).lanes.length).toBeGreaterThan(0);
    expect(dump(grouped.sqlite).bench.length).toBeGreaterThan(0);
    expect(dump(grouped.sqlite).items.length).toBeGreaterThan(0);
    const a = dump(grouped.sqlite);
    const b = dump(legacy.sqlite);
    expect(a.counts).toEqual(b.counts);
    expect(a.lanes).toEqual(b.lanes);
    expect(a.bench).toEqual(b.bench);
    expect(a.items).toEqual(b.items);
  });

  it("keeps each group apart and every bracket is the sum of its groups", async () => {
    const { db, sqlite } = fakeD1();
    const groups = ["iron_bronze", "silver", "gold", "platinum", "emerald", "diamond", "master_plus"];
    groups.forEach((g, i) => {
      for (let n = 0; n <= i; n++) game(sqlite, `EUW1_${g}_${n}`, g, n % 2 === 0);
    });
    await rollup(db, catalog);
    const games = (where: string) =>
      (sqlite.prepare(`SELECT COALESCE(SUM(games), 0) AS n FROM stat_counts_g WHERE kind = 'games' AND champion_id = 103 AND ${where}`).get() as { n: number }).n;
    expect(games("rank_group = 'silver'")).toBe(2);
    for (const bracket of BRACKETS) {
      const expected = groups.reduce((sum, g, i) => sum + ((groupsOf(bracket) as readonly string[]).includes(g) ? i + 1 : 0), 0);
      expect(games(`rank_group IN (${groupsSql(bracket)})`)).toBe(expected);
    }
    // The old name is Emerald+ only: 5 + 6 + 7.
    expect((sqlite.prepare("SELECT games FROM stat_counts WHERE kind = 'games' AND champion_id = 103").get() as { games: number }).games).toBe(18);
    // Bans and pool counts carry the group of their game too.
    expect(sqlite.prepare("SELECT rank_group, SUM(games) AS n FROM stat_counts_g WHERE kind = 'pool-games' GROUP BY rank_group ORDER BY rank_group").all().length).toBe(7);
  });

  it("converts an existing database once, counting old rows as Emerald", () => {
    const { sqlite } = fakeD1();
    // A database from before groups: the old tables, filled.
    sqlite.exec("DROP VIEW stat_counts; DROP TRIGGER IF EXISTS stat_counts_insert; DROP TRIGGER IF EXISTS stat_counts_delete");
    sqlite.exec("DROP TABLE stat_counts_g");
    sqlite.exec(`CREATE TABLE stat_counts (patch TEXT NOT NULL, queue_id INTEGER NOT NULL, team_position TEXT NOT NULL, champion_id INTEGER NOT NULL, kind TEXT NOT NULL, value TEXT NOT NULL, games INTEGER NOT NULL, wins INTEGER NOT NULL, PRIMARY KEY (patch, queue_id, team_position, champion_id, kind, value)) WITHOUT ROWID`);
    sqlite.exec("INSERT INTO stat_counts VALUES ('16.21', 420, 'MIDDLE', 103, 'games', '', 40, 22)");
    return import("./localSchema.ts").then(({ localSchema }) => {
      localSchema(sqlite);
      localSchema(sqlite);
      expect(sqlite.prepare("SELECT rank_group, games, wins FROM stat_counts_g").all()).toEqual([{ rank_group: "emerald", games: 40, wins: 22 }]);
      expect(sqlite.prepare("SELECT games, wins FROM stat_counts").all()).toEqual([{ games: 40, wins: 22 }]);
    });
  });
});
