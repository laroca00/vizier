import { abilityIconUrl, championIconUrl } from "../../data/ddragon";
import { SPIKE_TEXT } from "../../draft/threats";
import { formatPercent } from "../../i18n";
import type { WidgetContext } from "./context";

// The lane in three lines at the start of the game: the record, the ability to respect, the player's own note.
export function PlanWidget({ t, plan, version, reference }: WidgetContext) {
  if (!plan) return null;
  return (
    <section className="overlay__card overlay__plan">
      <p className="overlay__plan-head">
        {version && <img src={championIconUrl(version, plan.opponentKey)} alt="" width={28} height={28} />}
        <span>
          <span className="overlay__caption">{t("Koridor rakibin")}</span>
          <span className="overlay__plan-name">{plan.opponent}</span>
        </span>
      </p>
      {plan.matchup && (
        <p className="overlay__row">
          <span>{t("Eşleşme")}</span>
          <span className="overlay__value">
            {t("{rate}, {games} maç", { rate: formatPercent(plan.matchup.winRate, reference.lang), games: plan.matchup.games })}
          </span>
        </p>
      )}
      {plan.threat && (
        <p className="overlay__plan-threat">
          {version && <img src={abilityIconUrl(version, plan.threat.ability.image)} alt="" width={22} height={22} />}
          <span>
            <span>
              {plan.threat.ability.key}: {plan.threat.ability.name}
              {plan.threat.cooldown && <span className="overlay__target"> {t("{s} sn", { s: plan.threat.cooldown.first })}</span>}
            </span>
            <span className="overlay__caption">{t(SPIKE_TEXT[plan.threat.spike])}</span>
          </span>
        </p>
      )}
      {plan.note && <p className="overlay__plan-note">{plan.note}</p>}
    </section>
  );
}
