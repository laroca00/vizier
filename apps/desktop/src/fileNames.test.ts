import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Windows and macOS resolve `./banPlanner` and `./BanPlanner` to the same file,
// so a pair that only differs by case passes on Linux and breaks the release build.
function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path, out);
    else out.push(path);
  }
  return out;
}

describe("source file names", () => {
  it("never differ from another module only by case", () => {
    const src = import.meta.dirname;
    const seen = new Map<string, string>();
    const clashes: string[] = [];
    for (const file of walk(src)) {
      const rel = file.slice(src.length + 1).replace(/\\/g, "/");
      // Extensionless import specifiers collide across .ts and .tsx; CSS is imported with its extension.
      const key = rel.replace(/\.tsx?$/, "").toLowerCase();
      const other = seen.get(key);
      if (other) clashes.push(`${other} ~ ${rel}`);
      else seen.set(key, rel);
    }
    expect(clashes).toEqual([]);
  });
});
