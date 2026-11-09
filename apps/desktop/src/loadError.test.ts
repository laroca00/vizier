import { describe, expect, it } from "vitest";
import { ApiError } from "./http";
import { loadErrorMessage } from "./loadError";

describe("loadErrorMessage", () => {
  it("names the offline state before anything else", () => {
    expect(loadErrorMessage(new ApiError(500, "x"), false)).toMatch(/Çevrimdışı/);
  });
  it("tells a server problem from a generic failure", () => {
    expect(loadErrorMessage(new ApiError(503, "x"), true)).toMatch(/sunucusu/);
    expect(loadErrorMessage(new ApiError(429, "x"), true)).toMatch(/Çok fazla/);
    expect(loadErrorMessage(new TypeError("Failed to fetch"), true)).toBe("Veri alınamadı. Tekrar dene.");
  });
});
