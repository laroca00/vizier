import type { SavedBuild } from "./store";

/** Two finished core items is the usual first power spike. */
export const SPIKE_ITEMS = 2;

export type BuildGold = {
  start: number;
  core: number;
  rest: number;
  total: number;
  /** Gold spent by the time the spike's core items are done, starting items included. */
  spike: { items: number; gold: number } | null;
};

export function buildGold(build: Pick<SavedBuild, "startItems" | "coreItems" | "items">, price: (id: number) => number): BuildGold {
  const sum = (ids: number[]) => ids.reduce((total, id) => total + price(id), 0);
  const start = sum(build.startItems);
  const core = sum(build.coreItems);
  const rest = sum(build.items);
  const spikeItems = Math.min(SPIKE_ITEMS, build.coreItems.length);
  return {
    start,
    core,
    rest,
    total: start + core + rest,
    spike: spikeItems > 0 ? { items: spikeItems, gold: start + sum(build.coreItems.slice(0, spikeItems)) } : null,
  };
}
