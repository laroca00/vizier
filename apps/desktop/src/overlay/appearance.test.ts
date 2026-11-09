import { describe, expect, it } from "vitest";
import { OPACITY_RANGE, SCALE_RANGE, isDefaultStyle, normalizeStyle, themeBg, widgetVars, withWidgetStyle } from "./appearance";

describe("appearance", () => {
  it("keeps values inside their ranges and fills gaps with 1", () => {
    expect(normalizeStyle(undefined)).toEqual({ scale: 1, opacity: 1 });
    expect(normalizeStyle({ scale: 9, opacity: 0 })).toEqual({ scale: SCALE_RANGE.max, opacity: OPACITY_RANGE.min });
    expect(normalizeStyle({ scale: Number.NaN })).toEqual({ scale: 1, opacity: 1 });
  });
  it("drops a widget's entry when it goes back to the defaults", () => {
    const set = withWidgetStyle({}, "build", { scale: 1.2 });
    expect(set.build).toEqual({ scale: 1.2, opacity: 1 });
    expect(withWidgetStyle(set, "build", { scale: 1 })).toEqual({});
    expect(isDefaultStyle(set.build)).toBe(false);
  });
  it("leaves other widgets alone", () => {
    const set = withWidgetStyle({ next: { scale: 1.1, opacity: 1 } }, "build", { opacity: 0.5 });
    expect(set.next?.scale).toBe(1.1);
    expect(set.build?.opacity).toBe(0.5);
  });
  it("falls back to the first theme", () => {
    expect(themeBg("ink")).toBe("6 6 10");
    expect(themeBg("nope" as never)).toBe("8 18 54");
    expect(widgetVars({ scale: 1.5 })).toMatchObject({ "--widget-scale": 1.5 });
  });
});
