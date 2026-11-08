import type { Counters, ProBuild, TierEntry } from "../api";
import type { Champion } from "../data/ddragon";
import { analyzeComp, traitsOf } from "../data/traits";
import type { ChampSelect, DraftMember } from "../lcu";

export const ROLES = ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"] as const;

export function shownChampion(member: DraftMember) {
  return member.championId || member.pickIntent;
}

export type DraftView = "draft" | "build";

/**
 * Which view fits the moment, and a key that changes whenever that answer
 * could change. A manual choice holds until the key moves on.
 */
export function autoView(draft: ChampSelect): { view: DraftView; moment: string } {
  const me = draft.myTeam.find((m) => m.isLocal);
  const locked = !!me && me.championId !== 0;
  const hovering = !!me && me.pickIntent !== 0;
  const turn = draft.turn ?? null;
  const moment = [draft.phase, turn?.kind ?? "", turn?.mine ? "mine" : "", locked ? "locked" : "", hovering ? "hover" : ""].join(":");
  if (locked) return { view: "build", moment };
  if (draft.phase === "FINALIZATION" || draft.phase === "GAME_STARTING") return { view: hovering ? "build" : "draft", moment };
  if (turn?.kind === "pick" && turn.mine && hovering) return { view: "build", moment };
  return { view: "draft", moment };
}

/** Share of each champion's games played in each role, from the champion overview. */
export type RoleShares = Map<number, Map<string, number>>;

function* assignments(champions: number[], roles: readonly string[]): Generator<Map<number, string>> {
  if (champions.length === 0) {
    yield new Map();
    return;
  }
  const [first, ...rest] = champions;
  for (const role of roles) {
    for (const tail of assignments(rest, roles.filter((r) => r !== role))) {
      tail.set(first, role);
      yield tail;
    }
  }
}

/**
 * The enemy most likely to play the given role. Enemy roles are hidden in
 * ranked, so this reads only what champions are usually played where, and
 * assigns the whole team at once so two junglers don't both land in the jungle.
 */
export function guessOpponent(enemies: number[], role: string, shares: RoleShares): number | null {
  const known = [...new Set(enemies.filter((id) => id > 0))].slice(0, ROLES.length);
  if (known.length === 0 || !ROLES.includes(role as (typeof ROLES)[number])) return null;
  let best: { score: number; pick: number | null } = { score: -Infinity, pick: null };
  for (const assignment of assignments(known, ROLES)) {
    let score = 0;
    let pick: number | null = null;
    for (const [championId, assigned] of assignment) {
      score += Math.log((shares.get(championId)?.get(assigned) ?? 0) + 0.01);
      if (assigned === role) pick = championId;
    }
    if (score > best.score) best = { score, pick };
  }
  // A champion that almost never plays the role is no guess at all.
  const share = best.pick === null ? 0 : (shares.get(best.pick)?.get(role) ?? 0);
  return share >= 0.05 ? best.pick : null;
}

export type ProMatch = "exact" | "class" | "damage" | "any";

const MATCH_ORDER: ProMatch[] = ["exact", "class", "damage", "any"];

/**
 * Pro games ordered by how close their lane opponent is to ours: the same
 * champion, then the same class and damage type, then the same damage type,
 * then anything, newest first within each.
 */
