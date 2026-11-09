import { describe, expect, it } from "vitest";
import type { SavedBuild } from "../library/store";
import type { SavedDraft } from "../simulator/store";
import { buildsCsv, countStatus, notesCsv, previewImport, readWorkspaceFile, selectForImport, toCsv, workspaceFile, type Contents } from "./dataFile";

const build = (id: string, over: Partial<SavedBuild> = {}): SavedBuild => ({
  id, name: id, championId: 103, position: "MIDDLE", runes: { primaryStyle: 8100, subStyle: 8000, perks: [1, 2] }, spells: [4, 14], startItems: [1056], coreItems: [3020], items: [], skillOrder: [1, 2, 3],
  notes: "", collections: [], tags: [], favourite: false, source: "custom", createdAt: 1, updatedAt: 1, ...over,
});
const draft = (id: string, blue = [103, 0, 0, 0, 0]): SavedDraft => ({ id, name: id, blue, red: [0, 0, 0, 0, 0], bans: [], side: "blue", tags: [], notes: "", createdAt: 1, updatedAt: 1 });
const empty: Contents = { builds: [], drafts: [], notes: {} };
const known = { champions: new Set([103, 238]), items: new Set([1056, 3020]) };

describe("workspace file", () => {
  it("round-trips the chosen parts with a version", () => {
    const text = workspaceFile(["builds", "notes"], { builds: [build("a")], drafts: [draft("d")], notes: { "c:103": "mid note" } }, new Date(0));
    expect(JSON.parse(text)).toMatchObject({ format: "vizier-workspace", version: 1 });
    const back = readWorkspaceFile(text);
    expect(back.builds?.map((b) => b.id)).toEqual(["a"]);
    expect(back.drafts).toBeUndefined();
    expect(back.notes).toEqual({ "c:103": "mid note" });
  });
  it("rejects other files and newer versions", () => {
    expect(() => readWorkspaceFile("{")).toThrow("not-json");
    expect(() => readWorkspaceFile("{}")).toThrow("not-vizier");
    expect(() => readWorkspaceFile(JSON.stringify({ format: "vizier-workspace", version: 2 }))).toThrow("too-new");
  });
  it("drops malformed builds inside a valid file", () => {
    const text = JSON.stringify({ format: "vizier-workspace", version: 1, builds: [{ nope: 1 }, build("ok")] });
    expect(readWorkspaceFile(text).builds?.map((b) => b.id)).toEqual(["ok"]);
  });
});

describe("import preview", () => {
  it("marks new, same, changed and skipped entries", () => {
    const incoming = {
      builds: [build("new"), build("same"), build("chg", { name: "other" }), build("badchamp", { championId: 999 }), build("baditem", { coreItems: [424242] })],
      drafts: [draft("d1"), draft("d2", [999, 0, 0, 0, 0])],
      notes: { "c:103": "x", "c:238": "y" },
    };
    const current: Contents = { builds: [build("same"), build("chg")], drafts: [], notes: { "c:238": "mine" } };
    const rows = previewImport(incoming, current, known);
    const of = (id: string) => rows.find((r) => r.id === id)!;
    expect(of("new").status).toBe("new");
    expect(of("same").status).toBe("same");
    expect(of("chg").status).toBe("changed");
    expect(of("badchamp")).toMatchObject({ status: "skipped", reason: "champion" });
    expect(of("baditem")).toMatchObject({ status: "skipped", reason: "item" });
    expect(of("d2")).toMatchObject({ status: "skipped", reason: "champion" });
    expect(of("c:103").status).toBe("new");
    expect(of("c:238").status).toBe("changed");
    expect(countStatus(rows, "builds", "skipped")).toBe(2);
  });
  it("skips nothing for unknown ids when Data Dragon is unavailable", () => {
    const rows = previewImport({ builds: [build("x", { championId: 999 })] }, empty, { champions: null, items: null });
    expect(rows[0].status).toBe("new");
  });
  it("never replaces what exists: changed builds come in only as copies on request, notes never", () => {
    const incoming = { builds: [build("chg", { name: "other" })], notes: { "c:238": "y" } };
    const current: Contents = { builds: [build("chg")], drafts: [], notes: { "c:238": "mine" } };
    const rows = previewImport(incoming, current, known);
    expect(selectForImport(incoming, rows, false).builds).toEqual([]);
    expect(selectForImport(incoming, rows, true).builds).toHaveLength(1);
    expect(selectForImport(incoming, rows, true).notes).toEqual({});
  });
});

describe("csv", () => {
  it("quotes cells and defuses formulas", () => {
    expect(toCsv([["a,b", 'say "hi"', "=SUM(A1)", -5]])).toBe('"a,b","say ""hi""",\'=SUM(A1),-5\r\n');
  });
  it("writes one row per build and per note", () => {
    const csv = buildsCsv([build("a", { notes: "line\ntwo" })], () => "Ahri");
    expect(csv.split("\r\n")[0]).toContain("skill_order");
    expect(csv).toContain("Ahri,MIDDLE,4 14,1056,3020,,QWE");
    expect(notesCsv({ "c:103": "hello" }, () => "Ahri")).toContain("c:103,Ahri,hello");
  });
});
