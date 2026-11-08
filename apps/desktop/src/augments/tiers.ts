import type { AugmentStat } from "../api";

export const TIERS = ["S", "A", "B", "C", "D"] as const;

export type TierRow<T> = { tier: string; augments: T[] };

/** Augments laid out as tier rows, best first; empty tiers are left out. */
export function tierRows<T extends { tier: string; winRate: number }>(augments: T[], keep: (a: T) => boolean = () => true): TierRow<T>[] {
  return TIERS.map((tier) => ({
    tier,
    augments: augments.filter((a) => a.tier === tier && keep(a)).sort((a, b) => b.winRate - a.winRate),
  })).filter((row) => row.augments.length > 0);
}

export type AugmentColumn = "tier" | "name" | "pick" | "win" | "games";

const TIER_RANK = (tier: string) => {
  const i = (TIERS as readonly string[]).indexOf(tier);
  return i < 0 ? TIERS.length : i;
};

/** Sorts the augment table. Ties fall back to win rate so the order stays stable between renders. */
export function sortAugments(rows: AugmentStat[], column: AugmentColumn, desc: boolean, nameOf: (id: number) => string, lang: string): AugmentStat[] {
  const value = (a: AugmentStat, b: AugmentStat): number => {
    switch (column) {
      case "tier":
        return TIER_RANK(b.tier) - TIER_RANK(a.tier);
      case "name":
        return nameOf(a.augmentId).localeCompare(nameOf(b.augmentId), lang);
      case "pick":
        return a.pickRate - b.pickRate;
      case "games":
        return a.games - b.games;
      case "win":
        return a.winRate - b.winRate;
    }
  };
  return [...rows].sort((a, b) => (desc ? -1 : 1) * (value(a, b) || a.winRate - b.winRate));
}

/** A rate difference in percentage points, signed: "+4.2", "−1.0". Null when the server sent none. */
export function formatDelta(delta: number | undefined, lang: string): string | null {
  if (delta === undefined || !Number.isFinite(delta)) return null;
  const points = Math.round(delta * 1000) / 10;
  const text = Math.abs(points).toLocaleString(lang === "tr" ? "tr" : "en-GB", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return `${points > 0 ? "+" : points < 0 ? "−" : "±"}${text}`;
}

/** The augment queue a live game belongs to, from the Live Client's game mode: Arena is CHERRY, ARAM Mayhem is KIWI. */
export function augmentQueue(gameMode: string): number | null {
  return gameMode === "CHERRY" ? 1700 : gameMode === "KIWI" ? 2400 : null;
}

// Arena hands out one rarity per round, so the in-game card answers "which of these three".
const OVERLAY_RARITIES = [2, 1, 0];

/** The best few augments of each rarity, best tier first, for the in-game card. */
export function augmentsByRarity<T extends { augmentId: number; tier: string; winRate: number }>(
  augments: T[],
  rarityOf: (augmentId: number) => number | undefined,
  perRarity: number,
): { rarity: number; augments: T[] }[] {
  return OVERLAY_RARITIES.map((rarity) => ({
    rarity,
    augments: tierRows(augments, (a) => rarityOf(a.augmentId) === rarity)
      .flatMap((row) => row.augments)
      .slice(0, perRarity),
  })).filter((group) => group.augments.length > 0);
}
