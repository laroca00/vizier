import { BRACKET_LABELS } from "@vizier/shared/brackets";
import { updateSettings, useSettings } from "../settings";
import { useLang, useT } from "../i18n";
import { Select } from "../ui/Fields";
import { cleanChoice, RANK_CHOICES, resolveBracket, type RankChoice } from "./rank";

/** The rank bracket every crawler number on the page is read for. The choice is saved and shared by all pages. */
export function RankPicker() {
  const t = useT();
  const lang = useLang();
  const { rank, myRank } = useSettings();
  const label = (choice: RankChoice) =>
    choice === "mine" ? t("Benim rankım ({rank})", { rank: BRACKET_LABELS[resolveBracket(choice, myRank)][lang] }) : BRACKET_LABELS[choice][lang];
  return (
    <span className="rank-picker" title={rank === "mine" && !myRank ? t("Rankın okunamadı, Zümrüt+ verisi gösteriliyor.") : t("İstatistikler bu rank grubunun maçlarından.")}>
      <Select
        label={t("Rank")}
        hideLabel
        value={rank}
        options={RANK_CHOICES.map((choice) => ({ value: choice, label: label(choice) }))}
        onChange={(value) => updateSettings({ rank: cleanChoice(value) })}
      />
    </span>
  );
}
