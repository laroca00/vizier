import { describe, expect, it } from "vitest";
import type { Combo } from "../data/combos";
import { DEFAULT_REF, laneOpponent, moveRef, normalizeRef, panelCombos, referenceNote, toggleRef } from "./reference";
import type { LiveGame, LivePlayer } from "./live";

const p = (riotId: string, team: string, position: string) => ({ riotId, team, position }) as LivePlayer;
const combo = (id: string, difficulty: 1 | 2 | 3) => ({ id, difficulty }) as Combo;

describe("reference panel", () => {
  it("reads only known sections, once each", () => {
    expect(normalizeRef(["note", "bogus", "note", "build"])).toEqual(["note", "build"]);
    expect(normalizeRef(undefined)).toEqual(DEFAULT_REF);
    expect(normalizeRef([])).toEqual([]);
  });
  it("toggles and moves", () => {
    expect(toggleRef(["build"], "combo")).toEqual(["build", "combo"]);
    expect(toggleRef(["build", "combo"], "build")).toEqual(["combo"]);
    expect(moveRef(["build", "combo", "note"], "note", -1)).toEqual(["build", "note", "combo"]);
    expect(moveRef(["build", "combo"], "build", -1)).toEqual(["build", "combo"]);
  });
  it("finds the enemy in the same role", () => {
    const me = p("a", "ORDER", "MIDDLE");
    const game = { players: [me, p("b", "CHAOS", "TOP"), p("c", "CHAOS", "MIDDLE")] } as LiveGame;
    expect(laneOpponent(game, me)?.riotId).toBe("c");
    expect(laneOpponent(game, p("x", "ORDER", ""))).toBeNull();
  });
  it("prefers the matchup note and ignores blank ones", () => {
    const notes = { "c:103": " own ", "m:103:238": "vs zed" };
    expect(referenceNote(notes, 103, 238)).toEqual({ text: "vs zed", matchup: true });
    expect(referenceNote(notes, 103, 1)).toEqual({ text: "own", matchup: false });
    expect(referenceNote({ "m:103:238": "  " }, 103, 238)).toBeNull();
  });
  it("lists the easiest combos first", () => {
    expect(panelCombos([combo("a", 3), combo("b", 1), combo("c", 2)]).map((c) => c.id)).toEqual(["b", "c"]);
  });
});
