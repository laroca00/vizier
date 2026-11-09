import { createHash } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { DEFAULT_BRACKET, type Bracket } from "@vizier/shared/brackets";
import { nextExtra, scopeName, type ExtraScope } from "../../api/src/publishPlan.ts";
import { isOtherQueueKey, statDocs } from "../../api/src/statDocs.ts";

// D1 binds at most 100 parameters a statement, three per doc here.
const DOCS_PER_STATEMENT = 33;
// D1 also caps a statement's size; a doc bigger than this goes on its own.
const BYTES_PER_STATEMENT = 90_000;

export type Remote = { query(sql: string, params: unknown[]): Promise<void> };

type Doc = { key: string; body: string; hash: string };

/**
 * Sends the docs that changed since the last publish. A doc is marked as
 * published only once its statement succeeded, so a failed run resends it.
 */
export type Scope = { bracket: Bracket; only?: "ranked" | "other" };

export async function publish(db: D1Database, sqlite: DatabaseSync, remote: Remote, now = Date.now(), scope: Scope = { bracket: DEFAULT_BRACKET }) {
  sqlite.exec("CREATE TABLE IF NOT EXISTS published_docs (key TEXT PRIMARY KEY, hash TEXT NOT NULL)");
  const known = new Map(sqlite.prepare("SELECT key, hash FROM published_docs").all().map((r) => [String(r.key), String(r.hash)]));

  const changed: Doc[] = [];
  let total = 0;
  for await (const [key, value] of statDocs(db, scope.bracket, { regions: scope.only !== "ranked" })) {
    if (value === null) continue;
    if (scope.only && isOtherQueueKey(key) !== (scope.only === "other")) continue;
    total++;
    const body = JSON.stringify(value);
    const hash = createHash("sha1").update(body).digest("hex");
    if (known.get(key) !== hash) changed.push({ key, body, hash });
  }

  const mark = sqlite.prepare("INSERT OR REPLACE INTO published_docs (key, hash) VALUES (?, ?)");
  for (const group of statements(changed)) {
    const values = group.map(() => "(?, ?, ?)").join(", ");
    await remote.query(
      `INSERT INTO stat_docs (key, body, updated_at) VALUES ${values}
        ON CONFLICT (key) DO UPDATE SET body = excluded.body, updated_at = excluded.updated_at`,
      group.flatMap((d) => [d.key, d.body, now]),
    );
    for (const d of group) mark.run(d.key, d.hash);
  }
  return { total, sent: changed.length };
}

function* statements(docs: Doc[]): Generator<Doc[]> {
  let group: Doc[] = [];
  let bytes = 0;
  for (const doc of docs) {
    if (group.length > 0 && (group.length === DOCS_PER_STATEMENT || bytes + doc.body.length > BYTES_PER_STATEMENT)) {
      yield group;
      group = [];
      bytes = 0;
    }
    group.push(doc);
    bytes += doc.body.length;
  }
  if (group.length > 0) yield group;
}

function lastRun(sqlite: DatabaseSync, name: string): number | undefined {
  sqlite.exec("CREATE TABLE IF NOT EXISTS publish_state (key TEXT PRIMARY KEY, value TEXT NOT NULL)");
  const row = sqlite.prepare("SELECT value FROM publish_state WHERE key = ?").get(`extra:${name}`);
  return row ? Number(row.value) : undefined;
}

const extraScope = (extra: ExtraScope): Scope =>
  extra.kind === "other" ? { bracket: DEFAULT_BRACKET, only: "other" } : { bracket: extra.bracket, only: "ranked" };

/**
 * One scheduled publish: Emerald+ ranked docs, then at most one extra set (see
 * publishPlan.ts). The extra is marked done only after it went out.
 */
export async function publishTick(db: D1Database, sqlite: DatabaseSync, remote: Remote, now = Date.now()) {
  const main = await publish(db, sqlite, remote, now, { bracket: DEFAULT_BRACKET, only: "ranked" });
  const extra = nextExtra((name) => lastRun(sqlite, name), now);
  if (!extra) return { ...main, extra: null as string | null };
  const sent = await publish(db, sqlite, remote, now, extraScope(extra));
  sqlite.prepare("INSERT OR REPLACE INTO publish_state (key, value) VALUES (?, ?)").run(`extra:${scopeName(extra)}`, String(now));
  return { total: main.total + sent.total, sent: main.sent + sent.sent, extra: scopeName(extra) as string | null };
}
