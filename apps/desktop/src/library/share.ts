import type { BuildDraft, SavedBuild } from "./store";

// A saved build as a short text code a friend can paste into their library.
// Only ids travel; notes and collections stay with the sender.

const PREFIX = "VZB1:";

type Shared = {
  n: string;
  c: number;
  p: string | null;
  r: [number, number, number[]];
  s: [number, number];
  i: [number[], number[], number[]];
  k: number[];
};

const toBase64Url = (text: string) => btoa(String.fromCharCode(...new TextEncoder().encode(text))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

function fromBase64Url(code: string): string {
  const base64 = code.replace(/-/g, "+").replace(/_/g, "/");
  const bytes = Uint8Array.from(atob(base64), (ch) => ch.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export function shareCode(build: SavedBuild): string {
  const shared: Shared = {
    n: build.name,
    c: build.championId,
    p: build.position,
    r: [build.runes.primaryStyle, build.runes.subStyle, build.runes.perks],
    s: build.spells,
    i: [build.startItems, build.coreItems, build.items],
    k: build.skillOrder,
  };
  return PREFIX + toBase64Url(JSON.stringify(shared));
}

const ints = (value: unknown, max = 12): number[] | null =>
  Array.isArray(value) && value.length <= max && value.every((n) => Number.isInteger(n) && n >= 0) ? (value as number[]) : null;

/** A build from a code, or null if the code is damaged or not Vizier's. */
export function readShareCode(code: string): BuildDraft | null {
  const trimmed = code.trim();
  if (!trimmed.startsWith(PREFIX)) return null;
  try {
    const d = JSON.parse(fromBase64Url(trimmed.slice(PREFIX.length))) as Shared;
    const perks = ints(d.r?.[2], 9);
    const spells = ints(d.s, 2);
    const [start, core, rest] = [ints(d.i?.[0], 6), ints(d.i?.[1], 6), ints(d.i?.[2], 6)];
    const skills = ints(d.k, 3);
    if (typeof d.n !== "string" || !Number.isInteger(d.c) || !perks || !spells || spells.length !== 2 || !start || !core || !rest || !skills) return null;
    if (!Number.isInteger(d.r[0]) || !Number.isInteger(d.r[1])) return null;
    return {
      name: d.n.slice(0, 60),
      championId: d.c,
      position: typeof d.p === "string" && /^[A-Z]{3,7}$/.test(d.p) ? d.p : null,
      runes: { primaryStyle: d.r[0], subStyle: d.r[1], perks },
      spells: [spells[0], spells[1]],
      startItems: start,
      coreItems: core,
      items: rest,
      skillOrder: skills.length === 3 ? skills : [1, 2, 3],
      notes: "",
      collections: [],
      favourite: false,
      source: "custom",
    };
  } catch {
    return null;
  }
}
