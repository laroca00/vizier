import { describe, expect, it } from "vitest";
import { lockState } from "./lockState";

describe("lockState", () => {
  const gone = new Set([5]);
  it("is enabled on the player's pick turn", () => {
    expect(lockState({ kind: "pick", mine: true }, 1, gone)).toEqual({ enabled: true });
  });
  it("says why it is not", () => {
    expect(lockState(null, 1, gone)).toEqual({ enabled: false, reason: "turn" });
    expect(lockState({ kind: "pick", mine: false }, 1, gone)).toEqual({ enabled: false, reason: "turn" });
    expect(lockState({ kind: "ban", mine: true }, 1, gone)).toEqual({ enabled: false, reason: "ban" });
    expect(lockState({ kind: "pick", mine: true }, 5, gone)).toEqual({ enabled: false, reason: "gone" });
  });
});
