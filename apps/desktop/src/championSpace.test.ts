import { describe, expect, it } from "vitest";
import { changeSpace, parseSpaces, safeUrl } from "./championSpace";

describe("champion space", () => {
  it("keeps only web links", () => {
    expect(safeUrl("https://example.com/a")).toBe("https://example.com/a");
    expect(safeUrl("javascript:alert(1)")).toBeNull();
    expect(safeUrl("C:\\file")).toBeNull();
  });
  it("cleans stored data and drops empty or non-champion entries", () => {
    const spaces = parseSpaces({
      "103": { role: "MIDDLE", tags: [" a ", "a", ""], reminders: ["x", 5], links: [{ title: "", url: "https://example.com/x" }, { title: "bad", url: "file:///etc" }] },
      "238": { role: "NOPE" },
      abc: { role: "TOP" },
    });
    expect(Object.keys(spaces)).toEqual(["103"]);
    expect(spaces["103"]).toEqual({ role: "MIDDLE", tags: ["a"], reminders: ["x"], links: [{ title: "example.com", url: "https://example.com/x" }] });
  });
  it("changes one champion and removes it when emptied", () => {
    const one = changeSpace({}, 103, (s) => ({ ...s, tags: ["erken"] }));
    expect(one["103"].tags).toEqual(["erken"]);
    expect(changeSpace(one, 103, (s) => ({ ...s, tags: [] }))).toEqual({});
  });
});
