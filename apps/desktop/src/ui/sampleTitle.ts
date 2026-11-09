import { wilson } from "../data/confidence";
import { formatPercent, type Lang } from "../i18n";

type Translate = (text: string, params?: Record<string, string | number>) => string;

/** Tooltip text for a sample in rows that carry no chip of their own. */
export function sampleTitle(
  t: Translate,
  lang: Lang,
  sample: { games: number; winRate: number; patches?: string[] },
  source?: string,
): string {
  const { low, high } = wilson(sample.winRate, sample.games);
  return [
    source,
    sample.patches && sample.patches.length > 0 ? t("Yama {patch}", { patch: sample.patches.join(", ") }) : null,
    t("{games} maç", { games: sample.games }),
    sample.games > 0 ? t("%95 aralık: {low} – {high}", { low: formatPercent(low, lang, 1), high: formatPercent(high, lang, 1) }) : null,
  ]
    .filter(Boolean)
    .join("\n");
}
