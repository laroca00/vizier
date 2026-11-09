import { describe, expect, it } from "vitest";
import type { Champion } from "./data/ddragon";
import { fold } from "./fold";
import { search } from "./paletteSearch";
import type { Topic } from "./search/topics";

const champion = (key: number, name: string) => ({ key, id: name, name, tags: ["Mage"] }) as unknown as Champion;

describe("palette search", () => {
  it("lists pro players after champions", () => {
    const results = search("fa", [champion(1, "Fiddlesticks")], [], [{ player: "Faker", team: "T1" }, { player: "Chovy", team: "GEN" }]);
    expect(results.map((r) => r.kind)).toEqual(["pro"]);
    expect(search("ch", [], [], [{ player: "Chovy", team: "GEN" }])[0]).toEqual({ kind: "pro", pro: { player: "Chovy", team: "GEN" } });
  });
});

describe("palette extras", () => {
  it("finds saved builds, items and keystones after champions", () => {
    const results = search("ra", [champion(1, "Rakan")], [], [], {
      builds: [{ id: "b1", name: "Rakan engage", icon: null }],
      items: [{ id: "3089", name: "Rabadon's Deathcap", icon: null }],
      runes: [{ id: "8437", name: "Grasp of the Undying", icon: null }],
    });
    expect(results.map((r) => r.kind)).toEqual(["champion", "build", "item", "rune"]);
  });
});

describe("palette topics and intents", () => {
  const topic = (id: string, group: Topic["group"], name: string, ...terms: string[]): Topic => ({ id, group, name, terms: terms.map(fold), target: { route: { page: "templates" } } });
  const topics = [
    topic("lab:anti-tank", "lab", "Tanka karşı", "Tanka karşı", "anti tank"),
    topic("archetype:enchanter", "archetype", "Destek büyücü", "Enchanter"),
    topic("template:protect", "template", "Protect the carry", "Protect the carry"),
    topic("template:heavyEngage", "template", "Heavy engage", "Heavy engage"),
    topic("quiz:ability", "quiz", "Yetenek", "Yetenek", "Ability"),
    { id: "combo:Ahri/charm", group: "combo", name: "Ahri · Charm", terms: [fold("Ahri"), fold("Charm")], target: { champion: 103 } } as Topic,
    { id: "note:c:103", group: "note", name: "Ahri", terms: [fold("Ahri"), fold("hep cezbe at")], target: { champion: 103 } } as Topic,
  ];
  const ahri = champion(103, "Ahri");
  const kinds = (q: string, cat?: Parameters<typeof search>[5]) => search(q, [ahri], [], [], { topics }, cat).map((r) => (r.kind === "topic" ? r.topic.id : r.kind));

  it("finds topics by name, in either language", () => {
    expect(kinds("enchanter")).toContain("archetype:enchanter");
    expect(kinds("yetenek")).toEqual(["quiz:ability"]);
  });
  it("reads intent phrases in Turkish and English", () => {
    expect(kinds("anti tank build")).toContain("lab:anti-tank");
    expect(kinds("güçlü engage")).toContain("template:heavyEngage");
    expect(kinds("protect the carry")[0]).toBe("template:protect");
    expect(kinds("tanka karşı build")).toContain("lab:anti-tank");
  });
  it("reads '<champion> combo' and falls back to the champion", () => {
    expect(kinds("Ahri combo")[0]).toBe("combo:Ahri/charm");
    expect(kinds("ahri kombo")).toContain("combo:Ahri/charm");
    expect(search("ahri combo", [ahri], [], [], { topics: [] }).map((r) => r.kind)).toEqual(["champion"]);
  });
  it("finds notes by their text", () => {
    expect(kinds("cezbe")).toEqual(["note:c:103"]);
  });
  it("narrows to a category tab", () => {
    expect(kinds("ahri", "notes")).toEqual(["note:c:103"]);
    expect(kinds("ahri", "champions")).toEqual(["champion"]);
    expect(kinds("ahri", "builds")).toEqual(["combo:Ahri/charm"]);
  });
  it("ignores very short phrases for intents", () => {
    expect(kinds("hi")).toEqual([]);
  });
});
