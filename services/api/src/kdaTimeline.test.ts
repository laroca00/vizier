import { describe, expect, it } from "vitest";
import { decodeKda, encodeKda, kdaByMinute, type Timeline } from "./timeline.ts";

const frame = (minute: number, events: Timeline["info"]["frames"][number]["events"] = []) => ({
  timestamp: minute * 60_000,
  participantFrames: { 1: { totalGold: 0, xp: 0, minionsKilled: 0, jungleMinionsKilled: 0, level: 1 }, 2: { totalGold: 0, xp: 0, minionsKilled: 0, jungleMinionsKilled: 0, level: 1 }, 6: { totalGold: 0, xp: 0, minionsKilled: 0, jungleMinionsKilled: 0, level: 1 } },
  events,
});
const teamOf = (id: number) => (id <= 5 ? 100 : 200);

describe("kdaByMinute", () => {
  const timeline: Timeline = {
    info: {
      frames: Array.from({ length: 17 }, (_, m) =>
        frame(
          m,
          m === 2
            ? [
                { type: "CHAMPION_KILL", timestamp: 100_000, killerId: 2, victimId: 6, assistingParticipantIds: [1] },
                { type: "CHAMPION_KILL", timestamp: 110_000, killerId: 0, victimId: 6 },
              ]
            : m === 4
              ? [{ type: "CHAMPION_KILL", timestamp: 230_000, killerId: 6, victimId: 1 }]
              : [],
        ),
      ),
    },
  };

  it("counts cumulative kills, deaths, assists and team kills per minute", () => {
    const map = kdaByMinute(timeline, teamOf);
    expect(map.get(1)).toHaveLength(15);
    expect(map.get(1)![0]).toEqual({ kills: 0, deaths: 0, assists: 0, teamKills: 0 });
    expect(map.get(1)![2]).toEqual({ kills: 0, deaths: 0, assists: 1, teamKills: 1 });
    expect(map.get(1)![4]).toEqual({ kills: 0, deaths: 1, assists: 1, teamKills: 1 });
    expect(map.get(6)![4]).toEqual({ kills: 1, deaths: 2, assists: 0, teamKills: 1 });
  });

  it("returns short series for games that ended early", () => {
    const short: Timeline = { info: { frames: Array.from({ length: 9 }, (_, m) => frame(m)) } };
    expect(kdaByMinute(short, teamOf).get(1)).toHaveLength(8);
  });

  it("round-trips the stored text", () => {
    const points = kdaByMinute(timeline, teamOf).get(1)!;
    expect(decodeKda(encodeKda(points))).toEqual(points);
    expect(decodeKda(null)).toEqual([]);
    expect(decodeKda("1.x.3.4")).toEqual([]);
  });
});
