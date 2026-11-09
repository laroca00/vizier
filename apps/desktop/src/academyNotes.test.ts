import { describe, expect, it } from "vitest";
import { ACADEMY_LIMIT, addAcademy, parseAcademy, removeAcademy } from "./academyNotes";

describe("academy notes", () => {
  it("drops malformed and empty entries when reading", () => {
    expect(parseAcademy({ "m:1:2": { reminders: [" a ", "", 3], plans: "x" }, "m:3:4": { reminders: [], plans: [] }, junk: 5 })).toEqual({ "m:1:2": { reminders: ["a"], plans: [] } });
    expect(parseAcademy(null)).toEqual({});
  });
  it("adds, ignores duplicates and respects the limit", () => {
    let notes = addAcademy({}, "m:1:2", "reminders", "  E ile bekle ");
    notes = addAcademy(notes, "m:1:2", "reminders", "E ile bekle");
    expect(notes["m:1:2"].reminders).toEqual(["E ile bekle"]);
    for (let i = 0; i < ACADEMY_LIMIT + 2; i++) notes = addAcademy(notes, "m:1:2", "plans", `plan ${i}`);
    expect(notes["m:1:2"].plans).toHaveLength(ACADEMY_LIMIT);
  });
  it("removes an entry and the matchup once both lists are empty", () => {
    let notes = addAcademy({}, "m:1:2", "plans", "a");
    notes = addAcademy(notes, "m:1:2", "reminders", "b");
    notes = removeAcademy(notes, "m:1:2", "plans", 0);
    expect(notes["m:1:2"]).toEqual({ reminders: ["b"], plans: [] });
    expect(removeAcademy(notes, "m:1:2", "reminders", 0)).toEqual({});
  });
});
