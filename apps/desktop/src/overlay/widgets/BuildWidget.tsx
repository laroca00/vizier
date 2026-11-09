import { itemIconUrl, runeIconUrl } from "../../data/ddragon";
import type { WidgetContext } from "./context";

/** The build in one glance: items in buy order, runes, skill order and what to buy next. */
export function BuildWidget({ t, buildPanel, skillOrder, nextItem, items, version, gold, game }: WidgetContext) {
  const { items: list, runes } = buildPanel;
  const missing = nextItem ? Math.max(0, gold(nextItem) - (game.gold ?? 0)) : null;
  return (
    <section className="overlay__card overlay__build" aria-label={t("Build paneli")}>
      {list.length > 0 && version && (
        <ol className="overlay__build-items">
          {list.map((item) => (
            <li key={item.id} data-owned={item.owned || undefined}>
              <img src={itemIconUrl(version, item.id)} alt={items?.get(item.id)?.name ?? ""} width={30} height={30} />
            </li>
          ))}
        </ol>
      )}
      {runes && (
        <p className="overlay__build-runes">
          {runes.keystone && <img src={runeIconUrl(runes.keystone.icon)} alt={runes.keystone.name} width={30} height={30} />}
          {[...runes.primary, ...runes.secondary].map((r) => (
            <img key={r.icon} src={runeIconUrl(r.icon)} alt={r.name} width={20} height={20} />
          ))}
        </p>
      )}
      {skillOrder.keys.length > 0 && (
        <ol className="overlay__skillstrip" aria-label={t("Yetenek sırası")}>
          {skillOrder.keys.map((key, i) => (
            <li key={i} data-done={i < skillOrder.ranked || undefined} data-ult={key === "R" || undefined}>
              <span className="overlay__skilllevel">{i + 1}</span>
              {key}
            </li>
          ))}
        </ol>
      )}
      {nextItem && missing !== null && (
        <p className="overlay__row">
          <span>{items?.get(nextItem)?.name}</span>
          <span className="overlay__value">{missing > 0 ? t("{gold} altın kaldı", { gold: missing }) : t("Alabilirsin")}</span>
        </p>
      )}
    </section>
  );
}
