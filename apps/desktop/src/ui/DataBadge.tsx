import { useSyncExternalStore } from "react";
import { CONFIDENCE_LABEL, type Confidence, confidenceOf, wilson, type Sample } from "../data/confidence";
import { ageText } from "../data/freshness";
import { latestVersion } from "../data/ddragon";
import { formatPercent, useLang, useT } from "../i18n";
import { useOpenSources } from "../sourcesLink";
import { rankLabel, useBracket } from "../rank";
import { REGION_LABELS } from "@vizier/shared/brackets";
import { activeRegion, subscribeRank } from "../rankChoice";
import { useAsync } from "../useAsync";

type Props =
  | (Sample & { source?: string; editorial?: false; ranked?: boolean })
  | { editorial: true; source?: string };

/**
 * A small label saying how far a number can be trusted, with the source,
 * patches, games and the 95% interval in its tooltip.
 */
export function DataBadge(props: Props) {
  const t = useT();
  const lang = useLang();
  const openSources = useOpenSources();
  const bracket = useBracket();
  const region = useSyncExternalStore(subscribeRank, () => activeRegion() ?? "");
  const [version] = useAsync("ddragon-version", latestVersion);
  const badge = (level: Confidence, title: string) =>
    openSources ? (
      <button type="button" className="data-badge" data-confidence={level} title={`${title}\n${t("Veriler nereden geliyor?")}`} onClick={openSources}>
        {t(CONFIDENCE_LABEL[level])}
      </button>
    ) : (
      <span className="data-badge" data-confidence={level} title={title}>
        {t(CONFIDENCE_LABEL[level])}
      </span>
    );
  if (props.editorial) {
    const title = props.source ?? t("Maç verisinden değil; Vizier'in elle tuttuğu bir tablo.");
    return badge("editorial", [title].join("\n"));
  }
  const level = confidenceOf({ ...props, currentPatch: props.currentPatch ?? (version.status === "done" ? version.value : null) });
  const { low, high } = wilson(props.winRate, props.games);
  const lines = [
    props.source,
    props.ranked ? t("Rank: {rank}", { rank: rankLabel(bracket, lang === "en" ? "en" : "tr") + (region ? ` · ${REGION_LABELS[region as keyof typeof REGION_LABELS]}` : "") }) : null,
    props.patches && props.patches.length > 0 ? t("Yama {patch}", { patch: props.patches.join(", ") }) : null,
    t("{games} maç", { games: props.games }),
    ageText(t, props.updatedAt),
    props.games > 0 ? t("%95 aralık: {low} – {high}", { low: formatPercent(low, lang, 1), high: formatPercent(high, lang, 1) }) : null,
  ].filter(Boolean);
  return badge(level, lines.join("\n"));
}
