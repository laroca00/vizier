// A weekly copy of everything Vizier keeps, held next to the app's other data
// and kept to the last few. It is stored outside the "vizier." keys so a copy
// never ends up inside the next copy or in an export.

export type Backup = { at: number; entries: Record<string, string> };

export const BACKUP_KEY = "backups.v1";
export const MAX_BACKUPS = 5;
export const BACKUP_EVERY_MS = 7 * 24 * 60 * 60 * 1000;
const PREFIX = "vizier.";

export function parseBackups(raw: string | null): Backup[] {
  try {
    const list = JSON.parse(raw ?? "[]");
    return (Array.isArray(list) ? list : [])
      .filter((b) => b && typeof b.at === "number" && b.entries && typeof b.entries === "object")
      .map((b) => ({ at: b.at as number, entries: Object.fromEntries(Object.entries(b.entries as Record<string, unknown>).filter(([k, v]) => k.startsWith(PREFIX) && typeof v === "string")) as Record<string, string> }))
      .sort((a, b) => b.at - a.at)
      .slice(0, MAX_BACKUPS);
  } catch {
    return [];
  }
}

/** Due when there is something to keep and the last copy is a week old or missing. */
export function backupDue(list: Backup[], entries: Record<string, string>, now: number): boolean {
  if (Object.keys(entries).length === 0) return false;
  return list.length === 0 || now - list[0].at >= BACKUP_EVERY_MS;
}

export function addBackup(list: Backup[], entries: Record<string, string>, now: number): Backup[] {
  return [{ at: now, entries }, ...list].slice(0, MAX_BACKUPS);
}

export function currentEntries(storage: Pick<Storage, "length" | "key" | "getItem">): Record<string, string> {
  const entries: Record<string, string> = {};
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key?.startsWith(PREFIX)) entries[key] = storage.getItem(key) ?? "";
  }
  return entries;
}

function write(list: Backup[]): Backup[] {
  // A full disk quota drops the oldest copy until the rest fits.
  for (let keep = list.length; keep > 0; keep--) {
    try {
      localStorage.setItem(BACKUP_KEY, JSON.stringify(list.slice(0, keep)));
      return list.slice(0, keep);
    } catch {
      continue;
    }
  }
  return [];
}

export function readBackups(): Backup[] {
  try {
    return parseBackups(localStorage.getItem(BACKUP_KEY));
  } catch {
    return [];
  }
}

/** Called once at start: makes this week's copy when it is due. */
export function backupIfDue(now = Date.now()): void {
  try {
    const entries = currentEntries(localStorage);
    const list = readBackups();
    if (backupDue(list, entries, now)) write(addBackup(list, entries, now));
  } catch {
    // Backups are a convenience; the app works without them.
  }
}

export function backupNow(now = Date.now()): Backup[] {
  return write(addBackup(readBackups(), currentEntries(localStorage), now));
}

/** Puts a copy back in place of the current data; the caller reloads the app afterwards. */
export function restoreBackup(backup: Backup): void {
  const current = currentEntries(localStorage);
  for (const key of Object.keys(current)) localStorage.removeItem(key);
  for (const [key, value] of Object.entries(backup.entries)) localStorage.setItem(key, value);
}
