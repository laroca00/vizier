import { describe, expect, it } from "vitest";
import { parsePersonal } from "./personal";

describe("personal data", () => {
  it("keeps pool entries saved by older versions as main picks", () => {
    const old = JSON.stringify({ pool: [{ championId: 103, position: "MIDDLE" }, { championId: 238, position: null }], notes: { "c:103": "x" }, recent: [103], goals: [1] });
    const personal = parsePersonal(old);
    expect(personal.pool).toEqual([
      { championId: 103, position: "MIDDLE", rank: "main", note: "", buildId: null },
      { championId: 238, position: null, rank: "main", note: "", buildId: null },
    ]);
    expect(personal.notes).toEqual({ "c:103": "x" });
    expect(personal.favourites).toEqual([]);
    expect("goals" in personal).toBe(false);
  });

  it("keeps new fields and drops broken entries", () => {
    const personal = parsePersonal(JSON.stringify({ pool: [{ championId: 1, position: "TOP", rank: "secondary", note: "n", buildId: "b" }, { position: "TOP" }], favourites: [5, "x"] }));
    expect(personal.pool).toEqual([{ championId: 1, position: "TOP", rank: "secondary", note: "n", buildId: "b" }]);
    expect(personal.favourites).toEqual([5]);
  });

  it("starts empty on unreadable data", () => {
    expect(parsePersonal("{").pool).toEqual([]);
  });
});
