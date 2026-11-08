import { describe, expect, it } from "vitest";
import { cycleSlot, firstPickable } from "./keys";

describe("cycleSlot", () => {
  it("moves down a side, then to the other, then around", () => {
    expect(cycleSlot({ side: "blue", slot: 0 })).toEqual({ side: "blue", slot: 1 });
    expect(cycleSlot({ side: "blue", slot: 4 })).toEqual({ side: "red", slot: 0 });
    expect(cycleSlot({ side: "red", slot: 4 })).toEqual({ side: "blue", slot: 0 });
  });

  it("goes back with shift and starts somewhere without a slot", () => {
    expect(cycleSlot({ side: "blue", slot: 0 }, true)).toEqual({ side: "red", slot: 4 });
    expect(cycleSlot(null)).toEqual({ side: "blue", slot: 0 });
    expect(cycleSlot(null, true)).toEqual({ side: "red", slot: 4 });
  });
});

describe("firstPickable", () => {
  it("skips champions already in the draft", () => {
    const list = [{ key: 1 }, { key: 2 }, { key: 3 }];
    expect(firstPickable(list, (id) => id === 1)).toEqual({ key: 2 });
    expect(firstPickable(list, () => true)).toBeUndefined();
  });
});
