import { describe, expect, it } from "vitest";
import { pickBench } from "./benchRank";

const doc = (games: number) => ({ minutes: [5, 10, 15].map((minute) => ({ minute, games, cs: minute * 7, level: 3 })) });

describe("pickBench", () => {
  it("uses the player's bracket when every minute has enough games", () => {
    expect(pickBench("gold_minus", doc(150), doc(900))).toMatchObject({ bracket: "gold_minus" });
  });

  it("falls back to Emerald+ when the bracket is thin or missing", () => {
    expect(pickBench("gold_minus", doc(40), doc(900))).toMatchObject({ bracket: "emerald_plus" });
    expect(pickBench("gold_minus", null, doc(900))).toMatchObject({ bracket: "emerald_plus" });
    expect(pickBench(null, doc(500), doc(900))).toMatchObject({ bracket: "emerald_plus" });
  });

  it("has nothing when neither document exists", () => {
    expect(pickBench("gold_minus", null, null)).toBeNull();
  });
});
