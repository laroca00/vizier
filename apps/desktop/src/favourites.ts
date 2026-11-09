// Things the player starred, of any kind, with the tags and collections they
// filed them under. Only a label is kept next to the id so the list reads
// without loading every source; stored with the other personal data.

export const FAV_KINDS = ["build", "matchup", "item", "rune", "pro", "draft", "comp", "combo"] as const;
export type FavKind = (typeof FAV_KINDS)[number];

export type Favourite = {
  kind: FavKind;
  /** Unique per kind: a build id, "103:238" for a matchup, a combo as "Ahri/charm-burst". */
  id: string;
  label: string;
  /** The champion it belongs to, for the champion workspace. */
  championId: number | null;
  tags: string[];
  collection: string | null;
  addedAt: number;
  openedAt: number | null;
};

export const FAV_KIND_TEXT: Record<FavKind, string> = {
  build: "Build",
  matchup: "Eşleşme",
  item: "Eşya",
  rune: "Rün",
  pro: "Pro build",
  draft: "Draft şablonu",
  comp: "Kompozisyon şablonu",
  combo: "Kombo",
};

export const FAV_LIMIT = 300;
export const FAV_TAG_LIMIT = 6;
const TEXT_LIMIT = 60;

const isKind = (value: unknown): value is FavKind => (FAV_KINDS as readonly string[]).includes(value as string);
const text = (value: unknown, max = TEXT_LIMIT) => (typeof value === "string" ? value.trim().slice(0, max) : "");

export function cleanTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((v) => text(v, 24)).filter(Boolean))].slice(0, FAV_TAG_LIMIT);
}

/** Reads what was stored; malformed entries and repeats are dropped. */
export function parseFavourites(value: unknown): Favourite[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: Favourite[] = [];
  for (const raw of value as Partial<Favourite>[]) {
    if (!raw || !isKind(raw.kind) || typeof raw.id !== "string" || !raw.id) continue;
    const key = `${raw.kind}|${raw.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({
      kind: raw.kind,
      id: raw.id,
      label: text(raw.label) || raw.id,
      championId: typeof raw.championId === "number" ? raw.championId : null,
      tags: cleanTags(raw.tags),
      collection: text(raw.collection) || null,
      addedAt: typeof raw.addedAt === "number" ? raw.addedAt : 0,
      openedAt: typeof raw.openedAt === "number" ? raw.openedAt : null,
    });
  }
  return result.slice(0, FAV_LIMIT);
}

export const isFavourite = (list: Favourite[], kind: FavKind, id: string) => list.some((f) => f.kind === kind && f.id === id);

const same = (kind: FavKind, id: string) => (f: Favourite) => f.kind === kind && f.id === id;

export function toggleFavourite(list: Favourite[], item: { kind: FavKind; id: string; label: string; championId?: number | null }, now: number): Favourite[] {
  if (isFavourite(list, item.kind, item.id)) return list.filter((f) => !same(item.kind, item.id)(f));
  if (list.length >= FAV_LIMIT) return list;
  return [...list, { kind: item.kind, id: item.id, label: text(item.label) || item.id, championId: item.championId ?? null, tags: [], collection: null, addedAt: now, openedAt: null }];
}

export const patchFavourite = (list: Favourite[], kind: FavKind, id: string, patch: Partial<Pick<Favourite, "tags" | "collection" | "openedAt">>): Favourite[] =>
  list.map((f) => (same(kind, id)(f) ? { ...f, ...patch, tags: patch.tags ? cleanTags(patch.tags) : f.tags } : f));

/** Moves the favourites of a removed collection back to "no collection". */
export const dropCollection = (list: Favourite[], name: string): Favourite[] => list.map((f) => (f.collection === name ? { ...f, collection: null } : f));

export type FavFilter = { query?: string; kind?: FavKind | null; collection?: string | null; tag?: string | null };

/** The favourites matching the filter, the most recently opened (or added) first. */
export function filterFavourites(list: Favourite[], filter: FavFilter, locale = "tr"): Favourite[] {
  const q = (filter.query ?? "").trim().toLocaleLowerCase(locale);
  return list
    .filter((f) => !filter.kind || f.kind === filter.kind)
    .filter((f) => !filter.collection || f.collection === filter.collection)
    .filter((f) => !filter.tag || f.tags.includes(filter.tag))
    .filter((f) => !q || f.label.toLocaleLowerCase(locale).includes(q) || f.tags.some((t) => t.toLocaleLowerCase(locale).includes(q)))
    .sort((a, b) => (b.openedAt ?? b.addedAt) - (a.openedAt ?? a.addedAt));
}

export const recentlyOpened = (list: Favourite[], count = 5): Favourite[] =>
  list
    .filter((f) => f.openedAt !== null)
    .sort((a, b) => b.openedAt! - a.openedAt!)
    .slice(0, count);

export const allFavouriteTags = (list: Favourite[]): string[] => [...new Set(list.flatMap((f) => f.tags))].sort();
