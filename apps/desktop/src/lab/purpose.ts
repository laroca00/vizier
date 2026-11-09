import type { ItemDetail } from "../data/ddragon";
import { sumStats } from "./totals";

// A short reading of a build from the stats it adds up to. The thresholds are
// hand-kept rules of thumb, not statistics, and the page labels the line so.

export type Purpose = { damage: string; extras: string[]; survival: string };

const PEN_TAGS = ["ArmorPenetration", "MagicPenetration"];

type Rated = Pick<ItemDetail, "stats" | "tags">;

export function purposeOf(ids: number[], details: Map<number, Rated>): Purpose | null {
  if (ids.length === 0) return null;
  const totals = sumStats(ids, details);
  const ap = totals.FlatMagicDamageMod ?? 0;
  const ad = totals.FlatPhysicalDamageMod ?? 0;
  const hp = totals.FlatHPPoolMod ?? 0;
  const resist = (totals.FlatArmorMod ?? 0) + (totals.FlatSpellBlockMod ?? 0);
  const tags = ids.flatMap((id) => details.get(id)?.tags ?? []);

  const damage = ap >= 100 && ad >= 60 ? "Karma hasar" : ap >= 100 && ap > ad ? "Büyü hasarı ağırlıklı" : ad >= 60 && ad >= ap ? "Fiziksel hasar ağırlıklı" : "Hasar eşyası az";
  const extras: string[] = [];
  if (tags.some((tag) => PEN_TAGS.includes(tag))) extras.push("delme var");
  if ((totals.PercentLifeStealMod ?? 0) >= 0.1 || tags.includes("SpellVamp")) extras.push("can çalma var");
  if (tags.includes("Active") || tags.includes("Aura")) extras.push("kullanılabilir etki var");
  const survival = hp >= 1500 || resist >= 100 ? "dayanıklılık yüksek" : hp >= 800 || resist >= 50 ? "dayanıklılık orta" : "dayanıklılık az";
  return { damage, extras, survival };
}
