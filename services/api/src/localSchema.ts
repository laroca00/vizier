import type { DatabaseSync } from "node:sqlite";
import { BRACKETS, DEFAULT_BRACKET, groupsSql, type Bracket } from "@vizier/shared/brackets";

/**
 * Local-only schema, applied on every start after the D1 migrations. The
 * Worker's D1 never sees it: only finished docs are published there, so these
 * changes need no remote migration. Every step checks before it acts.
 *
 * The roll-up tables gain the tier group of the games in their key, so any
 * bracket is a sum of groups. The old table names stay as views over the
 * Emerald+ groups: code that reads or writes them keeps its meaning, and
 * counts from before the groups existed count as Emerald (a patch turn
 * washes them out).
 */
export const LEGACY_GROUP = "emerald";

/**
 * The view a bracket's reads go through. Emerald+ keeps the plain table name;
 * every other bracket has `<table>__<bracket>`.
 */
export const scope = (table: "stat_counts" | "lane_sums" | "bench_sums" | "item_time_sums", bracket: Bracket = DEFAULT_BRACKET) =>
  bracket === DEFAULT_BRACKET ? table : `${table}__${bracket}`;

type Spec = { name: string; key: string[]; values: string[]; index?: string };

const TABLES: Spec[] = [
  {
    name: "stat_counts",
    key: ["patch", "queue_id", "team_position", "champion_id", "kind", "value"],
    values: ["games", "wins"],
    index: "CREATE INDEX stat_counts_g_by_champion ON stat_counts_g (champion_id, queue_id, kind);CREATE INDEX stat_counts_g_by_kind ON stat_counts_g (kind, queue_id, patch, champion_id)",
  },
  { name: "lane_sums", key: ["patch", "team_position", "champion_id", "opponent_id"], values: ["games", "cs10", "cs15", "gold10", "gold15", "first_bloods"] },
  {
    name: "bench_sums",
    key: ["patch", "team_position", "champion_id", "minute"],
    values: ["games", "cs", "level", "kda_games", "kills", "deaths", "assists", "team_kills"],
  },
  { name: "item_time_sums", key: ["patch", "team_position", "champion_id", "item_id"], values: ["games", "seconds"] },
];

function columns(sqlite: DatabaseSync, table: string): { name: string; type: string }[] {
  return sqlite.prepare(`SELECT name, type FROM pragma_table_info('${table}')`).all() as { name: string; type: string }[];
}

function addColumn(sqlite: DatabaseSync, table: string, column: string, type: string) {
  if (!columns(sqlite, table).some((c) => c.name === column)) sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
}

function isTable(sqlite: DatabaseSync, name: string) {
  return !!sqlite.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(name);
}

function split(sqlite: DatabaseSync, spec: Spec) {
  const { name, key, values } = spec;
  const types = new Map(columns(sqlite, name).map((c) => [c.name, c.type]));
  const all = [...key, ...values];
  const defs = [...key.map((k) => `${k} ${types.get(k)} NOT NULL`), `rank_group TEXT NOT NULL`, ...values.map((v) => `${v} ${types.get(v)} NOT NULL`)];
  sqlite.exec("BEGIN");
  try {
    sqlite.exec(`CREATE TABLE ${name}_g (${defs.join(", ")}, PRIMARY KEY (${[...key, "rank_group"].join(", ")})) WITHOUT ROWID`);
    sqlite.exec(`INSERT INTO ${name}_g (${[...key, "rank_group", ...values].join(", ")}) SELECT ${[...key, `'${LEGACY_GROUP}'`, ...values].join(", ")} FROM ${name}`);
    sqlite.exec(`DROP TABLE ${name}`);
    for (const statement of (spec.index ?? "").split(";").filter(Boolean)) sqlite.exec(statement);
    sqlite.exec("COMMIT");
  } catch (error) {
    sqlite.exec("ROLLBACK");
    throw error;
  }
  return all;
}

function bracketViews(sqlite: DatabaseSync, spec: Spec) {
  const { name, key, values } = spec;
  for (const bracket of BRACKETS) {
    if (bracket === DEFAULT_BRACKET) continue;
    const view = scope(name as "stat_counts", bracket);
    sqlite.exec(`DROP VIEW IF EXISTS ${view}`);
    sqlite.exec(
      `CREATE VIEW ${view} AS SELECT ${key.join(", ")}, ${values.map((v) => `SUM(${v}) AS ${v}`).join(", ")}
        FROM ${name}_g WHERE rank_group IN (${groupsSql(bracket)}) GROUP BY ${key.join(", ")}`,
    );
  }
}

function emeraldView(sqlite: DatabaseSync, spec: Spec) {
  const { name, key, values } = spec;
  const groups = groupsSql("emerald_plus");
  sqlite.exec(`DROP VIEW IF EXISTS ${name}`);
  sqlite.exec(
    `CREATE VIEW ${name} AS SELECT ${key.join(", ")}, ${values.map((v) => `SUM(${v}) AS ${v}`).join(", ")}
      FROM ${name}_g WHERE rank_group IN (${groups}) GROUP BY ${key.join(", ")}`,
  );
  // Writes through the old name count as Emerald, as they did before groups.
  sqlite.exec(`DROP TRIGGER IF EXISTS ${name}_insert`);
  sqlite.exec(
    `CREATE TRIGGER ${name}_insert INSTEAD OF INSERT ON ${name} BEGIN
      INSERT INTO ${name}_g (${key.join(", ")}, rank_group, ${values.join(", ")})
        VALUES (${key.map((k) => `NEW.${k}`).join(", ")}, '${LEGACY_GROUP}', ${values.map((v) => `NEW.${v}`).join(", ")})
        ON CONFLICT DO UPDATE SET ${values.map((v) => `${v} = ${v} + excluded.${v}`).join(", ")};
    END`,
  );
  sqlite.exec(`DROP TRIGGER IF EXISTS ${name}_delete`);
  sqlite.exec(`CREATE TRIGGER ${name}_delete INSTEAD OF DELETE ON ${name} BEGIN
      DELETE FROM ${name}_g WHERE ${key.map((k) => `${k} = OLD.${k}`).join(" AND ")} AND rank_group IN (${groups});
    END`);
}

export function localSchema(sqlite: DatabaseSync) {
  // The tier group of the seed a game came from; null on rows from before.
  addColumn(sqlite, "participant_stats", "rank_group", "TEXT");
  addColumn(sqlite, "crawled_matches", "rank_group", "TEXT");
  for (const spec of TABLES) {
    if (isTable(sqlite, spec.name)) split(sqlite, spec);
    emeraldView(sqlite, spec);
    bracketViews(sqlite, spec);
  }
}
