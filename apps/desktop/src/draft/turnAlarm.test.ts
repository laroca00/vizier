import { describe, expect, it } from "vitest";
import { alarmDue } from "./turnAlarm";

const at = 1_000_000;
const draft = (kind: "pick" | "ban", mine: boolean) => ({ turn: { kind, mine }, phaseEndsAt: at });

describe("alarmDue", () => {
  it("fires in the last ten seconds of the player's own pick turn", () => {
    expect(alarmDue(draft("pick", true), at - 9_000)).toBe(at);
    expect(alarmDue(draft("pick", true), at - 11_000)).toBeNull();
    expect(alarmDue(draft("pick", true), at + 1)).toBeNull();
  });

  it("stays quiet on bans, on others' turns and with no turn", () => {
    expect(alarmDue(draft("ban", true), at - 5_000)).toBeNull();
    expect(alarmDue(draft("pick", false), at - 5_000)).toBeNull();
    expect(alarmDue({ turn: null, phaseEndsAt: at }, at - 5_000)).toBeNull();
    expect(alarmDue(null, at)).toBeNull();
  });
});
