import type { DatabaseSync } from "node:sqlite";

/**
 * Local-only schema, applied on every start after the D1 migrations. The
 * Worker's D1 never sees it: only finished docs are published there, so these
 * changes need no remote migration. Every step checks before it acts.
 */
function columns(sqlite: DatabaseSync, table: string): { name: string; type: string }[] {
  return sqlite.prepare(`SELECT name, type FROM pragma_table_info('${table}')`).all() as { name: string; type: string }[];
}

function addColumn(sqlite: DatabaseSync, table: string, column: string, type: string) {
  if (!columns(sqlite, table).some((c) => c.name === column)) sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
}

export function localSchema(sqlite: DatabaseSync) {
  // The tier group of the seed a game came from; null on rows from before.
  addColumn(sqlite, "participant_stats", "rank_group", "TEXT");
  addColumn(sqlite, "crawled_matches", "rank_group", "TEXT");
}
