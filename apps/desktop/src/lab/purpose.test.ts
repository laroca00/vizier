import { describe, expect, it } from "vitest";
import { purposeOf } from "./purpose";

const details = new Map<number, { stats: Record<string, number>; tags: string[] }>([
  [1, { stats: { FlatMagicDamageMod: 120 }, tags: ["MagicPenetration"] }],
  [2, { stats: { FlatMagicDamageMod: 90 }, tags: [] }],
  [3, { stats: { FlatPhysicalDamageMod: 70, FlatHPPoolMod: 400, FlatArmorMod: 40 }, tags: ["LifeSteal"] }],
  [4, { stats: { FlatHPPoolMod: 1000, FlatArmorMod: 60, FlatSpellBlockMod: 60 }, tags: ["Aura"] }],
]);

describe("purposeOf", () => {
  it("is null without items", () => {
    expect(purposeOf([], details)).toBeNull();
  });
  it("reads a penetrating AP build with little toughness", () => {
    expect(purposeOf([1, 2], details)).toEqual({ damage: "Büyü hasarı ağırlıklı", extras: ["delme var"], survival: "dayanıklılık az" });
  });
  it("reads mixed damage", () => {
    expect(purposeOf([1, 3], details)?.damage).toBe("Karma hasar");
  });
  it("reads a tough build with an aura and little damage", () => {
    expect(purposeOf([4], details)).toEqual({ damage: "Hasar eşyası az", extras: ["kullanılabilir etki var"], survival: "dayanıklılık yüksek" });
  });
  it("counts life steal as a trait only from 10%", () => {
    const lifesteal = new Map([[1, { stats: { PercentLifeStealMod: 0.12 }, tags: [] }]]);
    expect(purposeOf([1], lifesteal)?.extras).toEqual(["can çalma var"]);
  });
});
