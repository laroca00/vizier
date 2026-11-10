import { beforeAll, describe, expect, it } from "vitest";
import { emptyCatalog } from "./archetypes.ts";
import { aggregateBuild, itemTree } from "./builds.ts";
import { completedItems, rollup } from "./rollup.ts";
import { sampleLimits } from "./stats.ts";
import { fakeD1 } from "./test/fakeD1.ts";

beforeAll(() => Object.assign(sampleLimits, { priorGames: 50, tierGames: 10, pairGames: 10 }));

const count = (value: string, games: number, wins = Math.floor(games / 2)) => ({ value, games, wins });

describe("completedItems", () => {
  it("takes finished items in buy order, once each, up to the limit", () => {
    const finished = new Set([10, 20, 30, 40]);
    expect(completedItems({ purchase_order: "1055,10,2003,20,10,30,40" }, finished)).toEqual([10, 20, 30]);
    expect(completedItems({ purchase_order: "1055,10" }, finished)).toEqual([10]);
    expect(completedItems({ purchase_order: null }, finished)).toEqual([]);
  });
});

describe("itemTree", () => {
  it("keeps the three most played branches per level and follows only kept parents", () => {
    const tree = itemTree(
      [count("10", 100), count("20", 60), count("30", 30), count("40", 25)],
      [count("10,20", 70), count("10,30", 20), count("20,10", 40), count("30,10", 22)],
      [count("10,20,30", 50), count("10,20,40", 10), count("20,10,30", 30)],
    );
    expect(tree.map((n) => n.id)).toEqual([10, 20, 30]);
    expect(tree[0].next.map((n) => n.id)).toEqual([20, 30]);
    expect(tree[0].next[0].next).toEqual([{ id: 30, games: 50, winRate: 0.5, next: [] }]);
    expect(tree[1].next[0].next.map((n) => n.id)).toEqual([30]);
    // 40 has too few second-level games to appear, and no branch follows it.
    expect(tree.find((n) => n.id === 40)).toBeUndefined();
  });

  it("drops thin branches and returns nothing for no counts", () => {
    expect(itemTree([count("10", 5)], [], [])).toEqual([]);
    expect(itemTree([], [], [])).toEqual([]);
  });
});

describe("item tree in a build", () => {
  it("is rolled up from purchase order and lands on the build", async () => {
    const { db, sqlite } = fakeD1();
    const insert = sqlite.prepare(
      `INSERT INTO participant_stats (match_id, patch, champion_id, team_position, win, runes, spells, items, opponent_champion_id, duration, queue_id, team_id, rank_group, skill_order, purchase_order)
       VALUES (?, '16.21', 103, 'MIDDLE', ?, '8100:8300:8112,8143,8138,8106:8345,8347:5008,5008,5011', '4,14', '3157', 238, 1800, 420, 100, 'emerald', '123123', ?)`,
    );
    for (let i = 0; i < 50; i++) {
      sqlite.prepare("INSERT INTO crawled_matches (match_id, patch, game_start, queue_id, bans, rank_group) VALUES (?, '16.21', 1000, 420, '', 'emerald')").run(`TR1_${i}`);
      insert.run(`TR1_${i}`, i < 30 ? 1 : 0, i < 30 ? "1055,10,20,30" : "1055,20,10,30");
    }
    await rollup(db, async () => ({ ...emptyCatalog(), finished: new Set([10, 20, 30]) }));
    const build = await aggregateBuild(db, 103, "MIDDLE");
    expect(build?.itemTree[0]).toMatchObject({ id: 10, games: 30, winRate: 1 });
    expect(build?.itemTree[0].next[0]).toMatchObject({ id: 20, games: 30 });
    expect(build?.itemTree[0].next[0].next[0]).toMatchObject({ id: 30, games: 30 });
    expect(build?.itemTree[1]).toMatchObject({ id: 20, games: 20, winRate: 0 });
  });
});
