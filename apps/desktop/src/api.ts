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
  participantId: number;
  teamId: number;
  riotIdGameName?: string;
  riotIdTagline?: string;
  championId: number;
  champLevel: number;
  teamPosition: string;
  kills: number;
  deaths: number;
  assists: number;
  totalMinionsKilled: number;
  neutralMinionsKilled: number;
  goldEarned: number;
  totalDamageDealtToChampions: number;
  item0: number;
  item1: number;
  item2: number;
  item3: number;
  item4: number;
  item5: number;
  item6: number;
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
  /** The opponent the numbers are for, or null when they cover every matchup. */
  vs: number | null;
  startItems: Choice<{ ids: number[] }> | null;
  coreItems: Choice<{ ids: number[] }> | null;
  skills: Choice<{ maxOrder: number[]; firstLevels: number[] }> | null;
};

/** Null when Vizier has no games for the champion yet. */
export async function getBuild(championId: number, position: string | null, vs: number | null = null, queue = 420): Promise<Build | null> {
  const params = new URLSearchParams();
  if (queue !== 420) params.set("queue", String(queue));
  if (position) params.set("position", position.toUpperCase());
  if (vs) params.set("vs", String(vs));
  const query = params.size ? `?${params}` : "";
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

export type TierEntry = { championId: number; games: number; winRate: number; pickRate: number; tier: string; winRateChange: number | null };
export type TierList = { patches: string[]; games: number; champions: TierEntry[] };

/** Queues without roles take position ALL. */
export function getTierList(position: string, queue = 420) {
  return get<TierList>(`/v1/tierlist/${position}${queue === 420 ? "" : `?queue=${queue}`}`);
}

export type ChampionOverview = {
  patches: string[];
  positions: { position: string; games: number; share: number }[];
  position: string | null;
  games: number;
  winRate: number;
  pickRate: number;
  tier: string | null;
  winRateChange: number | null;
  /** Null outside ranked or before enough ranked games. */
  banRate: number | null;
};

/** Null when Vizier has no games for the champion yet. */
export async function getChampion(championId: number, position: string | null, queue = 420): Promise<ChampionOverview | null> {
  const params = new URLSearchParams();
  if (position && queue === 420) params.set("position", position);
  if (queue !== 420) params.set("queue", String(queue));
  const query = params.size ? `?${params}` : "";
  try {
    return await get<ChampionOverview>(`/v1/champions/${championId}${query}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export type Synergies = { patches: string[]; games: number; allies: { championId: number; position: string; games: number; winRate: number }[] };

export function getSynergies(championId: number, position: string) {
  return get<Synergies>(`/v1/champions/${championId}/synergies?position=${position}`);
}

export type Counters = { patches: string[]; games: number; matchups: { championId: number; games: number; winRate: number }[] };

export function getCounters(championId: number, position: string) {
  return get<Counters>(`/v1/champions/${championId}/counters?position=${position}`);
}

export type Distribution = { games: number; quantiles: number[] };
export type Benchmarks = { position: string; championId: number | null; patches: string[]; metrics: Partial<Record<string, Distribution>> };

export function getBenchmarks(position: string, championId: number | null) {
  return get<Benchmarks>(`/v1/benchmarks/${position}${championId ? `?champion=${championId}` : ""}`);
}

export type Pace = { position: string; championId: number | null; patches: string[]; games: number; median: number[] };

export function getPace(position: string, championId: number | null) {
  return get<Pace>(`/v1/pace/${position}${championId ? `?champion=${championId}` : ""}`);
}

export type LivePlayer = {
  riotId: string | null;
  championId: number;
  teamId: number;
  /** The player Vizier asked for, i.e. the one at this computer. */
  you: boolean;
  solo: { tier: string; rank: string; leaguePoints: number; wins: number; losses: number } | null;
  /** Null when the player has never played the champion. */
  mastery: { level: number; points: number; lastPlayTime: number } | null;
};
export type LiveGameInfo = { gameId: number; queueId: number | null; players: LivePlayer[] };

/** Null until Riot lists the game, which can take a few seconds into the loading screen. */
export async function getLiveGame(puuid: string): Promise<LiveGameInfo | null> {
  try {
    return await get<LiveGameInfo>(`/v1/live/${puuid}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export type ProBuild = {
  matchId: string;
  player: string;
  team: string;
  platform: string;
  patch: string;
  gameStart: number;
  duration: number;
  championId: number;
  opponentChampionId: number | null;
  position: string;
  win: boolean;
  kills: number;
  deaths: number;
  assists: number;
  cs: number;
  gold: number;
  runes: string;
  spells: number[];
  items: number[];
  startItems: number[];
  skillOrder: number[];
  purchases: number[];
};
export type ProFilter = { championId?: number; position?: string; team?: string; limit?: number };

export async function getProBuilds(filter: ProFilter): Promise<ProBuild[]> {
  const params = new URLSearchParams();
  if (filter.championId) params.set("champion", String(filter.championId));
  if (filter.position) params.set("position", filter.position);
  if (filter.team) params.set("team", filter.team);
  if (filter.limit) params.set("limit", String(filter.limit));
  return (await get<{ builds: ProBuild[] }>(`/v1/pros/builds${params.size ? `?${params}` : ""}`)).builds;
}

export async function getProTeams() {
  return (await get<{ teams: { team: string; players: string[] }[] }>("/v1/pros/teams")).teams;
}

export type BanSuggestions = { patches: string[]; champions: { championId: number; games: number; winRate: number }[] };

export function getBans() {
  return get<BanSuggestions>("/v1/bans");
}

export type Trends = { games: number; wins: number; habits: { title: string; detail: string }[] };

export function getTrends(puuid: string) {
  return get<Trends>(`/v1/players/${puuid}/trends`);
}

export type GoldGraph = { goldDiff: number[]; objectives: { minute: number; teamId: number; type: string }[] };

export function getGoldGraph(matchId: string) {
  return get<GoldGraph>(`/v1/matches/${matchId}/graph`);
}

export function getMatch(matchId: string) {
  return get<Match>(`/v1/matches/${matchId}`);
}
