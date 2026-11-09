import { STRENGTH_TEXT, WEAKNESS_TEXT, strengthsOf } from "../data/strengths";
import { useT } from "../i18n";
import { DataBadge } from "../ui/DataBadge";

/** What a champion is good and bad at, from Vizier's hand-kept table. */
export function StrengthsPanel({ championId }: { championId: string }) {
  const t = useT();
  const entry = strengthsOf(championId);
  if (!entry) return null;
  return (
    <section className="strengths" aria-label={t("Güçlü ve zayıf yönler")}>
      <h2 className="draft__heading">{t("Güçlü ve zayıf yönler")}</h2>
      <p className="section-badge">
        <DataBadge editorial source={t("Vizier'in elle yazdığı bir değerlendirme; maç verisi değil.")} />
      </p>
      <div className="strengths__lists">
        <div>
          <h3 className="build__stat">{t("Güçlü yönler")}</h3>
          <ul>
            {entry.strengths.map((key) => (
              <li key={key}>{t(STRENGTH_TEXT[key])}</li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="build__stat">{t("Zayıf yönler")}</h3>
          <ul>
            {entry.weaknesses.map((key) => (
              <li key={key}>{t(WEAKNESS_TEXT[key])}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
