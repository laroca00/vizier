import { describe, expect, it } from "vitest";
import { campSpot, minimapBox, onScreen, timerSpot } from "./minimap";

const screen = { width: 1920, height: 1080 };

describe("minimapBox", () => {
  it("sits in the chosen bottom corner and grows with the size", () => {
    const right = minimapBox(screen, "right", 0.5);
    expect(right.left + right.size).toBe(1920);
    expect(right.top + right.size).toBe(1080);
    expect(minimapBox(screen, "left", 0.5).left).toBe(0);
    expect(minimapBox(screen, "right", 1).size).toBeGreaterThan(minimapBox(screen, "right", 0).size);
  });
  it("keeps odd sizes inside the range", () => {
    expect(minimapBox(screen, "right", 9).size).toBe(minimapBox(screen, "right", 1).size);
    expect(minimapBox(screen, "right", -1).size).toBe(minimapBox(screen, "right", 0).size);
  });
});

describe("spots", () => {
  it("puts the inhibitor of the blue team on the blue half", () => {
    const own = timerSpot({ id: "x", kind: "inhibitor", lane: "mid", at: 1, ours: true }, "ORDER")!;
    const theirs = timerSpot({ id: "x", kind: "inhibitor", lane: "mid", at: 1, ours: false }, "ORDER")!;
    expect(own.x).toBeLessThan(0.5);
    expect(theirs.x).toBeCloseTo(1 - own.x);
    // A red player's own inhibitor is on the red half.
    expect(timerSpot({ id: "x", kind: "inhibitor", lane: "mid", at: 1, ours: true }, "CHAOS")!.x).toBeGreaterThan(0.5);
  });
  it("draws camps in the enemy or own jungle", () => {
    const enemy = campSpot("blue", "ORDER", "enemy")!;
    const own = campSpot("blue", "ORDER", "own")!;
    expect(own.x + enemy.x).toBeCloseTo(1);
    expect(campSpot("nothing", "ORDER", "own")).toBeNull();
  });
  it("converts a spot to screen pixels", () => {
    const box = minimapBox(screen, "right", 0.5);
    expect(onScreen({ x: 1, y: 1 }, box)).toEqual({ left: 1920, top: 1080 });
  });
});
