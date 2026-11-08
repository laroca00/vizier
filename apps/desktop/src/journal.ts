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

const NOTES_FORMAT = "vizier-notes";

export function notesFile(notes: Record<string, string>): string {
  const valid = Object.fromEntries(journalEntries(notes).map((e) => [e.key, e.text]));
  return JSON.stringify({ format: NOTES_FORMAT, version: 1, notes: valid }, null, 2);
}

/** Reads a notes file, or the notes inside a full local data export; throws on anything else. */
export function readNotesFile(text: string): Record<string, string> {
  let data: { format?: unknown; notes?: unknown; entries?: Record<string, unknown> };
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("not-json");
  }
  let notes: unknown;
  if (data?.format === NOTES_FORMAT) notes = data.notes;
  else if (data?.format === "vizier-local-data" && typeof data.entries?.["vizier.personal"] === "string") {
    try {
      notes = (JSON.parse(data.entries["vizier.personal"]) as { notes?: unknown }).notes;
    } catch {
      throw new Error("not-vizier");
    }
  }
  if (!notes || typeof notes !== "object") throw new Error("not-vizier");
  return Object.fromEntries(journalEntries(notes as Record<string, string>).map((e) => [e.key, e.text]));
}

/** Keeps the player's own text where both sides have a different note for the same key. */
export function mergeNotes(current: Record<string, string>, incoming: Record<string, string>) {
  const merged = { ...current };
  let added = 0;
  let kept = 0;
  for (const [key, text] of Object.entries(incoming)) {
    if (!current[key]?.trim()) {
      merged[key] = text;
      added += 1;
    } else if (current[key] !== text) kept += 1;
  }
  return { merged, added, kept };
}
