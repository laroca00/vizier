import type { BuildStyle } from "./api";

// Turkish source strings, translated through t(). Short enough to fit the
// client's rune page and item set names.
export const STYLE_NAMES: Record<BuildStyle, string> = {
  crit: "Kritik",
  onhit: "On-hit",
  hybrid: "Hibrit",
  ap: "AP",
  lethality: "Lethality",
  bruiser: "Bruiser",
  tank: "Tank",
  enchanter: "Enchanter",
  ad: "AD",
};
