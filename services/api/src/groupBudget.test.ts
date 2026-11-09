import { TIER_GROUPS } from "@vizier/shared/brackets";
import { describe, expect, it } from "vitest";
import { Crawler } from "./crawler.ts";
import { GroupBudget, SEED_QUOTA, TIMELINE_SHARE } from "./groupBudget.ts";
import type { RiotClient } from "./riot/client.ts";
import { fakeD1 } from "./test/fakeD1.ts";

describe("GroupBudget.plan", () => {
  it("shares slots by the quota table when nothing has been stored yet", () => {
    const budget = new GroupBudget(() => 0, 1000);
    const picks = budget.plan(100);
    const count = (g: string) => picks.filter((p) => p === g).length;
    for (const g of TIER_GROUPS) expect(Math.abs(count(g) - SEED_QUOTA[g] * 100)).toBeLessThanOrEqual(2);
  });

  it("sends slots to the group furthest behind and skips groups with no players", () => {
    const budget = new GroupBudget(() => 0, 1000);
    for (let i = 0; i < 300; i++) budget.game("gold");
    const picks = budget.plan(20, ["gold", "silver"]);
    expect(picks.filter((p) => p === "silver").length).toBeGreaterThan(picks.filter((p) => p === "gold").length);
    expect(budget.plan(5, [])).toEqual([]);
  });

  it("starts a fresh hour after an hour", () => {
    let now = 0;
    const budget = new GroupBudget(() => now, 1000);
    for (let i = 0; i < 400; i++) budget.game("gold");
    now = 3_600_001;
    budget.plan(1);
    expect(budget.report().find((r) => r.group === "gold")?.games).toBe(0);
  });
});

describe("GroupBudget.wantsTimeline", () => {
  it("lets Emerald+ games through and a fixed share of the lower groups", () => {
    const budget = new GroupBudget(() => 0);
    const take = (group: "emerald" | "silver" | "platinum") => Array.from({ length: 100 }, () => budget.wantsTimeline(group)).filter(Boolean).length;
    expect(take("emerald")).toBe(100);
    expect(take("silver")).toBe(Math.round(TIMELINE_SHARE.silver * 100));
    expect(take("platinum")).toBe(Math.round(TIMELINE_SHARE.platinum * 100));
    expect(budget.wantsTimeline(null)).toBe(true);
  });
});

describe("Crawler with a budget", () => {
  const options = { region: "asia", platforms: ["kr"], leagues: "all", playersPerRun: 4, matchesPerRun: 5, extraMatchesPerRun: 0, timelinesPerRun: 5 } as const;

  it("takes players from the groups furthest behind and counts seeds, games and calls", async () => {
    const { db, sqlite } = fakeD1();
    for (const [i, tier] of ["IRON", "SILVER", "GOLD", "EMERALD", "DIAMOND", "CHALLENGER", "SILVER", "GOLD"].entries()) {
      sqlite.prepare("INSERT INTO crawl_players (puuid, tier, region, last_crawled_at) VALUES (?, ?, 'asia', ?)").run(`p${i}`, tier, i);
    }
    sqlite.prepare("INSERT INTO crawl_state (key, value) VALUES ('seeded_at:asia', '86400000')").run();
    const asked: string[] = [];
    const riot = {
      get: async (_r: string, _m: string, path: string) => {
        if (path.includes("/ids?")) asked.push(path.split("/by-puuid/")[1].split("/")[0]);
        return path.includes("/ids?") ? [] : null;
      },
    } as unknown as RiotClient;
    const budget = new GroupBudget(() => 86_400_000, 1000);
    for (let i = 0; i < 500; i++) budget.game("gold");
    await new Crawler(db, riot, () => 86_400_000, { ...options, platforms: ["kr"] }, budget).run();
    // Gold is far ahead of its target, so it gets no slot; the four others go round.
    expect(asked).toHaveLength(4);
    expect(asked.some((p) => p === "p2" || p === "p7")).toBe(false);
    const report = budget.report();
    expect(report.find((r) => r.group === "silver")).toMatchObject({ seeds: 1, calls: 1 });
    expect(report.reduce((n, r) => n + r.seeds, 0)).toBe(4);
  });

  it("falls back to any player when a tier belongs to no group", async () => {
    const { db, sqlite } = fakeD1();
    sqlite.prepare("INSERT INTO crawl_players (puuid, tier, region) VALUES ('odd', 'WOOD', 'asia')").run();
    sqlite.prepare("INSERT INTO crawl_state (key, value) VALUES ('seeded_at:asia', '86400000')").run();
    const asked: string[] = [];
    const riot = { get: async (_r: string, _m: string, path: string) => (path.includes("/ids?") ? (asked.push(path), []) : null) } as unknown as RiotClient;
    await new Crawler(db, riot, () => 86_400_000, { ...options, platforms: ["kr"] }).run();
    expect(asked).toHaveLength(1);
  });
});
