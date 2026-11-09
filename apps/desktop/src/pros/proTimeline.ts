import type { ProBuild } from "../api";

// A pro game's build as a timeline. Only what the pro data holds: the buy
// order (ids, no clock times), starting items, runes, spells and the skill
// level-ups.

export type Step = { id: number; complete: boolean; count: number };

/** The buy order with the same purchase repeated in a row folded into one step. */
export function buySteps(purchases: number[], complete: (id: number) => boolean): Step[] {
  const steps: Step[] = [];
  for (const id of purchases) {
    const last = steps[steps.length - 1];
    if (last && last.id === id) last.count++;
    else steps.push({ id, complete: complete(id), count: 1 });
  }
  return steps;
}

/** Finished items in the order the player completed them, each once. */
export const finishedOrder = (purchases: number[], complete: (id: number) => boolean) => [...new Set(purchases.filter(complete))];

const KEYS = ["Q", "W", "E", "R"];

/** Level-up slots 1 to 4 as the letters Q, W, E, R, one per level. */
export const skillLetters = (order: number[]): string[] => order.map((slot) => KEYS[slot - 1] ?? "?");

/** The first three levelled abilities, which show the opening. */
export const opening = (order: number[]): string[] => skillLetters(order.slice(0, 3));

const sameList = (a: number[], b: number[]) => a.length === b.length && a.every((x, i) => x === b[i]);

export type ProComparison = {
  sharedItems: number[];
  onlyA: number[];
  onlyB: number[];
  sameKeystone: boolean;
  sameRunePage: boolean;
  sameSpells: boolean;
  sameStart: boolean;
  openings: [string[], string[]];
  sameOpening: boolean;
};

export function compareProBuilds(a: ProBuild, b: ProBuild, complete: (id: number) => boolean): ProComparison {
  const fa = finishedOrder(a.purchases, complete);
  const fb = finishedOrder(b.purchases, complete);
  const keystone = (build: ProBuild) => build.runes.split(":")[2]?.split(",")[0];
  const sorted = (xs: number[]) => [...xs].sort((x, y) => x - y);
  const openings: [string[], string[]] = [opening(a.skillOrder), opening(b.skillOrder)];
  return {
    sharedItems: fa.filter((id) => fb.includes(id)),
    onlyA: fa.filter((id) => !fb.includes(id)),
    onlyB: fb.filter((id) => !fa.includes(id)),
    sameKeystone: !!keystone(a) && keystone(a) === keystone(b),
    sameRunePage: a.runes === b.runes,
    sameSpells: sameList(sorted(a.spells), sorted(b.spells)),
    sameStart: sameList(sorted(a.startItems), sorted(b.startItems)),
    openings,
    sameOpening: openings[0].length > 0 && openings[0].join("") === openings[1].join(""),
  };
}
