import { describe, expect, it } from "vitest";
import { allFavouriteTags, dropCollection, filterFavourites, isFavourite, parseFavourites, patchFavourite, recentlyOpened, toggleFavourite, FAV_LIMIT } from "./favourites";

const add = (list: ReturnType<typeof parseFavourites>, kind: "build" | "combo" | "matchup", id: string, label: string, now: number) => toggleFavourite(list, { kind, id, label }, now);

describe("favourites", () => {
  it("toggles an item on and off", () => {
    const on = add([], "combo", "Ahri/charm-burst", "Charm", 1);
    expect(isFavourite(on, "combo", "Ahri/charm-burst")).toBe(true);
    expect(add(on, "combo", "Ahri/charm-burst", "Charm", 2)).toEqual([]);
  });
  it("keeps the same id apart per kind", () => {
    const list = add(add([], "build", "1", "A", 1), "matchup", "1", "B", 2);
    expect(list).toHaveLength(2);
  });
  it("drops malformed and repeated entries when reading", () => {
    const list = parseFavourites([{ kind: "build", id: "a", label: "A" }, { kind: "build", id: "a" }, { kind: "nope", id: "b" }, null, { kind: "item", id: 3 }]);
    expect(list.map((f) => f.id)).toEqual(["a"]);
    expect(parseFavourites("x")).toEqual([]);
  });
  it("stops at the limit", () => {
    const full = Array.from({ length: FAV_LIMIT }, (_, i) => ({ kind: "build" as const, id: String(i), label: "x", championId: null, tags: [], collection: null, addedAt: 0, openedAt: null }));
    expect(toggleFavourite(full, { kind: "build", id: "new", label: "n" }, 1)).toHaveLength(FAV_LIMIT);
  });
  it("cleans tags, files into collections and searches by label or tag", () => {
    let list = add(add([], "build", "1", "Ahri lane", 1), "build", "2", "Zed all-in", 2);
    list = patchFavourite(list, "build", "1", { tags: [" erken ", "erken", "", "mid"], collection: "Ana" });
    expect(list[0].tags).toEqual(["erken", "mid"]);
    expect(filterFavourites(list, { collection: "Ana" }).map((f) => f.id)).toEqual(["1"]);
    expect(filterFavourites(list, { query: "ZED" }, "en").map((f) => f.id)).toEqual(["2"]);
    expect(filterFavourites(list, { tag: "mid" }).map((f) => f.id)).toEqual(["1"]);
    expect(allFavouriteTags(list)).toEqual(["erken", "mid"]);
    expect(dropCollection(list, "Ana")[0].collection).toBeNull();
  });
  it("lists recently opened first and ignores never-opened ones", () => {
    let list = add(add(add([], "build", "1", "A", 1), "build", "2", "B", 2), "build", "3", "C", 3);
    list = patchFavourite(patchFavourite(list, "build", "1", { openedAt: 10 }), "build", "3", { openedAt: 20 });
    expect(recentlyOpened(list).map((f) => f.id)).toEqual(["3", "1"]);
  });
});
