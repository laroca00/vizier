import { describe, expect, it } from "vitest";
import { loadingUrl, skinLabel } from "./ddragon";

describe("skins", () => {
  it("names the base skin after the champion", () => {
    expect(skinLabel({ num: 0, name: "default" }, "Ahri")).toBe("Ahri");
    expect(skinLabel({ num: 1, name: "Dynasty Ahri" }, "Ahri")).toBe("Dynasty Ahri");
  });
  it("builds loading art urls", () => {
    expect(loadingUrl("Ahri", 3)).toBe("https://ddragon.leagueoflegends.com/cdn/img/champion/loading/Ahri_3.jpg");
  });
});
