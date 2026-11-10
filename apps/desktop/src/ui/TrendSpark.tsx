import { formatPercent, useLang, useT } from "../i18n";
import type { Trend } from "../data/history";
import { Sparkline } from "./Sparkline";

/** Win rate over the days of the patch as a small line; the title gives the ends and the games behind them. */
export function TrendSpark({ trend }: { trend: Trend | null }) {
  const t = useT();
  const lang = useLang();
  if (!trend) return null;
  return (
    <Sparkline
      values={trend.values}
      label={t("Yama boyunca kazanma oranı: {first} → {last}, {games} maç", {
        first: formatPercent(trend.first, lang, 1),
        last: formatPercent(trend.last, lang, 1),
        games: trend.games.toLocaleString(),
      })}
    />
  );
}
