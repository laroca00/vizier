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

// The style picked on the build page, so the overlay suggests items from the same build.
const styleKey = (championId: number, position: string | null) => `vizier.buildStyle.${championId}.${position ?? "ANY"}`;

export function readChosenStyle(championId: number, position: string | null): BuildStyle | null {
  try {
    return (localStorage.getItem(styleKey(championId, position)) as BuildStyle | null) ?? null;
  } catch {
    return null;
  }
}

export function saveChosenStyle(championId: number, position: string | null, style: BuildStyle) {
  try {
    localStorage.setItem(styleKey(championId, position), style);
  } catch {
    // The overlay falls back to the most played style.
  }
}
