import { RateLimiter, systemClock, type Clock } from "./rateLimiter.ts";

/** Platforms Vizier reads from: TR and EUW players, and KR and NA for pros. */
export type Platform = "tr1" | "euw1" | "kr" | "na1";
export type Region = "europe" | "asia" | "americas";
export type Routing = Platform | Region;

export const PLATFORMS: Platform[] = ["tr1", "euw1", "kr", "na1"];

const HOSTS: Record<Routing, string> = {
  tr1: "https://tr1.api.riotgames.com",
  euw1: "https://euw1.api.riotgames.com",
  kr: "https://kr.api.riotgames.com",
  na1: "https://na1.api.riotgames.com",
  europe: "https://europe.api.riotgames.com",
  asia: "https://asia.api.riotgames.com",
  americas: "https://americas.api.riotgames.com",
};

/** match-v5 lives on the regional host of the platform. */
export function regionOf(platform: Platform): Region {
  return platform === "kr" ? "asia" : platform === "na1" ? "americas" : "europe";
}

/** Match ids start with their platform: "TR1_123", "KR_456". */
export const MATCH_ID = /^(TR1|EUW1|KR|NA1)_\d+$/;

export function regionOfMatch(matchId: string): Region {
  return regionOf(matchId.split("_")[0].toLowerCase() as Platform);
}

const MAX_ATTEMPTS = 4;

export class RiotError extends Error {
  readonly status: number;
  constructor(status: number, path: string) {
    super(`Riot API ${status} for ${path}`);
    this.status = status;
  }
}

type Options = {
  apiKey: string;
  fetch?: typeof fetch;
  limiter?: RateLimiter;
  clock?: Clock;
};

export class RiotClient {
  private apiKey: string;
  private fetch: typeof fetch;
  private limiter: RateLimiter;
  private clock: Clock;

  constructor(options: Options) {
    this.apiKey = options.apiKey;
    // Workers reject fetch called with any `this` other than the global scope.
    this.fetch = options.fetch ?? fetch.bind(globalThis);
    this.clock = options.clock ?? systemClock;
    this.limiter = options.limiter ?? new RateLimiter({ clock: this.clock });
  }

  /**
   * `method` is the endpoint's path template; Riot counts method limits per
   * endpoint, not per URL. Resolves to null on 404, which is often a normal
   * answer (no ranked entry, no active game).
   */
  async get<T>(routing: Routing, method: string, path: string): Promise<T | null> {
    for (let attempt = 1; ; attempt++) {
      await this.limiter.acquire(routing, method);
      const response = await this.fetch(`${HOSTS[routing]}${path}`, {
        headers: { "X-Riot-Token": this.apiKey },
      });
      this.limiter.update(routing, method, response.headers);

      if (response.ok) return (await response.json()) as T;
      if (response.status === 404) return null;

      const retryable = response.status === 429 || response.status >= 500;
      if (!retryable || attempt >= MAX_ATTEMPTS) throw new RiotError(response.status, method);

      if (response.status === 429) {
        const seconds = Number(response.headers.get("retry-after"));
        const waitMs = Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 1000;
        const type = response.headers.get("x-rate-limit-type");
        // A "service" limit is Riot under load, not us over budget: wait, but
        // don't hold back other requests.
        if (type === "application" || type === "method") this.limiter.block(routing, method, type, waitMs);
        else await this.clock.sleep(waitMs);
      } else {
        const backoff = 500 * 2 ** (attempt - 1);
        await this.clock.sleep(backoff + Math.random() * backoff);
      }
    }
  }
}
