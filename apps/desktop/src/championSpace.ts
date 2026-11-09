// What the player keeps per champion beyond notes and builds: a preferred
// role, labels, short reminders and links. Stored with the other personal data.

export type ChampionSpace = { role: string | null; tags: string[]; reminders: string[]; links: { title: string; url: string }[] };
export type ChampionSpaces = Record<string, ChampionSpace>;

export const SPACE_LIMITS = { tags: 6, reminders: 6, links: 6, text: 140 } as const;

const ROLES = ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"];

const strings = (value: unknown, max: number, size: number = SPACE_LIMITS.text): string[] =>
  Array.isArray(value)
    ? [...new Set(value.filter((v): v is string => typeof v === "string").map((v) => v.trim().slice(0, size)).filter(Boolean))].slice(0, max)
    : [];

/** Only web links are kept, so a pasted file path or script never opens. */
export function safeUrl(value: string): string | null {
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export const emptySpace = (): ChampionSpace => ({ role: null, tags: [], reminders: [], links: [] });

const isEmpty = (s: ChampionSpace) => !s.role && !s.tags.length && !s.reminders.length && !s.links.length;

export function parseSpaces(value: unknown): ChampionSpaces {
  if (!value || typeof value !== "object") return {};
  const result: ChampionSpaces = {};
  for (const [key, raw] of Object.entries(value as Record<string, Partial<ChampionSpace>>)) {
    if (!/^\d+$/.test(key) || !raw || typeof raw !== "object") continue;
    const links = (Array.isArray(raw.links) ? raw.links : [])
      .map((l) => ({ title: typeof l?.title === "string" ? l.title.trim().slice(0, 60) : "", url: typeof l?.url === "string" ? safeUrl(l.url) : null }))
      .filter((l): l is { title: string; url: string } => l.url !== null)
      .slice(0, SPACE_LIMITS.links);
    const space: ChampionSpace = {
      role: typeof raw.role === "string" && ROLES.includes(raw.role) ? raw.role : null,
      tags: strings(raw.tags, SPACE_LIMITS.tags, 24),
      reminders: strings(raw.reminders, SPACE_LIMITS.reminders),
      links: links.map((l) => ({ title: l.title || new URL(l.url).hostname, url: l.url })),
    };
    if (!isEmpty(space)) result[key] = space;
  }
  return result;
}

/** Applies a change to one champion's space and drops the entry again when nothing is left. */
export function changeSpace(spaces: ChampionSpaces, championId: number, change: (space: ChampionSpace) => ChampionSpace): ChampionSpaces {
  const key = String(championId);
  const next = parseSpaces({ [key]: change(spaces[key] ?? emptySpace()) });
  const { [key]: _old, ...rest } = spaces;
  return key in next ? { ...rest, ...next } : rest;
}
