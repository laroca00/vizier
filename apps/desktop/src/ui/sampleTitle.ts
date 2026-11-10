import { ageText } from "../data/freshness";
import { wilson } from "../data/confidence";
import { formatPercent, type Lang } from "../i18n";

type Translate = (text: string, params?: Record<string, string | number>) => string;

/** Tooltip text for a sample in rows that carry no chip of their own. */
export function sampleTitle(
  t: Translate,
  lang: Lang,
  sample: { games: number; winRate: number; patches?: string[]; updatedAt?: number; bracket?: string },
  source?: string,
): string {
  const { low, high } = wilson(sample.winRate, sample.games);
  return [
    source,
    sample.bracket ? t("Rank: {rank}", { rank: sample.bracket }) : null,
    sample.patches && sample.patches.length > 0 ? t("Yama {patch}", { patch: sample.patches.join(", ") }) : null,
    t("{games} maç", { games: sample.games }),
    ageText(t, sample.updatedAt),
    sample.games > 0 ? t("%95 aralık: {low} – {high}", { low: formatPercent(low, lang, 1), high: formatPercent(high, lang, 1) }) : null,
  ]
    .filter(Boolean)
    .join("\n");
}
