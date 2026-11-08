import type { Champion } from "../data/ddragon";
import { CHAMPION_FACTS, CHAMPION_TRAITS, type Gender, type Region, type Species } from "./championFacts";

// The champion riddle: one answer per mode per day, the same for every
// player, or a random one in free play. Pure, so it is tested without a page.

export type QuizMode = "classic" | "ability" | "emoji" | "skin" | "item" | "recipe";
export const MODES: QuizMode[] = ["classic", "ability", "emoji", "skin", "item", "recipe"];

/** FNV-1a: a small, stable hash so a day's answer doesn't depend on the JavaScript engine. */
export function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** "2026-11-08" in the player's own time zone, so the day turns over at their midnight. */
export function dayKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Picks from a list sorted by key, so new champions don't reshuffle past days' answers more than needed. */
export function dailyPick<T>(items: T[], day: string, mode: QuizMode): T {
  return items[hash(`${day}:${mode}`) % items.length];
}

export type Match = "yes" | "partial" | "no";
export type Arrow = "higher" | "lower" | null;

export type ClassicAttributes = {
  /** Null for champions newer than the facts tables. */
  gender: Gender | null;
  species: Species[];
  region: Region | null;
  resource: string;
  range: "melee" | "ranged";
  year: number | null;
  roles: string[];
};

/** Data Dragon gives ranged champions 300 or more attack range. */
export const rangeOf = (champion: Pick<Champion, "attackRange">): "melee" | "ranged" => ((champion.attackRange ?? 0) >= 300 ? "ranged" : "melee");

/**
 * The lanes a champion is known for: the most played one, plus a second when
 * it holds a quarter of the games. Off-role picks would otherwise make every
 * guess look partly right.
 */
export function mainRoles(played: [role: string, games: number][]): string[] {
  const sorted = [...played].filter(([, games]) => games > 0).sort((a, b) => b[1] - a[1]);
  const total = sorted.reduce((sum, [, games]) => sum + games, 0);
  return sorted.slice(0, 2).filter(([, games], i) => i === 0 || games >= total * 0.25).map(([role]) => role);
}

export function attributesOf(champion: Champion, roles: string[]): ClassicAttributes {
  const facts = CHAMPION_FACTS[champion.id];
  const traits = CHAMPION_TRAITS[champion.id];
  return { gender: traits?.gender ?? null, species: traits?.species ?? [], region: facts?.region ?? null, resource: champion.partype || "Yok", range: rangeOf(champion), year: facts?.year ?? null, roles };
}

function overlap(a: string[], b: string[]): Match {
  if (a.length === b.length && a.every((x) => b.includes(x))) return "yes";
  return a.some((x) => b.includes(x)) ? "partial" : "no";
}

export type ClassicResult = {
  gender: Match;
  species: Match;
  region: Match;
  resource: Match;
  range: Match;
  year: Match;
  /** Which way the answer's release year lies from the guess's. */
  yearArrow: Arrow;
  roles: Match;
};

/** How a guess compares to the answer, attribute by attribute; roles are partial when they share one. */
export function compareClassic(guess: ClassicAttributes, answer: ClassicAttributes): ClassicResult {
  const years = guess.year !== null && answer.year !== null;
  return {
    gender: guess.gender !== null && guess.gender === answer.gender ? "yes" : "no",
    species: guess.species.length === 0 || answer.species.length === 0 ? "no" : overlap(guess.species, answer.species),
    region: guess.region !== null && guess.region === answer.region ? "yes" : "no",
    resource: guess.resource === answer.resource ? "yes" : "no",
    range: guess.range === answer.range ? "yes" : "no",
    year: years && guess.year === answer.year ? "yes" : "no",
    yearArrow: !years || guess.year === answer.year ? null : answer.year! > guess.year! ? "higher" : "lower",
    roles: guess.roles.length === 0 && answer.roles.length === 0 ? "yes" : overlap(guess.roles, answer.roles),
  };
}

const SQUARES: Record<Match, string> = { yes: "🟩", partial: "🟧", no: "🟥" };

/** One line of squares per guess, oldest first, for sharing a classic result without the answer. */
export function classicGrid(results: ClassicResult[]): string {
  return results.map((r) => [r.gender, r.roles, r.species, r.resource, r.range, r.region, r.year].map((m) => SQUARES[m]).join("")).join("\n");
}

/**
 * How much of the splash shows after this many wrong guesses: a small round
 * window first, the whole picture last. Splash art is only about 1200 pixels
 * wide, so the zoom stays low to keep it sharp and the window does the hiding.
 */
