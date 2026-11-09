import { describe, expect, it } from "vitest";
import { emptyText } from "./widgets/active";
import { CLOCK_TICK_MS } from "./tick";
import type { WidgetContext } from "./widgets/context";

const ctx = (patch: Partial<WidgetContext>) => ({ buildPanel: { shown: true, items: [], runes: null }, skillOrder: { keys: [], ranked: 0, shown: true }, ...patch }) as WidgetContext;

describe("quiet empty states", () => {
  it("says so when an opened panel has no data", () => {
    expect(emptyText("build", ctx({}))).toBe("Bu rol için build verisi yok");
    expect(emptyText("skillOrder", ctx({}))).toBe("Yetenek sırası verisi yok");
  });
  it("stays silent for closed panels and panels with data", () => {
    expect(emptyText("build", ctx({ buildPanel: { shown: false, items: [], runes: null } }))).toBeNull();
    expect(emptyText("skillOrder", ctx({ skillOrder: { keys: ["Q"], ranked: 0, shown: true } }))).toBeNull();
    expect(emptyText("next", ctx({}))).toBeNull();
  });
  it("renders at most once a second", () => {
    expect(CLOCK_TICK_MS).toBeGreaterThanOrEqual(1000);
  });
});
