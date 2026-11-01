import { Cache } from "./cache.ts";
import { patchOf, type Match } from "./riot/types.ts";

export interface Store {
  getCached<T>(key: string): Promise<T | undefined>;
  putCached(key: string, value: unknown, ttlMs: number): Promise<void>;
  getMatch(matchId: string): Promise<Match | undefined>;
  putMatch(match: Match): Promise<void>;
}

export class MemoryStore implements Store {
  private cache = new Cache<unknown>(10_000);
  private matches = new Cache<Match>(5_000);

  async getCached<T>(key: string) {
    return this.cache.get(key) as T | undefined;
  }

  async putCached(key: string, value: unknown, ttlMs: number) {
    this.cache.set(key, value, ttlMs);
  }

  async getMatch(matchId: string) {
    return this.matches.get(matchId);
  }

  async putMatch(match: Match) {
    this.matches.set(match.metadata.matchId, match);
  }
}

/**
 * Cache and match writes only save work later. When D1 refuses them (the
 * free plan's daily write limit, say) the answer still goes out.
 */
async function bestEffort(write: Promise<unknown>) {
  try {
    await write;
  } catch (error) {
    console.error(`store write skipped: ${error instanceof Error ? error.message : error}`);
  }
}

export class D1Store implements Store {
  private db: D1Database;
  private now: () => number;

  constructor(db: D1Database, now: () => number = Date.now) {
    this.db = db;
    this.now = now;
  }

  async getCached<T>(key: string) {
    const row = await this.db
      .prepare("SELECT value FROM cache WHERE key = ? AND expires_at > ?")
      .bind(key, this.now())
      .first<{ value: string }>();
    return row ? (JSON.parse(row.value) as T) : undefined;
  }

  async putCached(key: string, value: unknown, ttlMs: number) {
    // D1 stores Infinity as NULL, which the NOT NULL column rejects.
    const expiresAt = Number.isFinite(ttlMs) ? this.now() + ttlMs : Number.MAX_SAFE_INTEGER;
    await bestEffort(
      this.db.prepare("INSERT OR REPLACE INTO cache (key, value, expires_at) VALUES (?, ?, ?)").bind(key, JSON.stringify(value), expiresAt).run(),
    );
  }

  async getMatch(matchId: string) {
    const row = await this.db
      .prepare("SELECT data FROM matches WHERE match_id = ?")
      .bind(matchId)
      .first<{ data: string }>();
    return row ? (JSON.parse(row.data) as Match) : undefined;
  }

  async putMatch(match: Match) {
    const { matchId } = match.metadata;
    const { info } = match;
    const participant = this.db.prepare(
      "INSERT OR IGNORE INTO match_participants (match_id, puuid, champion_id, team_position, win) VALUES (?, ?, ?, ?, ?)",
    );
    await bestEffort(this.db.batch([
      this.db
        .prepare(
          "INSERT OR IGNORE INTO matches (match_id, patch, queue_id, game_start, data, fetched_at) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind(matchId, patchOf(info.gameVersion), info.queueId, info.gameStartTimestamp, JSON.stringify(match), this.now()),
      ...info.participants.map((p) =>
        participant.bind(matchId, p.puuid, p.championId, p.teamPosition, p.win ? 1 : 0),
      ),
    ]));
  }

  /** Expired cache rows are only skipped on read; this clears them out. */
  async purgeExpired() {
    await this.db.prepare("DELETE FROM cache WHERE expires_at <= ?").bind(this.now()).run();
  }
}
