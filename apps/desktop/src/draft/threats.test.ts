import { describe, expect, it } from "vitest";
import type { Ability, Champion } from "../data/ddragon";
import { spikeOf, threatOf } from "./threats";

const ability = (key: Ability["key"], cooldowns: number[]): Ability => ({ key, name: key, description: "", cooldowns, image: "" });
const abilities = [ability("P", []), ability("Q", [12, 11, 10, 9, 8]), ability("W", [10]), ability("E", [14]), ability("R", [120, 100, 80])];

function champ(id: string, tags: string[]): Champion {
  const info = { attack: 5, defense: 5, magic: 5, difficulty: 5 };
  return { id, key: String(id.length), name: id, magic: false, tank: false, tags, info } as unknown as Champion;
}

describe("enemy threats", () => {
  it("uses the ultimate by default", () => {
    const t = threatOf(champ("Garen", ["Fighter"]), abilities)!;
    expect(t.ability.key).toBe("R");
    expect(t.cooldown).toEqual({ first: 120, max: 80 });
  });

  it("uses the listed crowd control ability", () => {
    const t = threatOf(champ("Blitzcrank", ["Tank"]), abilities)!;
    expect(t.ability.key).toBe("Q");
    expect(t.cooldown).toEqual({ first: 12, max: 8 });
  });

  it("has no cooldown when Data Dragon lists none", () => {
    expect(threatOf(champ("Garen", []), [ability("R", [0])])!.cooldown).toBeNull();
    expect(threatOf(champ("Garen", []), [ability("P", [])])).toBeNull();
  });

  it("names the spike from the power curve", () => {
    expect(spikeOf(champ("Draven", ["Marksman"]))).toBe("early");
    expect(spikeOf(champ("Kayle", ["Fighter"]))).toBe("items");
    expect(spikeOf(champ("Ahri", ["Mage"]))).toBe("six");
  });
});
