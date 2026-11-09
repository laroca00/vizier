import { describe, expect, it } from "vitest";
import { ageText } from "./freshness";

const t = (text: string, params?: Record<string, string | number>) => text.replace(/\{(\w+)\}/g, (_, k) => String(params?.[k]));
const now = 1_700_000_000_000;

describe("ageText", () => {
  it("says nothing when the server sent no time", () => {
    expect(ageText(t, undefined, now)).toBeNull();
    expect(ageText(t, 0, now)).toBeNull();
    expect(ageText(t, now + 5000, now)).toBeNull();
  });
  it("picks minutes, hours and days", () => {
    expect(ageText(t, now - 30_000, now)).toBe("az önce güncellendi");
    expect(ageText(t, now - 5 * 60_000, now)).toBe("5 dakika önce güncellendi");
    expect(ageText(t, now - 3 * 3_600_000, now)).toBe("3 saat önce güncellendi");
    expect(ageText(t, now - 72 * 3_600_000, now)).toBe("3 gün önce güncellendi");
  });
});
