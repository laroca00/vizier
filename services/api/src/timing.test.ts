import { beforeAll, describe, expect, it } from "vitest";
import { emptyCatalog } from "./archetypes.ts";
import { aggregateBuild, medianMinute } from "./builds.ts";
import { firstMinute, rollup } from "./rollup.ts";
import { sampleLimits } from "./stats.ts";
import { fakeD1 } from "./test/fakeD1.ts";

beforeAll(() => Object.assign(sampleLimits, { priorGames: 50, tierGames: 10, pairGames: 10 }));

describe("firstMinute", () => {
  const row = { purchase_order: "1055,1001,3020,3157", purchase_times: "5,200,400,900" };
  it("is the whole minute of the first wanted purchase", () => {
    expect(firstMinute(row, new Set([1001, 3020]))).toBe(3);
    expect(firstMinute(row, new Set([3157]))).toBe(15);
  });
  it("caps late purchases and is null without a match", () => {
    expect(firstMinute({ purchase_order: "3157", purchase_times: "5000" }, new Set([3157]))).toBe(30);
    expect(firstMinute(row, new Set([9999]))).toBeNull();
    expect(firstMinute({ purchase_order: null, purchase_times: null }, new Set([1]))).toBeNull();
  });
});

describe("medianMinute", () => {
  it("reads the median from per-minute counts", () => {
    expect(medianMinute([{ value: "3", games: 10 }, { value: "5", games: 30 }, { value: "4", games: 10 }])).toEqual({ games: 50, medianMinute: 5 });
  });
  it("needs enough games", () => {
    expect(medianMinute([{ value: "3", games: 5 }])).toBeNull();
  });
});

describe("start options and timing in a build", () => {
  it("lists starting items with win rate and the median boots and first item minutes", async () => {
    const { db, sqlite } = fakeD1();
    const insert = sqlite.prepare(
      `INSERT INTO participant_stats (match_id, patch, champion_id, team_position, win, runes, spells, items, opponent_champion_id, duration, queue_id, team_id, rank_group, skill_order, start_items, purchase_order, purchase_times)
       VALUES (?, '16.21', 103, 'MIDDLE', ?, '8100:8300:8112,8143,8138,8106:8345,8347:5008,5008,5011', '4,14', '3157', 238, 1800, 420, 100, 'emerald', '123123', ?, ?, ?)`,
    );
    for (let i = 0; i < 40; i++) {
      sqlite.prepare("INSERT INTO crawled_matches (match_id, patch, game_start, queue_id, bans, rank_group) VALUES (?, '16.21', 1000, 420, '', 'emerald')").run(`TR1_${i}`);
      // 30 games start with 1056 and win 20; 10 start with 1055 and win 2. Boots at minute 4, first finished item at 8 or 9.
      const start = i < 30 ? "1056" : "1055";
      insert.run(`TR1_${i}`, i < 20 || (i >= 30 && i < 32) ? 1 : 0, start, `${start},1001,3157`, `5,240,${i % 2 ? 540 : 500}`);
    }
    await rollup(db, async () => ({ ...emptyCatalog(), finished: new Set([3157]), boots: new Set([1001]) }));
    const build = await aggregateBuild(db, 103, "MIDDLE");
    expect(build?.startOptions).toEqual([
      { ids: [1056], games: 30, winRate: 0.667 },
      { ids: [1055], games: 10, winRate: 0.2 },
    ].filter((o) => o.games >= 20));
    expect(build?.timing).toEqual({ boots: { games: 40, medianMinute: 4 }, firstItem: { games: 40, medianMinute: 8 } });
  });
});
