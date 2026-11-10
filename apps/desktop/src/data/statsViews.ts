import { STATS_COLUMNS, type StatsColumn, type StatsView } from "./statsTable";

/** The columns the explorer shows beside the champion's name. */
export type ColumnChoice = Exclude<StatsColumn, "name">[];

export const ALL_COLUMNS: ColumnChoice = STATS_COLUMNS.filter((c): c is Exclude<StatsColumn, "name"> => c !== "name");

export type SavedView = {
  id: string;
  name: string;
  position: string;
  sort: StatsColumn;
  desc: boolean;
  minGames: number;
  columns: ColumnChoice;
};

/** The three ready views. Names are Turkish; the page translates them. */
export const PRESET_VIEWS: SavedView[] = [
  { id: "preset:lane", name: "Hat ezenler", position: "ALL", sort: "goldDiff15", desc: true, minGames: 300, columns: ["goldDiff15", "csPerMinute", "winRate", "games"] },
  { id: "preset:late", name: "Geç oyun", position: "ALL", sort: "lateWinRate", desc: true, minGames: 300, columns: ["lateWinRate", "winRate", "minutes", "games"] },
  { id: "preset:bans", name: "Yasak hedefleri", position: "ALL", sort: "banRate", desc: true, minGames: 300, columns: ["banRate", "winRate", "pickRate", "games"] },
];

const isColumn = (value: unknown): value is StatsColumn => typeof value === "string" && (STATS_COLUMNS as string[]).includes(value);

/** The column choice as the table needs it: known columns only, in table order; nothing left means all of them. */
export function sanitizeColumns(value: unknown): ColumnChoice {
  const chosen = new Set(Array.isArray(value) ? value.filter(isColumn) : []);
  const kept = ALL_COLUMNS.filter((c) => chosen.has(c));
  return kept.length > 0 ? kept : [...ALL_COLUMNS];
}

/** Saved views from storage, with anything unreadable dropped; ids stay unique and presets can't be shadowed. */
export function sanitizeViews(value: unknown): SavedView[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const views: SavedView[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const v = raw as Record<string, unknown>;
    const name = typeof v.name === "string" ? v.name.trim().slice(0, 40) : "";
    if (!name || typeof v.id !== "string" || v.id.startsWith("preset:") || seen.has(v.id) || !isColumn(v.sort)) continue;
    seen.add(v.id);
    views.push({
      id: v.id,
      name,
      position: typeof v.position === "string" ? v.position : "ALL",
      sort: v.sort,
      desc: v.desc !== false,
      minGames: typeof v.minGames === "number" && v.minGames >= 0 ? v.minGames : 100,
      columns: sanitizeColumns(v.columns),
    });
  }
  return views.slice(0, 20);
}

export function viewFrom(id: string, name: string, view: Pick<StatsView, "position" | "sort" | "desc" | "minGames">, columns: ColumnChoice): SavedView {
  return { id, name: name.trim().slice(0, 40), position: view.position, sort: view.sort, desc: view.desc, minGames: view.minGames, columns };
}

/** Saving under a name that exists replaces that view. */
export function withView(views: SavedView[], next: SavedView): SavedView[] {
  const same = views.findIndex((v) => v.name.toLocaleLowerCase() === next.name.toLocaleLowerCase());
  if (same >= 0) return views.map((v, i) => (i === same ? { ...next, id: v.id } : v));
  return [...views, next].slice(-20);
}

/** Whether the table is showing exactly this view, so the picker can say so. */
export function matchesView(saved: SavedView, view: Pick<StatsView, "position" | "sort" | "desc" | "minGames">, columns: ColumnChoice): boolean {
  return (
    saved.position === view.position &&
    saved.sort === view.sort &&
    saved.desc === view.desc &&
    saved.minGames === view.minGames &&
    saved.columns.join() === columns.join()
  );
}
