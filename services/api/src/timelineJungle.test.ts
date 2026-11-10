import { describe, expect, it } from "vitest";
import { decodeJungle, encodeJungle, junglePath, laneAt, type Timeline, type TimelineEvent } from "./timeline.ts";

const frame = (positions: Record<string, { x: number; y: number }>, events: TimelineEvent[] = [], timestamp = 0) => ({
  timestamp,
  participantFrames: Object.fromEntries(
    Object.entries(positions).map(([id, position]) => [id, { totalGold: 0, xp: 0, minionsKilled: 0, jungleMinionsKilled: 0, level: 3, position }]),
  ),
  events,
});

const jungle = (xy: Record<number, { x: number; y: number }>) => frame({ "2": xy[0] });

describe("laneAt", () => {
  it("places positions in lanes and leaves the jungle and bases alone", () => {
    expect(laneAt({ x: 1500, y: 9000 })).toBe("top");
    expect(laneAt({ x: 6000, y: 13500 })).toBe("top");
    expect(laneAt({ x: 9000, y: 1500 })).toBe("bot");
    expect(laneAt({ x: 13500, y: 6000 })).toBe("bot");
    expect(laneAt({ x: 7400, y: 7400 })).toBe("mid");
    expect(laneAt({ x: 3800, y: 7900 })).toBeNull();
    expect(laneAt({ x: 500, y: 500 })).toBeNull();
  });
});

describe("junglePath", () => {
  const camp = (side: "top" | "bot") => (side === "top" ? { x: 3800, y: 7900 } : { x: 7900, y: 3800 });
  const timeline = (frames: ReturnType<typeof frame>[]): Timeline => ({ info: { frames } });

  it("reads the side from 2:00, the first lane from 3:00 on and the first gank minute", () => {
    const gank: TimelineEvent = { type: "CHAMPION_KILL", timestamp: 4 * 60_000 + 20_000, killerId: 3, assistingParticipantIds: [2], position: { x: 1500, y: 9000 } };
    const t = timeline([
      jungle([{ x: 500, y: 500 }]),
      jungle([camp("top")]),
      jungle([camp("top")]),
      jungle([camp("top")]),
      frame({ "2": { x: 1500, y: 9000 } }, [gank]),
    ]);
    expect(junglePath(t, 2)).toEqual({ side: "top", lane: "top", gankMinute: 4 });
  });

  it("says none while the jungler never reaches a lane, and null without a gank", () => {
    const t = timeline([jungle([camp("bot")]), jungle([camp("bot")]), jungle([camp("bot")]), jungle([camp("bot")]), jungle([camp("bot")]), jungle([camp("bot")]), jungle([camp("bot")])]);
    expect(junglePath(t, 2)).toEqual({ side: "bot", lane: "none", gankMinute: null });
  });

  it("ignores kills outside lanes and kills the jungler had no part in", () => {
    const inJungle: TimelineEvent = { type: "CHAMPION_KILL", timestamp: 150_000, killerId: 2, position: { x: 3800, y: 7900 } };
    const other: TimelineEvent = { type: "CHAMPION_KILL", timestamp: 200_000, killerId: 5, assistingParticipantIds: [6], position: { x: 1500, y: 9000 } };
    const t = timeline([jungle([camp("top")]), jungle([camp("top")]), frame({ "2": camp("top") }, [inJungle, other])]);
    expect(junglePath(t, 2)?.gankMinute).toBeNull();
  });

  it("is null when the frames carry no positions", () => {
    expect(junglePath({ info: { frames: [{ timestamp: 0, participantFrames: {}, events: [] }] } }, 2)).toBeNull();
  });
});

describe("encodeJungle", () => {
  it("round-trips and rejects junk", () => {
    const route = { side: "bot", lane: "mid", gankMinute: 5 } as const;
    expect(decodeJungle(encodeJungle(route))).toEqual(route);
    expect(decodeJungle(encodeJungle({ side: "top", lane: "none", gankMinute: null }))).toEqual({ side: "top", lane: "none", gankMinute: null });
    expect(decodeJungle("x|y|1")).toBeNull();
    expect(decodeJungle(null)).toBeNull();
  });
});
