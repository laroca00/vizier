import { beforeEach, describe, expect, it, vi } from "vitest";
import { duplicateDraft, deleteDraft, emptyDraft, filterDrafts, parseDrafts, parseTags, saveDraft, tagsOf, MAX_TAGS, type SavedDraft } from "./store";

describe("parseTags", () => {
  it("splits on commas, trims and drops repeats", () => {
    expect(parseTags(" dive, Erken oyun ;dive,, DIVE ")).toEqual(["dive", "Erken oyun"]);
  });
  it("caps the count and the length", () => {
    expect(parseTags("a,b,c,d,e,f,g,h")).toHaveLength(MAX_TAGS);
    expect(parseTags("x".repeat(60))[0]).toHaveLength(24);
  });
});

describe("saved draft templates", () => {
  beforeEach(() => {
    const data = new Map<string, string>();
    vi.stubGlobal("localStorage", { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v) });
  });
  it("reads drafts saved before templates as blue side with no tags or note", () => {
    const [d] = parseDrafts(JSON.stringify([{ id: "a", name: "Eski", blue: [1, 2, 3, 4, 5], red: [], bans: [9] }]));
    expect(d).toMatchObject({ side: "blue", tags: [], notes: "", bans: [9] });
  });
  it("keeps side, tags and note through a save, copy and delete", () => {
    const id = saveDraft(emptyDraft(), "Dalış", null, { side: "red", tags: ["dive"], notes: "erken sal" });
    const copy = duplicateDraft(id, (n) => `${n} 2`)!;
    const [first] = parseDrafts(localStorage.getItem("vizier.drafts"));
    expect(parseDrafts(localStorage.getItem("vizier.drafts")).find((d) => d.id === copy)).toMatchObject({ name: "Dalış 2", side: "red", tags: ["dive"], notes: "erken sal" });
    expect(first.id).toBe(copy);
    deleteDraft(id);
    deleteDraft(copy);
    expect(parseDrafts(localStorage.getItem("vizier.drafts"))).toEqual([]);
  });
});

describe("filterDrafts", () => {
  const base = { blue: [] as number[], red: [] as number[], bans: [] as number[], side: "blue" as const, createdAt: 0, updatedAt: 0 };
  const list: SavedDraft[] = [
    { ...base, id: "1", name: "Dalış", tags: ["dive", "erken"], notes: "" },
    { ...base, id: "2", name: "Poke", tags: ["poke"], notes: "kuleye çek" },
  ];
  it("needs every selected tag", () => {
    expect(filterDrafts(list, ["dive"], "").map((d) => d.id)).toEqual(["1"]);
    expect(filterDrafts(list, ["dive", "poke"], "")).toEqual([]);
  });
  it("searches names and notes", () => {
    expect(filterDrafts(list, [], "kule").map((d) => d.id)).toEqual(["2"]);
    expect(filterDrafts(list, [], "DAL").map((d) => d.id)).toEqual(["1"]);
  });
  it("lists tags once, sorted", () => {
    expect(tagsOf(list)).toEqual(["dive", "erken", "poke"]);
  });
});
