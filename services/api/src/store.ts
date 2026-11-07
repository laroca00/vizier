import { Cache } from "./cache.ts";

export interface Store {
  getCached<T>(key: string): Promise<T | undefined>;
  putCached(key: string, value: unknown, ttlMs: number): Promise<void>;
}

export class MemoryStore implements Store {
  private cache = new Cache<unknown>(10_000);

  async getCached<T>(key: string) {
    return this.cache.get(key) as T | undefined;
  }

  async putCached(key: string, value: unknown, ttlMs: number) {
    this.cache.set(key, value, ttlMs);
  }
}

/**
 * Cache writes only save work later. When D1 refuses them (the
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

  /** Expired cache rows are only skipped on read; this clears them out. */
  async purgeExpired() {
    await this.db.prepare("DELETE FROM cache WHERE expires_at <= ?").bind(this.now()).run();
  }
}
