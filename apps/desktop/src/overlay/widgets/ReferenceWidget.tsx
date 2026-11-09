import { itemIconUrl, runeIconUrl } from "../../data/ddragon";
import { CATEGORY_TEXT, comboText } from "../../data/combos";
import type { ReactNode } from "react";
import type { RefSection } from "../reference";
import type { WidgetContext } from "./context";
import { EmptyCard } from "./WidgetBoundary";

/** Blocks the player chose, in their order, in one card. */
export function ReferenceWidget(ctx: WidgetContext) {
  const { t, reference, buildPanel, skillOrder, items, version, nextItem, gold, game } = ctx;
  const block: Record<RefSection, () => ReactNode> = {
    build: () =>
      buildPanel.items.length > 0 && version ? (
        <ol className="overlay__build-items">
          {buildPanel.items.map((item) => (
            <li key={item.id} data-owned={item.owned || undefined}>
              <img src={itemIconUrl(version, item.id)} alt={items?.get(item.id)?.name ?? ""} width={30} height={30} />
            </li>
          ))}
        </ol>
      ) : null,
    runes: () => {
      const runes = buildPanel.runes;
      if (!runes) return null;
      return (
        <p className="overlay__build-runes">
          {runes.keystone && <img src={runeIconUrl(runes.keystone.icon)} alt={runes.keystone.name} width={30} height={30} />}
          {[...runes.primary, ...runes.secondary].map((r) => (
            <img key={r.icon} src={runeIconUrl(r.icon)} alt={r.name} width={20} height={20} />
          ))}
        </p>
      );
    },
    skills: () =>
      skillOrder.keys.length > 0 ? (
        <ol className="overlay__skillstrip" aria-label={t("Yetenek sırası")}>
          {skillOrder.keys.map((key, i) => (
            <li key={i} data-done={i < skillOrder.ranked || undefined} data-ult={key === "R" || undefined}>
              <span className="overlay__skilllevel">{i + 1}</span>
              {key}
            </li>
          ))}
        </ol>
      ) : null,
    combo: () =>
      reference.combos.length > 0 ? (
        <ul className="overlay__ref-list">
          {reference.combos.map((c) => (
            <li key={c.id}>
              <span className="overlay__caption">{t(CATEGORY_TEXT[c.category])}</span>
              <span>{c.sequence.join(" → ")}</span>
              <span className="overlay__target">{comboText(c.purpose, reference.lang)}</span>
            </li>
          ))}
        </ul>
      ) : null,
    note: () =>
      reference.note ? (
        <p className="overlay__ref-note">
          <span className="overlay__caption">{reference.note.matchup && reference.opponent ? t("Not: {name}", { name: reference.opponent }) : t("Notum")}</span>
          {reference.note.text}
        </p>
      ) : null,
    item: () => {
      const item = nextItem ? items?.get(nextItem) : undefined;
      if (!item) return null;
      const missing = Math.max(0, gold(item.id) - (game.gold ?? 0));
      const parts = (item.from ?? []).map((id) => items?.get(id)?.name).filter(Boolean);
      return (
        <p className="overlay__ref-note">
          <span className="overlay__caption">{t("Sıradaki eşya")}</span>
          {item.name} · {t("{gold} altın", { gold: item.gold })}
          {parts.length > 0 && <span className="overlay__target">{parts.join(" + ")}</span>}
          {missing > 0 && <span className="overlay__target">{t("{gold} altın kaldı", { gold: missing })}</span>}
        </p>
      );
    },
  };
  const rendered = reference.sections.map((s) => [s, block[s]()] as const).filter(([, node]) => node !== null);
  if (rendered.length === 0) return <EmptyCard text={t("Seçtiğin bloklar için veri yok")} />;
  return (
    <section className="overlay__card overlay__ref" aria-label={t("Hızlı bakış")}>
      {rendered.map(([s, node]) => (
        <div key={s}>{node}</div>
      ))}
    </section>
  );
}
