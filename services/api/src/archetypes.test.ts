import { describe, expect, it } from "vitest";
import { buildStyle, catalogFrom, foeProfiles, itemStyle, type RawItem } from "./archetypes.ts";
import { aggregateBuild } from "./builds.ts";
import { Crawler } from "./crawler.ts";
import type { RiotClient } from "./riot/client.ts";
import type { Match, Participant } from "./riot/types.ts";
import { rollup } from "./rollup.ts";
import { fakeD1 } from "./test/fakeD1.ts";

// Trimmed from Data Dragon 16.21.
const ITEMS: Record<string, RawItem> = {
  3031: { tags: ["CriticalStrike", "Damage"], gold: { total: 3450 }, stats: { FlatCritChanceMod: 0.25, FlatPhysicalDamageMod: 65 } },
  6675: { tags: ["CriticalStrike", "AttackSpeed"], gold: { total: 2650 }, stats: { FlatCritChanceMod: 0.25, PercentAttackSpeedMod: 0.4 } },
  3115: { tags: ["AttackSpeed", "SpellDamage", "OnHit"], gold: { total: 3000 }, stats: { FlatMagicDamageMod: 80, PercentAttackSpeedMod: 0.5 } },
  3089: { tags: ["SpellDamage"], gold: { total: 3600 }, stats: { FlatMagicDamageMod: 130 } },
  4645: { tags: ["SpellDamage", "MagicPenetration"], gold: { total: 3200 }, stats: { FlatMagicDamageMod: 110 } },
  6672: { tags: ["Damage", "AttackSpeed", "OnHit"], gold: { total: 3100 }, stats: { FlatPhysicalDamageMod: 45, PercentAttackSpeedMod: 0.4 } },
  3153: { tags: ["Damage", "AttackSpeed", "OnHit"], gold: { total: 3200 }, stats: { FlatPhysicalDamageMod: 40, PercentAttackSpeedMod: 0.25 } },
  3156: { tags: ["SpellBlock", "Damage"], gold: { total: 3100 }, stats: { FlatSpellBlockMod: 40, FlatPhysicalDamageMod: 60 } },
  3075: { tags: ["Health", "Armor"], gold: { total: 2450 }, stats: { FlatHPPoolMod: 350, FlatArmorMod: 70 } },
  3065: { tags: ["Health", "SpellBlock"], gold: { total: 2700 }, stats: { FlatHPPoolMod: 450, FlatSpellBlockMod: 60 } },
  3142: { tags: ["Damage", "ArmorPenetration"], gold: { total: 2800 }, stats: { FlatPhysicalDamageMod: 55 } },
  3172: { tags: ["AttackSpeed"], gold: { total: 1000 }, stats: { FlatMovementSpeedMod: 45, PercentAttackSpeedMod: 0.25 } },
  6617: { tags: ["Health", "SpellDamage", "ManaRegen"], gold: { total: 2200 }, stats: { FlatHPPoolMod: 200, FlatMagicDamageMod: 25 } },
  1038: { tags: ["Damage"], gold: { total: 1300 }, into: ["3031"], stats: { FlatPhysicalDamageMod: 40 } },
};

const MAGES = [1, 2, 3, 4, 5];
const FIGHTERS = [11, 12, 13, 14, 15];
const KAISA = 145;
const champion = (key: number, magic: boolean, tag = "Fighter") => ({ key: String(key), tags: [tag], info: { attack: magic ? 2 : 8, magic: magic ? 8 : 2 } });
const CHAMPIONS = Object.fromEntries(
  [...MAGES.map((id) => champion(id, true, "Mage")), ...FIGHTERS.map((id) => champion(id, false)), champion(KAISA, false, "Marksman"), ...[21, 22, 23, 24].map((id) => champion(id, false))].map((c) => [c.key, c]),
);
const catalog = catalogFrom(ITEMS, CHAMPIONS);

