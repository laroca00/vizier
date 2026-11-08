import { describe, expect, it } from "vitest";
import type { ChampSelect, DraftMember } from "../lcu";
import { draftCode, findDraftCode, fromChampSelect, readDraftCode } from "./transfer";

const member = (cellId: number, position: string, championId: number, pickIntent = 0): DraftMember => ({ cellId, championId, pickIntent, position, spells: [4, 14], isLocal: false });
const session = (extra: Partial<ChampSelect> = {}): ChampSelect => ({ myTeam: [], theirTeam: [], bans: [], phase: "BAN_PICK", phaseEndsAt: 0, ...extra });

describe("fromChampSelect", () => {
  it("puts each champion in its role slot, hovers included", () => {
    const draft = fromChampSelect(session({ myTeam: [member(0, "utility", 412), member(1, "top", 0, 86), member(2, "middle", 103)], theirTeam: [member(5, "bottom", 51)], bans: [1, 0, 1, 2] }));
    expect(draft.blue).toEqual([86, 0, 103, 0, 412]);
    expect(draft.red).toEqual([0, 0, 0, 51, 0]);
    expect(draft.bans).toEqual([1, 2]);
  });

  it("fills free slots for players without a role", () => {
    const draft = fromChampSelect(session({ myTeam: [member(0, "", 1), member(1, "", 2), member(2, "top", 3)] }));
    expect(draft.blue).toEqual([3, 1, 2, 0, 0]);
  });
});

describe("draft codes", () => {
  const draft = { blue: [86, 64, 103, 202, 412], red: [266, 0, 238, 51, 0], bans: [7, 157, 1000] };

  it("round-trips a draft", () => {
    const code = draftCode(draft);
    expect(code.startsWith("VZD1:")).toBe(true);
    expect(readDraftCode(code)).toEqual(draft);
  });

  it("finds a code inside a message", () => {
    const code = draftCode(draft);
    expect(findDraftCode(`look at this ${code}, ok?`)).toBe(code);
    expect(readDraftCode(`look at this ${code}, ok?`)).toEqual(draft);
  });

  it("rejects damaged and foreign codes", () => {
    expect(readDraftCode("VZD1:AAAA")).toBeNull();
    expect(readDraftCode("VZD1:!!")).toBeNull();
    expect(readDraftCode("hello")).toBeNull();
  });

  it("keeps a champion once", () => {
    const code = draftCode({ blue: [5, 0, 0, 0, 0], red: [5, 0, 0, 0, 0], bans: [5, 6] });
    expect(readDraftCode(code)).toEqual({ blue: [5, 0, 0, 0, 0], red: [0, 0, 0, 0, 0], bans: [6] });
  });
});
