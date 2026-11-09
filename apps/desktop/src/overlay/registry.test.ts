import { describe, expect, it } from "vitest";
import { GRID, layoutKey, parseLayoutFile, pickLayout, snapSpot, withLayout, withoutLayout } from "./layout";
import { MODES, WIDGETS, modeOf, widgetsFor } from "./registry";

describe("registry", () => {
  it("has one entry per widget id and every widget runs somewhere", () => {
    expect(new Set(WIDGETS.map((w) => w.id)).size).toBe(WIDGETS.length);
    for (const w of WIDGETS) expect(w.modes.length).toBeGreaterThan(0);
  });
  it("maps the Live Client game modes", () => {
    expect(modeOf("CLASSIC")).toBe("rift");
    expect(modeOf("ARAM")).toBe("aram");
    expect(modeOf("CHERRY")).toBe("arena");
    expect(modeOf("KIWI")).toBe("mayhem");
    expect(MODES).toEqual(["rift", "aram", "arena", "mayhem"]);
  });
  it("shows augments only where augments are offered", () => {
    expect(widgetsFor("rift").some((w) => w.id === "augments")).toBe(false);
    expect(widgetsFor("arena").some((w) => w.id === "augments")).toBe(true);
    expect(widgetsFor("mayhem").some((w) => w.id === "augments")).toBe(true);
  });
});

describe("layout file", () => {
  const size = { width: 1920, height: 1080 };
  it("keeps an old single layout as the fallback for every mode", () => {
    const file = parseLayoutFile(JSON.stringify({ skill: { x: 0.1, y: 0.2 }, rowGap: 0.06 }));
    expect(pickLayout(file, "aram", size)).toEqual({ skill: { x: 0.1, y: 0.2 }, rowGap: 0.06 });
  });
  it("stores a layout per mode and screen size", () => {
    let file = parseLayoutFile(null);
    file = withLayout(file, "rift", size, { skill: { x: 0.5, y: 0.5 } });
    expect(pickLayout(file, "rift", size)).toEqual({ skill: { x: 0.5, y: 0.5 } });
    expect(pickLayout(file, "aram", size)).toEqual({});
    expect(pickLayout(file, "rift", { width: 2560, height: 1440 })).toEqual({});
    expect(layoutKey("rift", size)).toBe("rift:1920x1080");
  });
  it("reset does not bring the shared fallback back", () => {
    let file = parseLayoutFile(JSON.stringify({ skill: { x: 0.1, y: 0.2 } }));
    file = withoutLayout(file, "rift", size);
    expect(pickLayout(file, "rift", size)).toEqual({});
    expect(pickLayout(file, "aram", size)).toEqual({ skill: { x: 0.1, y: 0.2 } });
  });
  it("survives garbage", () => {
    expect(parseLayoutFile("not json")).toEqual({ version: 2, legacy: {}, layouts: {} });
  });
});

describe("snapSpot", () => {
  it("lands on the 8 px grid", () => {
    const size = { width: 1920, height: 1080 };
    const spot = snapSpot({ x: 203 / 1920, y: 101 / 1080 }, size);
    expect(Math.round(spot.x * 1920) % GRID).toBe(0);
    expect(Math.round(spot.y * 1080) % GRID).toBe(0);
    expect(Math.round(spot.x * 1920)).toBe(200);
    expect(Math.round(spot.y * 1080)).toBe(104);
  });
});
