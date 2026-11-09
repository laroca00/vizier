import { hasEnoughGames } from "./confidence";
import type { Champion } from "./ddragon";
import { synergyReasons, type SynergyCategory } from "./synergyReasons";

export type SynergyRow = {
  champion: Champion;
  reasons: SynergyCategory[];
  /** From the crawler; null when the pair has no judgeable sample. */
  data: { games: number; winRate: number; position: string } | null;
};

type Ally = { championId: number; position: string; games: number; winRate: number };

/**
 * Partners of `me`: every pair the crawler has judgeable numbers for, plus
 * champions that only fit by a reason rule. `position` restricts the data
 * rows to that partner role; reason-only rows have no role, so they show up
 * only without a role filter.
 */
export function synergyRows(me: Champion, champions: Map<number, Champion>, allies: Ally[], position: string | null): SynergyRow[] {
  const rows: SynergyRow[] = [];
  const withData = new Set<number>();
  for (const ally of allies) {
    const champion = champions.get(ally.championId);
    if (!champion || champion.key === me.key) continue;
    if (position && ally.position !== position) continue;
    if (!hasEnoughGames(ally.games, ally.winRate)) continue;
    withData.add(champion.key);
    rows.push({ champion, reasons: synergyReasons(me, champion), data: { games: ally.games, winRate: ally.winRate, position: ally.position } });
  }
  if (!position) {
    for (const champion of champions.values()) {
      if (champion.key === me.key || withData.has(champion.key)) continue;
      const reasons = synergyReasons(me, champion);
      if (reasons.length > 0) rows.push({ champion, reasons, data: null });
    }
  }
  return rows;
}

/** Rows with numbers first, best win rate first, then the reason-only rows by name. */
export function sortByData(rows: SynergyRow[], locale: string): SynergyRow[] {
  return [...rows].sort((a, b) => {
    if (a.data && b.data) return b.data.winRate - a.data.winRate;
    if (a.data || b.data) return a.data ? -1 : 1;
    return a.champion.name.localeCompare(b.champion.name, locale);
  });
}

/** Rows grouped under each reason they carry (a row can appear in several), data rows first inside a group. */
export function groupByCategory(rows: SynergyRow[], locale: string): { category: SynergyCategory; rows: SynergyRow[] }[] {
  const groups = new Map<SynergyCategory, SynergyRow[]>();
  for (const row of rows) for (const reason of row.reasons) groups.set(reason, [...(groups.get(reason) ?? []), row]);
  return [...groups.entries()].map(([category, list]) => ({ category, rows: sortByData(list, locale) }));
}
