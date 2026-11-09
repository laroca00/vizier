import raw from "./combos.json";

// Ability sequences written by hand for Vizier, in plain words of its own.
// They are editorial: not measured, and written against one patch
// (`writtenFor`), so a later patch can have changed an ability they use.

export const COMBO_CATEGORIES = ["basic", "trading", "all-in", "burst", "escape", "flash", "teamfight", "animation"] as const;
export type ComboCategory = (typeof COMBO_CATEGORIES)[number];

/** Q W E R, a second cast like Q2, an auto attack, or a summoner spell. */
export const SEQUENCE_TOKEN = /^(AA|Flash|Ignite|Ghost|Smite|[QWER][12]?)$/;

export type Localized = { tr: string; en: string };

export type Combo = {
  id: string;
  category: ComboCategory;
  /** 1 easy to 3 hard. */
  difficulty: 1 | 2 | 3;
  sequence: string[];
  name: Localized;
  purpose: Localized;
  timing: Localized;
  mistake: Localized;
};

export type ComboDoc = { writtenFor: string; champions: { championId: string; combos: Combo[] }[] };

export const COMBOS = raw as ComboDoc;

const byChampion = new Map(COMBOS.champions.map((c) => [c.championId, c.combos]));

/** The champion's combos, by Data Dragon id. */
export const combosOf = (championId: string): Combo[] => byChampion.get(championId) ?? [];

export const comboText = (text: Localized, lang: "tr" | "en") => text[lang];

export const CATEGORY_TEXT: Record<ComboCategory, string> = {
  basic: "Temel",
  trading: "Değiş tokuş",
  "all-in": "Her şeyi ver",
  burst: "Patlama",
  escape: "Kaçış",
  flash: "Flash",
  teamfight: "Takım dövüşü",
  animation: "Animasyon iptali",
};
