// Item data from Data Dragon, to tell finished items from components when
// ordering builds. Fetched once per isolate.

const BASE = "https://ddragon.leagueoflegends.com";

type RawItem = { into?: string[]; tags?: string[]; consumed?: boolean; gold: { total: number } };

let completeItems: Promise<Set<number>> | undefined;

export function finishedItems(fetcher: typeof fetch = fetch): Promise<Set<number>> {
  completeItems ??= fetcher(`${BASE}/api/versions.json`)
    .then((r) => r.json() as Promise<string[]>)
    .then(([version]) => fetcher(`${BASE}/cdn/${version}/data/en_US/item.json`))
    .then((r) => r.json() as Promise<{ data: Record<string, RawItem> }>)
    .then(
      ({ data }) =>
        new Set(
          Object.entries(data)
            .filter(([, item]) => !item.into?.length && !item.consumed && !item.tags?.includes("Trinket") && item.gold.total >= 900)
            .map(([id]) => Number(id)),
        ),
    )
    .catch((error) => {
      completeItems = undefined;
      throw error;
    });
  return completeItems;
}
