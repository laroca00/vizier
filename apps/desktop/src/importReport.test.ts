import { describe, expect, it } from "vitest";
import { importSummary, reasonOf } from "./importReport";

const t = (key: string, vars?: Record<string, string | number>) => key.replace(/\{(\w+)\}/g, (whole, name: string) => String(vars?.[name] ?? whole));

describe("importSummary", () => {
  it("lists what went in", () => {
    const r = importSummary(t, "Ahri", { runes: { ok: true }, spells: { ok: true }, items: { ok: true } });
    expect(r).toEqual({ kind: "success", message: "Ahri: rünler, büyüler ve eşya seti aktarıldı" });
  });
  it("names the reason for a failure", () => {
    const r = importSummary(t, "Ahri", { runes: { ok: false, reason: "noSlot" }, items: { ok: true } });
    expect(r.kind).toBe("error");
    expect(r.message).toContain("rünler: boş rün sayfası yok");
    expect(r.message).toContain("eşya seti aktarıldı");
  });
});

describe("reasonOf", () => {
  it("separates a closed client from a refusal", () => {
    expect(reasonOf("not connected to the League client")).toBe("client");
    expect(reasonOf("HTTP 400")).toBe("failed");
  });
});
