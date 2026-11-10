import { BRACKET_LABELS, REGIONS, REGION_LABELS } from "@vizier/shared/brackets";
import { useLang, useT } from "../i18n";
import { RANK_CHOICES, type RankChoice, type RegionChoice } from "../rankChoice";
import { useRank } from "../rank";
import { regionApplies } from "../rankChoice";
import { updateSettings, useSettings } from "../settings";
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

/** A read-only note of which rank the page's numbers are for, where there is no room for the picker. */
export function RankChip() {
  const t = useT();
  const lang = useLang() === "en" ? "en" : "tr";
  const { bracket, inDraft } = useRank();
  return (
    <span className="rank-chip" title={inDraft ? t("Kendi rankının verisi (Ayarlar'dan değiştirilir)") : t("Seçili rank filtresi")}>
      {t("Veri: {rank}", { rank: BRACKET_LABELS[bracket][lang] })}
    </span>
  );
}

/**
 * TR, EUW, KR or all three. Regional numbers exist only for Emerald+ and all ranks,
 * so in other brackets the choice waits, disabled, with a note.
 */
export function RegionPicker() {
  const t = useT();
  const { region } = useSettings();
  const { bracket } = useRank();
  const available = regionApplies(bracket);
  return (
    <span className="rank-picker">
      <Select<RegionChoice>
        label={t("Bölge")}
        hideLabel
        value={available ? region : "all"}
        disabled={!available}
        options={[{ value: "all", label: t("Tüm bölgeler") }, ...REGIONS.map((id) => ({ value: id, label: REGION_LABELS[id] }))]}
        onChange={(next) => updateSettings({ region: next })}
      />
      {!available && <span className="rank-picker__note">{t("Bölge verisi yalnız Zümrüt+ ve Hepsi için var")}</span>}
    </span>
  );
}
