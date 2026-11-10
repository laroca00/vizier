import { BRACKETS, DEFAULT_BRACKET } from "@vizier/shared/brackets";
import { describe, expect, it } from "vitest";
import { emptyCatalog } from "./archetypes.ts";
import { rollup } from "./rollup.ts";
import { BRACKET_KINDS, docKey, splitRank, statDocs } from "./statDocs.ts";
import { fakeD1 } from "./test/fakeD1.ts";

describe("doc keys with a bracket", () => {
  it("Emerald+ keeps today's key and every other bracket adds a suffix", () => {
    expect(docKey.tierList(420, "MIDDLE")).toBe("tierlist:420:MIDDLE");
    expect(docKey.tierList(420, "MIDDLE", "emerald_plus")).toBe("tierlist:420:MIDDLE");
    expect(docKey.tierList(420, "MIDDLE", "gold_minus")).toBe("tierlist:420:MIDDLE:r=gold_minus");
    expect(docKey.champion(420, 103, null, "all")).toBe("champion:420:103:ANY:r=all");
    expect(docKey.build(420, 103, "MIDDLE", "diamond_plus")).toBe("build:420:103:MIDDLE:r=diamond_plus");
    expect(docKey.matchupBuilds(103, "MIDDLE", "master_plus")).toBe("buildvs:103:MIDDLE:r=master_plus");
    expect(docKey.counters(103, "MIDDLE", "platinum_plus")).toBe("counters:103:MIDDLE:r=platinum_plus");
    expect(docKey.bench(420, 103, "MIDDLE", "all")).toBe("bench:420:103:MIDDLE:r=all");
    // Unbracketed kinds take no bracket at all.
    expect(docKey.itemTimes(103, "MIDDLE")).toBe("itemtimes:103:MIDDLE");
  });

  it("splitRank undoes the suffix for every bracket and kind", () => {
    for (const bracket of BRACKETS) {
      const keys = [
        docKey.tierList(420, "TOP", bracket),
        docKey.champion(420, 1, "TOP", bracket),
        docKey.build(420, 1, null, bracket),
        docKey.matchupBuilds(1, "TOP", bracket),
        docKey.counters(1, "TOP", bracket),
        docKey.synergies(1, "TOP", bracket),
        docKey.lane(1, "TOP", bracket),
        docKey.bench(420, 1, "TOP", bracket),
        docKey.statsBoard("TOP", bracket),
      ];
      expect(keys.map((k) => splitRank(k).bracket)).toEqual(keys.map(() => bracket));
      expect(keys.map((k) => splitRank(k).base)).toEqual(keys.map((k) => k.replace(/:r=\w+$/, "")));
      expect(keys.map((k) => k.split(":")[0])).toEqual([...BRACKET_KINDS]);
    }
    expect(splitRank("tierlist:420:TOP:r=nonsense")).toEqual({ base: "tierlist:420:TOP:r=nonsense", bracket: DEFAULT_BRACKET });
    expect(splitRank("bans")).toEqual({ base: "bans", bracket: DEFAULT_BRACKET });
  });
});

function game(sqlite: ReturnType<typeof fakeD1>["sqlite"], id: string, group: string, win: boolean, champion: number) {
  sqlite.prepare("INSERT INTO crawled_matches (match_id, patch, game_start, queue_id, bans, rank_group) VALUES (?, '16.21', 1000, 420, '', ?)").run(id, group);
  const row = sqlite.prepare(
    `INSERT INTO participant_stats (match_id, patch, champion_id, team_position, win, runes, spells, items, opponent_champion_id, duration, queue_id, team_id, rank_group)
     VALUES (?, '16.21', ?, 'MIDDLE', ?, '8100:8300:8112,8143,8138,8106:8345,8347:5008,5008,5011', '4,14', '3157', ?, 1800, 420, ?, ?)`,
  );
  row.run(id, champion, win ? 1 : 0, 64, 100, group);
  row.run(id, 64, win ? 0 : 1, champion, 200, group);
}

describe("statDocs per bracket", () => {
  it("publishes the bracket kinds under suffixed keys with that bracket's games, Emerald+ unchanged", async () => {
    const { db, sqlite } = fakeD1();
    // Champion 103: 4 silver games (all wins), 6 diamond games (all losses).
    for (let i = 0; i < 4; i++) game(sqlite, `EUW1_s${i}`, "silver", true, 103);
    for (let i = 0; i < 6; i++) game(sqlite, `EUW1_d${i}`, "diamond", false, 103);
    await rollup(db, async () => ({ ...emptyCatalog(), finished: new Set([3157]) }));

    const collect = async (bracket?: Parameters<typeof statDocs>[1]) => {
      const docs = new Map<string, unknown>();
      for await (const [key, value] of statDocs(db, bracket)) docs.set(key, value);
      return docs;
    };
    const main = await collect();
    const low = await collect("gold_minus");
    const all = await collect("all");

    // Emerald+ docs: only the diamond games, same keys as before.
    expect(main.has("champion:420:103:MIDDLE")).toBe(true);
    expect([...main.keys()].some((k) => k.includes(":r="))).toBe(false);
    expect(main.get("champion:420:103:MIDDLE")).toMatchObject({ games: 6, winRate: 0 });
    expect(main.has("bans")).toBe(true);

    // Gold and below: only the silver games, only bracket kinds.
    expect(low.get("champion:420:103:MIDDLE:r=gold_minus")).toMatchObject({ games: 4, winRate: 1 });
    expect(low.get("champion:420:103:ANY:r=gold_minus")).toMatchObject({ games: 4 });
    expect(low.get("build:420:103:MIDDLE:r=gold_minus")).toMatchObject({ games: 4 });
    expect(low.has("tierlist:420:MIDDLE:r=gold_minus")).toBe(true);
    expect(low.has("bans")).toBe(false);
    expect(low.has("itemtimes:103:MIDDLE")).toBe(false);
    expect([...low.keys()].every((k) => k.includes(":r=gold_minus"))).toBe(true);
    expect([...low.keys()].every((k) => BRACKET_KINDS.includes(k.split(":")[0] as never))).toBe(true);

    expect(all.get("champion:420:103:MIDDLE:r=all")).toMatchObject({ games: 10, winRate: 0.4 });
    // A bracket with no games for a champion publishes nothing for it.
    const top = await collect("master_plus");
    expect([...top.keys()].some((k) => k.startsWith("champion:"))).toBe(false);
  });
});
