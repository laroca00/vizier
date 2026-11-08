import { describe, expect, it } from "vitest";
import { emptyDraft, nextSlot, parseDrafts, place, sideToPick, swap } from "./store";

describe("draft simulator", () => {
  it("keeps a champion in one slot only", () => {
    let draft = place(emptyDraft(), "blue", 0, 103);
    draft = place(draft, "red", 2, 103);
    expect(draft.blue[0]).toBe(0);
    expect(draft.red[2]).toBe(103);
  });

  it("follows the ranked pick order when asked", () => {
    let draft = emptyDraft();
    expect(nextSlot(draft, true, { side: "blue", slot: 0 })).toEqual({ side: "blue", slot: 0 });
    draft = place(draft, "blue", 0, 1);
    expect(nextSlot(draft, true, { side: "blue", slot: 0 })).toEqual({ side: "red", slot: 0 });
    draft = place(draft, "red", 0, 2);
    expect(nextSlot(draft, true, { side: "red", slot: 0 })).toEqual({ side: "red", slot: 1 });
  });

  it("hands turns to the other side once one is full", () => {
    let draft = emptyDraft();
    for (let i = 0; i < 5; i++) draft = place(draft, "blue", i, i + 1);
    expect(sideToPick(draft)).toBe("red");
  });

  it("fills down the same side without the pick order, then the other", () => {
    let draft = emptyDraft();
    for (let i = 0; i < 5; i++) draft = place(draft, "red", i, i + 1);
    expect(nextSlot(draft, false, { side: "red", slot: 4 })).toEqual({ side: "blue", slot: 0 });
  });

  it("swaps roles within a team", () => {
    const draft = swap(place(emptyDraft(), "blue", 0, 54), "blue", 0, 2);
    expect(draft.blue).toEqual([0, 0, 54, 0, 0]);
  });

  it("reads saved drafts defensively", () => {
    expect(parseDrafts("nope")).toEqual([]);
    const [d] = parseDrafts(JSON.stringify([{ id: "a", name: "x", blue: [1, 2], red: "bad" }]));
    expect(d.blue).toEqual([1, 2, 0, 0, 0]);
    expect(d.red).toEqual([0, 0, 0, 0, 0]);
  });
});
