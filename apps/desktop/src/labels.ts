// Role and champ select phase names as the Turkish League client shows them; English via i18n.
import { intlLocale, translate, type Lang } from "./i18n";

export const POSITIONS: Record<string, string> = {
  TOP: "Üst koridor",
  JUNGLE: "Orman",
  MIDDLE: "Orta koridor",
  BOTTOM: "Alt koridor",
  UTILITY: "Destek",
};

const DRAFT_PHASES: Record<string, string> = {
  PLANNING: "Niyet belirleme",
  BAN_PICK: "Seçim ve yasaklar",
  FINALIZATION: "Son hazırlık",
  GAME_STARTING: "Oyun başlıyor",
};

export function draftPhaseLabel(phase: string, lang: Lang = "tr") {
  return translate(lang, DRAFT_PHASES[phase] ?? phase);
}

/** The LCU sends lowercase positions, match-v5 uppercase. */
export function positionLabel(position: string, lang: Lang = "tr") {
  const name = POSITIONS[position.toUpperCase()];
  return name ? translate(lang, name) : null;
}

export function timeAgo(timestamp: number, lang: Lang = "tr", now = Date.now()) {
  const relative = new Intl.RelativeTimeFormat(intlLocale(lang), { numeric: "auto" });
  const minutes = Math.round((timestamp - now) / 60_000);
  if (Math.abs(minutes) < 60) return relative.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return relative.format(hours, "hour");
  return relative.format(Math.round(hours / 24), "day");
}
