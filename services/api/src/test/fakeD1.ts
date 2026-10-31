import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

const MIGRATIONS = join(import.meta.dirname, "../../migrations");

/** Just enough of D1's API over node:sqlite to run the real migrations and queries. */
export function fakeD1() {
  const sqlite = new DatabaseSync(":memory:");
  for (const file of readdirSync(MIGRATIONS).sort()) sqlite.exec(readFileSync(join(MIGRATIONS, file), "utf8"));
  const statement = (sql: string, params: unknown[] = []) => ({
    bind: (...values: unknown[]) => statement(sql, values),
    first: async () => sqlite.prepare(sql).get(...(params as never[])) ?? null,
    all: async () => ({ results: sqlite.prepare(sql).all(...(params as never[])) }),
    run: async () => sqlite.prepare(sql).run(...(params as never[])),
  });
  const db = {
    prepare: (sql: string) => statement(sql),
    batch: async (statements: { run(): Promise<unknown> }[]) => {
      sqlite.exec("BEGIN");
      for (const s of statements) await s.run();
      sqlite.exec("COMMIT");
    },
  };
  return { db: db as unknown as D1Database, sqlite };
}
