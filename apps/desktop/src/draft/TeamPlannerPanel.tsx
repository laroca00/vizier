import type { Champion } from "../data/ddragon";
import { SYNERGY_TEXT } from "../data/synergyReasons";
import { DIMENSION_NAMES } from "../data/traits";
import { formatPercent, useLang, useT } from "../i18n";
import { DataBadge } from "../ui/DataBadge";
import { GAP_TEXT, planTeam, type PlannerCount } from "./teamPlanner";
import "./TeamPlannerPanel.css";

const COUNT_LABEL: Record<PlannerCount, string> = {
  engage: DIMENSION_NAMES.engage,
  disengage: DIMENSION_NAMES.disengage,
  frontline: DIMENSION_NAMES.frontline,
  hardCc: "Sert kontrol",
  scaling: "Geç oyun",
};
const COUNTS: PlannerCount[] = ["engage", "disengage", "frontline", "hardCc", "scaling"];

/** What each pick is, what the team brings and lacks, and which pairs work; no overall score. */
export function TeamPlannerPanel({ team, label }: { team: Champion[]; label?: string }) {
  const t = useT();
  const lang = useLang();
  if (team.length === 0) return null;
  const report = planTeam(team);
  return (
    <details className="planner">
      <summary>
        {label ?? t("Takım planlayıcı")} <DataBadge editorial source={t("Vizier'in elle tuttuğu tablolardan; maç verisi değil.")} />
      </summary>
      <ul className="planner__picks">
        {report.picks.map(({ champion, archetypes }) => (
          <li key={champion.id}>
            <strong>{champion.name}</strong> <span className="build__stat">{archetypes.map((a) => a.name[lang]).join(", ") || "–"}</span>
          </li>
        ))}
      </ul>
      <ul className="planner__counts">
        {COUNTS.map((key) => (
          <li key={key} data-empty={report.counts[key].length === 0 || undefined}>
            <span>{t(COUNT_LABEL[key])}</span>
            <span className="build__stat">{report.counts[key].length > 0 ? report.counts[key].join(", ") : "–"}</span>
          </li>
        ))}
        <li>
          <span>{t("Hasar dağılımı")}</span>
          <span className="build__stat">
            {t("Büyü {ap}, fiziksel {ad}", { ap: formatPercent(report.damage.ap, lang), ad: formatPercent(report.damage.ad, lang) })}
          </span>
        </li>
      </ul>
      {report.pairs.length > 0 && (
        <>
          <h4 className="build__stat">{t("Birlikte iyi çalışanlar")}</h4>
          <ul className="planner__pairs">
            {report.pairs.map(({ a, b, reasons }) => (
              <li key={`${a.id}-${b.id}`}>
                <strong>
                  {a.name} + {b.name}
                </strong>{" "}
                <span className="build__stat">{reasons.map((r) => t(SYNERGY_TEXT[r].name)).join(", ")}</span>
              </li>
            ))}
          </ul>
        </>
      )}
      {report.gaps.length > 0 && (
        <ul className="planner__gaps">
          {report.gaps.map((g) => (
            <li key={g}>{t(GAP_TEXT[g])}</li>
          ))}
        </ul>
      )}
    </details>
  );
}
