/// <reference types="node" />
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { EN } from "./i18n.en";

// Turkish is the source language, so every Turkish string in the code needs an
// English entry. This finds strings passed to t() and any string literal with
// a letter only Turkish uses, which catches labels kept in lookup tables.

const ROOT = fileURLToPath(new URL(".", import.meta.url));
const SKIP = new Set(["i18n.en.ts"]);

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name: string) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.(ts|tsx)$/.test(name) && !name.includes(".test.") && !SKIP.has(name) ? [path] : [];
  });
}

const TURKISH = /[çğıöşüÇĞİÖŞÜ]/;
const unquote = (literal: string) => JSON.parse(`"${literal}"`) as string;

function untranslated(): string[] {
  const missing = new Set<string>();
  for (const file of sources(ROOT)) {
    const code = readFileSync(file, "utf8")
      .replace(/^\s*\/\/.*$/gm, "")
      .replace(/\/\*[\s\S]*?\*\//g, "");
    for (const m of code.matchAll(/\bt\(\s*"((?:[^"\\]|\\.)*)"/g)) {
      const text = unquote(m[1]);
      if (!(text in EN)) missing.add(text);
    }
    for (const m of code.matchAll(/"((?:[^"\\\n]|\\.)*)"/g)) {
      const text = unquote(m[1]);
      if (TURKISH.test(text) && !(text in EN)) missing.add(text);
    }
  }
  return [...missing].sort();
}

describe("translations", () => {
  it("has English for every Turkish string", () => {
    expect(untranslated()).toEqual([]);
  });
});
