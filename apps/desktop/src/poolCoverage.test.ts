import { describe, expect, it } from "vitest";
import { coverage, gaps, safestBlind, type Matchups } from "./poolCoverage";

const m = (championId: number, winRate: number, games = 100) => ({ championId, winRate, games });
const pool = new Map<number, Matchups>([
  [1, [m(10, 0.55), m(11, 0.45), m(12, 0.5), m(13, 0.6, 5)]],
  [2, [m(10, 0.5), m(11, 0.47), m(12, 0.52)]],
]);

describe("coverage", () => {
  const rows = coverage([10, 11, 12, 13, 14], pool);
  it("picks the best pool champion per opponent", () => {
    expect(rows[0]).toMatchObject({ opponentId: 10, status: "covered", best: { championId: 1, winRate: 0.55 } });
    expect(rows[2]).toMatchObject({ status: "covered", best: { championId: 2 } });
  });
  it("calls an opponent a gap when even the best answer loses", () => {
    expect(rows[1]).toMatchObject({ status: "gap", best: { championId: 2, winRate: 0.47 } });
  });
  it("ignores matchups with too few games", () => {
    expect(rows[3]).toMatchObject({ status: "unknown", best: null });
    expect(gaps(rows).map((r) => r.opponentId)).toEqual([11, 13, 14]);
  });
});

describe("safestBlind", () => {
  it("prefers the champion with fewest bad matchups", () => {
    // Both have one bad matchup (11), so the higher average (champion 1, 50.0% against 49.7%) wins.
    expect(safestBlind([10, 11, 12], pool)).toMatchObject({ championId: 1, bad: 1, known: 3, games: 300 });
    const fewer = new Map(pool).set(3, [m(10, 0.5), m(11, 0.5), m(12, 0.5)]);
    expect(safestBlind([10, 11, 12], fewer)).toMatchObject({ championId: 3, bad: 0 });
  });
  it("needs data for at least half of the opponents", () => {
    expect(safestBlind([10, 11, 12, 13, 14, 15, 16], pool)).toBeNull();
  });
});

describe("poolByRole", () => {
  const roles = new Map([[5, new Map([["JUNGLE", { pickRate: 0.1 }], ["TOP", { pickRate: 0.02 }]])]]);
  it("uses the pick's role, else the champion's most played one", async () => {
    const { poolByRole } = await import("./poolCoverage");
    const byRole = poolByRole([{ championId: 1, position: "TOP" }, { championId: 5, position: null }, { championId: 1, position: "TOP" }, { championId: 9, position: null }], roles);
    expect([...byRole.entries()]).toEqual([["TOP", [1]], ["JUNGLE", [5]]]);
  });
});
