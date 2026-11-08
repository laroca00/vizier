import type { Lang } from "../i18n";

// Augment names and icons from CommunityDragon, which publishes the client's
// own game data; Data Dragon has none. The client's list covers Arena and
// ARAM Mayhem alike.

const BASE = "https://raw.communitydragon.org/latest";
const GAME_DATA = `${BASE}/plugins/rcp-be-lol-game-data/global`;

export type AugmentInfo = { id: number; name: string; icon: string; rarity: number };
type RawAugment = { id: number; augmentNameId: string; nameTRA: string; augmentSmallIconPath: string; rarity: string };

const RARITY_IDS: Record<string, number> = { kSilver: 0, kGold: 1, kPrismatic: 2 };

/** Client asset paths start with /lol-game-data/assets/ and are served lowercase under default/. */
export function assetUrl(path: string): string {
  return `${GAME_DATA}/default/${path.replace(/^\/lol-game-data\/assets\//i, "").toLowerCase()}`;
}

export function parseAugments(raw: RawAugment[]): Map<number, AugmentInfo> {
  return new Map(
    raw
      .filter((a) => Number.isInteger(a.id) && a.nameTRA)
      .map((a) => [a.id, { id: a.id, name: a.nameTRA, icon: assetUrl(a.augmentSmallIconPath ?? ""), rarity: RARITY_IDS[a.rarity] ?? 4 }]),
  );
}

const byLang = new Map<Lang, Promise<Map<number, AugmentInfo>>>();
let raw: Promise<RawAugment[]> | null = null;

function rawAugments(lang: Lang): Promise<RawAugment[]> {
  return fetch(`${GAME_DATA}/${lang === "tr" ? "tr_tr" : "en_gb"}/v1/cherry-augments.json`).then((r) => r.json() as Promise<RawAugment[]>);
}

export function augmentInfo(lang: Lang): Promise<Map<number, AugmentInfo>> {
  let info = byLang.get(lang);
  if (!info) {
    info = rawAugments(lang).then(parseAugments);
    byLang.set(lang, info);
    info.catch(() => byLang.delete(lang));
  }
  return info;
}

/** The client's mode names: Arena is CHERRY, ARAM Mayhem is KIWI. */
export type AugmentMode = "CHERRY" | "KIWI";

/** Ids of the augments a mode hands out, matched through their internal names. */
export function modeAugmentIds(lists: { modeName: string; augmentList: string[] }[], augments: { id: number; augmentNameId: string }[], mode: AugmentMode): number[] {
  const byName = new Map(augments.map((a) => [String(a.augmentNameId).toLowerCase(), a.id]));
  const list = lists.find((l) => l.modeName === mode)?.augmentList ?? [];
  return [...new Set(list.map((path) => byName.get(path.split("/").pop()!.toLowerCase())).filter((id): id is number => id !== undefined))];
}

const byMode = new Map<AugmentMode, Promise<number[]>>();

export function modeAugments(mode: AugmentMode): Promise<number[]> {
  let ids = byMode.get(mode);
  if (!ids && mode === "CHERRY") {
    // The client's CHERRY list is a short event subset; CommunityDragon's Arena export has the full pool.
    ids = fetch(`${BASE}/cdragon/arena/en_gb.json`)
      .then((r) => r.json() as Promise<{ augments: { id: number }[] }>)
      .then(({ augments }) => augments.map((a) => a.id));
    byMode.set(mode, ids);
    ids.catch(() => byMode.delete(mode));
  }
  if (!ids) {
    raw ??= rawAugments("en");
    ids = Promise.all([fetch(`${GAME_DATA}/default/v1/augment-lists.json`).then((r) => r.json()), raw]).then(([lists, augments]) => modeAugmentIds(lists, augments, mode));
    byMode.set(mode, ids);
    ids.catch(() => {
      byMode.delete(mode);
      raw = null;
    });
  }
  return ids;
}

/** CommunityDragon's rarity numbers. */
export const RARITY: Record<number, string> = { 0: "Gümüş", 1: "Altın", 2: "Prizmatik", 4: "Özel" };

const TIER_ORDER = ["S", "A", "B", "C", "D"];

/** The augments to look for first: best tier, then win rate. The API's own order is not relied on. */
export function pickOrder<T extends { tier: string; winRate: number }>(augments: T[], count: number): T[] {
  const rank = (tier: string) => {
    const i = TIER_ORDER.indexOf(tier);
    return i < 0 ? TIER_ORDER.length : i;
  };
  return [...augments].sort((a, b) => rank(a.tier) - rank(b.tier) || b.winRate - a.winRate).slice(0, count);
}
