import { describe, expect, it } from "vitest";
import { bestBlind, buildMatrix, cellState } from "./counterMatrix";

describe("cellState", () => {
  it("names a side only when the interval clears 50%", () => {
    expect(cellState(2000, 0.56)).toBe("favourable");
    expect(cellState(2000, 0.44)).toBe("unfavourable");
    expect(cellState(300, 0.52)).toBe("neutral");
  });
  it("calls thin samples insufficient however high the rate", () => {
    expect(cellState(12, 0.75)).toBe("insufficient");
    expect(cellState(0, 0)).toBe("insufficient");
  });
});

const m = (championId: number, winRate: number, games: number) => ({ championId, winRate, games });

describe("buildMatrix", () => {
  const matchups = new Map([
    [1, [m(10, 0.57, 3000), m(11, 0.43, 3000)]],
    [2, [m(10, 0.5, 3000)]],
  ]);
  const rows = buildMatrix([1, 2], [10, 11, 12], matchups);
  it("keeps one cell per opponent in order", () => {
    expect(rows[0].cells.map((c) => c?.state ?? null)).toEqual(["favourable", "unfavourable", null]);
    expect(rows[1].cells.map((c) => c?.state ?? null)).toEqual(["neutral", null, null]);
  });
  it("carries the games", () => expect(rows[0].cells[0]?.games).toBe(3000));
});

describe("bestBlind", () => {
  const rows = buildMatrix(
    [1, 2, 3],
    [10, 11, 12, 13],
    new Map([
      [1, [m(10, 0.57, 3000), m(11, 0.43, 3000), m(12, 0.5, 3000), m(13, 0.5, 3000)]],
      [2, [m(10, 0.5, 3000), m(11, 0.5, 3000), m(12, 0.5, 3000), m(13, 0.5, 3000)]],
      [3, [m(10, 0.6, 3000)]],
    ]),
  );
  it("prefers fewest unfavourable cells", () => {
    expect(bestBlind(rows)).toMatchObject({ championId: 2, unfavourable: 0, known: 4 });
  });
  it("skips champions with data for under half of the opponents", () => {
    expect(bestBlind(rows.slice(2))).toBeNull();
  });
});
