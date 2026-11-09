// Rank brackets, shared by the crawler, the Worker and the app so all three
// sum and name tiers the same way. No server or UI imports here.

/** The smallest unit the crawler stores a game under. */
export const TIER_GROUPS = ["iron_bronze", "silver", "gold", "platinum", "emerald", "diamond", "master_plus"] as const;
export type TierGroup = (typeof TIER_GROUPS)[number];

/** Brackets a player can pick; each is a sum of tier groups. */
export const BRACKETS = ["all", "gold_minus", "platinum_plus", "emerald_plus", "diamond_plus", "master_plus"] as const;
export type Bracket = (typeof BRACKETS)[number];

/** Today's data, and what a request without a rank means. */
export const DEFAULT_BRACKET: Bracket = "emerald_plus";

const GROUP_OF_TIER: Record<string, TierGroup> = {
  IRON: "iron_bronze",
  BRONZE: "iron_bronze",
  SILVER: "silver",
  GOLD: "gold",
  PLATINUM: "platinum",
  EMERALD: "emerald",
  DIAMOND: "diamond",
  MASTER: "master_plus",
  GRANDMASTER: "master_plus",
  CHALLENGER: "master_plus",
};

const MEMBERS: Record<Bracket, readonly TierGroup[]> = {
  all: TIER_GROUPS,
  gold_minus: ["iron_bronze", "silver", "gold"],
  platinum_plus: ["platinum", "emerald", "diamond", "master_plus"],
  emerald_plus: ["emerald", "diamond", "master_plus"],
  diamond_plus: ["diamond", "master_plus"],
  master_plus: ["master_plus"],
};

/** Riot's tier name (any case) to its group; null for anything unknown. */
export function bracketOfTier(tier: string | null | undefined): TierGroup | null {
  return (tier && GROUP_OF_TIER[tier.toUpperCase()]) || null;
}

export function isTierGroup(value: unknown): value is TierGroup {
  return typeof value === "string" && (TIER_GROUPS as readonly string[]).includes(value);
}

export function isBracket(value: unknown): value is Bracket {
  return typeof value === "string" && (BRACKETS as readonly string[]).includes(value);
}

/** Parses a `?rank=` value: missing means the default, unknown is null. */
export function parseBracket(value: string | null | undefined): Bracket | null {
  if (value === undefined || value === null || value === "") return DEFAULT_BRACKET;
  return isBracket(value) ? value : null;
}

/** The tier groups a bracket sums. */
export function groupsOf(bracket: Bracket): readonly TierGroup[] {
  return MEMBERS[bracket];
}

/** Every published bracket a tier group counts towards. */
export function bracketsContaining(group: TierGroup): Bracket[] {
  return BRACKETS.filter((b) => MEMBERS[b].includes(group));
}

export const BRACKET_LABELS: Record<Bracket, { tr: string; en: string }> = {
  all: { tr: "Tüm ligler", en: "All ranks" },
  gold_minus: { tr: "Altın ve altı", en: "Gold and below" },
  platinum_plus: { tr: "Platin+", en: "Platinum+" },
  emerald_plus: { tr: "Zümrüt+", en: "Emerald+" },
  diamond_plus: { tr: "Elmas+", en: "Diamond+" },
  master_plus: { tr: "Usta+", en: "Master+" },
};

export const GROUP_LABELS: Record<TierGroup, { tr: string; en: string }> = {
  iron_bronze: { tr: "Demir–Bronz", en: "Iron–Bronze" },
  silver: { tr: "Gümüş", en: "Silver" },
  gold: { tr: "Altın", en: "Gold" },
  platinum: { tr: "Platin", en: "Platinum" },
  emerald: { tr: "Zümrüt", en: "Emerald" },
  diamond: { tr: "Elmas", en: "Diamond" },
  master_plus: { tr: "Usta+", en: "Master+" },
};

/** SQL list of a bracket's groups, for `IN (...)`; values come from the constants above only. */
export function groupsSql(bracket: Bracket): string {
  return MEMBERS[bracket].map((g) => `'${g}'`).join(",");
}

/** Where a game was played; tier lists and champion pages can be cut by it. */
export const REGIONS = ["tr", "euw", "kr"] as const;
export type Region = (typeof REGIONS)[number];

export function isRegion(value: unknown): value is Region {
  return typeof value === "string" && (REGIONS as readonly string[]).includes(value);
}

/** A match id starts with its platform (TR1_..., EUW1_..., KR_...). */
export function regionOfMatch(matchId: string): Region | null {
  const platform = matchId.split("_")[0];
  return platform === "TR1" ? "tr" : platform === "EUW1" ? "euw" : platform === "KR" ? "kr" : null;
}

/** Brackets that have per-region docs; every other bracket pools the regions. */
export const REGION_BRACKETS: readonly Bracket[] = ["emerald_plus", "all"];

/** The roll-up kind that counts `kind` for one region only; without a region the kind itself. */
export const regionKind = (kind: string, region?: Region) => (region ? `${kind}@${region}` : kind);
