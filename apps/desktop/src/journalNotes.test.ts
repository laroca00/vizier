import { describe, expect, it } from "vitest";
import { groupJournal, journalEntries, mergeNotes, noteToStore, notesFile, parseNoteKey, readNotesFile } from "./journalNotes";

const names: Record<number, string> = { 103: "Ahri", 238: "Zed", 1: "Annie", 157: "Yasuo" };
const nameOf = (id: number) => names[id] ?? "";

describe("journal", () => {
  it("reads champion and matchup keys and rejects others", () => {
    expect(parseNoteKey("c:103")).toEqual({ championId: 103, opponentId: null });
    expect(parseNoteKey("m:103:238")).toEqual({ championId: 103, opponentId: 238 });
    for (const bad of ["x:1", "c:abc", "m:103", "m:103:x", "c:103:5", "m:1:2:3", ""]) expect(parseNoteKey(bad)).toBeNull();
  });

  it("skips blank notes", () => {
    expect(journalEntries({ "c:103": "  ", "m:103:238": "wait for E" }).map((e) => e.key)).toEqual(["m:103:238"]);
  });

  const entries = journalEntries({ "c:103": "charm first", "m:103:238": "ult when he ults", "m:103:157": "wall", "c:1": "tibbers" });

  it("groups by champion name with matchups by opponent name", () => {
    const groups = groupJournal(entries, nameOf, "", "en");
    expect(groups.map((g) => g.name)).toEqual(["Ahri", "Annie"]);
    expect(groups[0].champion?.text).toBe("charm first");
    expect(groups[0].matchups.map((m) => m.opponentId)).toEqual([157, 238]);
  });

  it("searches note text and both champion names", () => {
    expect(groupJournal(entries, nameOf, "tibbers", "en").map((g) => g.name)).toEqual(["Annie"]);
    expect(groupJournal(entries, nameOf, "zed", "en")[0].matchups).toHaveLength(1);
    expect(groupJournal(entries, nameOf, "nothing here", "en")).toEqual([]);
  });

  it("does not store an untouched template", () => {
    const template = "Lane plan:\n\n";
    expect(noteToStore(template, template)).toBe("");
    expect(noteToStore(`${template}trade at level 2`, template)).toContain("trade");
    expect(noteToStore("free text")).toBe("free text");
  });

  it("round-trips a notes file and drops invalid keys", () => {
    const text = notesFile({ "c:103": "charm", "bogus": "x", "m:103:238": " " });
    expect(readNotesFile(text)).toEqual({ "c:103": "charm" });
  });

  it("reads the notes out of a full local data export", () => {
    const personal = JSON.stringify({ pool: [], notes: { "m:1:2": "kite" } });
    const full = JSON.stringify({ format: "vizier-local-data", version: 1, entries: { "vizier.personal": personal } });
    expect(readNotesFile(full)).toEqual({ "m:1:2": "kite" });
  });

  it("rejects files that are not Vizier notes", () => {
    expect(() => readNotesFile("nope")).toThrow("not-json");
    expect(() => readNotesFile("{}")).toThrow("not-vizier");
    expect(() => readNotesFile(JSON.stringify({ format: "vizier-local-data", entries: {} }))).toThrow("not-vizier");
  });

  it("merges without overwriting the player's own notes", () => {
    const { merged, added, kept } = mergeNotes({ "c:1": "mine", "c:2": "same" }, { "c:1": "theirs", "c:2": "same", "c:3": "new" });
    expect(merged).toEqual({ "c:1": "mine", "c:2": "same", "c:3": "new" });
    expect({ added, kept }).toEqual({ added: 1, kept: 1 });
  });
});
