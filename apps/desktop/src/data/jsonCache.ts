// Data Dragon files never change within a version, so they are kept in
// IndexedDB under the version and pages open without a network round trip
// after the first run. Every failure falls back to the network.

export interface JsonStore {
  get(key: string): Promise<string | undefined>;
  set(key: string, body: string): Promise<void>;
  keys(): Promise<string[]>;
  delete(key: string): Promise<void>;
}

export function memoryStore(): JsonStore {
  const map = new Map<string, string>();
  return {
    get: async (key) => map.get(key),
    set: async (key, body) => void map.set(key, body),
    keys: async () => [...map.keys()],
    delete: async (key) => void map.delete(key),
  };
}

const DB = "vizier-ddragon";
const STORE = "files";

function request<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

export function indexedDbStore(): JsonStore | null {
  if (typeof indexedDB === "undefined") return null;
  let opened: Promise<IDBDatabase> | undefined;
  const open = () =>
    (opened ??= new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(STORE);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    }));
  const store = async (mode: IDBTransactionMode) => (await open()).transaction(STORE, mode).objectStore(STORE);
  return {
    get: async (key) => (await request((await store("readonly")).get(key))) as string | undefined,
    set: async (key, body) => void (await request((await store("readwrite")).put(body, key))),
    keys: async () => (await request((await store("readonly")).getAllKeys())) as string[],
    delete: async (key) => void (await request((await store("readwrite")).delete(key))),
  };
}

/** Keys are "<version>/<path>", so a new version leaves the old files to be swept. */
export async function sweepOldVersions(store: JsonStore, version: string) {
  for (const key of await store.keys()) if (!key.startsWith(`${version}/`) && !key.startsWith("meta/")) await store.delete(key);
}

/**
 * The parsed file for this version, from the store when it is there. The raw
 * body is stored so a cache hit costs one parse, like a network answer.
 */
export async function cachedJson(store: JsonStore | null, version: string, path: string, load: () => Promise<string>): Promise<unknown> {
  const key = `${version}/${path}`;
  if (store) {
    try {
      const hit = await store.get(key);
      if (hit !== undefined) return JSON.parse(hit);
    } catch {
      /* unreadable cache: go to the network */
    }
  }
  const body = await load();
  const parsed = JSON.parse(body);
  if (store) {
    store
      .set(key, body)
      .then(() => sweepOldVersions(store, version))
      .catch(() => {});
  }
  return parsed;
}
