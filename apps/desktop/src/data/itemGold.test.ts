import { describe, expect, it } from "vitest";
import { goldEfficiency, statGold } from "./itemGold";

describe("gold efficiency", () => {
  it("prices the basic items at 100%", () => {
    expect(goldEfficiency({ FlatPhysicalDamageMod: 10 }, 350)).toBeCloseTo(1, 5); // Long Sword
    expect(goldEfficiency({ FlatArmorMod: 15 }, 300)).toBeCloseTo(1, 5); // Cloth Armor
    expect(goldEfficiency({ FlatSpellBlockMod: 25 }, 450)).toBeCloseTo(1, 5); // Null-Magic Mantle
    expect(goldEfficiency({ FlatMagicDamageMod: 20 }, 435)).toBeCloseTo(1, 5); // Amplifying Tome
    expect(goldEfficiency({ FlatHPPoolMod: 150 }, 400)).toBeCloseTo(1, 1); // Ruby Crystal
  });

  it("counts percent stats per percent point", () => {
    expect(statGold({ PercentAttackSpeedMod: 0.18 })).toBeCloseTo(450, 5); // Dagger: 12% for 300 gold
    expect(statGold({ FlatCritChanceMod: 0.2 })).toBeCloseTo(800, 5);
  });

  it("adds stats up and ignores ones it doesn't price", () => {
    expect(statGold({ FlatPhysicalDamageMod: 50, FlatArmorMod: 10, PercentMagicPenetrationMod: 0.4 })).toBeCloseTo(1950, 5);
  });

  it("gives no number for free or unpriced items", () => {
    expect(goldEfficiency({ FlatArmorMod: 10 }, 0)).toBeNull();
    expect(goldEfficiency({}, 500)).toBeNull();
  });
});
