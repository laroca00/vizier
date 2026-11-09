import { describe, expect, it } from "vitest";
import { SCENARIOS } from "./scenarios";
import { advance, answerFor, choicesOf, finished, grade, pick, record, replayMissed, startSession, summary } from "./session";

const first = SCENARIOS[0];
const rng = () => 0.3;

describe("grade", () => {
  it("sorts a pick into accepted, rejected or other", () => {
    expect(grade(first, first.accepted[0].champion)).toBe("accepted");
    expect(grade(first, first.rejected[0].champion)).toBe("rejected");
    expect(grade(first, "Zyra")).toBe("other");
  });
  it("finds the reason for a listed pick only", () => {
    expect(answerFor(first, first.rejected[0].champion)?.why.tr).toBeTruthy();
    expect(answerFor(first, "Zyra")).toBeUndefined();
  });
});

describe("choicesOf", () => {
  it("offers at most four, at least one right and one wrong, no repeats", () => {
    for (const s of SCENARIOS) {
      const choices = choicesOf(s, rng);
      expect(choices.length, s.id).toBeLessThanOrEqual(4);
      expect(new Set(choices).size, s.id).toBe(choices.length);
      expect(choices.some((c) => grade(s, c) === "accepted"), s.id).toBe(true);
      expect(choices.some((c) => grade(s, c) === "rejected"), s.id).toBe(true);
    }
  });
});

describe("pick", () => {
  it("filters by category and difficulty", () => {
    expect(pick({ category: "all", difficulty: 0 })).toHaveLength(SCENARIOS.length);
    expect(pick({ category: "damage", difficulty: 0 }).every((s) => s.category === "damage")).toBe(true);
    expect(pick({ category: "all", difficulty: 3 }).every((s) => s.difficulty === 3)).toBe(true);
  });
});

describe("session", () => {
  const few = SCENARIOS.slice(0, 3);
  it("counts the first answer only and walks the queue", () => {
    let s = startSession(few, rng);
    s = record(s, "rejected");
    s = record(s, "accepted");
    expect(summary(s)).toMatchObject({ answered: 1, rejected: 1, accepted: 0, total: 3 });
    s = advance(advance(advance(s)));
    expect(finished(s)).toBe(true);
    expect(advance(s).index).toBe(3);
  });
  it("replays only the missed scenarios", () => {
    let s = startSession(few, rng);
    for (let i = 0; i < 3; i++) s = advance(record(s, i === 1 ? "rejected" : "accepted"));
    const replay = replayMissed(s, few, rng)!;
    expect(replay.queue).toEqual([s.queue[1]]);
    const clean = startSession(few, rng);
    expect(replayMissed(clean, few, rng)).toBeNull();
  });
});
