/** Last good result per key, so a page opened again shows data at once while it refreshes. */
export function createStaleCache(maxAgeMs: number, now: () => number = Date.now, limit = 200) {
  const entries = new Map<string, { at: number; value: unknown }>();
  return {
    get<T>(key: string): T | undefined {
      const entry = entries.get(key);
      if (!entry) return undefined;
      if (now() - entry.at > maxAgeMs) {
        entries.delete(key);
        return undefined;
      }
      return entry.value as T;
    },
    set(key: string, value: unknown) {
      entries.delete(key);
      entries.set(key, { at: now(), value });
      if (entries.size > limit) entries.delete(entries.keys().next().value as string);
    },
  };
}
