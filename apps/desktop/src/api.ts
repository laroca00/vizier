const API_URL = import.meta.env.VITE_API_URL ?? "https://vizier-api.vizier-api.workers.dev";

import { createApiCache } from "./apiCache";
import { activeBracket, activeRegion, withRank } from "./rankChoice";
import { ApiError, requestJson } from "./http";
import type { RankCurveDoc } from "./data/rankCurve";
import type { ChampionHistoryDoc, TierHistoryDoc } from "./data/history";
import type { ItemNode } from "./lab/itemPath";

export { ApiError };

// Several panels read the same build, counters and role data, and the Worker only
// publishes every few hours, so answers are kept per route (see apiCache.ts).
const cache = createApiCache(typeof sessionStorage === "undefined" ? null : sessionStorage);

function get<T>(route: string, init?: RequestInit): Promise<T> {
  if (init) return request<T>(route, init);
  // The cache key carries the bracket, so each rank keeps its own answers.
  const path = withRank(route, activeBracket(), activeRegion());
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
  /** When the crawler last published this doc (ms); absent on older servers. */
  updatedAt?: number;
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
  /** First, second and third completed item as a tree (most played branches first); missing from older docs. */
  itemTree?: ItemNode[];
  /** The most played starting items with win rate; missing from older docs. */
  startOptions?: Choice<{ ids: number[] }>[];
  /** Median minute of the first boots and the first finished item. */
  timing?: { boots: { games: number; medianMinute: number } | null; firstItem: { games: number; medianMinute: number } | null };
  /** Picks of players with many games on the champion; missing until enough games. */
  mains?: Picks & { games: number; winRate: number };
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

/** A closed patch's build, kept small: the most played choices with their games. */
export type BuildSnapshot = {
  patch: string;
  games: number;
  winRate: number;
  runes: Choice<{ primaryStyle: number; subStyle: number; perks: number[] }>[];
  spells: Choice<{ ids: number[] }> | null;
  startItems: Choice<{ ids: number[] }> | null;
  coreItems: Choice<{ ids: number[] }> | null;
  items: Choice<{ id: number }>[];
  skills: Choice<{ maxOrder: number[]; firstLevels: number[] }> | null;
};

/** Newest patch first; empty until the crawler has seen a patch close, and on servers that predate it. */
export async function getBuildHistory(championId: number, position: string): Promise<BuildSnapshot[]> {
  try {
    const history = await get<{ snapshots: BuildSnapshot[] }>(`/v1/builds/history/${championId}?position=${position.toUpperCase()}`);
    return history.snapshots ?? [];
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) return [];
    throw error;
  }
}

export type AugmentStat = {
  augmentId: number;
  games: number;
  pickRate: number;
  winRate: number;
  tier: string;
  /** Win rate minus the champion's own rate with any augment; older servers leave it out. */
  delta?: number;
};
export type AugmentStats = { patches: string[]; updatedAt?: number; games: number; augments: AugmentStat[] };

/** Null while the server has augment stats switched off. */
export async function getAugments(queue: number, championId: number | null): Promise<AugmentStats | null> {
  try {
    return await get<AugmentStats>(`/v1/augments?queue=${queue}${championId ? `&champion=${championId}` : ""}`);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 403 || error.status === 404)) return null;
    throw error;
  }
}

export type AugmentChampion = { championId: number; games: number; winRate: number; delta: number; tier: string };
export type AugmentChampionList = { patches: string[]; augments: { augmentId: number; champions: AugmentChampion[] }[] };

