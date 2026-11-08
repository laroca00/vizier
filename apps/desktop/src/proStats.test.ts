import { describe, expect, it } from "vitest";
import type { ProBuild } from "./api";
import { opponentFirst, summarizePlayer, uniqueGames } from "./proStats";

const build = (extra: Partial<ProBuild>): ProBuild => ({
  matchId: "EUW1_1", player: "Chovy", team: "Gen.G", platform: "kr", patch: "16.21", gameStart: 1000, duration: 1800,
  championId: 103, opponentChampionId: 238, position: "MIDDLE", win: true, kills: 1, deaths: 1, assists: 1, cs: 200, gold: 10000,
  runes: "8100:8300:8112,8143,8138,8106:8345,8347:5008,5008,5011", spells: [4, 12], items: [6655, 3020], startItems: [], skillOrder: [], purchases: [], ...extra,
});

const keystone = (b: ProBuild) => Number(b.runes.split(":")[2].split(",")[0]);

describe("summarizePlayer", () => {
  const games = [
    build({ matchId: "a", gameStart: 3000 }),
    build({ matchId: "b", gameStart: 2000, win: false }),
    build({ matchId: "c", gameStart: 1000, championId: 7, team: "Old", items: [6655, 1056], runes: "8200:8300:8230,8143,8138,8106:8345,8347:5008,5008,5011" }),
  ];

  it("counts champions with wins, most played first", () => {
    const s = summarizePlayer(games, keystone);
    expect(s.games).toBe(3);
    expect(s.wins).toBe(2);
    expect(s.champions).toEqual([
      { championId: 103, games: 2, wins: 1 },
      { championId: 7, games: 1, wins: 1 },
    ]);
  });

  it("takes the team from the newest game", () => {
    expect(summarizePlayer(games, keystone).team).toBe("Gen.G");
  });

  it("counts keystones, spells and only finished items", () => {
    const s = summarizePlayer(games, keystone, (id) => id !== 1056);
    expect(s.keystones).toEqual([{ id: 8112, games: 2 }, { id: 8230, games: 1 }]);
    expect(s.items[0]).toEqual({ id: 6655, games: 3 });
    expect(s.items.some((i) => i.id === 1056)).toBe(false);
    expect(s.spells).toEqual([{ id: 4, games: 3 }, { id: 12, games: 3 }]);
  });

  it("counts a game seen on two accounts once", () => {
    expect(uniqueGames([build({}), build({ platform: "na1" })])).toHaveLength(1);
  });

  it("is empty without games", () => {
    expect(summarizePlayer([], keystone).champions).toEqual([]);
  });
});

describe("opponentFirst", () => {
  it("moves games against the opponent to the top and keeps the order otherwise", () => {
    const list = [{ matchId: "a", opponentChampionId: 1 }, { matchId: "b", opponentChampionId: 238 }, { matchId: "c", opponentChampionId: 2 }] as ProBuild[];
    expect(opponentFirst(list, 238).map((b) => b.matchId)).toEqual(["b", "a", "c"]);
    expect(opponentFirst(list, null)).toBe(list);
  });
});
