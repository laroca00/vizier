import { AREA_TEXT, DIFFICULTY_AREAS, LEVEL_TEXT, difficultyBreakdownOf } from "../data/difficultyBreakdown";
import type { Champion } from "../data/ddragon";
import { useT } from "../i18n";
import { DataBadge } from "../ui/DataBadge";
import "./DifficultyPanel.css";

/** Seven areas as qualitative levels (Vizier's own reading) next to Data Dragon's official 1 to 10 number. */
export function DifficultyPanel({ champion }: { champion: Pick<Champion, "id" | "info"> }) {
  const t = useT();
  const breakdown = difficultyBreakdownOf(champion.id);
  if (!breakdown) return null;
  return (
    <section className="difficulty" aria-label={t("Zorluk dağılımı")}>
      <h2 className="draft__heading">{t("Zorluk dağılımı")}</h2>
      <p className="section-badge">
        <DataBadge editorial source={t("Vizier'in elle yazdığı bir değerlendirme; maç verisi değil.")} />
      </p>
      <ul className="difficulty__list">
        {DIFFICULTY_AREAS.map((area) => (
          <li key={area}>
            <span>{t(AREA_TEXT[area])}</span>
            <span className="difficulty__dots" data-level={breakdown[area]} role="img" aria-label={t(LEVEL_TEXT[breakdown[area]])}>
              {[1, 2, 3].map((n) => (
                <i key={n} data-on={n <= breakdown[area] || undefined} />
              ))}
            </span>
            <span className="build__stat">{t(LEVEL_TEXT[breakdown[area]])}</span>
          </li>
        ))}
      </ul>
      <p className="build__note">{t("Riot'un resmi zorluk puanı: {score} / 10 (Data Dragon).", { score: champion.info.difficulty })}</p>
    </section>
  );
}
