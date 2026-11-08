import type { BuildDraft, SavedBuild } from "./store";

// A saved build as a short text code a friend can paste into their library.
// Only ids travel; notes and collections stay with the sender.
// "VZ2:" codes pack the ids as varint bytes and are about half the length of
// the older "VZB1:" JSON codes, which still read.

const PREFIX = "VZB1:";
const PREFIX_V2 = "VZ2:";
const POSITIONS = ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"];

type Shared = {
  n: string;
  c: number;
  p: string | null;
  r: [number, number, number[]];
  s: [number, number];
  i: [number[], number[], number[]];
  k: number[];
};

function fromBase64Url(code: string): string {
  const base64 = code.replace(/-/g, "+").replace(/_/g, "/");
  const bytes = Uint8Array.from(atob(base64), (ch) => ch.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

const toBase64UrlBytes = (bytes: number[]) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

function varint(out: number[], value: number) {
  let n = value;
  while (n >= 0x80) {
    out.push((n & 0x7f) | 0x80);
    n = Math.floor(n / 128);
  }
  out.push(n);
}

function list(out: number[], values: number[]) {
  varint(out, values.length);
  for (const v of values) varint(out, v);
}

export function shareCode(build: SavedBuild): string {
  const out: number[] = [];
  const name = [...new TextEncoder().encode(build.name.slice(0, 60))];
  varint(out, name.length);
  out.push(...name);
  varint(out, build.championId);
  varint(out, POSITIONS.indexOf(build.position ?? "") + 1);
  varint(out, build.runes.primaryStyle);
  varint(out, build.runes.subStyle);
  list(out, build.runes.perks);
  list(out, build.spells);
  list(out, build.startItems);
  list(out, build.coreItems);
  list(out, build.items);
  list(out, build.skillOrder);
  return PREFIX_V2 + toBase64UrlBytes(out);
}

/** Reads varints and lists from a code's bytes; throws when the code ends early or carries something absurd. */
class Reader {
  private at = 0;
  constructor(private bytes: Uint8Array) {}
  varint(): number {
    let value = 0;
    for (let shift = 0; shift < 35; shift += 7) {
      const byte = this.bytes[this.at++];
      if (byte === undefined) throw new Error("short");
      value += (byte & 0x7f) * 2 ** shift;
      if (byte < 0x80) return value;
    }
    throw new Error("long");
  }
  list(max: number): number[] {
    const length = this.varint();
    if (length > max) throw new Error("long");
    return Array.from({ length }, () => this.varint());
  }
  take(length: number): Uint8Array {
    if (this.at + length > this.bytes.length) throw new Error("short");
    return this.bytes.slice(this.at, (this.at += length));
  }
  get done() {
    return this.at === this.bytes.length;
  }
}

function readV2(body: string): BuildDraft | null {
  const base64 = body.replace(/-/g, "+").replace(/_/g, "/");
  const r = new Reader(Uint8Array.from(atob(base64), (ch) => ch.charCodeAt(0)));
  const nameLength = r.varint();
  if (nameLength > 240) return null;
  const name = new TextDecoder("utf-8", { fatal: true }).decode(r.take(nameLength));
  const championId = r.varint();
  const position = POSITIONS[r.varint() - 1] ?? null;
  const primaryStyle = r.varint();
  const subStyle = r.varint();
  const perks = r.list(9);
  const spells = r.list(2);
  const [start, core, rest] = [r.list(6), r.list(6), r.list(6)];
  const skills = r.list(3);
  if (!r.done || spells.length !== 2 || championId === 0) return null;
  return {
    name: name.slice(0, 60),
    championId,
    position,
    runes: { primaryStyle, subStyle, perks },
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
}

/** The first Vizier code in a piece of text, for pasting a whole message. */
export function findShareCode(text: string): string | null {
  return text.match(/VZ(?:B1|2):[A-Za-z0-9_=+/-]+/)?.[0] ?? null;
}

const ints = (value: unknown, max = 12): number[] | null =>
  Array.isArray(value) && value.length <= max && value.every((n) => Number.isInteger(n) && n >= 0) ? (value as number[]) : null;

/** A build from a code, or null if the code is damaged or not Vizier's. */
export function readShareCode(code: string): BuildDraft | null {
  const trimmed = code.trim();
  if (trimmed.startsWith(PREFIX_V2)) {
    try {
      return readV2(trimmed.slice(PREFIX_V2.length));
    } catch {
      return null;
    }
  }
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
