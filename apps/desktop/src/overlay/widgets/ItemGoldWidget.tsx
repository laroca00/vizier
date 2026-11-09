import type { WidgetContext } from "./context";
import { thousands } from "./shared";

export function ItemGoldWidget({ t, itemGold }: WidgetContext) {
  if (!itemGold) return null;
  return (
    <section className="overlay__card">
      <p className="overlay__caption">{t("Eşya altını farkı")}</p>
      {itemGold.lane !== null && (
        <p className="overlay__row" data-ahead={itemGold.lane >= 0}>
          <span>{t("Koridor rakibine göre")}</span>
          <span className="overlay__value">{thousands(itemGold.lane)}</span>
        </p>
      )}
      <p className="overlay__row" data-ahead={itemGold.team >= 0}>
        <span>{t("Takım")}</span>
        <span className="overlay__value">{thousands(itemGold.team)}</span>
      </p>
    </section>
  );
}
