// Tier and queue names as the Turkish League client shows them; English via i18n.
import { intlLocale, translate, type Lang } from "./i18n";

const TIERS: Record<string, string> = {
  IRON: "Demir",
  BRONZE: "Bronz",
  SILVER: "Gümüş",
  GOLD: "Altın",
  PLATINUM: "Platin",
  EMERALD: "Zümrüt",
  DIAMOND: "Elmas",
  MASTER: "Ustalık",
  GRANDMASTER: "Büyük Ustalık",
  CHALLENGER: "Şampiyonluk",
};

const APEX = new Set(["MASTER", "GRANDMASTER", "CHALLENGER"]);

const QUEUES: Record<string, string> = {
  RANKED_SOLO_5x5: "Tek/Çift",
  RANKED_FLEX_SR: "Esnek",
};

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

export function tierLabel(tier: string, division: string, lang: Lang = "tr") {
  const name = translate(lang, TIERS[tier] ?? tier);
  return APEX.has(tier) ? name : `${name} ${division}`;
}

export function queueLabel(queueType: string, lang: Lang = "tr") {
  return translate(lang, QUEUES[queueType] ?? queueType);
}

export function timeAgo(timestamp: number, lang: Lang = "tr", now = Date.now()) {
  const relative = new Intl.RelativeTimeFormat(intlLocale(lang), { numeric: "auto" });
  const minutes = Math.round((timestamp - now) / 60_000);
  if (Math.abs(minutes) < 60) return relative.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return relative.format(hours, "hour");
  return relative.format(Math.round(hours / 24), "day");
}
