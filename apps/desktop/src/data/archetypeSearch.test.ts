import { describe, expect, it } from "vitest";
import { matchChampions } from "./archetypeSearch";

const name = (id: string) => id;

describe("matchChampions", () => {
  it("combines archetypes: a champion needs all of them", () => {
    const both = matchChampions({ archetypes: ["juggernaut", "splitpusher"], query: "", inRole: null }, name);
    expect(both).toContain("Garen");
    expect(both).not.toContain("Malphite");
    expect(matchChampions({ archetypes: ["juggernaut"], query: "", inRole: null }, name).length).toBeGreaterThan(both.length);
  });
  it("searches names without caring about case or accents", () => {
    expect(matchChampions({ archetypes: [], query: "gAREN", inRole: null }, name)).toEqual(["Garen"]);
  });
  it("keeps only champions of the role", () => {
    expect(matchChampions({ archetypes: ["vanguard"], query: "", inRole: new Set(["Malphite"]) }, name)).toEqual(["Malphite"]);
  });
  it("matches everything with no filter", () => {
    expect(matchChampions({ archetypes: [], query: "", inRole: null }, name).length).toBeGreaterThan(150);
  });
});
