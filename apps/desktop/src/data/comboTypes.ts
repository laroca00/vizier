// The combo types and labels, without the combo text itself, so screens that
// only label combos (the overlay) don't load every champion's combos.

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
