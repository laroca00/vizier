import type { Champion } from "../data/ddragon";
import { CHAMPION_FACTS, type Region } from "./championFacts";

// The champion riddle: one answer per mode per day, the same for every
// player, or a random one in free play. Pure, so it is tested without a page.

export type QuizMode = "classic" | "ability" | "emoji" | "skin" | "item";
export const MODES: QuizMode[] = ["classic", "ability", "emoji", "skin", "item"];

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
  /** Null for champions newer than the facts table. */
  region: Region | null;
  resource: string;
  range: "melee" | "ranged";
  year: number | null;
  roles: string[];
};

/** Data Dragon gives ranged champions 300 or more attack range. */
export const rangeOf = (champion: Pick<Champion, "attackRange">): "melee" | "ranged" => ((champion.attackRange ?? 0) >= 300 ? "ranged" : "melee");

export function attributesOf(champion: Champion, roles: string[]): ClassicAttributes {
  const facts = CHAMPION_FACTS[champion.id];
  return { region: facts?.region ?? null, resource: champion.partype || "Yok", range: rangeOf(champion), year: facts?.year ?? null, roles };
}

function overlap(a: string[], b: string[]): Match {
  if (a.length === b.length && a.every((x) => b.includes(x))) return "yes";
  return a.some((x) => b.includes(x)) ? "partial" : "no";
}

export type ClassicResult = {
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
  return results.map((r) => [r.region, r.resource, r.range, r.year, r.roles].map((m) => SQUARES[m]).join("")).join("\n");
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
