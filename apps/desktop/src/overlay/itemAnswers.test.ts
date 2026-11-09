import { describe, expect, it } from "vitest";
import type { ItemAdvice } from "../draft/itemAdvice";
import { openAnswers } from "./itemAnswers";

const advice = (rule: ItemAdvice["rule"], items: number[]): ItemAdvice => ({ rule, reason: "", names: [], items });

describe("openAnswers", () => {
  it("drops advice the player already answered and keeps at most three", () => {
    const list = [advice("antiHeal", [3165, 3033]), advice("magicResist", [3156]), advice("armor", [3143]), advice("burst", [3157])];
    expect(openAnswers(list, [3033, 1056]).map((a) => a.rule)).toEqual(["magicResist", "armor", "burst"]);
    expect(openAnswers(list, [3033, 3156, 3143, 3157])).toEqual([]);
  });
});
