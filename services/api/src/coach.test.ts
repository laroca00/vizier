import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { createApp } from "./app.ts";
import { summarize, type CoachMatch, type CoachParticipant, type Timeline } from "./coach.ts";
import type { RiotClient } from "./riot/client.ts";
import { MemoryStore } from "./store.ts";

const ME = "m".repeat(78);
const THEM = "t".repeat(78);

function player(puuid: string, participantId: number, teamId: number, championName: string, win: boolean): CoachParticipant {
  return {
    puuid,
    participantId,
    teamId,
    championName,
    teamPosition: "MIDDLE",
    win,
    kills: 3,
    deaths: 6,
    assists: 4,
    totalMinionsKilled: 180,
    neutralMinionsKilled: 0,
    goldEarned: 10_000,
    totalDamageDealtToChampions: 15_000,
    visionScore: 12,
    wardsPlaced: 8,
    wardsKilled: 1,
  };
}

const match: CoachMatch = {
  metadata: { matchId: "TR1_5" },
  info: { gameDuration: 1800, queueId: 420, participants: [player(ME, 1, 100, "Ahri", false), player(THEM, 6, 200, "Zed", true)] },
};

const frame = (minuteIndex: number, myGold: number, theirGold: number) => ({
  timestamp: minuteIndex * 60_000,
  participantFrames: {
    "1": { totalGold: myGold, xp: 1000, minionsKilled: 10 * minuteIndex, jungleMinionsKilled: 0, level: 5 },
    "6": { totalGold: theirGold, xp: 1200, minionsKilled: 9 * minuteIndex, jungleMinionsKilled: 0, level: 6 },
  },
  events: [] as Timeline["info"]["frames"][number]["events"],
});

const timeline: Timeline = {
  info: {
    frames: Array.from({ length: 21 }, (_, m) => {
      const f = frame(m, 500 + m * 300, 500 + m * 350);
      if (m === 7) f.events.push({ type: "CHAMPION_KILL", timestamp: 7 * 60_000 + 12_000, killerId: 6, victimId: 1, assistingParticipantIds: [7], position: { x: 7400, y: 7400 } });
      if (m === 12) f.events.push({ type: "ELITE_MONSTER_KILL", timestamp: 12 * 60_000, monsterType: "DRAGON", killerTeamId: 200 });
      if (m === 14) f.events.push({ type: "BUILDING_KILL", timestamp: 14 * 60_000, buildingType: "TOWER_BUILDING", teamId: 200 });
      return f;
    }),
  },
};

describe("summarize", () => {
  it("compares the lane and lists deaths and objectives", () => {
    const summary = summarize(match, timeline, ME)!;
    expect(summary.laneOpponent?.champion).toBe("Zed");
    expect(summary.laneSnapshots.find((s) => s.minute === 10)).toEqual({ minute: 10, cs: 100, goldDiff: -500, xpDiff: -200, csDiff: 10 });
    expect(summary.deaths).toEqual([{ minute: 7.2, killer: "Zed", enemiesInvolved: 2, where: "orta bölge, nehir" }]);
    expect(summary.objectives).toEqual([
      { minute: 12, what: "DRAGON", takenByUs: false },
      { minute: 14, what: "TOWER", takenByUs: true },
    ]);
  });

  it("returns null for a player not in the match", () => {
    expect(summarize(match, timeline, "x".repeat(78))).toBeNull();
  });
});

describe("POST /v1/coach/:matchId", () => {
  function setup(allowed = [ME], dailyLimit = 20) {
    const riot = {
      get: async (_r: string, _m: string, path: string) => (path.endsWith("/timeline") ? timeline : path.endsWith("TR1_5") ? match : null),
    } as unknown as RiotClient;
    let calls = 0;
    const client = {
      beta: {
        messages: {
          parse: async () => {
            calls++;
            return { stop_reason: "end_turn", parsed_output: { headline: "Koridor erken kaybedildi.", points: [] } };
          },
        },
      },
    } as unknown as Anthropic;
    const app = createApp(riot, new MemoryStore(), undefined, { client, allowedPuuids: new Set(allowed), dailyLimit });
    const post = (puuid = ME, id = "TR1_5") =>
      app.request(`/v1/coach/${id}`, { method: "POST", body: JSON.stringify({ puuid }), headers: { "content-type": "application/json" } });
    return { app, post, calls: () => calls };
  }

  it("coaches an allowed player once and serves the cached result after", async () => {
    const { post, calls } = setup();
    const first = await post();
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({ headline: "Koridor erken kaybedildi.", points: [] });
    await post();
    expect(calls()).toBe(1);
  });

  it("refuses accounts outside the allow list", async () => {
    const { post, calls } = setup([THEM]);
    expect((await post()).status).toBe(403);
    expect(calls()).toBe(0);
  });

  it("stops at the daily limit", async () => {
    const { post } = setup([ME, THEM], 1);
    expect((await post(ME)).status).toBe(200);
    expect((await post(THEM)).status).toBe(429);
  });

  it("answers 503 when coaching is not configured", async () => {
    const riot = { get: async () => null } as unknown as RiotClient;
    const app = createApp(riot, new MemoryStore());
    const response = await app.request("/v1/coach/TR1_5", { method: "POST", body: JSON.stringify({ puuid: ME }) });
    expect(response.status).toBe(503);
  });
});
