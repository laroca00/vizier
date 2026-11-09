import { RARITY } from "../../augments/data";
import type { WidgetContext } from "./context";

export function AugmentsWidget({ t, augments, augmentNames }: WidgetContext) {
  if (augments.length === 0 || !augmentNames) return null;
  return (
    <section className="overlay__card overlay__augments">
      <p className="overlay__caption">{t("En iyi augment'ler")}</p>
      {augments.map((group) => (
        <div key={group.rarity} className="overlay__augment-group" data-rarity={group.rarity}>
          <span className="overlay__augment-rarity">{t(RARITY[group.rarity] ?? "")}</span>
          <ol>
            {group.augments.map((a) => (
              <li key={a.augmentId}>
                <span className="overlay__augment-tier" data-tier={a.tier}>
                  {a.tier}
                </span>
                {augmentNames.get(a.augmentId)?.name}
              </li>
            ))}
          </ol>
        </div>
      ))}
    </section>
  );
}
