import { describe, expect, it } from "vitest";
import { changeText, trendOf } from "./trend";

describe("trend", () => {
  it("reads direction and ignores noise", () => {
    expect(trendOf(0.012)).toBe("up");
    expect(trendOf(-0.012)).toBe("down");
    expect(trendOf(0.0002)).toBe("flat");
    expect(trendOf(null)).toBeNull();
  });
  it("writes the change in points with an arrow", () => {
    expect(changeText(0.0123)).toBe("▲ +1.2");
    expect(changeText(-0.031)).toBe("▼ −3.1");
    expect(changeText(0)).toBe("▬ 0.0");
    expect(changeText(null)).toBe("–");
  });
});
