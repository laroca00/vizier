import { describe, expect, it } from "vitest";
import { lengthLine, lengthRead } from "./matchupLength";

const b = (bucket: number, games: number, winRate: number) => ({ bucket, games, winRate });

describe("lengthRead", () => {
  it("says hard then easy when short games lose and long games win, with enough games", () => {
    const read = lengthRead([b(0, 300, 0.4), b(1, 300, 0.42), b(3, 300, 0.6), b(4, 300, 0.62)]);
    expect(read).toEqual({ early: "hard", late: "easy" });
    expect(lengthLine(read)).toBe("hardThenEasy");
  });
  it("says easy then hard the other way round", () => {
    expect(lengthLine(lengthRead([b(0, 400, 0.6), b(1, 400, 0.58), b(3, 400, 0.41), b(4, 400, 0.4)]))).toBe("easyThenHard");
  });
  it("has no read when a side is thin, even, or both go the same way", () => {
    expect(lengthRead([b(0, 10, 0.3), b(4, 10, 0.7)])).toBeNull();
    expect(lengthRead([b(0, 500, 0.5), b(4, 500, 0.7)])).toBeNull();
    expect(lengthRead([b(0, 500, 0.4), b(4, 500, 0.42)])).toBeNull();
    expect(lengthRead([b(2, 500, 0.4), b(4, 500, 0.7)])).toBeNull();
    expect(lengthRead(undefined)).toBeNull();
    expect(lengthLine(null)).toBeNull();
  });
});
