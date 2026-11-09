import { CONFIDENCE_LABEL, confidenceOf, wilson, type Sample } from "../data/confidence";
import { latestVersion } from "../data/ddragon";
import { formatPercent, useLang, useT } from "../i18n";
import { useAsync } from "../useAsync";

type Props =
  | (Sample & { source?: string; editorial?: false })
  | { editorial: true; source?: string };

/**
 * A small label saying how far a number can be trusted, with the source,
 * patches, games and the 95% interval in its tooltip.
 */
export function DataBadge(props: Props) {
  const t = useT();
  const lang = useLang();
  const [version] = useAsync("ddragon-version", latestVersion);
  if (props.editorial) {
    const title = props.source ?? t("Maç verisinden değil; Vizier'in elle tuttuğu bir tablo.");
    return (
      <span className="data-badge" data-confidence="editorial" title={title}>
        {t(CONFIDENCE_LABEL.editorial)}
      </span>
    );
  }
  const level = confidenceOf({ ...props, currentPatch: props.currentPatch ?? (version.status === "done" ? version.value : null) });
  const { low, high } = wilson(props.winRate, props.games);
  const lines = [
    props.source,
    props.patches && props.patches.length > 0 ? t("Yama {patch}", { patch: props.patches.join(", ") }) : null,
    t("{games} maç", { games: props.games }),
    props.games > 0 ? t("%95 aralık: {low} – {high}", { low: formatPercent(low, lang, 1), high: formatPercent(high, lang, 1) }) : null,
  ].filter(Boolean);
  return (
    <span className="data-badge" data-confidence={level} title={lines.join("\n")}>
      {t(CONFIDENCE_LABEL[level])}
    </span>
  );
}
