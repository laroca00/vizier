import type { Lang } from "../i18n";

// Augment names and icons from CommunityDragon, which publishes the client's
// own Arena data; Data Dragon has none.

const BASE = "https://raw.communitydragon.org/latest";

export type AugmentInfo = { id: number; name: string; icon: string; rarity: number };

const byLang = new Map<Lang, Promise<Map<number, AugmentInfo>>>();

export function augmentInfo(lang: Lang): Promise<Map<number, AugmentInfo>> {
  let info = byLang.get(lang);
  if (!info) {
    info = fetch(`${BASE}/cdragon/arena/${lang === "tr" ? "tr_tr" : "en_gb"}.json`)
      .then((r) => r.json() as Promise<{ augments: { id: number; name: string; iconSmall: string; rarity: number }[] }>)
      .then(({ augments }) => new Map(augments.map((a) => [a.id, { id: a.id, name: a.name, icon: `${BASE}/game/${a.iconSmall.toLowerCase()}`, rarity: a.rarity }])));
    byLang.set(lang, info);
    info.catch(() => byLang.delete(lang));
  }
  return info;
}

/** CommunityDragon's rarity numbers. */
export const RARITY: Record<number, string> = { 0: "Gümüş", 1: "Altın", 2: "Prizmatik", 4: "Özel" };
