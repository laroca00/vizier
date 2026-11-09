import { describe, expect, it } from "vitest";
import { greeting } from "./greeting";

describe("greeting", () => {
  it("follows the hour", () => {
    expect([4, 5, 11, 12, 17, 18, 22, 23, 0].map(greeting)).toEqual([
      "İyi geceler",
      "Günaydın",
      "Günaydın",
      "İyi günler",
      "İyi günler",
      "İyi akşamlar",
      "İyi akşamlar",
      "İyi geceler",
      "İyi geceler",
    ]);
  });
});
