import { describe, expect, it } from "vitest";
import { modeAugmentIds, parseAugments, pickOrder } from "./data";

describe("pickOrder", () => {
  const list = [
    { id: 1, tier: "B", winRate: 0.6 },
    { id: 2, tier: "S", winRate: 0.52 },
    { id: 3, tier: "S", winRate: 0.55 },
    { id: 4, tier: "?", winRate: 0.9 },
  ];

  it("puts the best tier first and breaks ties by win rate", () => {
    expect(pickOrder(list, 4).map((a) => a.id)).toEqual([3, 2, 1, 4]);
  });

  it("limits the count and leaves the input alone", () => {
    expect(pickOrder(list, 2).map((a) => a.id)).toEqual([3, 2]);
    expect(list[0].id).toBe(1);
  });
});

describe("client augment data", () => {
  const raw = [
    { id: 1414, augmentNameId: "Dropybara_Active", nameTRA: "Düşen Kapibara", augmentSmallIconPath: "/lol-game-data/assets/ASSETS/UX/Cherry/Augments/Icons/OrbitalLaser_small.png", rarity: "kPrismatic" },
    { id: 68, augmentNameId: "ARAM_Recursion", nameTRA: "Yineleme", augmentSmallIconPath: "/lol-game-data/assets/ASSETS/UX/Cherry/Augments/Icons/Recursion_small.png", rarity: "kGold" },
    { id: 9, augmentNameId: "Odd", nameTRA: "", augmentSmallIconPath: "", rarity: "kSilver" },
  ];

  it("reads names, rarities and lowercase icon urls, skipping nameless rows", () => {
    const info = parseAugments(raw);
    expect(info.size).toBe(2);
    expect(info.get(1414)).toEqual({
      id: 1414,
      name: "Düşen Kapibara",
      rarity: 2,
      icon: "https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/assets/ux/cherry/augments/icons/orbitallaser_small.png",
    });
    expect(info.get(68)?.rarity).toBe(1);
  });

  it("matches a mode's augment list by internal name", () => {
    const lists = [
      { modeName: "CHERRY", augmentList: ["Maps/ModeSpecificData/Augments/Dropybara_Active"] },
      { modeName: "KIWI", augmentList: ["Maps/ModeSpecificData/Augments/aram_recursion", "Maps/ModeSpecificData/Augments/Dropybara_Active", "Maps/ModeSpecificData/Augments/Missing"] },
    ];
    expect(modeAugmentIds(lists, raw, "KIWI")).toEqual([68, 1414]);
    expect(modeAugmentIds(lists, raw, "CHERRY")).toEqual([1414]);
    expect(modeAugmentIds([], raw, "KIWI")).toEqual([]);
  });
});
