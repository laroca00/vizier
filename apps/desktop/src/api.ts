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

async function get<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, init);
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

export type Choice<T> = T & { games: number; winRate: number };

export type Build = {
  patches: string[];
  games: number;
  winRate: number;
  runes: Choice<{ primaryStyle: number; subStyle: number; perks: number[] }>[];
  spells: Choice<{ ids: number[] }>[];
  items: Choice<{ id: number }>[];
};

/** Null when Vizier has no games for the champion yet. */
export async function getBuild(championId: number, position: string | null): Promise<Build | null> {
  const query = position ? `?position=${position.toUpperCase()}` : "";
  try {
    return await get<Build>(`/v1/builds/${championId}${query}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export type Coaching = {
  source?: "rules" | "workers-ai" | "claude";
  headline: string;
  points: { minute: number | null; title: string; detail: string }[];
};

export function getCoaching(matchId: string, puuid: string) {
  return get<Coaching>(`/v1/coach/${matchId}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ puuid }),
  });
}
