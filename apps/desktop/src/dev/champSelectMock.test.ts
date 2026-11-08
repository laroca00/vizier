import { describe, expect, it } from "vitest";
import { autoView } from "../draft/logic";
import { MOCK_SESSIONS, mockFrame, mockLength } from "./champSelectMock";

describe("champ select mock", () => {
  it("has the four recorded queues", () => {
    expect(Object.keys(MOCK_SESSIONS).sort()).toEqual(["aram", "arena", "blind", "draft"]);
  });

  it("clamps the step and resolves the deadline", () => {
    const last = mockFrame("draft", 99, 1000);
    expect(last?.phase).toBe("FINALIZATION");
    expect(mockFrame("draft", -1, 1000)?.phase).toBe("PLANNING");
    expect(mockFrame("draft", 1, 1000)?.phaseEndsAt).toBe(31_000);
    expect(mockFrame("nope", 0, 0)).toBeNull();
  });

  it("every frame has a local player and unique cells", () => {
    for (const [name, frames] of Object.entries(MOCK_SESSIONS)) {
      expect(frames.length).toBe(mockLength(name));
      for (const frame of frames) {
        expect(frame.myTeam.filter((m) => m.isLocal)).toHaveLength(1);
        const cells = [...frame.myTeam, ...frame.theirTeam].map((m) => m.cellId);
        expect(new Set(cells).size).toBe(cells.length);
      }
    }
  });

  it("the draft session walks from bans to a build view", () => {
    const views = MOCK_SESSIONS.draft.map((f) => autoView(f).view);
    expect(views[1]).toBe("draft");
    expect(views[views.length - 1]).toBe("build");
    expect(MOCK_SESSIONS.draft.some((f) => f.turn?.kind === "ban")).toBe(true);
    expect(MOCK_SESSIONS.draft[MOCK_SESSIONS.draft.length - 1].bans).toHaveLength(10);
  });
});
