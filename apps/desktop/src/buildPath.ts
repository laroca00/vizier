import type { Picks } from "./api";

export type PathItem = { id: number; games: number; winRate: number };
export type PathStep = { key: "start" | "core" | "later"; items: PathItem[]; games: number; winRate: number | null };

const LATER_ITEMS = 3;

/**
 * Starting items, the three core items and the finished items bought most
 * after them. Start and core are one combination each, with its own games and
 * win rate; the later items each carry their own.
 */
export function buildPath(picks: Pick<Picks, "startItems" | "coreItems" | "items">, isFinished: (id: number) => boolean): PathStep[] {
  const steps: PathStep[] = [];
  const asItems = (ids: number[], games: number, winRate: number) => ids.map((id) => ({ id, games, winRate }));
  if (picks.startItems) steps.push({ key: "start", items: asItems(picks.startItems.ids, picks.startItems.games, picks.startItems.winRate), games: picks.startItems.games, winRate: picks.startItems.winRate });
  const core = new Set(picks.coreItems?.ids);
  if (picks.coreItems) steps.push({ key: "core", items: asItems(picks.coreItems.ids, picks.coreItems.games, picks.coreItems.winRate), games: picks.coreItems.games, winRate: picks.coreItems.winRate });
  const later = picks.items.filter((i) => isFinished(i.id) && !core.has(i.id)).slice(0, LATER_ITEMS);
  if (later.length > 0) steps.push({ key: "later", items: later, games: Math.max(...later.map((i) => i.games)), winRate: null });
  return steps;
}
