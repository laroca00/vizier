import { describe, expect, it } from "vitest";
import type { Participant } from "./riot/types.ts";
import { fixRoles } from "./roles.ts";
import type { Timeline } from "./timeline.ts";

let n = 0;
const player = (teamId: number, teamPosition: string, extra: Partial<Participant> = {}): Participant =>
  ({ puuid: `p${n}`, participantId: ++n, teamId, championId: n, teamPosition, win: true, summoner1Id: 4, summoner2Id: 14, totalMinionsKilled: 180, neutralMinionsKilled: 0, ...extra }) as Participant;

const full = (teamId: number) => ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"].map((r) => player(teamId, r));
const game = (blue: Participant[], red: Participant[] = full(200)) => ({ gameDuration: 1800, participants: [...blue, ...red] });

/** A timeline where each participant stands at a given spot from minute 2 to 9. */
const timeline = (spots: Record<number, { x: number; y: number }>): Timeline => ({
  info: {
    frames: Array.from({ length: 10 }, (_, i) => ({
      timestamp: i * 60_000,
      events: [],
      participantFrames: Object.fromEntries(Object.entries(spots).map(([id, position]) => [id, { totalGold: 0, xp: 0, minionsKilled: 0, jungleMinionsKilled: 0, level: 1, position }])),
    })),
  },
});

describe("fixRoles", () => {
  it("leaves complete teams alone", () => {
    const info = game(full(100));
    const { positions, fixed } = fixRoles(info, null);
    expect(fixed).toBe(false);
    expect(info.participants.every((p) => positions.get(p) === p.teamPosition)).toBe(true);
  });

  it("fills a single empty role from the one that is missing, without a timeline", () => {
    const blue = full(100);
    blue[3].teamPosition = "";
    const info = game(blue);
    const { positions, fixed } = fixRoles(info, null);
    expect(fixed).toBe(true);
    expect(positions.get(blue[3])).toBe("BOTTOM");
  });

  it("uses Smite and farm when a duplicate hides the jungler and the support", () => {
    const blue = [player(100, "TOP"), player(100, "MIDDLE", { summoner2Id: 11 }), player(100, "MIDDLE"), player(100, "BOTTOM", { totalMinionsKilled: 190 }), player(100, "BOTTOM", { totalMinionsKilled: 25 })];
    const spots = {
      [blue[2].participantId!]: { x: 7500, y: 7300 },
      [blue[3].participantId!]: { x: 12000, y: 2300 },
      [blue[4].participantId!]: { x: 12300, y: 2100 },
    };
    const { positions, fixed } = fixRoles(game(blue), timeline(spots));
    expect(fixed).toBe(true);
    expect(blue.map((p) => positions.get(p))).toEqual(["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"]);
  });

  it("tells three lanes apart by where the players stood", () => {
    const blue = [player(100, ""), player(100, "JUNGLE", { summoner1Id: 11 }), player(100, ""), player(100, ""), player(100, "UTILITY", { totalMinionsKilled: 20 })];
    const [a, , b, c] = blue;
    const spots = {
      [a.participantId!]: { x: 7300, y: 7500 },
      [b.participantId!]: { x: 1900, y: 12400 },
      [c.participantId!]: { x: 12500, y: 2000 },
    };
    const { positions } = fixRoles(game(blue), timeline(spots));
    expect([a, b, c].map((p) => positions.get(p))).toEqual(["MIDDLE", "TOP", "BOTTOM"]);
  });

  it("gives up on lanes it cannot place, so the old behaviour stays", () => {
    const blue = [player(100, ""), player(100, "JUNGLE", { summoner1Id: 11 }), player(100, ""), player(100, ""), player(100, "UTILITY")];
    const info = game(blue);
    const { positions, fixed } = fixRoles(info, null);
    expect(fixed).toBe(false);
    expect(positions.get(blue[0])).toBe("");
  });

  it("does not guess a jungler without Smite", () => {
    const blue = full(100);
    blue[1].teamPosition = "";
    blue[1].summoner2Id = 14;
    const { fixed } = fixRoles(game(blue), null);
    expect(fixed).toBe(false);
  });
});
