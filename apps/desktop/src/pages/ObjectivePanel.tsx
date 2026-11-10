import type { ChampionOverview } from "../api";
import { OBJECTIVE_TEXT, strongObjectives } from "../data/objectives";
import { formatPercent, useLang, useT } from "../i18n";
import { DataBadge } from "../ui/DataBadge";
import { sampleTitle } from "../ui/sampleTitle";
import "./LengthPanel.css";

type Objectives = NonNullable<ChampionOverview["objectives"]>;

/** How often the team takes each first objective, against the role's average; a tag where the champion clearly leads. */
export function ObjectivePanel({ objectives, winRate, patches, updatedAt }: { objectives: Objectives; winRate: number; patches: string[]; updatedAt?: number }) {
  const t = useT();
  const lang = useLang();
  const strong = strongObjectives(objectives.rates, objectives.games);
  return (
    <section className="enter" aria-label={t("Objektifler")}>
      <h2 className="draft__heading">
        {t("Objektifler")} <DataBadge games={objectives.games} winRate={winRate} patches={patches} updatedAt={updatedAt} ranked source={t("Vizier crawler, dereceli maçlar")} />
        {strong.length > 0 && <span className="elo-tag">{t("Objektif gücü")}</span>}
      </h2>
      <ul className="jungle__paths">
        {objectives.rates.map((r) => (
          <li key={r.key} title={sampleTitle(t, lang, { games: objectives.games, winRate: r.rate, patches, updatedAt })}>
            <span>
              {t(OBJECTIVE_TEXT[r.key] ?? r.key)}
              {strong.includes(r.key) && <span className="elo-tag">{t("rol ortalamasının üstünde")}</span>}
            </span>
            <span className="build__stat">
              {formatPercent(r.rate, lang, 0)} · {t("rol ortalaması {rate}", { rate: formatPercent(r.roleRate, lang, 0) })} · {t("{games} maç", { games: objectives.games.toLocaleString() })}
            </span>
          </li>
        ))}
      </ul>
      <p className="build__note">{t("Takımın ilk aldığı oyunların payı; kazanma oranı değil.")}</p>
    </section>
  );
}
