// The journal reads the notes store: "c:103" is a champion note and
// "m:103:238" a note for Ahri against Zed.

export type JournalEntry = { key: string; championId: number; opponentId: number | null; text: string };

export function parseNoteKey(key: string): { championId: number; opponentId: number | null } | null {
  const [kind, champion, opponent, ...rest] = key.split(":");
  const championId = Number(champion);
  if (!Number.isInteger(championId) || championId <= 0 || rest.length) return null;
  if (kind === "c" && opponent === undefined) return { championId, opponentId: null };
  const opponentId = Number(opponent);
  if (kind === "m" && Number.isInteger(opponentId) && opponentId > 0) return { championId, opponentId };
  return null;
}

export function journalEntries(notes: Record<string, string>): JournalEntry[] {
  const entries: JournalEntry[] = [];
  for (const [key, text] of Object.entries(notes)) {
    const parsed = parseNoteKey(key);
    if (parsed && typeof text === "string" && text.trim()) entries.push({ key, text, ...parsed });
  }
  return entries;
}

export type JournalGroup = { championId: number; name: string; champion: JournalEntry | null; matchups: JournalEntry[] };

const fold = (text: string, locale: string) => text.toLocaleLowerCase(locale);

/**
 * Entries grouped by champion, groups by champion name. The query matches the
 * note text and the names of both champions.
 */
export function groupJournal(entries: JournalEntry[], nameOf: (id: number) => string, query: string, locale: string): JournalGroup[] {
  const q = fold(query.trim(), locale);
  const groups = new Map<number, JournalGroup>();
  for (const entry of entries) {
    const name = nameOf(entry.championId);
    const opponent = entry.opponentId === null ? "" : nameOf(entry.opponentId);
    if (q && ![entry.text, name, opponent].some((s) => fold(s, locale).includes(q))) continue;
    const group = groups.get(entry.championId) ?? { championId: entry.championId, name, champion: null, matchups: [] };
    if (entry.opponentId === null) group.champion = entry;
    else group.matchups.push(entry);
    groups.set(entry.championId, group);
  }
  for (const group of groups.values()) group.matchups.sort((a, b) => nameOf(a.opponentId!).localeCompare(nameOf(b.opponentId!), locale));
  return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name, locale));
}

/** What to store for the text in the box: an untouched template is no note. */
export function noteToStore(text: string, template?: string): string {
  return template !== undefined && text === template ? "" : text;
}