/** For each augment, the champions it lifts most. Null while augment stats are off or the server is older. */
export async function getAugmentChampions(queue: number): Promise<AugmentChampionList | null> {
  try {
    return await get<AugmentChampionList>(`/v1/augments/champions?queue=${queue}`);
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

export type BuildIndex = { patches: string[]; updatedAt?: number; builds: BuildIndexEntry[] };

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
  /** Pick rate change over the same two patches; absent on servers that predate it. */
  pickRateChange?: number | null;
  /** Games and win rate on the two newest patches, newest first; absent on servers that predate it. */
  byPatch?: { patch: string; games: number; winRate: number }[];
};
/** The numbers behind a tier; absent on servers that predate it. */
export type TierRule = { priorGames: number; presenceWeight: number; listGames: number; tierGames: number; cuts: { tier: string; score: number }[] };
export type TierList = { patches: string[]; updatedAt?: number; games: number; champions: TierEntry[]; rule?: TierRule };

/** Queues without roles take position ALL. */
export function getTierList(position: string, queue = 420) {
  return get<TierList>(`/v1/tierlist/${position}${queue === 420 ? "" : `?queue=${queue}`}`);
}

export type ChampionOverview = {
  patches: string[];
  updatedAt?: number;
  positions: { position: string; games: number; share: number }[];
  position: string | null;
  games: number;
  winRate: number;
  pickRate: number;
  tier: string | null;
  winRateChange: number | null;
  /** Null outside ranked or before enough ranked games. */
  banRate: number | null;
  /** Games and win rate on the two newest patches, newest first; absent on servers that predate it. */
  byPatch?: { patch: string; games: number; winRate: number }[];
  /** Games and win rate by game length (see data/lengthStats); missing before the crawler counted them and in region views. */
  lengths?: { bucket: number; games: number; winRate: number }[];
  /** Jungle only: the first camps' side with the first lane, and the first gank minute. */
  jungle?: {
    games: number;
    paths: { side: "top" | "bot"; lane: "top" | "mid" | "bot" | "none"; games: number; winRate: number }[];
    gank: { games: number; medianMinute: number } | null;
  };
  /** How often the team took each first objective (d dragon, g grubs, h herald, t tower, c first blood) against the role. */
  objectives?: { games: number; rates: { key: string; games: number; rate: number; winRate: number; roleRate: number }[] };
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

export type Synergies = { patches: string[]; updatedAt?: number; games: number; allies: { championId: number; position: string; games: number; winRate: number }[] };

export function getSynergies(championId: number, position: string) {
  return get<Synergies>(`/v1/champions/${championId}/synergies?position=${position}`);
}

export type ArenaDuos = { patches: string[]; updatedAt?: number; games: number; partners: { championId: number; games: number; winRate: number }[] };

/** Champions that placed top four most often next to this one in Arena. */
export function getArenaDuos(championId: number) {
  return get<ArenaDuos>(`/v1/arena/duos/${championId}`);
}

export type ArenaItems = { patches: string[]; updatedAt?: number; games: number; items: { id: number; games: number; pickRate: number; winRate: number }[] };

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

export type ItemTimes = Record<number, { games: number; minute: number }>;

/** Average minute each finished item is completed; empty until enough timelines are in. */
export function getItemTimes(championId: number, position: string) {
  return get<ItemTimes>(`/v1/champions/${championId}/item-times?position=${position}`);
}

export type Counters = { patches: string[]; updatedAt?: number; games: number; matchups: { championId: number; games: number; winRate: number }[] };

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

export type ProMetaEntry = { championId: number; position: string; games: number; wins: number };

/** Picks and wins per champion and role in pro games; empty when the Worker predates the route. */
export async function getProMeta(group?: ProGroup, patch?: string): Promise<ProMetaEntry[]> {
  const params = new URLSearchParams();
  if (group) params.set("group", group);
  if (patch) params.set("patch", patch);
  try {
    return (await get<{ champions: ProMetaEntry[] }>(`/v1/pros/meta${params.size ? `?${params}` : ""}`)).champions;
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

export type BanSuggestions = { patches: string[]; updatedAt?: number; champions: { championId: number; games: number; winRate: number }[] };

export function getBans() {
  return get<BanSuggestions>("/v1/bans");
}

export type ScoutPlayer = {
  puuid: string;
  championId: number;
  /** Ranked solo this season; null when unranked. */
  rank: { tier: string; division: string; lp: number; wins: number; losses: number; winStreak: boolean } | null;
  mastery: { level: number; points: number } | null;
};

/** Rank and mastery of the players on the loading screen; the Worker answers 503 until the owner sets its Riot key. */
export function getScout(platform: string, asks: { puuid: string; championId: number }[]) {
  const players = asks.map((a) => `${a.puuid}:${a.championId}`).join(",");
  return request<{ players: ScoutPlayer[] }>(`/v1/scout?platform=${platform}&players=${players}`);
}

export type BenchMinute = { minute: number; games: number; cs: number; level: number; kdaGames?: number; kills?: number; deaths?: number; assists?: number; killParticipation?: number };

/** Average CS and level of ranked games at a few minutes; empty until enough timelines were crawled. */
export function getBench(championId: number, position: string, bracket?: string) {
  // An explicit rank is always sent, even Emerald+, so a window with another filter cannot change which one it asks for.
  return get<{ minutes: BenchMinute[] }>(`/v1/champions/${championId}/bench?position=${position}${bracket ? `&rank=${bracket}` : ""}`);
}

export type CoverageDoc = {
  patches: string[];
  games: { patch: string; queue: number; games: number }[];
  timeline: { patch: string; queue: number; players: number; withTimeline: number; share: number | null }[];
  players: { region: string; source: "ladder" | "mode"; players: number }[];
  /** Games per rank bracket and platform; missing before the all-rank crawl was published. */
  brackets?: { patch: string; queue: number; bracket: string; platform: string; games: number }[];
  /** Timeline share per rank bracket (ranked solo). */
  timelineBrackets?: { patch: string; queue: number; bracket: string; players: number; withTimeline: number; share: number | null }[];
  /** Ranked games left out (remakes, players who left) per patch; missing in older docs. */
  dropped?: { patch: string; queue: number; reason: string; games: number }[];
  /** Counted games whose roles were inferred; missing in older docs. */
  roleFixed?: { patch: string; queue: number; games: number }[];
  /** Last publish and any hold per bracket; missing in older docs. */
  status?: { bracket: string; lastPublishAt: number | null; held: string[] }[];
  /** Ranked games played in the 24 hours before the doc was made. */
  gamesToday?: number;
};

/** What the stats stand on: games per patch, rank bracket and platform. */
export function getCoverage() {
  return get<CoverageDoc>("/v1/meta/coverage");
}

/** Win rate, pick rate and games of every champion and role in each bracket, side by side; empty until the crawler publishes it. */
export function getRankCurve() {
  return get<RankCurveDoc>("/v1/meta/rank-curve");
}

/** Daily win, pick and ban rates of one champion per role and bracket; empty until the crawler has recorded days. */
export function getChampionHistory(championId: number) {
  return get<ChampionHistoryDoc>(`/v1/history/${championId}`);
}

/** Win rate per day of every champion in one role (Emerald+). */
export function getTierHistory(position: string) {
  return get<TierHistoryDoc>(`/v1/history/tier/${position}`);
}

export type BoardRow = {
  championId: number;
  /** Games that carried the averages below. */
  games: number;
  kills: number;
  deaths: number;
  assists: number;
  kda: number;
  csPerMinute: number;
  minutes: number;
  goldDiff15: { games: number; value: number } | null;
};
export type StatsBoard = { patches: string[]; updatedAt?: number; rank?: string; rows: BoardRow[] };

/** Per-game averages of every champion in a role; win, pick and ban rates come from the tier list. */
export function getStatsBoard(position: string) {
  return get<StatsBoard>(`/v1/stats/board/${position}`);
}
