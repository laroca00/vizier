import { describe, expect, it } from "vitest";
import { parseTags, sortBuilds, tagCounts } from "./organize";
import type { SavedBuild } from "./store";

const build = (id: string, name: string, championId: number, updatedAt: number, collections: string[] = [], tags?: string[]) =>
  ({ id, name, championId, updatedAt, collections, tags }) as SavedBuild;
const names: Record<number, string> = { 1: "Zed", 2: "Ahri" };
const list = [build("a", "Lane", 1, 10, ["Ranked"]), build("b", "Scaling", 2, 30), build("c", "Burst", 2, 20, ["Fun"])];

describe("library organising", () => {
  it("parses tags into a short clean list", () => {
    expect(parseTags(" Ranked, lane BULLY;ranked\n\n")).toEqual(["ranked", "lane bully"]);
    expect(parseTags("a,b,c,d,e,f,g")).toHaveLength(6);
    expect(parseTags("x".repeat(40))[0]).toHaveLength(20);
  });

  it("counts tags, most used first", () => {
    expect(tagCounts([{ tags: ["a", "b"] }, { tags: ["b"] }, {}])).toEqual([{ tag: "b", count: 2 }, { tag: "a", count: 1 }]);
  });

  const order = (sort: Parameters<typeof sortBuilds>[1]) => sortBuilds(list, sort, (id) => names[id], "en").map((b) => b.id);

  it("sorts by last edit, champion, name and collection without touching the input", () => {
    expect(order("edited")).toEqual(["b", "c", "a"]);
    expect(order("champion")).toEqual(["c", "b", "a"]);
    expect(order("name")).toEqual(["c", "a", "b"]);
    expect(order("collection")).toEqual(["c", "a", "b"]);
    expect(list.map((b) => b.id)).toEqual(["a", "b", "c"]);
  });
});
