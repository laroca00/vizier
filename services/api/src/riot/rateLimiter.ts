type Window = { max: number; windowMs: number; count: number; resetAt: number };

/** Parses Riot's `count:seconds` lists, e.g. `20:1,100:120`. */
export function parseLimits(header: string | null): { value: number; seconds: number }[] {
  if (!header) return [];
  return header.split(",").flatMap((part) => {
    const [value, seconds] = part.split(":").map(Number);
    return Number.isFinite(value) && Number.isFinite(seconds) && seconds > 0 ? [{ value, seconds }] : [];
  });
}

class Bucket {
  windows: Window[] = [];
  blockedUntil = 0;
  /** Fraction of each limit this bucket may use. */
  share = 1;

  setLimits(header: string | null, counts: string | null, now: number) {
    const limits = parseLimits(header).map(({ value, seconds }) => ({ value: Math.max(1, Math.floor(value * this.share)), seconds }));
    if (limits.length === 0) return;
    const used = new Map(parseLimits(counts).map((c) => [c.seconds, c.value]));
    this.windows = limits.map(({ value, seconds }) => {
      const windowMs = seconds * 1000;
      const existing = this.windows.find((w) => w.windowMs === windowMs);
      const window = existing ?? { max: value, windowMs, count: 0, resetAt: now + windowMs };
      window.max = value;
      // Riot's count includes requests other instances made with the same key.
      window.count = Math.max(window.count, used.get(seconds) ?? 0);
      return window;
    });
  }

  waitMs(now: number): number {
    let wait = Math.max(0, this.blockedUntil - now);
    for (const w of this.windows) {
      if (w.resetAt > now && w.count >= w.max) wait = Math.max(wait, w.resetAt - now);
    }
    return wait;
  }

  take(now: number) {
    for (const w of this.windows) {
      if (w.resetAt <= now) {
        w.count = 0;
        w.resetAt = now + w.windowMs;
      }
      w.count++;
    }
  }
}

export type Clock = { now(): number; sleep(ms: number): Promise<void> };

export const systemClock: Clock = {
  now: () => Date.now(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

/**
 * Keeps Riot's app and method limits per routing value (tr1 and europe are
 * counted separately) and waits before a request would exceed them.
 */
export class RateLimiter {
  private buckets = new Map<string, Bucket>();
  private clock: Clock;
  private defaultAppLimits: string;
  private appShare: number;

  /**
   * `appShare` below 1 leaves the rest of the key's app limit to other users
   * of the same key; Riot's counts include their requests, so the share holds.
   */
  constructor(options: { appLimits?: string; appShare?: number; clock?: Clock } = {}) {
    this.clock = options.clock ?? systemClock;
    // Development key limits, used until Riot's headers report the real ones.
    this.defaultAppLimits = options.appLimits ?? "20:1,100:120";
    this.appShare = options.appShare ?? 1;
  }

  private bucket(key: string): Bucket {
    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = new Bucket();
      if (key.startsWith("app:")) {
        bucket.share = this.appShare;
        bucket.setLimits(this.defaultAppLimits, null, this.clock.now());
      }
      this.buckets.set(key, bucket);
    }
    return bucket;
  }

  async acquire(routing: string, method: string) {
    const buckets = [this.bucket(`app:${routing}`), this.bucket(`method:${routing}:${method}`)];
    for (;;) {
      const now = this.clock.now();
      const wait = Math.max(...buckets.map((b) => b.waitMs(now)));
      if (wait === 0) {
        for (const b of buckets) b.take(now);
        return;
      }
      await this.clock.sleep(wait);
    }
  }

  update(routing: string, method: string, headers: Headers) {
    const now = this.clock.now();
    this.bucket(`app:${routing}`).setLimits(
      headers.get("x-app-rate-limit"),
      headers.get("x-app-rate-limit-count"),
      now,
    );
    this.bucket(`method:${routing}:${method}`).setLimits(
      headers.get("x-method-rate-limit"),
      headers.get("x-method-rate-limit-count"),
      now,
    );
  }

  /** After a 429 that names our app or method as the cause. */
  block(routing: string, method: string, scope: "application" | "method", ms: number) {
    const key = scope === "application" ? `app:${routing}` : `method:${routing}:${method}`;
    const bucket = this.bucket(key);
    bucket.blockedUntil = Math.max(bucket.blockedUntil, this.clock.now() + ms);
  }
}
