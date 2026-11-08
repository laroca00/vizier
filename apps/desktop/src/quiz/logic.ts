import type { Champion } from "../data/ddragon";

// The champion riddle: one answer per mode per day, the same for every
// player, or a random one in free play. Pure, so it is tested without a page.

export type QuizMode = "classic" | "ability" | "emoji" | "skin";
export const MODES: QuizMode[] = ["classic", "ability", "emoji", "skin"];

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
  classes: string[];
  resource: string;
  range: "melee" | "ranged";
  difficulty: number;
  roles: string[];
};

/** Data Dragon gives ranged champions 300 or more attack range. */
export const rangeOf = (champion: Pick<Champion, "attackRange">): "melee" | "ranged" => ((champion.attackRange ?? 0) >= 300 ? "ranged" : "melee");

export function attributesOf(champion: Champion, roles: string[]): ClassicAttributes {
  return { classes: champion.tags, resource: champion.partype || "Yok", range: rangeOf(champion), difficulty: champion.info.difficulty, roles };
}

function overlap(a: string[], b: string[]): Match {
  if (a.length === b.length && a.every((x) => b.includes(x))) return "yes";
  return a.some((x) => b.includes(x)) ? "partial" : "no";
}

export type ClassicResult = {
  classes: Match;
  resource: Match;
  range: Match;
  difficulty: Match;
  difficultyArrow: Arrow;
  roles: Match;
};

/** How a guess compares to the answer, attribute by attribute; partial when lists share something. */
export function compareClassic(guess: ClassicAttributes, answer: ClassicAttributes): ClassicResult {
  return {
    classes: overlap(guess.classes, answer.classes),
    resource: guess.resource === answer.resource ? "yes" : "no",
    range: guess.range === answer.range ? "yes" : "no",
    difficulty: guess.difficulty === answer.difficulty ? "yes" : Math.abs(guess.difficulty - answer.difficulty) <= 1 ? "partial" : "no",
    difficultyArrow: guess.difficulty === answer.difficulty ? null : answer.difficulty > guess.difficulty ? "higher" : "lower",
    roles: guess.roles.length === 0 && answer.roles.length === 0 ? "yes" : overlap(guess.roles, answer.roles),
  };
}

const SQUARES: Record<Match, string> = { yes: "🟩", partial: "🟨", no: "🟥" };

/** One line of squares per guess, oldest first, for sharing a classic result without the answer. */
export function classicGrid(results: ClassicResult[]): string {
  return results.map((r) => [r.classes, r.resource, r.range, r.difficulty, r.roles].map((m) => SQUARES[m]).join("")).join("\n");
}

/** How far the splash is zoomed in after this many wrong guesses: a detail first, the whole picture last. */
export function skinZoom(wrongGuesses: number): number {
  const steps = [6, 4.5, 3.2, 2.2, 1.5, 1];
  return steps[Math.min(wrongGuesses, steps.length - 1)];
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
