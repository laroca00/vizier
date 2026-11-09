import { itemIconUrl } from "../../data/ddragon";
import { RULE_SHORT } from "../itemAnswers";
import type { WidgetContext } from "./context";

// Item answers to the enemy team that the player hasn't bought yet, from their champion's own build pool.
export function ItemAnswersWidget({ t, itemAnswers, version, items }: WidgetContext) {
  if (itemAnswers.length === 0 || !version) return null;
  return (
    <section className="overlay__card overlay__answers">
      <p className="overlay__caption">{t("Rakibe karşı")}</p>
      {itemAnswers.map((a) => (
        <p key={a.rule} className="overlay__row overlay__answer">
          <span>{t(RULE_SHORT[a.rule])}</span>
          <span className="overlay__answer-items">
            {a.items.map((id) => (
              <img key={id} src={itemIconUrl(version, id)} alt={items?.get(id)?.name ?? ""} title={items?.get(id)?.name} width={22} height={22} />
            ))}
          </span>
        </p>
      ))}
    </section>
  );
}
