import type { Lang } from "../i18n";
import { diffChampions, diffItems, diffRunes, type EntityDiff, type RawChampion, type RawItem, type RawRuneStyle } from "./diff";

const BASE = "https://ddragon.leagueoflegends.com";
const SHOWN_VERSIONS = 12;
// Not under "vizier." so the cached diffs stay out of exported settings.
const CACHE_PREFIX = "patchdiff.v2.";

let versionList: Promise<string[]> | undefined;

/** Recent live patches, newest first; Data Dragon also lists old "lolpatch" builds, which are left out. */
export function patchVersions(): Promise<string[]> {
  versionList ??= fetch(`${BASE}/api/versions.json`)
    .then((r) => r.json() as Promise<string[]>)
    .then((all) => all.filter((v) => /^\d+\.\d+\.\d+$/.test(v)).slice(0, SHOWN_VERSIONS));
  return versionList;
}

/** "16.22.1" is patch 16.22. */
export const patchName = (version: string) => version.split(".").slice(0, 2).join(".");

const locale = (lang: Lang) => (lang === "tr" ? "tr_TR" : "en_GB");

async function json<T>(version: string, file: string, lang: Lang): Promise<T> {
  const response = await fetch(`${BASE}/cdn/${version}/data/${locale(lang)}/${file}`);
  if (!response.ok) throw new Error(`${file} ${response.status}`);
  return response.json() as Promise<T>;
}

/** A diff the patch tracker already computed, or null; never downloads anything. */
export function cachedPatchDiff(from: string, to: string, lang: Lang): PatchDiff | null {
  try {
    const hit = localStorage.getItem(`${CACHE_PREFIX}${from}.${to}.${lang}`);
    return hit ? (JSON.parse(hit) as PatchDiff) : null;
  } catch {
    return null;
  }
}

export type PatchDiff = { from: string; to: string; entries: EntityDiff[]; itemNames: Record<string, string> };

/**
 * Every change between two versions. Computed once per version pair and
 * language, then kept on this computer: both versions' full champion files
 * are several megabytes.
 */
export async function patchDiff(from: string, to: string, lang: Lang): Promise<PatchDiff> {
  const key = `${CACHE_PREFIX}${from}.${to}.${lang}`;
  try {
    const hit = localStorage.getItem(key);
    if (hit) return JSON.parse(hit) as PatchDiff;
  } catch {
    // Computed again below.
  }
  const [champsA, champsB, itemsA, itemsB, runesA, runesB] = await Promise.all([
    json<{ data: Record<string, RawChampion> }>(from, "championFull.json", lang),
    json<{ data: Record<string, RawChampion> }>(to, "championFull.json", lang),
    json<{ data: Record<string, RawItem> }>(from, "item.json", lang),
    json<{ data: Record<string, RawItem> }>(to, "item.json", lang),
    json<RawRuneStyle[]>(from, "runesReforged.json", lang),
    json<RawRuneStyle[]>(to, "runesReforged.json", lang),
  ]);
  const result: PatchDiff = {
    from,
    to,
    entries: [...diffChampions(champsA.data, champsB.data), ...diffItems(itemsA.data, itemsB.data), ...diffRunes(runesA, runesB)],
    itemNames: Object.fromEntries(Object.entries({ ...itemsA.data, ...itemsB.data }).map(([id, item]) => [id, item.name])),
  };
  try {
    localStorage.setItem(key, JSON.stringify(result));
  } catch {
    // Too big or storage is full; it is computed again next time.
  }
  return result;
}