export function rankProBuilds(
  builds: ProBuild[],
  opponentId: number | null,
  champions: Map<number, Pick<Champion, "tags" | "magic">>,
): { build: ProBuild; match: ProMatch }[] {
  const opponent = opponentId ? champions.get(opponentId) : undefined;
  const matchOf = (build: ProBuild): ProMatch => {
    if (!opponentId || !build.opponentChampionId) return "any";
    if (build.opponentChampionId === opponentId) return "exact";
    const theirs = champions.get(build.opponentChampionId);
    if (!opponent || !theirs || theirs.magic !== opponent.magic) return "any";
    return theirs.tags[0] === opponent.tags[0] ? "class" : "damage";
  };
  // The same game can arrive twice, once per region a pro's account is tracked on.
  const seen = new Set<string>();
  const unique = builds.filter((build) => {
    const key = `${build.player}:${build.gameStart}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return unique
    .map((build) => ({ build, match: matchOf(build) }))
    .sort((a, b) => MATCH_ORDER.indexOf(a.match) - MATCH_ORDER.indexOf(b.match) || b.build.gameStart - a.build.gameStart);
}

export type Need = "ap" | "ad" | "frontline" | "engage" | "peel";

/** What the allies picked so far are missing. Needs only count once a few allies are in. */
export function teamNeeds(allies: Champion[]): Need[] {
  if (allies.length < 2) return [];
  const report = analyzeComp(allies);
  const needs: Need[] = [];
  if (report.magic < 0.3) needs.push("ap");
  if (report.magic > 0.7) needs.push("ad");
  if (!allies.some((c) => traitsOf(c).frontline)) needs.push("frontline");
  if (report.engage === 0) needs.push("engage");
  if (allies.length >= 3 && report.peel === 0) needs.push("peel");
  return needs;
}

function fills(need: Need, champion: Champion) {
  const traits = traitsOf(champion);
  switch (need) {
    case "ap":
      return traits.magic >= 0.6;
    case "ad":
      return traits.magic <= 0.4;
    case "frontline":
      return traits.frontline;
    case "engage":
      return traits.engage;
    case "peel":
      return traits.peel;
  }
}

export type PickReason =
  | { kind: "counter"; vs: number; winRate: number; games: number }
  | { kind: "need"; need: Need }
  | { kind: "meta"; tier: string; winRate: number; games: number };

/** Points behind a score: the champion's own rate, the matchup and the team's gaps. */
export type ScoreBreakdown = { meta: number; counter: number; needs: number };

export type PickSuggestion = { championId: number; score: number; reasons: PickReason[]; breakdown: ScoreBreakdown; inPool: boolean };

const MIN_TIER_GAMES = 150;
const MIN_MATCHUP_GAMES = 40;
const NEED_POINTS = 2;
const COUNTER_WEIGHT = 1.5;
const SHOWN_SUGGESTIONS = 6;

type SuggestInput = {
  tierList: TierEntry[];
  /** The lane opponent's own matchups in our role: their win rate against each champion. */
  opponentCounters: Counters | null;
  opponentId: number | null;
  allies: Champion[];
  champions: Map<number, Champion>;
  /** Banned or already picked. */
  unavailable: Set<number>;
  /** Champions of the player's pool; they are always listed and come first. */
  pool?: Set<number>;
};

/**
 * Picks for the player's role. Each point is a percentage point of expected
 * win rate: the champion's own rate above 50%, how much better it does
 * against the lane opponent, and a flat bonus for each gap it fills.
 */
export function suggestPicks({ tierList, opponentCounters, opponentId, allies, champions, unavailable, pool }: SuggestInput): PickSuggestion[] {
  const needs = teamNeeds(allies);
  const against = new Map((opponentCounters?.matchups ?? []).filter((m) => m.games >= MIN_MATCHUP_GAMES).map((m) => [m.championId, m]));
  return tierList
    .filter((entry) => entry.games >= MIN_TIER_GAMES && !unavailable.has(entry.championId))
    .flatMap((entry) => {
      const champion = champions.get(entry.championId);
      if (!champion) return [];
      const reasons: PickReason[] = [];
      const breakdown: ScoreBreakdown = { meta: (entry.winRate - 0.5) * 100, counter: 0, needs: 0 };
      const matchup = opponentId ? against.get(entry.championId) : undefined;
      if (matchup && opponentId) {
        const ours = 1 - matchup.winRate;
        breakdown.counter = (ours - 0.5) * 100 * COUNTER_WEIGHT;
        if (ours >= 0.51) reasons.push({ kind: "counter", vs: opponentId, winRate: ours, games: matchup.games });
      }
      for (const need of needs) {
        if (fills(need, champion)) {
          breakdown.needs += NEED_POINTS;
          reasons.push({ kind: "need", need });
        }
      }
      // Every row shows its own numbers, but a B tier pick needs another reason to be listed.
      const strong = entry.tier === "S" || entry.tier === "A";
      const inPool = pool?.has(entry.championId) ?? false;
      if (!strong && reasons.length === 0 && !inPool) return [];
      reasons.push({ kind: "meta", tier: entry.tier, winRate: entry.winRate, games: entry.games });
      const score = breakdown.meta + breakdown.counter + breakdown.needs;
      return [{ championId: entry.championId, score, reasons, breakdown, inPool }];
    })
    .sort((a, b) => Number(b.inPool) - Number(a.inPool) || b.score - a.score)
    .slice(0, SHOWN_SUGGESTIONS);
}

export type Difficulty = "hard" | "even" | "easy";

/** How the matchup tends to go, from our champion's win rate against the opponent. */
export function difficultyOf(winRate: number): Difficulty {
  if (winRate < 0.48) return "hard";
  if (winRate > 0.52) return "easy";
  return "even";
}

/**
 * Finished items bought noticeably more often against this opponent than in
 * general: the matchup's situational buys.
 */
export function matchupItems(
  general: { games: number; items: { id: number; games: number }[] },
  versus: { games: number; items: { id: number; games: number }[] },
  minLift = 0.08,
): number[] {
  if (general.games === 0 || versus.games === 0) return [];
  const usual = new Map(general.items.map((i) => [i.id, i.games / general.games]));
  return versus.items
    .map((i) => ({ id: i.id, lift: i.games / versus.games - (usual.get(i.id) ?? 0) }))
    .filter((i) => i.lift >= minLift)
    .sort((a, b) => b.lift - a.lift)
    .map((i) => i.id);
}

// Bot lane is played in pairs; the jungler works most with the mid laner.
const DUO_PARTNER: Record<string, string> = { BOTTOM: "UTILITY", UTILITY: "BOTTOM", JUNGLE: "MIDDLE", MIDDLE: "JUNGLE" };

/** The role whose champion pairs with ours, or null for top and unknown roles. */
export function duoPartnerRole(role: string | null | undefined): string | null {
  return (role && DUO_PARTNER[role.toUpperCase()]) || null;
}

const MIN_LINE_GAMES = 40;

/** The champion's matchup against the opponent, or null while the sample is too thin. */
export function matchupLine(
  counters: { matchups: { championId: number; games: number; winRate: number }[] },
  opponentId: number,
): { winRate: number; games: number; difficulty: Difficulty } | null {
  const m = counters.matchups.find((x) => x.championId === opponentId);
  if (!m || m.games < MIN_LINE_GAMES) return null;
  return { winRate: m.winRate, games: m.games, difficulty: difficultyOf(m.winRate) };
}
