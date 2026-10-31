// Tier and queue names as the Turkish League client shows them.

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

export function tierLabel(tier: string, division: string) {
  const name = TIERS[tier] ?? tier;
  return APEX.has(tier) ? name : `${name} ${division}`;
}

export function queueLabel(queueType: string) {
  return QUEUES[queueType] ?? queueType;
}

const relative = new Intl.RelativeTimeFormat("tr", { numeric: "auto" });

export function timeAgo(timestamp: number, now = Date.now()) {
  const minutes = Math.round((timestamp - now) / 60_000);
  if (Math.abs(minutes) < 60) return relative.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return relative.format(hours, "hour");
  return relative.format(Math.round(hours / 24), "day");
}
