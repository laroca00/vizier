import { describe, expect, it } from "vitest";
import { addRecent, MAX_RECENT_SEARCHES, parseRecent } from "./recent";

describe("recent searches", () => {
  it("puts the newest first and drops repeats regardless of case", () => {
    expect(addRecent(["ahri", "zed"], "AHRI")).toEqual(["AHRI", "zed"]);
  });
  it("ignores one-letter queries and keeps a fixed number", () => {
    expect(addRecent(["a1"], " x ")).toEqual(["a1"]);
    let list: string[] = [];
    for (let i = 0; i < 10; i++) list = addRecent(list, `query ${i}`);
    expect(list).toHaveLength(MAX_RECENT_SEARCHES);
    expect(list[0]).toBe("query 9");
  });
  it("reads only strings", () => {
    expect(parseRecent('["ab", 3, "c", "de"]')).toEqual(["ab", "de"]);
    expect(parseRecent("{")).toEqual([]);
  });
});
