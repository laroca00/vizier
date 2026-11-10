import { describe, expect, it } from "vitest";
import { statsIntent } from "./intents";
import { staticTopics } from "./topics";

const topics = staticTopics("tr");
const route = (query: string) => {
  const topic = statsIntent(query, topics);
  return topic && "route" in topic.target ? topic.target.route : null;
};

describe("statsIntent", () => {
  it("reads a stat and a role in Turkish and English", () => {
    expect(route("en yüksek winrate jungle")).toMatchObject({ page: "stats", position: "JUNGLE", sort: "winRate", desc: true });
    expect(route("lane bully top")).toMatchObject({ position: "TOP", sort: "goldDiff15", desc: true });
    expect(route("orman kazanma oranı")).toMatchObject({ position: "JUNGLE", sort: "winRate" });
    expect(route("highest kda support")).toMatchObject({ position: "UTILITY", sort: "kda", desc: true });
    expect(route("geç oyun orta")).toMatchObject({ position: "MIDDLE", sort: "lateWinRate" });
    expect(route("most banned adc")).toMatchObject({ sort: "banRate", position: "BOTTOM" });
    expect(route("yasak adc")).toMatchObject({ position: "BOTTOM", sort: "banRate" });
  });
  it("sorts ascending for the lowest, the worst and the least", () => {
    expect(route("lowest winrate top")).toMatchObject({ sort: "winRate", desc: false, position: "TOP" });
    expect(route("en düşük kda")).toMatchObject({ sort: "kda", desc: false, position: "ALL" });
  });
  it("covers every role when none is named", () => {
    expect(route("pick rate leaders")).toMatchObject({ sort: "pickRate", position: "ALL", desc: true });
  });
  it("leaves ordinary searches alone", () => {
    expect(route("ahri")).toBeNull();
    expect(route("kda")).toBeNull();
    expect(route("anti tank build")).toBeNull();
    expect(route("")).toBeNull();
  });
  it("has a topic for every stat, role and direction, none found by name", () => {
    const stats = topics.filter((t) => t.id.startsWith("stats:"));
    expect(stats).toHaveLength(8 * 6 * 2);
    expect(stats.every((t) => t.terms.length === 0)).toBe(true);
  });
});
