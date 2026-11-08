import { describe, expect, it } from "vitest";
import type { EntityDiff } from "./diff";
import { changedOf, poolFirst } from "./pool";

const e = (kind: EntityDiff["kind"], id: string, status: EntityDiff["status"] = "changed"): EntityDiff => ({ kind, id, name: id, status, changes: [] });

describe("pool patch helpers", () => {
  const entries = [e("item", "3000"), e("champion", "1"), e("champion", "2"), e("champion", "3", "added")];

  it("puts the pool's champions first and keeps the rest in order", () => {
    expect(poolFirst(entries, new Set(["2", "3"])).map((x) => x.id)).toEqual(["2", "3", "3000", "1"]);
  });

  it("lists changed pool champions, not new ones", () => {
    expect([...changedOf(entries, new Set(["1", "3", "3000"]))]).toEqual(["1"]);
  });
});
