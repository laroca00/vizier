// Item and champion data from Data Dragon, to tell finished items from
// components and to name builds and enemy teams.
import { catalogFrom, type Catalog, type RawChampion, type RawItem } from "./archetypes.ts";

const BASE = "https://ddragon.leagueoflegends.com";
// The crawler runs for weeks, so a new patch's items must show up without a restart.
const REFRESH_MS = 6 * 3_600_000;

let cached: { at: number; catalog: Promise<Catalog> } | undefined;

export function loadCatalog(fetcher: typeof fetch = fetch, now = Date.now()): Promise<Catalog> {
  if (cached && now - cached.at < REFRESH_MS) return cached.catalog;
  const previous = cached;
  const catalog = fetcher(`${BASE}/api/versions.json`)
    .then((r) => r.json() as Promise<string[]>)
    .then(([version]) =>
      Promise.all([
        fetcher(`${BASE}/cdn/${version}/data/en_US/item.json`).then((r) => r.json() as Promise<{ data: Record<string, RawItem> }>),
        fetcher(`${BASE}/cdn/${version}/data/en_US/champion.json`).then((r) => r.json() as Promise<{ data: Record<string, RawChampion> }>),
      ] as const),
    )
    .then(([items, champions]) => catalogFrom(items.data, champions.data))
    .catch((error) => {
      // Keep serving the old patch's data rather than failing every rollup.
      cached = previous;
      if (previous) return previous.catalog;
      throw error;
    });
  cached = { at: now, catalog };
  return catalog;
}
