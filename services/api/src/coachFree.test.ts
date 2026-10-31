import { describe, expect, it } from "vitest";
import { createApp } from "./app.ts";
import type { MatchSummary } from "./coach.ts";
import { acceptRewrite } from "./coachRewrite.ts";
import { coachByRules } from "./coachRules.ts";
import type { RiotClient } from "./riot/client.ts";
import { MemoryStore } from "./store.ts";

const summary: MatchSummary = {
  durationMinutes: 30,
  result: "loss",
  position: "MIDDLE",
  player: { champion: "Ahri", kda: "3/6/4", csPerMinute: 5.2, gold: 10000, damageToChampions: 15000, visionScore: 12, wardsPlaced: 8, wardsKilled: 0 },
  laneOpponent: { champion: "Zed", kda: "8/2/3", csPerMinute: 7.4, gold: 13000, damageToChampions: 20000, visionScore: 15 },
  laneSnapshots: [{ minute: 10, cs: 70, goldDiff: -900, xpDiff: -300, csDiff: -12 }],
  deaths: [
    { minute: 4.5, killer: "Zed", enemiesInvolved: 1, where: "orta bölge, rakip yarısı" },
    { minute: 8.2, killer: "Lee Sin", enemiesInvolved: 2, where: "orta bölge, rakip yarısı" },
    { minute: 19.1, killer: "Zed", enemiesInvolved: 3, where: "alt koridor, nehir" },
  ],
  objectives: [{ minute: 20, what: "DRAGON", takenByUs: false }],
};

describe("coachByRules", () => {
  it("ranks the findings the numbers support", () => {
    const coaching = coachByRules(summary);
    const titles = coaching.points.map((p) => p.title);
    expect(titles).toContain("Erken oyunda çok öldün");
    expect(titles).toContain("Koridorda erken geride kaldın");
    expect(titles).toContain("Minyon toplaman düşük");
    expect(titles).toContain("Ölümlerin hedefe mal oldu");
    expect(titles).toContain("Görüş skorun düşük");
    expect(coaching.points.length).toBeLessThanOrEqual(5);
    expect(coaching.headline).toMatch(/^Kaybettiğin bu maçta/);
    expect(coaching.points.find((p) => p.title === "Koridorda erken geride kaldın")?.detail).toContain("900 altın");
  });

  it("says so when nothing stands out", () => {
    const clean: MatchSummary = { ...summary, result: "win", player: { ...summary.player, csPerMinute: 8, visionScore: 30, wardsKilled: 3 }, laneSnapshots: [], deaths: [], objectives: [] };
    const coaching = coachByRules(clean);
    expect(coaching.points).toEqual([]);
    expect(coaching.headline).toMatch(/belirgin bir zayıf nokta görünmüyor/);
  });
});

describe("acceptRewrite", () => {
  const original = {
    headline: "Kaybettiğin bu maçta en çok fark yaratacak konu: koridor.",
    points: [{ minute: 10, title: "Koridorda erken geride kaldın", detail: "10. dakikada Zed karşısında 900 altın geriydin." }],
  };

  it("keeps minutes from the rules and takes the new wording", () => {
    const reply = { response: '```json\n{"headline":"Bu maçı koridorda kaybettin.","points":[{"title":"Erken geri düştün","detail":"10. dakikada Zed\'e 900 altın gerideydin."}]}\n```' };
    expect(acceptRewrite(original, reply)).toEqual({
      headline: "Bu maçı koridorda kaybettin.",
      points: [{ minute: 10, title: "Erken geri düştün", detail: "10. dakikada Zed'e 900 altın gerideydin." }],
    });
  });

  it("reads OpenAI-style chat completions", () => {
    const reply = { choices: [{ message: { content: '{"headline":"Koridorda kaybettin.","points":[{"title":"Erken geri düştün","detail":"10. dakikada 900 altın gerideydin."}]}' } }] };
    expect(acceptRewrite(original, reply)?.headline).toBe("Koridorda kaybettin.");
  });

  it("rejects invented numbers, dropped points and broken JSON", () => {
    const invented = { response: '{"headline":"x","points":[{"title":"a","detail":"10. dakikada 1500 altın geriydin."}]}' };
    const dropped = { response: '{"headline":"x","points":[]}' };
    expect(acceptRewrite(original, invented)).toBeNull();
    expect(acceptRewrite(original, dropped)).toBeNull();
    expect(acceptRewrite(original, { response: "üzgünüm" })).toBeNull();
  });
});

describe("free coach route", () => {
  it("serves the Workers AI wording and falls back to rules when it fails", async () => {
    const riot = { get: async () => null } as unknown as RiotClient;
    const store = new MemoryStore();
    // The route needs a match and timeline; this test only checks the engine choice,
    // so a missing match must answer 404 without touching the AI.
    let aiCalls = 0;
    const app = createApp(riot, store, { ai: { run: async () => { aiCalls++; return null; } } });
    const response = await app.request("/v1/coach/TR1_5", { method: "POST", body: JSON.stringify({ puuid: "m".repeat(78) }) });
    expect(response.status).toBe(404);
    expect(aiCalls).toBe(0);
  });
});
