import { describe, expect, it } from "vitest";
import { Crawler } from "../../api/src/crawler.ts";
import type { RiotClient } from "../../api/src/riot/client.ts";
import type { Match, Participant } from "../../api/src/riot/types.ts";
import { emptyCatalog } from "../../api/src/archetypes.ts";
import { rollup } from "../../api/src/rollup.ts";
import { sqliteD1 } from "../../api/src/sqliteD1.ts";
import { publish, publishTick } from "./publish.ts";
import { nextExtra, scopeName } from "../../api/src/publishPlan.ts";

const perks = {
  statPerks: { offense: 5008, flex: 5008, defense: 5011 },
  styles: [
    { description: "primaryStyle", style: 8100, selections: [{ perk: 8112 }, { perk: 8143 }, { perk: 8138 }, { perk: 8106 }] },
    { description: "subStyle", style: 8300, selections: [{ perk: 8345 }, { perk: 8347 }] },
  ],
};

const player = (id: number, teamId: number, championId: number, win: boolean): Participant => ({
  puuid: `p${id}`, participantId: id, teamId, championId, teamPosition: "MIDDLE", win,
  totalMinionsKilled: 200, neutralMinionsKilled: 0, summoner1Id: 4, summoner2Id: 14, item0: 3157, perks,
});

async function seeded(from: number, count: number, db = sqliteD1()) {
  const crawler = new Crawler(db.db, { get: async () => null } as unknown as RiotClient);
  for (let n = from; n < from + count; n++) {
    const match: Match = {
      metadata: { matchId: `TR1_${n}`, participants: [] },
      info: { gameVersion: "16.21.1", queueId: 420, gameStartTimestamp: n, gameDuration: 1800, participants: [player(1, 100, 103, n % 3 > 0), player(6, 200, 238, n % 3 === 0)] },
    };
    await crawler.save(match);
  }
  await rollup(db.db, async () => emptyCatalog());
  return db;
}

function fakeRemote() {
  const statements: { sql: string; params: unknown[] }[] = [];
  return { statements, query: async (sql: string, params: unknown[]) => void statements.push({ sql, params }) };
}

describe("publish", () => {
  it("sends every doc once, then only the ones that changed", async () => {
    const local = await seeded(1, 12);
    const remote = fakeRemote();

    const first = await publish(local.db, local.sqlite, remote, 1);
    expect(first.sent).toBe(first.total);
    expect(remote.statements.every((s) => s.params.length <= 99)).toBe(true);
    const keys = remote.statements.flatMap((s) => s.params.filter((_, i) => i % 3 === 0));
    expect(keys).toContain("tierlist:420:MIDDLE");

    expect((await publish(local.db, local.sqlite, remote, 2)).sent).toBe(0);
    await seeded(13, 3, local);
    const third = await publish(local.db, local.sqlite, remote, 3);
    expect(third.sent).toBeGreaterThan(0);
    expect(third.sent).toBeLessThan(third.total);
  });

  it("resends docs whose statement failed", async () => {
    const local = await seeded(1, 12);
    const failing = { query: async () => Promise.reject(new Error("D1 is down")) };
    await expect(publish(local.db, local.sqlite, failing, 1)).rejects.toThrow("D1 is down");
    const remote = fakeRemote();
    const retry = await publish(local.db, local.sqlite, remote, 2);
    expect(retry.sent).toBe(retry.total);
  });
});

const HOUR = 3_600_000;

describe("publish schedule", () => {
  it("picks the extra set waiting longest, once a day each", () => {
    const last = new Map<string, number>();
    const seen: string[] = [];
    // Six publishes four hours apart: five brackets and the other queues, none twice.
    for (let tick = 0; tick < 6; tick++) {
      const extra = nextExtra((name) => last.get(name), tick * 4 * HOUR);
      expect(extra).not.toBeNull();
      last.set(scopeName(extra!), tick * 4 * HOUR);
      seen.push(scopeName(extra!));
    }
    expect(new Set(seen).size).toBe(6);
    // The next day starts the rotation again, oldest first.
    expect(scopeName(nextExtra((name) => last.get(name), 24 * HOUR)!)).toBe(seen[0]);
    // Nothing is due before a full day has passed.
    expect(nextExtra((name) => last.get(name), 5 * 4 * HOUR + 1)).toBeNull();
  });

  it("sends Emerald+ ranked docs every time and one extra set a publish", async () => {
    const local = await seeded(1, 12);
    const remote = fakeRemote();
    const keysOf = () => remote.statements.flatMap((s) => s.params.filter((_, i) => i % 3 === 0 && typeof s.params[i] === "string") as string[]);

    const first = await publishTick(local.db, local.sqlite, remote, 1);
    const sentFirst = keysOf();
    expect(first.extra).not.toBeNull();
    expect(sentFirst).toContain("tierlist:420:MIDDLE");
    // Exactly one non-default set came with it.
    const suffixes = new Set(sentFirst.filter((k) => k.includes(":r=")).map((k) => k.split(":r=")[1]));
    expect(suffixes.size).toBe(1);

    // Over a day of 4-hour publishes, each of the five brackets goes out once.
    const sent = new Set<string>();
    for (let tick = 1; tick <= 6; tick++) {
      remote.statements.length = 0;
      const result = await publishTick(local.db, local.sqlite, remote, tick * 4 * HOUR);
      if (result.extra) sent.add(result.extra);
    }
    expect(sent.size).toBeGreaterThanOrEqual(5);
    expect(local.sqlite.prepare("SELECT COUNT(*) AS n FROM published_docs WHERE key LIKE '%:r=gold_minus'").get()).not.toEqual({ n: 0 });
  });

  it("keeps other-queue docs out of the ranked publish", async () => {
    const local = await seeded(1, 12);
    const remote = fakeRemote();
    await publish(local.db, local.sqlite, remote, 1, { bracket: "emerald_plus", only: "ranked" });
    const keys = remote.statements.flatMap((s) => s.params.filter((_, i) => i % 3 === 0) as string[]);
    expect(keys.some((k) => /^(augments|duos|arenaitems)/.test(k))).toBe(false);
    expect(keys).toContain("bans");
  });
});
