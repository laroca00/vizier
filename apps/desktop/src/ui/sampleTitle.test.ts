import { describe, expect, it, vi } from "vitest";

// The module reaches the settings store through i18n, which wants a window.
vi.stubGlobal("window", { addEventListener: () => {} });
vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => {} });
const { sampleTitle } = await import("./sampleTitle");

const t = (text: string, params?: Record<string, string | number>) => text.replace(/\{(\w+)\}/g, (_, k) => String(params?.[k]));

describe("sampleTitle", () => {
  it("names the rank bracket the sample is from", () => {
    const title = sampleTitle(t, "tr", { games: 120, winRate: 0.5, bracket: "Altın-" });
    expect(title.split("\n")).toContain("Rank: Altın-");
  });

  it("leaves the line out when the sample has no bracket", () => {
    expect(sampleTitle(t, "tr", { games: 120, winRate: 0.5 })).not.toContain("Rank:");
  });
});
