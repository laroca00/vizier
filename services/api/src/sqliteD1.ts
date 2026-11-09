import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { localSchema } from "./localSchema.ts";

const MIGRATIONS = join(import.meta.dirname, "../migrations");

/**
 * The part of D1's API Vizier uses, over node:sqlite. The tests run on it in
 * memory and services/crawler runs the real crawler on it from a file.
 */
export function sqliteD1(path = ":memory:") {
  const sqlite = new DatabaseSync(path);
  if (path !== ":memory:") sqlite.exec("PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;");
  migrate(sqlite);
  localSchema(sqlite);

  const statement = (sql: string, params: unknown[] = []) => ({
    bind: (...values: unknown[]) => statement(sql, values),
    first: async () => sqlite.prepare(sql).get(...(params as never[])) ?? null,
    all: async () => ({ results: sqlite.prepare(sql).all(...(params as never[])) }),
    run: async () => sqlite.prepare(sql).run(...(params as never[])),
    runNow: () => sqlite.prepare(sql).run(...(params as never[])),
  });
  const db = {
    prepare: (sql: string) => statement(sql),
    // Synchronous from BEGIN to COMMIT, so a concurrent caller can't run a
    // statement inside someone else's transaction.
    batch: async (statements: { runNow(): unknown }[]) => {
      sqlite.exec("BEGIN");
      try {
        for (const s of statements) s.runNow();
        sqlite.exec("COMMIT");
      } catch (error) {
        sqlite.exec("ROLLBACK");
        throw error;
      }
    },
  };
  return { db: db as unknown as D1Database, sqlite };
}

/** Applies the D1 migrations a file has not seen yet, in name order. */
function migrate(sqlite: DatabaseSync) {
  sqlite.exec("CREATE TABLE IF NOT EXISTS applied_migrations (name TEXT PRIMARY KEY)");
  const applied = new Set(sqlite.prepare("SELECT name FROM applied_migrations").all().map((r) => String(r.name)));
  for (const file of readdirSync(MIGRATIONS).sort()) {
    if (!file.endsWith(".sql") || applied.has(file)) continue;
    sqlite.exec("BEGIN");
    sqlite.exec(readFileSync(join(MIGRATIONS, file), "utf8"));
    sqlite.prepare("INSERT INTO applied_migrations (name) VALUES (?)").run(file);
    sqlite.exec("COMMIT");
  }
}