export function skinView(wrongGuesses: number): { zoom: number; radius: number } {
  const steps = [
    { zoom: 1.6, radius: 9 },
    { zoom: 1.5, radius: 14 },
    { zoom: 1.35, radius: 21 },
    { zoom: 1.2, radius: 31 },
    { zoom: 1.1, radius: 46 },
    { zoom: 1, radius: 100 },
  ];
  return steps[Math.min(wrongGuesses, steps.length - 1)];
}

/**
 * How an ability icon is disguised after this many wrong guesses: turned
 * and grey first, then straightened, then in colour.
 */
export function abilityView(wrongGuesses: number, seed: number): { rotate: number; grey: boolean } {
  const turns = [180, 120, 60, 0];
  const base = turns[Math.min(wrongGuesses, turns.length - 1)];
  // The direction depends on the day's seed, so the same icon isn't always turned the same way.
  return { rotate: seed % 2 === 0 ? base : -base, grey: wrongGuesses < 2 };
}

/** Pixels of blur on the item icon: heavy at first, sharp after five wrong guesses. */
export function itemBlur(wrongGuesses: number): number {
  const steps = [10, 7, 5, 3, 1.5, 0];
  return steps[Math.min(wrongGuesses, steps.length - 1)];
}

type PoolItem = { id: number; name: string; complete: boolean; gold: number };

/**
 * Finished Summoner's Rift items worth guessing, one per name: Data Dragon
 * repeats items for other modes under ids from 10000 up.
 */
export function itemPool<T extends PoolItem>(items: Iterable<T>): T[] {
  const byName = new Map<string, T>();
  for (const item of items) {
    if (!item.complete || item.id >= 10000 || item.gold < 2000) continue;
    const known = byName.get(item.name);
    if (!known || item.id < known.id) byName.set(item.name, item);
  }
  return [...byName.values()].sort((a, b) => a.id - b.id);
}

/** Items with at least two components, so the recipe is a real clue. */
export function recipePool<T extends PoolItem & { from?: number[] }>(items: Iterable<T>): T[] {
  return itemPool(items).filter((item) => (item.from?.length ?? 0) >= 2);
}

/** A recipe's parts with how many of each, in the order Data Dragon lists them. */
export function recipeParts(from: number[]): { id: number; count: number }[] {
  const counts = new Map<number, number>();
  for (const id of from) counts.set(id, (counts.get(id) ?? 0) + 1);
  return [...counts].map(([id, count]) => ({ id, count }));
}

/** Gold paid on top of the components, a hint that narrows the recipe down. */
export function combineCost(gold: number, partGold: number[]): number {
  return gold - partGold.reduce((sum, g) => sum + g, 0);
}

/** Emoji hints revealed: one to start, one more for each wrong guess. */
export const emojisShown = (wrongGuesses: number, total: number) => Math.min(total, 1 + wrongGuesses);

export type QuizRecord = { day: string; mode: QuizMode; guesses: number[]; solved: boolean };

/** Days in a row, ending today or yesterday, with the mode solved. */
export function streak(records: QuizRecord[], mode: QuizMode, today: string): number {
  const solved = new Set(records.filter((r) => r.mode === mode && r.solved).map((r) => r.day));
  const day = new Date(`${today}T12:00:00`);
  if (!solved.has(today)) day.setDate(day.getDate() - 1);
  let count = 0;
  while (solved.has(dayKey(day))) {
    count++;
    day.setDate(day.getDate() - 1);
  }
  return count;
}

export type ModeStats = {
  played: number;
  solved: number;
  current: number;
  best: number;
  /** Solved days by number of guesses: index 0 is one guess, the last bucket is six or more. */
  distribution: number[];
};

export const DISTRIBUTION_BUCKETS = 6;

/** Longest run of consecutive solved days. */
export function bestStreak(records: QuizRecord[], mode: QuizMode): number {
  const days = [...new Set(records.filter((r) => r.mode === mode && r.solved).map((r) => r.day))].sort();
  let best = 0;
  let run = 0;
  let previous: Date | null = null;
  for (const day of days) {
    const date = new Date(`${day}T12:00:00`);
    const next = previous && dayKey(new Date(previous.getTime() + 36e5 * 24)) === day;
    run = next ? run + 1 : 1;
    best = Math.max(best, run);
    previous = date;
  }
  return best;
}

export function modeStats(records: QuizRecord[], mode: QuizMode, today: string): ModeStats {
  const own = records.filter((r) => r.mode === mode);
  const distribution = new Array<number>(DISTRIBUTION_BUCKETS).fill(0);
  for (const r of own) if (r.solved) distribution[Math.min(r.guesses.length, DISTRIBUTION_BUCKETS) - 1]++;
  return { played: own.length, solved: own.filter((r) => r.solved).length, current: streak(records, mode, today), best: bestStreak(records, mode), distribution };
}
