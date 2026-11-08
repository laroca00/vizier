import { isTauri } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";

/** Riot's game update news, where each patch's official notes are posted. */
export const PATCH_NOTES = { tr: "https://www.leagueoflegends.com/tr-tr/news/game-updates/", en: "https://www.leagueoflegends.com/en-gb/news/game-updates/" };

/** Opens a page in the player's browser, not inside Vizier. */
export function openExternal(url: string) {
  if (isTauri()) openUrl(url).catch(() => {});
  else window.open(url, "_blank", "noopener");
}
