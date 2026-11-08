import { describe, expect, it } from "vitest";
import { checkRole } from "./allyRole";

const positions = (rows: [string, number][]) => ({ positions: rows.map(([position, games]) => ({ position, games, share: 0 })) });

describe("checkRole", () => {
  it("accepts a role the champion is played in", () => {
    expect(checkRole(positions([["MIDDLE", 800], ["BOTTOM", 200]]), "BOTTOM")).toEqual({ kind: "ok" });
  });

  it("warns when the role is rare and names the usual one", () => {
    expect(checkRole(positions([["MIDDLE", 950], ["TOP", 50]]), "TOP")).toEqual({ kind: "off", usual: "MIDDLE", share: 0.05 });
  });

  it("warns when the champion was never seen in the role", () => {
    expect(checkRole(positions([["JUNGLE", 1000]]), "UTILITY")).toMatchObject({ kind: "off", usual: "JUNGLE", share: 0 });
  });

  it("stays quiet with too few games", () => {
    expect(checkRole(positions([["JUNGLE", 100]]), "UTILITY")).toEqual({ kind: "ok" });
  });
});
