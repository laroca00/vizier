import { champions, itemDetails, items, latestVersion, runes, summonerSpells, type Champion, type Item, type ItemDetail, type Rune, type RuneStyle, type SummonerSpell } from "../data/ddragon";

export type LibraryData = {
  version: string;
  champions: Map<number, Champion>;
  items: Map<number, Item>;
  /** Stats and prices, for filtering items by what they give. */
  details: Map<number, ItemDetail>;
  styles: Map<number, RuneStyle>;
  runes: Map<number, Rune>;
  spells: Map<number, SummonerSpell>;
};

export async function loadLibraryData(): Promise<LibraryData> {
  const [version, championList, itemList, details, styles, spells] = await Promise.all([latestVersion(), champions(), items(), itemDetails(), runes(), summonerSpells()]);
  const runeById = new Map([...styles.values()].flatMap((s) => s.slots.flat().map((r) => [r.id, r] as const)));
  return { version, champions: championList, items: itemList, details, styles, runes: runeById, spells };
}

/** Summoner's Rift spells, the ones a saved build can use. */
export const RIFT_SPELLS = [4, 14, 12, 11, 7, 3, 21, 1, 6];

export const SKILL_ORDERS = [
  [1, 2, 3],
  [1, 3, 2],
  [2, 1, 3],
  [2, 3, 1],
  [3, 1, 2],
  [3, 2, 1],
];

export const skillOrderLabel = (order: number[]) => order.map((s) => ["", "Q", "W", "E"][s]).join(" > ");
