import type { Ability, Champion } from "../data/ddragon";
import { phaseCurve, traitsOf } from "../data/traits";

// The ability to respect when it isn't the ultimate: the hard CC or the
// engage tool. Hand-kept; a champion not listed falls back to the ultimate.
export const THREAT_KEY: Record<string, "Q" | "W" | "E"> = {
  Blitzcrank: "Q", Thresh: "Q", Nautilus: "Q", Pyke: "Q", Morgana: "Q", Lux: "Q", Leona: "E", Ashe: "Q", Amumu: "Q",
  Ahri: "E", Syndra: "E", Xerath: "E", Lissandra: "W", Zyra: "E", Rell: "W", Alistar: "W", Bard: "Q", Elise: "E",
  Sejuani: "E", Skarner: "Q", Ornn: "E", Gragas: "E", Veigar: "E", Neeko: "E",
  Rakan: "W", Nami: "Q", Janna: "Q", Braum: "Q", Fiddlesticks: "W", Lulu: "W", Maokai: "W", Poppy: "E",
  Zac: "E", Jhin: "W", Camille: "E", Kled: "Q", Galio: "W", Sion: "Q", Taric: "E",
  Shen: "E",
};

export type Threat = {
  championId: number;
  name: string;
  ability: Ability;
  /** Cooldown at rank 1 and at max rank, seconds; null when Data Dragon has none. */
  cooldown: { first: number; max: number } | null;
  /** When the champion gets dangerous, as a template key. */
  spike: "early" | "six" | "items";
};

export function spikeOf(c: Champion): Threat["spike"] {
  const curve = phaseCurve(c);
  const traits = traitsOf(c);
  if (curve.early >= 3 && curve.early >= curve.late) return "early";
  if (traits.phase === "late" || curve.late >= 3) return "items";
  return "six";
}

export function threatOf(champion: Champion, abilities: Ability[]): Threat | null {
  const key = THREAT_KEY[champion.id] ?? "R";
  const ability = abilities.find((a) => a.key === key) ?? abilities.find((a) => a.key === "R");
  if (!ability) return null;
  const cds = ability.cooldowns.filter((n) => n > 0);
  return {
    championId: Number(champion.key),
    name: champion.name,
    ability,
    cooldown: cds.length ? { first: cds[0], max: cds[cds.length - 1] } : null,
    spike: spikeOf(champion),
  };
}

export const SPIKE_TEXT: Record<Threat["spike"], string> = {
  early: "İlk dakikalarda ve 3. seviyede tehlikeli",
  six: "6. seviyede ve ilk eşyada tehlikeli",
  items: "2-3 eşya tamamlanınca tehlikeli",
};
