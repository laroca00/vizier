import { BRACKET_LABELS } from "@vizier/shared/brackets";
import { useLang, useT } from "../i18n";
import { RANK_CHOICES, type RankChoice } from "../rankChoice";
import { useRank } from "../rank";
import { updateSettings } from "../settings";
import { Select } from "./Fields";
import "./RankPicker.css";

/**
 * The rank bracket the crawler stats are read for: one choice for the whole
 * app, kept in settings. Shown as a chip so a page always says which rank it is.
 */
export function RankPicker() {
  const t = useT();
  const lang = useLang() === "en" ? "en" : "tr";
  const { choice, fellBack } = useRank();
  return (
    <span className="rank-picker">
      <Select<RankChoice>
        label={t("Lig")}
        hideLabel
        value={choice}
        options={RANK_CHOICES.map((id) => ({ value: id, label: id === "mine" ? t("Benim rankım") : BRACKET_LABELS[id][lang] }))}
        onChange={(rank) => updateSettings({ rank })}
      />
      {fellBack && <span className="rank-picker__note">{t("Rankın bilinmiyor, Zümrüt+ gösteriliyor")}</span>}
    </span>
  );
}
