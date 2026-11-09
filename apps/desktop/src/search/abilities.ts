import { latestVersion } from "../data/ddragon";
import { fold } from "../fold";
import type { Topic } from "./topics";

type Raw = { data: Record<string, { key: string; name?: string; passive?: { name: string }; spells?: { name: string }[] }> };

const SLOTS = ["Q", "W", "E", "R"];
const cache = new Map<string, Promise<Topic[]>>();

/** Ability and passive names of every champion, from one Data Dragon file that is fetched when abilities are first searched. */
export function abilityTopics(lang: "tr" | "en"): Promise<Topic[]> {
  let hit = cache.get(lang);
  if (!hit) {
    hit = latestVersion()
      .then((version) => fetch(`https://ddragon.leagueoflegends.com/cdn/${version}/data/${lang === "tr" ? "tr_TR" : "en_GB"}/championFull.json`))
      .then((response) => (response.ok ? (response.json() as Promise<Raw>) : Promise.reject(new Error(String(response.status)))))
      .then((raw) => abilityTopicsFrom(raw));
    hit.catch(() => cache.delete(lang));
    cache.set(lang, hit);
  }
  return hit;
}

export function abilityTopicsFrom(raw: Raw): Topic[] {
  return Object.values(raw.data).flatMap((champion) => {
    const names = [champion.passive?.name, ...(champion.spells ?? []).map((s) => s.name)];
    return names.flatMap((name, i): Topic[] =>
      name
        ? [{ id: `ability:${champion.key}:${i}`, group: "ability", name: `${name} · ${champion.name ?? ""} ${i === 0 ? "P" : SLOTS[i - 1]}`.trim(), terms: [fold(name)], target: { champion: Number(champion.key) } }]
        : [],
    );
  });
}
