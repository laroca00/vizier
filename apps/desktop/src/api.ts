const API_URL = import.meta.env.VITE_API_URL ?? "https://vizier-api.vizier-api.workers.dev";

export type Rank = {
  queueType: string;
  tier: string;
  rank: string;
  leaguePoints: number;
  wins: number;
  losses: number;
};

export type Profile = {
  account: { puuid: string; gameName: string; tagLine: string };
  summoner: { profileIconId: number; summonerLevel: number } | null;
  ranks: Rank[];
};

export type MatchParticipant = {
  puuid: string;
  championId: number;
  teamPosition: string;
  kills: number;
  deaths: number;
  assists: number;
  win: boolean;
};

export type Match = {
  metadata: { matchId: string };
  info: { gameEndTimestamp: number; gameDuration: number; queueId: number; participants: MatchParticipant[] };
};

export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function get<T>(path: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`);
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new ApiError(response.status, body?.error ?? response.statusText);
  }
  return response.json() as Promise<T>;
}

export function getProfile(gameName: string, tagLine: string) {
  return get<Profile>(`/v1/profiles/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`);
}

export async function getRecentMatches(puuid: string, count: number): Promise<Match[]> {
  const { matchIds } = await get<{ matchIds: string[] }>(`/v1/players/${puuid}/matches?count=${count}`);
  return Promise.all(matchIds.map((id) => get<Match>(`/v1/matches/${id}`)));
}
