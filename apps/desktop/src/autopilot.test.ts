import { describe, expect, it } from "vitest";
import { describeStep, nextStep } from "./autopilot";
import type { ChampSelect, DraftMember } from "./lcu";

const member = (cellId: number, championId = 0, isLocal = false): DraftMember => ({ cellId, championId, pickIntent: 0, position: "", spells: [4, 14], isLocal });

function draft(over: Partial<ChampSelect> = {}): ChampSelect {
  return {
    myTeam: [member(0, 0, true), member(1, 64)],
    theirTeam: [member(5, 238)],
    bans: [157],
    phase: "BAN_PICK",
    turn: { kind: "pick", mine: true },
    phaseEndsAt: 0,
    ...over,
  };
}

const plan = { picks: [157, 238, 64, 103], bans: [11, 22] };
const base = { plan, mode: "lock" as const, lockSeconds: 0, secondsLeft: 20, allowed: null };

describe("nextStep", () => {
  it("skips banned and taken champions and locks at once with no delay", () => {
    expect(nextStep({ ...base, draft: draft() })).toEqual({ kind: "pick", championId: 103, lock: true });
  });
  it("only hovers in hover mode", () => {
    expect(nextStep({ ...base, draft: draft(), mode: "hover" })).toEqual({ kind: "pick", championId: 103, lock: false });
  });
  it("hovers until the lock window opens", () => {
    const early = nextStep({ ...base, draft: draft(), lockSeconds: 5, secondsLeft: 12 });
    const late = nextStep({ ...base, draft: draft(), lockSeconds: 5, secondsLeft: 5 });
    expect(early?.lock).toBe(false);
    expect(late?.lock).toBe(true);
  });
  it("bans from the ban list", () => {
    expect(nextStep({ ...base, draft: draft({ turn: { kind: "ban", mine: true } }) })).toEqual({ kind: "ban", championId: 11, lock: true });
  });
  it("does nothing outside the player's turn, when off, or after locking", () => {
    expect(nextStep({ ...base, draft: draft({ turn: { kind: "pick", mine: false } }) })).toBeNull();
    expect(nextStep({ ...base, draft: draft(), mode: "off" })).toBeNull();
    expect(nextStep({ ...base, draft: draft({ myTeam: [member(0, 103, true)] }) })).toBeNull();
    expect(nextStep({ ...base, draft: draft({ turn: null }) })).toBeNull();
  });
  it("respects what the client says can be picked", () => {
    expect(nextStep({ ...base, draft: draft(), allowed: new Set([64, 103]) })?.championId).toBe(103);
    expect(nextStep({ ...base, draft: draft(), allowed: new Set([1]) })).toBeNull();
  });
});

describe("describeStep", () => {
  it("names what will happen", () => {
    expect(describeStep("hover", 0)).toBe("hover");
    expect(describeStep("lock", 0)).toBe("lockNow");
    expect(describeStep("lock", 4)).toBe("lockLater");
  });
});
