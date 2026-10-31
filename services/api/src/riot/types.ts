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

export type Match = {
  metadata: { matchId: string; participants: string[] };
  info: { gameVersion: string; queueId: number; gameDuration: number; participants: unknown[] };
};
