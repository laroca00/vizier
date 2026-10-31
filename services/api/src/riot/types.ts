// Only the fields Vizier reads; Riot's DTOs carry more.

export type Account = { puuid: string; gameName: string; tagLine: string };

export type Summoner = { puuid: string; profileIconId: number; summonerLevel: number };

export type LeagueEntry = {
  queueType: string;
  tier: string;
  rank: string;
  leaguePoints: number;
  wins: number;
  losses: number;
};

export type Participant = {
  puuid: string;
  championId: number;
  teamPosition: string;
  win: boolean;
  summoner1Id?: number;
  summoner2Id?: number;
  item0?: number;
  item1?: number;
  item2?: number;
  item3?: number;
  item4?: number;
  item5?: number;
  perks?: {
    statPerks: { offense: number; flex: number; defense: number };
    styles: { description: string; style: number; selections: { perk: number }[] }[];
  };
};

/** challenger/grandmaster/master leagues; division pages are a bare array of these. */
export type LeagueEntryWithPuuid = { puuid: string };
export type LeagueList = { entries: LeagueEntryWithPuuid[] };

export type Match = {
  metadata: { matchId: string; participants: string[] };
  info: {
    gameVersion: string;
    queueId: number;
    gameStartTimestamp: number;
    gameDuration: number;
    participants: Participant[];
  };
};

/** `26.21.715.1234` is patch `26.21`. */
export function patchOf(gameVersion: string): string {
  return gameVersion.split(".").slice(0, 2).join(".");
}
