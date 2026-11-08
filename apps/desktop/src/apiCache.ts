const MIN = 60_000;

/** Tier lists and builds change when the Worker publishes (every few hours); pro games come in faster. */
export function ttlFor(path: string): number {
  if (path.startsWith("/v1/pros/builds")) return 5 * MIN;
  if (path.startsWith("/v1/tierlist") || path.startsWith("/v1/builds") || path.startsWith("/v1/champions") || path.startsWith("/v1/augments")) return 30 * MIN;
  if (path.startsWith("/v1/pros")) return 30 * MIN;
  return 5 * MIN;
}

const PREFIX = "vizier.api.";

export function cacheKey(path: string) {
  return PREFIX + path;
}

type Entry = { at: number; value: unknown };

export type CacheStore = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function createApiCache(storage: CacheStore | null, now: () => number = Date.now) {
  const memory = new Map<string, Entry>();
  const inflight = new Map<string, Promise<unknown>>();

  function read(path: string): Entry | null {
    const ttl = ttlFor(path);
    const key = cacheKey(path);
    let entry = memory.get(key) ?? null;
    if (!entry && storage) {
      try {
        const raw = storage.getItem(key);
        entry = raw ? (JSON.parse(raw) as Entry) : null;
      } catch {
        entry = null;
      }
    }
    if (!entry || typeof entry.at !== "number" || now() - entry.at >= ttl) {
      memory.delete(key);
      try {
        storage?.removeItem(key);
      } catch {
        /* storage unavailable */
      }
      return null;
    }
    memory.set(key, entry);
    return entry;
  }

  function write(path: string, value: unknown) {
    const key = cacheKey(path);
    const entry = { at: now(), value };
    memory.set(key, entry);
    try {
      storage?.setItem(key, JSON.stringify(entry));
    } catch {
      /* quota or private mode: memory copy still serves */
    }
  }

  return {
    async get<T>(path: string, load: () => Promise<T>): Promise<T> {
      const hit = read(path);
      if (hit) return hit.value as T;
      const pending = inflight.get(path);
      if (pending) return pending as Promise<T>;
      const promise = load()
        .then((value) => {
          write(path, value);
          return value;
        })
        .finally(() => inflight.delete(path));
      inflight.set(path, promise);
      return promise;
    },
  };
}
