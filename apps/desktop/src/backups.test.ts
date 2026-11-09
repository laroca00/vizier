import { describe, expect, it } from "vitest";
import { addBackup, BACKUP_EVERY_MS, backupDue, currentEntries, MAX_BACKUPS, parseBackups } from "./backups";

const entries = { "vizier.personal": "{}" };

describe("backups", () => {
  it("is due when there is data and no copy or an old one", () => {
    expect(backupDue([], entries, 1000)).toBe(true);
    expect(backupDue([{ at: 1000, entries }], entries, 1000 + BACKUP_EVERY_MS - 1)).toBe(false);
    expect(backupDue([{ at: 1000, entries }], entries, 1000 + BACKUP_EVERY_MS)).toBe(true);
  });
  it("makes no copy of nothing", () => {
    expect(backupDue([], {}, 1)).toBe(false);
  });
  it("keeps the newest five", () => {
    let list: ReturnType<typeof addBackup> = [];
    for (let i = 1; i <= 8; i++) list = addBackup(list, entries, i);
    expect(list).toHaveLength(MAX_BACKUPS);
    expect(list.map((b) => b.at)).toEqual([8, 7, 6, 5, 4]);
  });
  it("reads only well-formed copies and only vizier keys", () => {
    const raw = JSON.stringify([{ at: 2, entries: { "vizier.a": "1", other: "2", "vizier.b": 3 } }, { at: "x" }, null, { at: 5, entries: {} }]);
    expect(parseBackups(raw)).toEqual([{ at: 5, entries: {} }, { at: 2, entries: { "vizier.a": "1" } }]);
    expect(parseBackups("{")).toEqual([]);
  });
  it("collects vizier keys from storage", () => {
    const data: Record<string, string> = { "vizier.x": "1", "patchdiff.v3.a": "big", "backups.v1": "[]" };
    const keys = Object.keys(data);
    const storage = { length: keys.length, key: (i: number) => keys[i] ?? null, getItem: (k: string) => data[k] ?? null };
    expect(currentEntries(storage)).toEqual({ "vizier.x": "1" });
  });
});
