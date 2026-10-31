/** In-memory LRU with an optional TTL per entry. */
export class Cache<T> {
  private entries = new Map<string, { value: T; expiresAt: number }>();
  private maxEntries: number;
  private now: () => number;

  constructor(maxEntries: number, now: () => number = Date.now) {
    this.maxEntries = maxEntries;
    this.now = now;
  }

  get(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= this.now()) {
      this.entries.delete(key);
      return undefined;
    }
    // Re-insert so iteration order tracks recency.
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value;
  }

  set(key: string, value: T, ttlMs = Infinity) {
    this.entries.delete(key);
    this.entries.set(key, { value, expiresAt: this.now() + ttlMs });
    if (this.entries.size > this.maxEntries) {
      this.entries.delete(this.entries.keys().next().value!);
    }
  }
}
