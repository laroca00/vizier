import { itemIconUrl } from "../../data/ddragon";
import type { WidgetContext } from "./context";

export function NextItemWidget({ t, nextItem, items, version, gold, game }: WidgetContext) {
  if (!nextItem || !version) return null;
  const missing = Math.max(0, gold(nextItem) - (game.gold ?? 0));
  return (
    <section className="overlay__card overlay__next">
      <img src={itemIconUrl(version, nextItem)} alt="" width={34} height={34} />
      <span className="overlay__next-text">
        <span className="overlay__caption">{t("Sıradaki eşya")}</span>
        <span>{items?.get(nextItem)?.name}</span>
        <span className="overlay__target">{missing > 0 ? t("{gold} altın kaldı", { gold: missing }) : t("Alabilirsin")}</span>
      </span>
    </section>
  );
}
