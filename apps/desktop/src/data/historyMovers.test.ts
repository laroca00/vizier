import { describe, expect, it } from "vitest";
import type { TierHistoryDoc } from "./history";
import { historyMover, historyMovers } from "./historyMovers";

const doc = (champions: TierHistoryDoc["champions"]): TierHistoryDoc => ({ patch: "16.22", days: ["d1", "d2", "d3"], champions });

describe("historyMover", () => {
  it("finds a clear rise between the early games and the games added since", () => {
    // 1000 early games at 47%, then 1000 more at 55% (2000 total at 51%).
    const m = historyMover(doc({ 1: { games: [1000, 1500, 2000], winRate: [0.47, 0.49, 0.51] } }), 1, "TOP");
    expect(m?.laterGames).toBe(1000);
    expect(m?.laterRate).toBeCloseTo(0.55, 3);
    expect(m?.change).toBeCloseTo(0.08, 3);
  });
  it("finds a fall", () => {
    const m = historyMover(doc({ 1: { games: [1000, 2000], winRate: [0.55, 0.51] } }), 1, "TOP");
    expect(m?.change).toBeLessThan(-0.05);
  });
  it("ignores a move whose intervals overlap", () => {
    expect(historyMover(doc({ 1: { games: [150, 300], winRate: [0.5, 0.52] } }), 1, "TOP")).toBeNull();
  });
  it("needs a sample in both halves and two days", () => {
    expect(historyMover(doc({ 1: { games: [50, 2000], winRate: [0.4, 0.5] } }), 1, "TOP")).toBeNull();
    expect(historyMover(doc({ 1: { games: [1000, 1050], winRate: [0.4, 0.5] } }), 1, "TOP")).toBeNull();
    expect(historyMover(doc({ 1: { games: [0, 0, 3000], winRate: [0, 0, 0.5] } }), 1, "TOP")).toBeNull();
    expect(historyMover(doc({}), 9, "TOP")).toBeNull();
  });
  it("skips empty days between points", () => {
    const m = historyMover(doc({ 1: { games: [1000, 0, 2000], winRate: [0.47, 0, 0.51] } }), 1, "TOP");
    expect(m?.change).toBeCloseTo(0.08, 3);
  });
});

describe("historyMovers", () => {
  it("ranks risers and fallers across roles and tolerates a missing role", () => {
    const m = historyMovers([
      { position: "TOP", doc: doc({ 1: { games: [1000, 2000], winRate: [0.47, 0.51] }, 2: { games: [1000, 2000], winRate: [0.55, 0.51] } }) },
      { position: "JUNGLE", doc: null },
      { position: "MIDDLE", doc: doc({ 3: { games: [2000, 4000], winRate: [0.5, 0.53] } }) },
    ]);
    expect(m.up.map((r) => [r.championId, r.position])).toEqual([[1, "TOP"], [3, "MIDDLE"]]);
    expect(m.down.map((r) => r.championId)).toEqual([2]);
  });
});
