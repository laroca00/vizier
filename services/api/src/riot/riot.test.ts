import { describe, expect, it } from "vitest";
import { RiotClient, RiotError } from "./client.ts";
import { RateLimiter, parseLimits, type Clock } from "./rateLimiter.ts";

function fakeClock(): Clock & { t: number; slept: number[] } {
  const clock = {
    t: 0,
    slept: [] as number[],
    now: () => clock.t,
    sleep: async (ms: number) => {
      clock.slept.push(ms);
      clock.t += ms;
    },
  };
  return clock;
}

function respond(status: number, body: unknown = {}, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers });
}

describe("parseLimits", () => {
  it("reads Riot's limit lists", () => {
    expect(parseLimits("20:1,100:120")).toEqual([
      { value: 20, seconds: 1 },
      { value: 100, seconds: 120 },
    ]);
    expect(parseLimits(null)).toEqual([]);
    expect(parseLimits("junk")).toEqual([]);
  });
});

describe("RateLimiter", () => {
  it("waits for the window once the app limit is used up", async () => {
    const clock = fakeClock();
    const limiter = new RateLimiter({ appLimits: "2:1", clock });
    await limiter.acquire("tr1", "m");
    await limiter.acquire("tr1", "m");
    expect(clock.slept).toEqual([]);
    await limiter.acquire("tr1", "m");
    expect(clock.slept).toEqual([1000]);
  });

  it("keeps the rest of the key's limit for others with a share", async () => {
    const clock = fakeClock();
    const limiter = new RateLimiter({ appLimits: "10:1", appShare: 0.5, clock });
    for (let i = 0; i < 5; i++) await limiter.acquire("europe", "m");
    expect(clock.slept).toEqual([]);
    await limiter.acquire("europe", "m");
    expect(clock.slept).toEqual([1000]);
  });

  it("counts routing values separately", async () => {
    const clock = fakeClock();
    const limiter = new RateLimiter({ appLimits: "1:1", clock });
    await limiter.acquire("tr1", "m");
    await limiter.acquire("europe", "m");
    expect(clock.slept).toEqual([]);
  });

  it("adopts counts reported by Riot", async () => {
    const clock = fakeClock();
    const limiter = new RateLimiter({ appLimits: "5:1", clock });
    await limiter.acquire("tr1", "m");
    limiter.update("tr1", "m", new Headers({ "x-app-rate-limit": "5:1", "x-app-rate-limit-count": "5:1" }));
    await limiter.acquire("tr1", "m");
    expect(clock.slept).toEqual([1000]);
  });

  it("applies method limits per endpoint", async () => {
    const clock = fakeClock();
    const limiter = new RateLimiter({ appLimits: "100:1", clock });
    limiter.update("tr1", "a", new Headers({ "x-method-rate-limit": "1:10", "x-method-rate-limit-count": "1:10" }));
    await limiter.acquire("tr1", "b");
    expect(clock.slept).toEqual([]);
    await limiter.acquire("tr1", "a");
    expect(clock.slept).toEqual([10_000]);
  });
});

describe("RiotClient", () => {
  function client(responses: Response[]) {
    const clock = fakeClock();
    const calls: { url: string; token: string | null }[] = [];
    const fetch = (async (url: string, init?: RequestInit) => {
      calls.push({ url, token: new Headers(init?.headers).get("x-riot-token") });
      return responses.shift()!;
    }) as typeof globalThis.fetch;
    return { riot: new RiotClient({ apiKey: "RGAPI-test", fetch, clock }), calls, clock };
  }

  it("sends the key and returns JSON", async () => {
    const { riot, calls } = client([respond(200, { puuid: "p" })]);
    expect(await riot.get("europe", "m", "/path")).toEqual({ puuid: "p" });
    expect(calls).toEqual([{ url: "https://europe.api.riotgames.com/path", token: "RGAPI-test" }]);
  });

  it("returns null on 404", async () => {
    const { riot } = client([respond(404)]);
    expect(await riot.get("tr1", "m", "/path")).toBeNull();
  });

  it("waits Retry-After on 429 and retries", async () => {
    const { riot, clock } = client([
      respond(429, {}, { "retry-after": "3", "x-rate-limit-type": "application" }),
      respond(200, { ok: true }),
    ]);
    expect(await riot.get("tr1", "m", "/path")).toEqual({ ok: true });
    expect(clock.slept).toContain(3000);
  });

  it("backs off on 5xx and gives up after four attempts", async () => {
    const { riot, calls } = client([respond(503), respond(503), respond(503), respond(503)]);
    await expect(riot.get("tr1", "m", "/path")).rejects.toBeInstanceOf(RiotError);
    expect(calls).toHaveLength(4);
  });

  it("does not retry other errors", async () => {
    const { riot, calls } = client([respond(403)]);
    await expect(riot.get("tr1", "m", "/path")).rejects.toMatchObject({ status: 403 });
    expect(calls).toHaveLength(1);
  });
});
