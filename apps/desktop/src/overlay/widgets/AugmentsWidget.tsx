import { RARITY } from "../../augments/data";
import { confidenceOf } from "../../data/confidence";
import { formatPercent, useLang } from "../../i18n";
import type { WidgetContext } from "./context";

export function AugmentsWidget({ t, augments, augmentNames, augmentPatches, augmentsShown }: WidgetContext) {
  const lang = useLang();
  if (!augmentsShown || augments.length === 0 || !augmentNames) return null;
  return (
    <section className="overlay__card overlay__augments">
      <p className="overlay__caption">{t("En iyi augment'ler")}</p>
      {augments.map((group) => (
        <div key={group.rarity} className="overlay__augment-group" data-rarity={group.rarity}>
          <span className="overlay__augment-rarity">{t(RARITY[group.rarity] ?? "")}</span>
          <ol>
            {group.augments.map((a) => {
              // Rates over too few games are greyed, not hidden: the game count stays visible.
              const weak = confidenceOf({ games: a.games, winRate: a.winRate, patches: augmentPatches }) === "insufficient";
              return (
                <li key={a.augmentId}>
                  <span className="overlay__augment-tier" data-tier={a.tier}>
                    {a.tier}
                  </span>
                  <span className="overlay__augment-name">{augmentNames.get(a.augmentId)?.name}</span>
                  <span className="overlay__augment-rate" data-weak={weak || undefined} title={t("{games} maç", { games: a.games })}>
                    {formatPercent(a.winRate, lang, 0)} · {a.games}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      ))}
    </section>
  );
}
