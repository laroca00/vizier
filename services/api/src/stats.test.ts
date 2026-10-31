import { describe, expect, it } from "vitest";
import { aggregateBuild, maxOrder } from "./builds.ts";
import type { MatchSummary } from "./coach.ts";
import { coachByRules } from "./coachRules.ts";
import { Crawler } from "./crawler.ts";
import type { RiotClient } from "./riot/client.ts";
import type { Match, Participant } from "./riot/types.ts";
import { banSuggestions, benchmarks, championOverview, counters, quantiles, rankOf, tierList } from "./stats.ts";
import { fakeD1 } from "./test/fakeD1.ts";
import { findHabits, type GameNumbers } from "./trends.ts";

const perks = {
  statPerks: { offense: 5008, flex: 5008, defense: 5011 },
  styles: [
    { description: "primaryStyle", style: 8100, selections: [{ perk: 8112 }, { perk: 8143 }, { perk: 8138 }, { perk: 8106 }] },
    { description: "subStyle", style: 8300, selections: [{ perk: 8345 }, { perk: 8347 }] },
  ],
};

function player(id: number, teamId: number, championId: number, win: boolean, cs: number): Participant {
  return {
    puuid: `p${id}`, participantId: id, teamId, championId, teamPosition: "MIDDLE", win,
    totalMinionsKilled: cs, neutralMinionsKilled: 0, deaths: 3, goldEarned: 12000, visionScore: 20,
    challenges: { laneMinionsFirst10Minutes: cs / 4, killParticipation: 0.5, teamDamagePercentage: 0.25 },
    summoner1Id: 4, summoner2Id: 14, item0: 3157, perks,
  };
}

async function seed(games: { me: number; them: number; win: boolean; version?: string }[]) {
  const { db } = fakeD1();
  const crawler = new Crawler(db, { get: async () => null } as unknown as RiotClient);
  let n = 0;
  for (const g of games) {
    n++;
    const match: Match = {
      metadata: { matchId: `TR1_${n}`, participants: [] },
      info: { gameVersion: g.version ?? "16.21.1", queueId: 420, gameStartTimestamp: n, gameDuration: 1800, participants: [player(1, 100, g.me, g.win, 210 + n), player(6, 200, g.them, !g.win, 180)] },
    };
    await crawler.save(match);
  }
  return db;
}

describe("quantiles and rankOf", () => {
  it("place a value within the distribution", () => {
    const d = { games: 101, quantiles: quantiles(Array.from({ length: 101 }, (_, i) => i)) };
    expect(d.quantiles[10]).toBe(50);
    expect(rankOf(d, 25)).toBeCloseTo(0.25, 2);
    expect(rankOf(d, -5)).toBe(0);
    expect(rankOf(d, 500)).toBe(1);
  });
});

describe("maxOrder", () => {
  it("orders Q, W and E by when they reach rank 5", () => {
    expect(maxOrder("131241311132233322")).toEqual([1, 3, 2]);
  });
});

describe("benchmarks, tiers and bans", () => {
  it("builds role distributions and ranks champions", async () => {
    const games = [
      ...Array.from({ length: 12 }, () => ({ me: 103, them: 238, win: true })),
      ...Array.from({ length: 12 }, () => ({ me: 7, them: 238, win: false })),
    ];
    const db = await seed(games);
    const bench = await benchmarks(db, "MIDDLE");
    expect(bench.metrics.cs_pm?.games).toBe(48);
    expect(bench.championId).toBeNull();

    const tiers = await tierList(db, "MIDDLE");
    expect(tiers.champions[0].championId).toBe(103);
    expect(tiers.champions[0].tier).toBe("S");
    const bans = await banSuggestions(db);
    expect(bans.champions.map((c) => c.championId)).toContain(103);
  });

  it("falls back to every matchup when one has too few games", async () => {
    const db = await seed([
      ...Array.from({ length: 20 }, () => ({ me: 103, them: 238, win: true })),
      ...Array.from({ length: 3 }, () => ({ me: 103, them: 84, win: false })),
    ]);
    const vsZed = await aggregateBuild(db, 103, "MIDDLE", 238, async () => new Set());
    expect(vsZed).toMatchObject({ vs: 238, games: 20, winRate: 1 });
    const vsAkali = await aggregateBuild(db, 103, "MIDDLE", 84, async () => new Set());
    expect(vsAkali).toMatchObject({ vs: null, games: 23 });
  });
});

