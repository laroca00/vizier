import type { SavedBuild } from "./store";

export type LibrarySort = "edited" | "champion" | "name" | "collection";

const MAX_TAGS = 6;
const MAX_TAG_LENGTH = 20;

/** Tags typed as "ranked, lane bully": trimmed, lower-cased, no repeats, no empties. */
export function parseTags(text: string): string[] {
  const tags = text
    .split(/[,;\n]/)
    .map((t) => t.trim().toLocaleLowerCase("tr").slice(0, MAX_TAG_LENGTH))
    .filter(Boolean);
  return [...new Set(tags)].slice(0, MAX_TAGS);
}

/** Every tag in use with how many builds carry it, most used first. */
export function tagCounts(builds: Pick<SavedBuild, "tags">[]): { tag: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const b of builds) for (const tag of b.tags ?? []) counts.set(tag, (counts.get(tag) ?? 0) + 1);
  return [...counts].map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, "tr"));
}

/** A new array; ties fall back to the last edit so the order is stable. */
export function sortBuilds(builds: SavedBuild[], sort: LibrarySort, championName: (id: number) => string, locale: string): SavedBuild[] {
  const byEdit = (a: SavedBuild, b: SavedBuild) => b.updatedAt - a.updatedAt;
  const text = (a: string, b: string) => a.localeCompare(b, locale);
  const compare: Record<LibrarySort, (a: SavedBuild, b: SavedBuild) => number> = {
    edited: byEdit,
    champion: (a, b) => text(championName(a.championId), championName(b.championId)) || text(a.name, b.name),
    name: (a, b) => text(a.name, b.name),
    // Builds without a collection go last.
    collection: (a, b) => (a.collections[0] ? (b.collections[0] ? text(a.collections[0], b.collections[0]) : -1) : b.collections[0] ? 1 : 0) || text(a.name, b.name),
  };
  return [...builds].sort((a, b) => compare[sort](a, b) || byEdit(a, b));
}
