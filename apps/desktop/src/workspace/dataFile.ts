import { journalEntries } from "../journalNotes";
import { parseLibrary, type SavedBuild } from "../library/store";
import { parseDrafts, type SavedDraft } from "../simulator/store";

// Builds, draft templates and notes as one file, or any of them alone. The
// file carries a version so a later format can still read this one.

export const WORKSPACE_FORMAT = "vizier-workspace";
export const WORKSPACE_VERSION = 1;

export type Part = "builds" | "drafts" | "notes";
export const PARTS: Part[] = ["builds", "drafts", "notes"];

export type Contents = { builds: SavedBuild[]; drafts: SavedDraft[]; notes: Record<string, string> };
export type Incoming = Partial<Contents>;

export function workspaceFile(parts: Part[], contents: Contents, now = new Date()): string {
  const file: Record<string, unknown> = { format: WORKSPACE_FORMAT, version: WORKSPACE_VERSION, exportedAt: now.toISOString() };
  if (parts.includes("builds")) file.builds = contents.builds;
  if (parts.includes("drafts")) file.drafts = contents.drafts;
  if (parts.includes("notes")) file.notes = Object.fromEntries(journalEntries(contents.notes).map((e) => [e.key, e.text]));
  return JSON.stringify(file, null, 2);
}

/** Reads a workspace file; throws "not-json", "not-vizier" or "too-new". Malformed entries inside are dropped, not trusted. */
export function readWorkspaceFile(text: string): Incoming {
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("not-json");
  }
  if (data?.format !== WORKSPACE_FORMAT || typeof data.version !== "number") throw new Error("not-vizier");
  if (data.version > WORKSPACE_VERSION) throw new Error("too-new");
  const result: Incoming = {};
  if (Array.isArray(data.builds)) result.builds = parseLibrary(JSON.stringify({ builds: data.builds })).builds;
  if (Array.isArray(data.drafts)) result.drafts = parseDrafts(JSON.stringify(data.drafts));
  if (data.notes && typeof data.notes === "object") result.notes = Object.fromEntries(journalEntries(data.notes as Record<string, string>).map((e) => [e.key, e.text]));
  return result;
}

export type Status = "new" | "changed" | "same" | "skipped";
export type PreviewRow = { part: Part; id: string; name: string; status: Status; reason?: "champion" | "item" };

/** What is known from Data Dragon; null when it could not be loaded, so nothing is skipped for an unknown id. */
export type Known = { champions: Set<number> | null; items: Set<number> | null };

const stamp = (value: object) => JSON.stringify(value, (key, v) => (key === "updatedAt" || key === "createdAt" ? undefined : v));

/** Each incoming entry as new, changed (same id, other content), same, or skipped with a reason. Nothing is applied here. */
export function previewImport(incoming: Incoming, current: Contents, known: Known): PreviewRow[] {
  const rows: PreviewRow[] = [];
  for (const build of incoming.builds ?? []) {
    const mine = current.builds.find((b) => b.id === build.id);
    const unknownItem = known.items && [...build.startItems, ...build.coreItems, ...build.items].some((id) => !known.items!.has(id));
    const status: Status = known.champions && !known.champions.has(build.championId) ? "skipped" : unknownItem ? "skipped" : !mine ? "new" : stamp(mine) === stamp(build) ? "same" : "changed";
    rows.push({ part: "builds", id: build.id, name: build.name, status, reason: status === "skipped" ? (unknownItem && !(known.champions && !known.champions.has(build.championId)) ? "item" : "champion") : undefined });
  }
  for (const draft of incoming.drafts ?? []) {
    const mine = current.drafts.find((d) => d.id === draft.id);
    const ids = [...draft.blue, ...draft.red, ...draft.bans].filter((n) => n > 0);
    const unknown = known.champions && ids.some((id) => !known.champions!.has(id));
    const status: Status = unknown ? "skipped" : !mine ? "new" : stamp(mine) === stamp(draft) ? "same" : "changed";
    rows.push({ part: "drafts", id: draft.id, name: draft.name, status, reason: unknown ? "champion" : undefined });
  }
  for (const [key, text] of Object.entries(incoming.notes ?? {})) {
    const mine = current.notes[key]?.trim();
    rows.push({ part: "notes", id: key, name: key, status: !mine ? "new" : mine === text.trim() ? "same" : "changed" });
  }
  return rows;
}

export const countStatus = (rows: PreviewRow[], part: Part, status: Status) => rows.filter((r) => r.part === part && r.status === status).length;

/** What to write: new entries, plus changed builds and drafts as copies when asked. Notes the player already has are never replaced. */
export function selectForImport(incoming: Incoming, rows: PreviewRow[], withChanged: boolean) {
  const take = (part: Part, id: string) => rows.some((r) => r.part === part && r.id === id && (r.status === "new" || (withChanged && r.status === "changed" && part !== "notes")));
  return {
    builds: (incoming.builds ?? []).filter((b) => take("builds", b.id)),
    drafts: (incoming.drafts ?? []).filter((d) => take("drafts", d.id)),
    notes: Object.fromEntries(Object.entries(incoming.notes ?? {}).filter(([key]) => take("notes", key))),
  };
}

const cell = (value: string | number) => {
  const text = String(value);
  // A leading = + - or @ would run as a formula in a spreadsheet.
  const safe = /^[=+\-@]/.test(text) && Number.isNaN(Number(text)) ? `'${text}` : text;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export const toCsv = (rows: (string | number)[][]) => rows.map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";

export function buildsCsv(builds: SavedBuild[], championName: (id: number) => string): string {
  return toCsv([
    ["name", "champion", "role", "spells", "start_items", "core_items", "items", "skill_order", "tags", "notes"],
    ...builds.map((b) => [b.name, championName(b.championId), b.position ?? "", b.spells.join(" "), b.startItems.join(" "), b.coreItems.join(" "), b.items.join(" "), b.skillOrder.map((s) => "QWE"[s - 1] ?? "").join(""), (b.tags ?? []).join(" "), b.notes]),
  ]);
}

export function notesCsv(notes: Record<string, string>, label: (key: string) => string): string {
  return toCsv([["key", "subject", "note"], ...journalEntries(notes).map((e) => [e.key, label(e.key), e.text])]);
}
