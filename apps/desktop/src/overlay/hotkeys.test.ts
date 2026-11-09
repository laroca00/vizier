import { describe, expect, it } from "vitest";
import { changedHotkeys, clashing, comboFromEvent, effectiveHotkeys } from "./hotkeys";

const press = (code: string, mods: Partial<Record<"ctrlKey" | "shiftKey" | "altKey" | "metaKey", boolean>> = {}) => ({
  code,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  metaKey: false,
  ...mods,
});

describe("comboFromEvent", () => {
  it("names a key with its modifiers", () => {
    expect(comboFromEvent(press("KeyK", { ctrlKey: true, shiftKey: true }))).toBe("Ctrl+Shift+K");
    expect(comboFromEvent(press("Digit4", { altKey: true }))).toBe("Alt+4");
    expect(comboFromEvent(press("F5", { ctrlKey: true }))).toBe("Ctrl+F5");
  });
  it("ignores a bare key and a lone modifier", () => {
    expect(comboFromEvent(press("KeyK"))).toBeNull();
    expect(comboFromEvent(press("ShiftLeft", { shiftKey: true }))).toBeNull();
  });
});

describe("hotkey choices", () => {
  it("lays choices over the defaults", () => {
    expect(effectiveHotkeys({ toggle: "Ctrl+Alt+H" }).toggle).toBe("Ctrl+Alt+H");
    expect(effectiveHotkeys({}).edit).toBe("Ctrl+Shift+L");
  });
  it("finds clashes, ignoring case", () => {
    expect([...clashing({ toggle: "ctrl+shift+l" })].sort()).toEqual(["edit", "toggle"]);
    expect(clashing({}).size).toBe(0);
  });
  it("sends only what differs from the default", () => {
    expect(changedHotkeys({ toggle: "Ctrl+Shift+O", edit: "Ctrl+Alt+E" })).toEqual({ edit: "Ctrl+Alt+E" });
  });
});
