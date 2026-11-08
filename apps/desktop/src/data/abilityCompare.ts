import type { Ability } from "./ddragon";

const KEYS = ["Q", "W", "E", "R"] as const;
export type AbilityKey = (typeof KEYS)[number];

export type CooldownPair = { first: number; max: number };
export type CompareRow = { key: AbilityKey; a: Ability | null; b: Ability | null };

/** Cooldown at rank 1 and at max rank, or null for abilities Data Dragon lists no cooldown for. */
export function cooldownPair(ability: Ability | null): CooldownPair | null {
  const list = ability?.cooldowns.filter((c) => c > 0) ?? [];
  return list.length ? { first: list[0], max: list[list.length - 1] } : null;
}

export function compareRows(a: Ability[], b: Ability[]): CompareRow[] {
  return KEYS.map((key) => ({ key, a: a.find((x) => x.key === key) ?? null, b: b.find((x) => x.key === key) ?? null }));
}

// A cooldown shorter than this is back before a trade can be planned around it.
const WINDOW_MIN_SECONDS = 6;

export type WindowLine = { key: AbilityKey; name: string; seconds: number; ultimate: boolean };

/**
 * When the opponent is weakest to a trade: their longest basic cooldown at
 * rank 1, and their ultimate, which comes at level 6.
 */
export function windowLines(abilities: Ability[]): WindowLine[] {
  const lines: WindowLine[] = [];
  const basics = abilities
    .filter((a) => a.key === "Q" || a.key === "W" || a.key === "E")
    .map((a) => ({ a, pair: cooldownPair(a) }))
    .filter((x): x is { a: Ability; pair: CooldownPair } => x.pair !== null && x.pair.first >= WINDOW_MIN_SECONDS)
    .sort((x, y) => y.pair.first - x.pair.first);
  if (basics[0]) lines.push({ key: basics[0].a.key as AbilityKey, name: basics[0].a.name, seconds: basics[0].pair.first, ultimate: false });
  const ult = abilities.find((a) => a.key === "R");
  const pair = cooldownPair(ult ?? null);
  if (ult && pair) lines.push({ key: "R", name: ult.name, seconds: pair.first, ultimate: true });
  return lines;
}
