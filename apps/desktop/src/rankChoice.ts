import { DEFAULT_BRACKET, REGIONS, REGION_BRACKETS, isBracket, type Bracket, type Region } from "@vizier/shared/brackets";

/** A region, or every region pooled (what the API answers without `region`). */
export type RegionChoice = Region | "all";

export function sanitizeRegion(value: unknown): RegionChoice {
  return (REGIONS as readonly string[]).includes(value as string) ? (value as Region) : "all";
}

/** Region docs exist only for some brackets; elsewhere the filter is not sent. */
export const regionApplies = (bracket: Bracket) => REGION_BRACKETS.includes(bracket);

/** A bracket, or "mine": the player's own rank, read from the League client. */
export type RankChoice = Bracket | "mine";

export const RANK_CHOICES: RankChoice[] = ["emerald_plus", "all", "gold_minus", "platinum_plus", "diamond_plus", "master_plus", "mine"];

/** Anything stored that is not a known choice becomes the default, so a bad or older value never reaches a request. */
export function sanitizeRank(value: unknown): RankChoice {
  return value === "mine" || isBracket(value) ? value : DEFAULT_BRACKET;
}

// What requests use: set by the settings store and by the client reading (34.2); no UI imports, so api.ts can read it.
let chosen: RankChoice = DEFAULT_BRACKET;
let mine: Bracket | null = null;
let region: RegionChoice = "all";
const listeners = new Set<() => void>();
const notify = () => {
  for (const listener of listeners) listener();
};

// Champ select reads the player's own rank by default (setting), only while its page is open, so other
// pages keep the filter the player picked.
let draftScope = false;
let draftOwnRank = true;

export function setDraftScope(on: boolean) {
  if (on === draftScope) return;
  draftScope = on;
  notify();
}

export function setDraftOwnRank(on: boolean) {
  if (on === draftOwnRank) return;
  draftOwnRank = on;
  notify();
}

/** The choice requests really use: the player's own rank in champ select when the setting is on and the rank is known. */
export function effectiveChoice(choice: RankChoice, scope: boolean, own: Bracket | null, ownWanted: boolean): RankChoice {
  return scope && ownWanted && own ? "mine" : choice;
}

export const inDraftScope = () => draftScope && draftOwnRank && mine !== null;

export function setRankChoice(next: RankChoice) {
  if (next === chosen) return;
  chosen = next;
  notify();
}

export function setRegionChoice(next: RegionChoice) {
  if (next === region) return;
  region = next;
  notify();
}

/** The bracket of the player's own rank; null until the client says. */
export function setMyBracket(next: Bracket | null) {
  if (next === mine) return;
  mine = next;
  notify();
}

export const subscribeRank = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
export const myBracket = () => mine;

/** "Mine" without a known rank falls back to Emerald+; `fellBack` lets the page say so. */
export function resolveRank(choice: RankChoice, own: Bracket | null): { bracket: Bracket; fellBack: boolean } {
  if (choice !== "mine") return { bracket: choice, fellBack: false };
  return own ? { bracket: own, fellBack: false } : { bracket: DEFAULT_BRACKET, fellBack: true };
}

/** The bracket requests use right now. */
export const activeBracket = (): Bracket => resolveRank(effectiveChoice(chosen, draftScope, mine, draftOwnRank), mine).bracket;

/** The region requests use right now: null when pooled, or when the bracket has no region docs. */
// Champ select always counts every region: a region filter set on the tier list should not thin its advice.
export const activeRegion = (): Region | null => (region !== "all" && !draftScope && regionApplies(activeBracket()) ? region : null);

/** Bracket and region as one string, for keys and for subscribers that need a stable snapshot. */
export const activeScope = (): string => `${activeBracket()}${activeRegion() ? `/${activeRegion()}` : ""}`;

// Stats routes split by rank. Item times, build history and the build index are not.
const RANKED_ROUTES = [/^\/v1\/tierlist\//, /^\/v1\/stats\/board\//, /^\/v1\/builds\/\d+(\?|$)/, /^\/v1\/champions\/\d+(\?|$)/, /^\/v1\/champions\/\d+\/(counters|synergies|lane|bench)(\?|$)/];

// Only the tier lists and the champion overview have region docs.
const REGION_ROUTES = [/^\/v1\/tierlist\//, /^\/v1\/champions\/\d+(\?|$)/];

/** Adds `rank=` to a stats route when the bracket is not Emerald+; other routes and paths that carry one are left alone. */
export function withRank(path: string, bracket: Bracket, regionChoice: Region | null = null): string {
  let result = path;
  const add = (param: string) => (result += `${result.includes("?") ? "&" : "?"}${param}`);
  if (regionChoice && REGION_ROUTES.some((route) => route.test(path)) && !/[?&]region=/.test(path)) add(`region=${regionChoice}`);
  if (bracket !== DEFAULT_BRACKET && RANKED_ROUTES.some((route) => route.test(path)) && !/[?&]rank=/.test(path)) add(`rank=${bracket}`);
  return result;
}
