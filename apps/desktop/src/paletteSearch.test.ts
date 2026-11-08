import { describe, expect, it } from "vitest";
import type { Champion } from "./data/ddragon";
import { search } from "./paletteSearch";

const champion = (key: number, name: string) => ({ key, id: name, name, tags: ["Mage"] }) as unknown as Champion;

describe("palette search", () => {
  it("lists pro players after champions", () => {
    const results = search("fa", [champion(1, "Fiddlesticks")], [], [{ player: "Faker", team: "T1" }, { player: "Chovy", team: "GEN" }]);
    expect(results.map((r) => r.kind)).toEqual(["pro"]);
    expect(search("ch", [], [], [{ player: "Chovy", team: "GEN" }])[0]).toEqual({ kind: "pro", pro: { player: "Chovy", team: "GEN" } });
  });
});
