import { createHash } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import type { Remote } from "./publish.ts";

const MATCH_COLUMNS = [
  "match_id", "puuid", "player", "team", "platform", "patch", "game_start", "duration", "champion_id", "opponent_champion_id",
  "team_position", "win", "kills", "deaths", "assists", "cs", "gold", "runes", "spells", "items", "start_items", "skill_order",
  "purchase_order", "grp",
];
const ACCOUNT_COLUMNS = ["puuid", "player", "team", "role", "platform", "riot_id", "grp"];
// D1 binds at most 100 parameters a statement.
const rowsPer = (columns: string[]) => Math.floor(100 / columns.length);

function state(sqlite: DatabaseSync, key: string): string | null {
  sqlite.exec("CREATE TABLE IF NOT EXISTS publish_state (key TEXT PRIMARY KEY, value TEXT NOT NULL)");
  const row = sqlite.prepare("SELECT value FROM publish_state WHERE key = ?").get(key);
  return row ? String(row.value) : null;
}

const setState = (sqlite: DatabaseSync, key: string, value: string) =>
  sqlite.prepare("INSERT OR REPLACE INTO publish_state (key, value) VALUES (?, ?)").run(key, value);

async function insert(remote: Remote, table: string, columns: string[], rows: Record<string, unknown>[], verb = "INSERT OR IGNORE") {
  const size = rowsPer(columns);
  for (let i = 0; i < rows.length; i += size) {
    const group = rows.slice(i, i + size);
    const values = group.map(() => `(${columns.map(() => "?").join(", ")})`).join(", ");
    await remote.query(`${verb} INTO ${table} (${columns.join(", ")}) VALUES ${values}`, group.flatMap((r) => columns.map((c) => r[c] ?? null)));
  }
}

/**
 * Sends pro games saved since the last run, and the account list when it
 * changed. The Worker reads both for the pro builds page.
 */
export async function publishPros(sqlite: DatabaseSync, remote: Remote) {
  const from = Number(state(sqlite, "pro_matches") ?? 0);
  const matches = sqlite
    .prepare(`SELECT rowid, ${MATCH_COLUMNS.join(", ")} FROM pro_matches WHERE rowid > ? ORDER BY rowid`)
    .all(from) as Record<string, unknown>[];
  // Games arrive in rowid order, so the watermark moves after each statement succeeds.
  const size = rowsPer(MATCH_COLUMNS);
  for (let i = 0; i < matches.length; i += size) {
    const group = matches.slice(i, i + size);
    await insert(remote, "pro_matches", MATCH_COLUMNS, group);
    setState(sqlite, "pro_matches", String(group[group.length - 1].rowid));
  }

  const accounts = sqlite.prepare(`SELECT ${ACCOUNT_COLUMNS.join(", ")} FROM pro_accounts ORDER BY puuid`).all() as Record<string, unknown>[];
  const hash = createHash("sha1").update(JSON.stringify(accounts)).digest("hex");
  let accountsSent = false;
  if (accounts.length > 0 && hash !== state(sqlite, "pro_accounts")) {
    // Challengers come and go daily; the remote list is replaced, not merged.
    await remote.query("DELETE FROM pro_accounts", []);
    await insert(remote, "pro_accounts", ACCOUNT_COLUMNS, accounts, "INSERT OR REPLACE");
    setState(sqlite, "pro_accounts", hash);
    accountsSent = true;
  }
  return { games: matches.length, accounts: accountsSent ? accounts.length : 0 };
}
