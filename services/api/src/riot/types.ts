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
  participantId?: number;
  teamId?: number;
  /** Arena only: which duo the player belongs to. */
  playerSubteamId?: number;
  championId: number;
  teamPosition: string;
  win: boolean;
  /** Arena only: where the player's team finished, 1 to 8. */
  placement?: number;
  playerAugment1?: number;
  playerAugment2?: number;
  playerAugment3?: number;
  playerAugment4?: number;
  playerAugment5?: number;
  playerAugment6?: number;
  firstBloodKill?: boolean;
  kills?: number;
  deaths?: number;
  assists?: number;
  totalMinionsKilled?: number;
  neutralMinionsKilled?: number;
  goldEarned?: number;
  visionScore?: number;
  /** Seconds the player was in the game; shorter than the game when they left. */
  timePlayed?: number;
  totalDamageDealtToChampions?: number;
  gameEndedInEarlySurrender?: boolean;
  teamEarlySurrendered?: boolean;
  challenges?: {
    laneMinionsFirst10Minutes?: number;
    jungleCsBefore10Minutes?: number;
    killParticipation?: number;
    teamDamagePercentage?: number;
  };
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
    teams?: {
      teamId: number;
      bans?: { championId: number; pickTurn: number }[];
      objectives?: Partial<Record<"dragon" | "horde" | "riftHerald" | "tower" | "champion", { first: boolean; kills: number }>>;
    }[];
  };
};

/** `26.21.715.1234` is patch `26.21`. */
export function patchOf(gameVersion: string): string {
  return gameVersion.split(".").slice(0, 2).join(".");
}

export type ActiveGame = {
  gameId: number;
  gameQueueConfigId?: number;
  participants: { puuid: string | null; riotId?: string; championId: number; teamId: number; spell1Id: number; spell2Id: number }[];
};

export type ChampionMastery = { championId: number; championLevel: number; championPoints: number; lastPlayTime: number };
