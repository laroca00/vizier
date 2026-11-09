import { describe, expect, it } from "vitest";
import { commandLinks, commandPatch } from "./commands";

const on = { overlay: true, autoImportRunes: true, autoImportSpells: true, autoImportItems: true, autoAcceptReady: false };

describe("commands", () => {
  it("label each toggle by what it will do", () => {
    const labels = commandLinks(on).map((c) => c.label);
    expect(labels).toContain("Overlay'i kapat");
    expect(labels).toContain("Otomatik aktarımı kapat");
    expect(labels).toContain("Maçı kendiliğinden kabul et");
    expect(commandLinks({ ...on, overlay: false, autoImportItems: false }).map((c) => c.label)).toEqual(expect.arrayContaining(["Overlay'i aç", "Otomatik aktarımı aç"]));
  });

  it("flip the settings they name", () => {
    expect(commandPatch("cmd:overlay", on)).toEqual({ overlay: false });
    expect(commandPatch("cmd:autoImport", on)).toEqual({ autoImportRunes: false, autoImportSpells: false, autoImportItems: false });
    // Partly on counts as off, so one press turns all three on.
    expect(commandPatch("cmd:autoImport", { ...on, autoImportSpells: false })).toEqual({ autoImportRunes: true, autoImportSpells: true, autoImportItems: true });
    expect(commandPatch("cmd:autoAccept", on)).toEqual({ autoAcceptReady: true });
    expect(commandPatch("cmd:welcome", on)).toEqual({ welcomeSeen: false });
    expect(commandPatch("cmd:keys", on)).toBeNull();
  });
});
