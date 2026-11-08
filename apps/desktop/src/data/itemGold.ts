// Gold value of an item's stats at the price of the basic items that carry
// only that stat. These prices are the community's long-used estimates, kept
// by hand: change them here if a patch moves the base items.
// Keys are Data Dragon's stat names; percent stats arrive as fractions (0.25 is 25%).

export const STAT_PRICES: Record<string, { gold: number; label: string; percent?: boolean }> = {
  FlatPhysicalDamageMod: { gold: 35, label: "Saldırı gücü" },
  FlatMagicDamageMod: { gold: 21.75, label: "Büyü gücü" },
  FlatArmorMod: { gold: 20, label: "Zırh" },
  FlatSpellBlockMod: { gold: 18, label: "Büyü direnci" },
  FlatHPPoolMod: { gold: 2.67, label: "Can" },
  FlatMPPoolMod: { gold: 1.4, label: "Mana" },
  PercentAttackSpeedMod: { gold: 25, label: "Saldırı hızı", percent: true },
  FlatCritChanceMod: { gold: 40, label: "Kritik şansı", percent: true },
  PercentLifeStealMod: { gold: 27.5, label: "Can çalma", percent: true },
  FlatMovementSpeedMod: { gold: 12, label: "Hareket hızı" },
  PercentMovementSpeedMod: { gold: 39.5, label: "Hareket hızı yüzdesi", percent: true },
};

/** Gold the listed stats are worth; stats the table doesn't price count for nothing. */
export function statGold(stats: Record<string, number>): number {
  let total = 0;
  for (const [key, value] of Object.entries(stats)) {
    const price = STAT_PRICES[key];
    if (!price || !Number.isFinite(value)) continue;
    total += value * (price.percent ? 100 : 1) * price.gold;
  }
  return total;
}

/** Stat gold over the full price; null when the item has no price or nothing in the table. */
export function goldEfficiency(stats: Record<string, number>, price: number): number | null {
  const value = statGold(stats);
  return price > 0 && value > 0 ? value / price : null;
}
