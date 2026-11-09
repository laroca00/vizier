import { describe, expect, it } from "vitest";
import { appShortcuts, isTyping } from "./shortcuts";

describe("isTyping", () => {
  it("knows text fields from other controls", () => {
    expect(isTyping({ tagName: "INPUT", type: "text" } as unknown as EventTarget)).toBe(true);
    expect(isTyping({ tagName: "INPUT", type: "search" } as unknown as EventTarget)).toBe(true);
    expect(isTyping({ tagName: "TEXTAREA" } as unknown as EventTarget)).toBe(true);
    expect(isTyping({ tagName: "DIV", isContentEditable: true } as unknown as EventTarget)).toBe(true);
    expect(isTyping({ tagName: "INPUT", type: "checkbox" } as unknown as EventTarget)).toBe(false);
    expect(isTyping({ tagName: "BUTTON" } as unknown as EventTarget)).toBe(false);
    expect(isTyping(null)).toBe(false);
  });
});

describe("appShortcuts", () => {
  it("numbers the pages from one", () => {
    const rows = appShortcuts(["Ana sayfa", "Şampiyonlar"]);
    expect(rows[1]).toEqual({ keys: ["Ctrl", "1"], label: "Ana sayfa" });
    expect(rows[2]).toEqual({ keys: ["Ctrl", "2"], label: "Şampiyonlar" });
    expect(rows[rows.length - 1].keys).toEqual(["?"]);
  });
});