describe("item and build styles", () => {
  it("names items by their stats", () => {
    expect(itemStyle(ITEMS[3031])).toBe("crit");
    expect(itemStyle(ITEMS[3115])).toBe("hybrid");
    expect(itemStyle(ITEMS[3089])).toBe("ap");
    expect(itemStyle(ITEMS[6672])).toBe("onhit");
    expect(itemStyle(ITEMS[3142])).toBe("lethality");
    expect(itemStyle(ITEMS[3075])).toBe("tank");
    expect(itemStyle(ITEMS[6617])).toBe("enchanter");
    expect(itemStyle(ITEMS[3172])).toBeNull();
    expect(catalog.finished.has(1038)).toBe(false);
  });

  it("names an inventory by what most of it does", () => {
    expect(buildStyle([3031, 6675, 3172], catalog)).toBe("crit");
    expect(buildStyle([3089, 4645, 3172], catalog)).toBe("ap");
    expect(buildStyle([3115, 6672, 3153], catalog)).toBe("hybrid");
    expect(buildStyle([6672, 3153], catalog)).toBe("onhit");
    expect(buildStyle([3075, 3065], catalog)).toBe("tank");
    expect(buildStyle([3031, 3172], catalog)).toBeNull();
  });

  it("reads an enemy team's damage", () => {
    expect(foeProfiles(MAGES, catalog)).toEqual(["ap"]);
    expect(foeProfiles(FIGHTERS, catalog)).toEqual(["ad"]);
    expect(foeProfiles(MAGES.slice(0, 4), catalog)).toEqual([]);
  });
});

const perks = {
  statPerks: { offense: 5008, flex: 5008, defense: 5011 },
  styles: [
    { description: "primaryStyle", style: 8000, selections: [{ perk: 8008 }, { perk: 9111 }, { perk: 9103 }, { perk: 8017 }] },
    { description: "subStyle", style: 8300, selections: [{ perk: 8345 }, { perk: 8347 }] },
  ],
};
const apPerks = { ...perks, styles: [{ description: "primaryStyle", style: 8100, selections: [{ perk: 8112 }, { perk: 8143 }, { perk: 8138 }, { perk: 8106 }] }, perks.styles[1]] };

const POSITIONS = ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"];

function player(id: number, teamId: number, championId: number, win: boolean, extra: Partial<Participant> = {}): Participant {
  return {
    puuid: `p${id}`, participantId: id, teamId, championId, teamPosition: POSITIONS[(id - 1) % 5], win,
    totalMinionsKilled: 200, neutralMinionsKilled: 0, summoner1Id: 4, summoner2Id: 7, perks, ...extra,
  };
}

describe("build variants", () => {
  it("splits a champion's games by build style and finds items for the enemy team", async () => {
    const { db } = fakeD1();
    const crawler = new Crawler(db, { get: async () => null } as unknown as RiotClient);
    for (let n = 0; n < 70; n++) {
      const ap = n % 3 === 0;
      const vsMages = n % 2 === 0;
      const kaisa = ap
        ? { perks: apPerks, item0: 3115, item1: 3089, item2: 4645 }
        : { item0: 3031, item1: 6675, item2: 6672, ...(vsMages ? { item3: 3156 } : {}) };
      const allies = [21, 22, 23, 24].map((id, i) => player(i + 1, 100, id, n % 2 === 0));
      const enemies = (vsMages ? MAGES : FIGHTERS).map((id, i) => player(i + 6, 200, id, n % 2 !== 0));
      const match: Match = {
        metadata: { matchId: `TR1_${n}`, participants: [] },
        info: {
          gameVersion: "16.21.1", queueId: 420, gameStartTimestamp: n, gameDuration: 1800,
          participants: [...allies.slice(0, 3), player(4, 100, KAISA, n % 2 === 0, kaisa), allies[3], ...enemies],
        },
      };
      await crawler.save(match);
    }
    await rollup(db, async () => catalog);

    const build = await aggregateBuild(db, KAISA, "BOTTOM");
    expect(build?.variants.map((v) => v.style)).toEqual(["crit", "ap"]);
    const [crit, ap] = build!.variants;
    expect(crit.games + ap.games).toBe(70);
    expect(ap.runes[0].primaryStyle).toBe(8100);
    expect(crit.runes[0].primaryStyle).toBe(8000);
    expect(ap.items.map((i) => i.id)).toContain(3089);
    expect(crit.items.map((i) => i.id)).not.toContain(3089);

    const vsAp = build?.situational.find((s) => s.vs === "ap");
    expect(vsAp?.items[0].id).toBe(3156);
    expect(build?.situational.find((s) => s.vs === "ad")?.items.map((i) => i.id) ?? []).not.toContain(3156);
  });
});
