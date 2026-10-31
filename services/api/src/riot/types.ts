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
};

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
