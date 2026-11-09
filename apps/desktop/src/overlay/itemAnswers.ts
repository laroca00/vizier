import type { ItemAdvice, ItemRule } from "../draft/itemAdvice";

/** Short names for the overlay, where the champ select sentences don't fit. */
export const RULE_SHORT: Record<ItemRule, string> = {
  antiHeal: "İyileşme kesici",
  magicResist: "Büyü direnci",
  armor: "Zırh",
  crowdControl: "Kontrol kırıcı",
  burst: "Hayatta kalma",
  tanks: "Tank delici",
};

const SHOWN = 3;

/**
 * The answers still open in this game: advice the player already covered with
 * one of its items is dropped, so the card shrinks as the build fills in.
 */
export function openAnswers(advice: ItemAdvice[], owned: number[]): ItemAdvice[] {
  const have = new Set(owned);
  return advice.filter((a) => !a.items.some((id) => have.has(id))).slice(0, SHOWN);
}
