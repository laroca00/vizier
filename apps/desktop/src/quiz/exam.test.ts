import { describe, expect, it, vi } from "vitest";
import type { Champion, Item, ItemDetail, RuneStyle } from "../data/ddragon";
// labels.ts pulls in the settings store, which listens on window when imported.
vi.hoisted(() => {
  const g = globalThis as unknown as Record<string, unknown>;
  g.window = { addEventListener() {} };
  g.localStorage = { getItem: () => null, setItem() {} };
});

import { buildExam, EXAM_CATEGORIES, summarize, withChoices, type Context } from "./exam";

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const NAMES: [string, string[], number, string][] = [
  ["Malphite", ["Tank", "Fighter"], 125, "Mana"], ["Jinx", ["Marksman"], 525, "Mana"], ["Lulu", ["Support", "Mage"], 550, "Mana"], ["Zed", ["Assassin"], 125, "Enerji"],
  ["Ashe", ["Marksman", "Support"], 600, "Mana"], ["Garen", ["Fighter", "Tank"], 175, "Yok"], ["Leona", ["Tank", "Support"], 125, "Mana"], ["Ahri", ["Mage", "Assassin"], 550, "Mana"],
  ["Caitlyn", ["Marksman"], 650, "Mana"], ["Vi", ["Fighter", "Assassin"], 125, "Mana"], ["Orianna", ["Mage", "Support"], 525, "Mana"], ["Sion", ["Tank", "Fighter"], 175, "Yok"],
];
const champions: Champion[] = NAMES.map(([id, tags, range, partype], i) => ({ id, key: i + 1, name: id, magic: false, tank: tags[0] === "Tank", tags, info: { attack: 5, defense: 5, magic: 5, difficulty: 5 }, attackRange: range, partype }));

const roles = new Map(
  champions.map((c, i) => [c.key, new Map([[["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"][i % 5], { championId: c.key, games: 5000, winRate: 0.5, pickRate: 0.1, tier: "A", winRateChange: null }]])]),
);

const itemDetails = new Map<number, ItemDetail>([
  [1, { id: 1, name: "Rabadon", plaintext: "", gold: { base: 1, total: 3600, purchasable: true }, from: [], into: [], stats: { FlatMagicDamageMod: 140 }, tags: [], complete: true } as unknown as ItemDetail],
  [2, { id: 2, name: "Infinity", plaintext: "", gold: { base: 1, total: 3400, purchasable: true }, from: [], into: [], stats: { FlatPhysicalDamageMod: 65, FlatCritChanceMod: 0.25 }, tags: [], complete: true } as unknown as ItemDetail],
]);
const items = new Map<number, Item>([[1, { id: 1, name: "Rabadon", complete: true, gold: 3600 }], [2, { id: 2, name: "Infinity", complete: true, gold: 3400 }]]);
const runes = new Map<number, RuneStyle>(
  [["Hükümranlık", 1], ["Hassasiyet", 2], ["Büyücülük", 3], ["Kararlılık", 4], ["İlham", 5]].map(([name, id], i) => [i, { id: i, name: String(name), icon: "", slots: [[{ id: Number(id) * 10, name: `Rune${id}`, icon: "" }]] }]),
);

const ctx: Context = {
  champions, roles, items, itemDetails, runes, lang: "tr", t: (s) => s,
  abilityNames: async (c) => [`${c.name} Q`, `${c.name} R`],
  counters: async () => ({ patches: ["16.1"], games: 9000, matchups: [{ championId: 2, games: 3000, winRate: 0.56 }, { championId: 3, games: 3000, winRate: 0.44 }, { championId: 4, games: 3000, winRate: 0.43 }, { championId: 5, games: 3000, winRate: 0.44 }, { championId: 6, games: 3000, winRate: 0.42 }] }),
};

describe("withChoices", () => {
  it("puts the right answer among the wrong ones once", () => {
    const c = withChoices("A", ["B", "C", "D", "A", "B"], 4, seeded(1))!;
    expect(c.choices).toHaveLength(4);
    expect(c.choices[c.answer]).toBe("A");
    expect(new Set(c.choices).size).toBe(4);
  });
  it("gives up when there are too few wrong answers", () => {
    expect(withChoices("A", ["B"], 4, seeded(1))).toBeNull();
  });
});

describe("buildExam", () => {
  for (const category of EXAM_CATEGORIES) {
    it(`builds valid ${category} questions`, async () => {
      const questions = await buildExam(category, 1, 3, ctx, seeded(5));
      expect(questions.length, category).toBeGreaterThan(0);
      for (const q of questions) {
        expect(q.category).toBe(category);
        expect(q.choices.length).toBeGreaterThanOrEqual(2);
        expect(q.answer).toBeGreaterThanOrEqual(0);
        expect(q.answer).toBeLessThan(q.choices.length);
        expect(new Set(q.choices).size).toBe(q.choices.length);
        expect(q.prompt[0] && q.explain[0]).toBeTruthy();
      }
    });
  }

  it("mixes categories for all", async () => {
    const questions = await buildExam("all", 2, 8, ctx, seeded(9));
    expect(new Set(questions.map((q) => q.category)).size).toBeGreaterThan(2);
  });

  it("uses more choices on harder levels", async () => {
    const hard = await buildExam("abilities", 3, 2, ctx, seeded(2));
    expect(hard[0].choices).toHaveLength(5);
    const easy = await buildExam("abilities", 1, 2, ctx, seeded(2));
    expect(easy[0].choices).toHaveLength(3);
  });

  it("carries the crawler sample only on matchup questions", async () => {
    const [q] = await buildExam("matchups", 1, 1, ctx, seeded(3));
    expect(q.sample).toMatchObject({ games: 3000 });
    const [a] = await buildExam("abilities", 1, 1, ctx, seeded(3));
    expect(a.sample).toBeUndefined();
  });

  it("skips a category whose data is missing instead of failing", async () => {
    expect(await buildExam("matchups", 1, 3, { ...ctx, counters: async () => null }, seeded(4))).toEqual([]);
  });

  it("is deterministic for a seed", async () => {
    const a = await buildExam("all", 2, 5, ctx, seeded(11));
    const b = await buildExam("all", 2, 5, ctx, seeded(11));
    expect(a).toEqual(b);
  });
});

describe("summarize", () => {
  it("counts correct and lists the missed", async () => {
    const qs = await buildExam("runes", 1, 3, ctx, seeded(1));
    const results = qs.map((question, i) => ({ question, picked: i === 0 ? question.answer : null }));
    const s = summarize(results);
    expect(s).toMatchObject({ total: qs.length, correct: 1 });
    expect(s.missed).toHaveLength(qs.length - 1);
  });
});
