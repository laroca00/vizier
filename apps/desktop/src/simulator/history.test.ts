import { describe, expect, it } from "vitest";
import { push, redo, startHistory, undo } from "./history";
import { emptyDraft, place } from "./store";

describe("draft history", () => {
  const a = place(emptyDraft(), "blue", 0, 1);
  const b = place(a, "red", 0, 2);

  it("undoes and redoes steps", () => {
    let h = push(push(startHistory(emptyDraft()), a), b);
    h = undo(h);
    expect(h.present).toEqual(a);
    h = undo(h);
    expect(h.present).toEqual(emptyDraft());
    expect(undo(h)).toBe(h);
    h = redo(redo(h));
    expect(h.present).toEqual(b);
    expect(redo(h)).toBe(h);
  });

  it("drops the redo steps on a new change", () => {
    let h = undo(push(push(startHistory(emptyDraft()), a), b));
    h = push(h, place(a, "red", 1, 3));
    expect(h.future).toEqual([]);
  });

  it("ignores a change that leaves the draft as it was", () => {
    const h = push(startHistory(emptyDraft()), a);
    expect(push(h, { ...a })).toBe(h);
  });

  it("keeps a bounded past", () => {
    let h = startHistory(emptyDraft());
    for (let i = 1; i <= 150; i++) h = push(h, place(emptyDraft(), "blue", 0, i));
    expect(h.past).toHaveLength(100);
  });
});
