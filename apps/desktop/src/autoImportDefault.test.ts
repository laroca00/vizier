import { describe, expect, it } from "vitest";
import { withAutoImportOn } from "./autoImportDefault";

describe("withAutoImportOn", () => {
  it("flips the three import switches and keeps other settings", () => {
    const next = withAutoImportOn({ autoImportRunes: false, autoImportSpells: false, autoImportItems: false, language: "en" });
    expect(next).toEqual({ autoImportRunes: true, autoImportSpells: true, autoImportItems: true, language: "en" });
  });
});
