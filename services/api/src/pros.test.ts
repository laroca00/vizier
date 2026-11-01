import { describe, expect, it } from "vitest";
import { ProCrawler, proBuilds, proTeams, syncChallengers } from "./pros.ts";
import type { RiotClient } from "./riot/client.ts";
import type { Match, Participant } from "./riot/types.ts";
import { fakeD1 } from "./test/fakeD1.ts";

const DAY = 86_400_000;

const perks = {
  statPerks: { offense: 5008, flex: 5008, defense: 5011 },
  styles: [
    { description: "primaryStyle", style: 8100, selections: [{ perk: 8112 }, { perk: 8143 }, { perk: 8138 }, { perk: 8106 }] },
    { description: "subStyle", style: 8300, selections: [{ perk: 8345 }, { perk: 8347 }] },
  ],
};

function participant(puuid: string, championId: number, teamId: number, extra: Partial<Participant> = {}): Participant {
  return {
    puuid, participantId: teamId === 100 ? 1 : 6, teamId, championId, teamPosition: "MIDDLE", win: teamId === 100,
    kills: 7, deaths: 2, assists: 5, totalMinionsKilled: 250, neutralMinionsKilled: 10, goldEarned: 14000,
    summoner1Id: 4, summoner2Id: 12, item0: 6655, item1: 3020, item2: 4645, perks, ...extra,
  };
}

const match = (id: string, start: number): Match => ({
  metadata: { matchId: id, participants: [] },
  info: { gameVersion: "16.21.1", queueId: 420, gameStartTimestamp: start, gameDuration: 1700, participants: [participant("faker", 103, 100), participant("other", 238, 200)] },
});

const timeline = {
  info: {
    frames: [
      {
        timestamp: 0,
        participantFrames: {},
        events: [
          { type: "ITEM_PURCHASED", timestamp: 10_000, participantId: 1, itemId: 1056 },
          { type: "SKILL_LEVEL_UP", timestamp: 60_000, participantId: 1, skillSlot: 1 },
          { type: "SKILL_LEVEL_UP", timestamp: 120_000, participantId: 1, skillSlot: 3 },
        ],
      },
    ],
  },
};

describe("ProCrawler", () => {
  it("resolves the listed accounts and saves only the pro's side of new games", async () => {
    const { db } = fakeD1();
    const now = 100 * DAY;
    const calls: string[] = [];
    const riot = {
      get: async (routing: string, _method: string, path: string) => {
        calls.push(`${routing} ${path}`);
        if (path.includes("by-riot-id/Hide%20on%20bush/KR1")) return { puuid: "faker", gameName: "Hide on bush", tagLine: "KR1" };
        if (path.includes("by-riot-id")) return null;
        if (path.includes("/faker/ids?")) return ["KR_1", "KR_2", "KR_3"];
        if (path.endsWith("/timeline")) return timeline;
        const id = path.split("/").pop()!;
        return match(id, now - Number(id.slice(3)) * 60_000);
      },
    } as unknown as RiotClient;
    const players = [{ name: "Faker", team: "T1", role: "MIDDLE" as const, accounts: [{ riotId: "Hide on bush#KR1", platform: "kr" as const }, { riotId: "gone#NA1", platform: "na1" as const }] }];

    const crawler = new ProCrawler(db, riot, () => now, players);
    expect(await crawler.run()).toBe(2);
    // KR games come from the Asia host.
    expect(calls.some((c) => c.startsWith("asia /lol/match/v5/matches/KR_1"))).toBe(true);
    expect(await crawler.run()).toBe(1);

    const builds = await proBuilds(db, { championId: 103 });
    expect(builds.map((b) => b.matchId)).toEqual(["KR_1", "KR_2", "KR_3"]);
    expect(builds[0]).toMatchObject({
      player: "Faker", team: "T1", platform: "kr", opponentChampionId: 238, position: "MIDDLE", win: true,
      kills: 7, cs: 260, spells: [4, 12], items: [6655, 3020, 4645], startItems: [1056], skillOrder: [1, 3],
    });
    expect(await proBuilds(db, { championId: 238 })).toEqual([]);
    expect(await proTeams(db)).toEqual([{ team: "T1", group: "worlds", players: ["Faker"] }]);
    expect(await proBuilds(db, { group: "turkey" })).toEqual([]);
  });
});

describe("syncChallengers", () => {
  it("lists the top of each ladder and drops players who fell off it", async () => {
    const { db } = fakeD1();
    let ladder = [
      { puuid: "a", leaguePoints: 1500 },
      { puuid: "b", leaguePoints: 1800 },
      { puuid: "c", leaguePoints: 900 },
    ];
    const lookups: string[] = [];
    const riot = {
      get: async (_routing: string, _method: string, path: string) => {
        if (path.includes("challengerleagues")) return { entries: ladder };
        const puuid = path.split("/").pop()!;
        lookups.push(puuid);
        return { puuid, gameName: `Player ${puuid}`, tagLine: "KR1" };
      },
    } as unknown as RiotClient;
    const ladders = [{ platform: "kr" as const, top: 2, label: "KR Challenger" }];

    expect(await syncChallengers(db, riot, ladders)).toBe(2);
    const teams = await proTeams(db);
    expect(teams).toEqual([{ team: "KR Challenger", group: "challenger", players: ["Player a", "Player b"] }]);

    ladder = [{ puuid: "c", leaguePoints: 2000 }, { puuid: "b", leaguePoints: 1900 }];
    expect(await syncChallengers(db, riot, ladders)).toBe(2);
    expect((await proTeams(db))[0].players).toEqual(["Player b", "Player c"]);
    // b was already known, so only new players cost an account lookup.
    expect(lookups).toEqual(["b", "a", "c"]);
  });
});