describe("champion pages", () => {
  it("summarises a champion and compares the two newest patches", async () => {
    const db = await seed([
      ...Array.from({ length: 10 }, (_, i) => ({ me: 103, them: 238, win: i < 4, version: "16.20.1" })),
      ...Array.from({ length: 10 }, (_, i) => ({ me: 103, them: 238, win: i < 6 })),
    ]);
    const overview = await championOverview(db, 103, null);
    expect(overview).toMatchObject({ position: "MIDDLE", games: 20, winRate: 0.5, pickRate: 0.5, winRateChange: 0.2 });
    expect(overview?.positions).toEqual([{ position: "MIDDLE", games: 20, share: 1 }]);
    expect(await championOverview(db, 1, null)).toBeNull();
  });

  it("lists matchups with enough games, hardest first", async () => {
    const db = await seed([
      ...Array.from({ length: 12 }, (_, i) => ({ me: 103, them: 238, win: i < 3 })),
      ...Array.from({ length: 12 }, (_, i) => ({ me: 103, them: 7, win: i < 9 })),
      ...Array.from({ length: 4 }, () => ({ me: 103, them: 84, win: true })),
    ]);
    const result = await counters(db, 103, "MIDDLE");
    expect(result.games).toBe(28);
    expect(result.matchups).toEqual([
      { championId: 238, games: 12, winRate: 0.25 },
      { championId: 7, games: 12, winRate: 0.75 },
    ]);
  });
});

describe("coach with benchmarks", () => {
  it("compares CS with the Emerald+ distribution", () => {
    const summary: MatchSummary = {
      durationMinutes: 30, result: "loss", position: "MIDDLE",
      player: { champion: "Ahri", kda: "2/2/2", csPerMinute: 5.1, gold: 9000, damageToChampions: 10000, visionScore: 30, wardsPlaced: 10, wardsKilled: 2, cs10: 52 },
      laneOpponent: null, laneSnapshots: [], deaths: [], objectives: [],
    };
    const spread = (lo: number, hi: number) => ({ games: 500, quantiles: Array.from({ length: 21 }, (_, i) => Math.round((lo + ((hi - lo) * i) / 20) * 100) / 100) });
    const bench = { position: "MIDDLE", championId: null, patches: ["16.21"], metrics: { cs_pm: spread(5, 9), cs10: spread(50, 90), vision_pm: spread(0.4, 1.2) } };
    const coaching = coachByRules(summary, bench);
    const cs = coaching.points.find((p) => p.title === "Minyon toplaman düşük")!;
    expect(cs.detail).toContain("TR Emerald+ orta koridor oyuncularının %98 kadarı");
    expect(cs.detail).toContain("medyan 7");
    expect(coaching.points.find((p) => p.title === "Koridor evresinde minyon kaçırdın")?.detail).toContain("medyanı 70");
  });
});

describe("findHabits", () => {
  it("reports a metric that is below the median in most games", () => {
    const bench = { position: "MIDDLE", championId: null, patches: [], metrics: { cs_pm: { games: 500, quantiles: Array.from({ length: 21 }, (_, i) => 5 + i * 0.2) } } };
    const games: GameNumbers[] = Array.from({ length: 10 }, (_, i) => ({
      matchId: `TR1_${i}`, championId: 103, position: "MIDDLE", win: i < 4, values: { cs_pm: i < 8 ? 5.5 : 8.5 },
    }));
    const trends = findHabits(games, new Map([["MIDDLE", bench]]));
    expect(trends).toMatchObject({ games: 10, wins: 4 });
    expect(trends.habits).toEqual([
      { title: "Maç boyunca minyon toplaman düşük", detail: "Son 10 maçın 8 tanesinde dakika başına minyonun Emerald+ medyanı olan 7 değerinin altındaydı." },
    ]);
  });
});
