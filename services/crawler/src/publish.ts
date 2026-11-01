import { createHash } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { statDocs } from "../../api/src/statDocs.ts";

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
export async function publish(db: D1Database, sqlite: DatabaseSync, remote: Remote, now = Date.now()) {
  sqlite.exec("CREATE TABLE IF NOT EXISTS published_docs (key TEXT PRIMARY KEY, hash TEXT NOT NULL)");
  const known = new Map(sqlite.prepare("SELECT key, hash FROM published_docs").all().map((r) => [String(r.key), String(r.hash)]));

  const changed: Doc[] = [];
  let total = 0;
  for await (const [key, value] of statDocs(db)) {
    if (value === null) continue;
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
