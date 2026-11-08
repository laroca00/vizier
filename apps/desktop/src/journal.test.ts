import { describe, expect, it } from "vitest";
import { groupJournal, journalEntries, parseNoteKey } from "./journal";

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
});
