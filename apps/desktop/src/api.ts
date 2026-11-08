const API_URL = import.meta.env.VITE_API_URL ?? "https://vizier-api.vizier-api.workers.dev";

import { createApiCache } from "./apiCache";
import { ApiError, requestJson } from "./http";

export { ApiError };

// Several panels read the same build, counters and role data, and the Worker only
// publishes every few hours, so answers are kept per route (see apiCache.ts).
const cache = createApiCache(typeof sessionStorage === "undefined" ? null : sessionStorage);

function get<T>(path: string, init?: RequestInit): Promise<T> {
  if (init) return request<T>(path, init);
  return cache.get(path, () => request<T>(path));
}

function request<T>(path: string, init?: RequestInit) {
  return requestJson<T>(`${API_URL}${path}`, init);
}

export type Choice<T> = T & { games: number; winRate: number };

export type BuildStyle = "crit" | "onhit" | "hybrid" | "ap" | "lethality" | "bruiser" | "tank" | "enchanter" | "ad";
export type Foe = "ap" | "ad" | "tank";

export type Picks = {
  runes: Choice<{ primaryStyle: number; subStyle: number; perks: number[] }>[];
  spells: Choice<{ ids: number[] }>[];
  items: Choice<{ id: number }>[];
  startItems: Choice<{ ids: number[] }> | null;
  coreItems: Choice<{ ids: number[] }> | null;
  skills: Choice<{ maxOrder: number[]; firstLevels: number[] }> | null;
};

/** The games built one way, say AP or crit, with their own runes and items. */
export type Variant = Picks & { style: BuildStyle; games: number; winRate: number; share: number };

export type Build = Picks & {
  patches: string[];
  games: number;
  winRate: number;
  /** The opponent the numbers are for, or null when they cover every matchup. */
  vs: number | null;
  /** Build styles with enough games, most played first. Missing from docs published before they existed. */
  variants?: Variant[];
  /** Items bought more often against magic-heavy, physical-heavy or tanky teams. */
  situational?: { vs: Foe; games: number; items: Choice<{ id: number }>[] }[];
  /** How often each single rune was taken; missing from docs published before it existed and for matchups. */
  perks?: Choice<{ id: number }>[];
  /** Games the perk counts come from; fewer than `games` for a while after they were introduced. */
  perkGames?: number;
  /** The most played skill orders; `share` is out of the games that had a timeline. */
  skillOptions?: Choice<{ maxOrder: number[]; firstLevels: number[]; share: number }>[];
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

export type AugmentStat = { augmentId: number; games: number; pickRate: number; winRate: number; tier: string };
export type AugmentStats = { patches: string[]; games: number; augments: AugmentStat[] };

/** Null while the server has augment stats switched off. */
export async function getAugments(queue: number, championId: number | null): Promise<AugmentStats | null> {
  try {
    return await get<AugmentStats>(`/v1/augments?queue=${queue}${championId ? `&champion=${championId}` : ""}`);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 403 || error.status === 404)) return null;
    throw error;
  }
}

export type BuildIndexEntry = {
  championId: number;
  position: string;
  games: number;
  winRate: number;
  keystone: number | null;
  styles: BuildStyle[];
  /** Core items in buy order, then the most bought finished items. */
  items: number[];
};

export type BuildIndex = { patches: string[]; builds: BuildIndexEntry[] };

/** Every ranked champion and role in one small document; empty until the crawler publishes it. */
export function getBuildIndex() {
  return get<BuildIndex>("/v1/builds/index");
}

export type TierEntry = {
  championId: number;
  games: number;
  winRate: number;
  /** Share of matches the champion was picked in, in this role. */
  pickRate: number;
  /** Share of ranked matches it was banned in; null outside ranked and from servers that predate it. */
  banRate?: number | null;
  tier: string;
  winRateChange: number | null;
};
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

export type ArenaDuos = { patches: string[]; games: number; partners: { championId: number; games: number; winRate: number }[] };

/** Champions that placed top four most often next to this one in Arena. */
export function getArenaDuos(championId: number) {
  return get<ArenaDuos>(`/v1/arena/duos/${championId}`);
}

export type ArenaItems = { patches: string[]; games: number; items: { id: number; games: number; pickRate: number; winRate: number }[] };

/** Null while the server has Arena item stats switched off. */
export async function getArenaItems(championId: number): Promise<ArenaItems | null> {
  try {
    return await get<ArenaItems>(`/v1/arena/items/${championId}`);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 403 || error.status === 404)) return null;
    throw error;
  }
}

export type LaneStat = {
  games: number;
  csDiff10?: number;
  csDiff15?: number;
  goldDiff10?: number;
  goldDiff15?: number;
  firstBloodRate?: number;
};

/** Averages from the champion's side against one lane opponent; `games` is 0 until enough timelines are in. */
export function getLaneStats(championId: number, position: string, vs: number) {
  return get<LaneStat>(`/v1/champions/${championId}/lane?position=${position}&vs=${vs}`);
}

export type Counters = { patches: string[]; games: number; matchups: { championId: number; games: number; winRate: number }[] };

export function getCounters(championId: number, position: string) {
  return get<Counters>(`/v1/champions/${championId}/counters?position=${position}`);
}

export type ProBuild = {
  matchId: string;
  player: string;
  team: string;
  group?: ProGroup;
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
  /** Missing from answers cached before styles existed. */
  style?: BuildStyle | null;
};
export type ProGroup = "worlds" | "turkey" | "challenger";
export type ProFilter = {
  championId?: number;
  position?: string;
  team?: string;
  group?: ProGroup;
  player?: string;
  /** Lowercase platform id: kr, euw1, tr1, na1. */
  platform?: string;
  patch?: string;
  limit?: number;
};

/** True when the game matches every filter that is set; checks the server's answer, which older Workers don't filter. */
export function matchesProFilter(build: ProBuild, filter: ProFilter) {
  return (
    (!filter.championId || build.championId === filter.championId) &&
    (!filter.position || build.position === filter.position) &&
    (!filter.team || build.team === filter.team) &&
    (!filter.group || build.group === filter.group) &&
    (!filter.player || build.player === filter.player) &&
    (!filter.platform || build.platform === filter.platform) &&
    (!filter.patch || build.patch === filter.patch)
  );
}

/** Patches with pro games, newest first; empty when the Worker predates the route. */
export async function getProPatches(): Promise<string[]> {
  try {
    return (await get<{ patches: string[] }>("/v1/pros/patches")).patches;
  } catch {
    return [];
  }
}

export async function getProBuilds(filter: ProFilter): Promise<ProBuild[]> {
  const params = new URLSearchParams();
  if (filter.championId) params.set("champion", String(filter.championId));
  if (filter.position) params.set("position", filter.position);
  if (filter.team) params.set("team", filter.team);
  if (filter.group) params.set("group", filter.group);
  if (filter.player) params.set("player", filter.player);
  if (filter.platform) params.set("platform", filter.platform);
  if (filter.patch) params.set("patch", filter.patch);
  if (filter.limit) params.set("limit", String(filter.limit));
  const { builds } = await get<{ builds: ProBuild[] }>(`/v1/pros/builds${params.size ? `?${params}` : ""}`);
  return builds.filter((b) => matchesProFilter(b, filter));
}

export async function getProTeams() {
  return (await get<{ teams: { team: string; group: ProGroup; players: string[] }[] }>("/v1/pros/teams")).teams;
}

export type BanSuggestions = { patches: string[]; champions: { championId: number; games: number; winRate: number }[] };

export function getBans() {
  return get<BanSuggestions>("/v1/bans");
}
