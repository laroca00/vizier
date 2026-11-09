// Short reminders and favourite plans the player attaches to a matchup, on top
// of the free-text note. Stored with the other personal data, keyed like notes.

export type AcademyEntry = { reminders: string[]; plans: string[] };
export type AcademyNotes = Record<string, AcademyEntry>;
export type AcademyKind = keyof AcademyEntry;

export const ACADEMY_LIMIT = 5;
export const ACADEMY_TEXT_LIMIT = 140;

const clean = (value: unknown): string[] =>
  Array.isArray(value)
    ? value
        .filter((v): v is string => typeof v === "string")
        .map((v) => v.trim().slice(0, ACADEMY_TEXT_LIMIT))
        .filter(Boolean)
        .slice(0, ACADEMY_LIMIT)
    : [];

/** Reads what was stored; malformed entries and empty ones are dropped. */
export function parseAcademy(value: unknown): AcademyNotes {
  if (!value || typeof value !== "object") return {};
  const result: AcademyNotes = {};
  for (const [key, entry] of Object.entries(value as Record<string, Partial<AcademyEntry>>)) {
    const reminders = clean(entry?.reminders);
    const plans = clean(entry?.plans);
    if (reminders.length || plans.length) result[key] = { reminders, plans };
  }
  return result;
}

function change(notes: AcademyNotes, key: string, kind: AcademyKind, edit: (list: string[]) => string[]): AcademyNotes {
  const entry = notes[key] ?? { reminders: [], plans: [] };
  const next = { ...entry, [kind]: clean(edit(entry[kind])) };
  const rest = { ...notes };
  if (next.reminders.length || next.plans.length) rest[key] = next;
  else delete rest[key];
  return rest;
}

export const addAcademy = (notes: AcademyNotes, key: string, kind: AcademyKind, text: string) =>
  change(notes, key, kind, (list) => (list.length >= ACADEMY_LIMIT || list.includes(text.trim()) ? list : [...list, text]));

export const removeAcademy = (notes: AcademyNotes, key: string, kind: AcademyKind, index: number) =>
  change(notes, key, kind, (list) => list.filter((_, i) => i !== index));
