import { describe, expect, it } from "vitest";
import { ALL_COLUMNS, matchesView, PRESET_VIEWS, sanitizeColumns, sanitizeViews, viewFrom, withView } from "./statsViews";

describe("preset views", () => {
  it("are the three ready ones, each sorted by a column it shows", () => {
    expect(PRESET_VIEWS.map((v) => v.id)).toEqual(["preset:lane", "preset:late", "preset:bans"]);
    for (const v of PRESET_VIEWS) expect(v.columns).toContain(v.sort);
    expect(PRESET_VIEWS[0].sort).toBe("goldDiff15");
    expect(PRESET_VIEWS[1].sort).toBe("lateWinRate");
    expect(PRESET_VIEWS[2].sort).toBe("banRate");
  });
});

describe("sanitizeColumns", () => {
  it("keeps known columns in table order and falls back to all of them", () => {
    expect(sanitizeColumns(["games", "kda", "bogus", "name"])).toEqual(["games", "kda"].sort((a, b) => ALL_COLUMNS.indexOf(a as never) - ALL_COLUMNS.indexOf(b as never)));
    expect(sanitizeColumns([])).toEqual(ALL_COLUMNS);
    expect(sanitizeColumns("kda")).toEqual(ALL_COLUMNS);
    expect(sanitizeColumns(undefined)).toEqual(ALL_COLUMNS);
  });
});

describe("sanitizeViews", () => {
  it("drops unreadable entries, preset ids and repeated ids", () => {
    const good = { id: "v1", name: "  Mine ", position: "TOP", sort: "kda", desc: false, minGames: 50, columns: ["kda"] };
    const views = sanitizeViews([good, good, { ...good, id: "preset:x" }, { ...good, id: "v2", name: "" }, { ...good, id: "v3", sort: "nope" }, null, "x"]);
    expect(views).toEqual([{ id: "v1", name: "Mine", position: "TOP", sort: "kda", desc: false, minGames: 50, columns: ["kda"] }]);
    expect(sanitizeViews("nonsense")).toEqual([]);
  });
});

describe("saving views", () => {
  const base = { position: "ALL", sort: "games" as const, desc: true, minGames: 100 };
  it("replaces a view with the same name and keeps its id", () => {
    const first = viewFrom("a", "Top picks", base, ["games"]);
    const next = withView([first], viewFrom("b", "top picks", { ...base, sort: "kda" }, ["kda"]));
    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({ id: "a", sort: "kda", columns: ["kda"] });
    expect(withView(next, viewFrom("c", "Other", base, ["games"]))).toHaveLength(2);
  });
  it("recognises a view the table shows exactly", () => {
    const saved = viewFrom("a", "x", base, ["games", "kda"]);
    expect(matchesView(saved, base, ["games", "kda"])).toBe(true);
    expect(matchesView(saved, { ...base, minGames: 300 }, ["games", "kda"])).toBe(false);
    expect(matchesView(saved, base, ["games"])).toBe(false);
  });
});
