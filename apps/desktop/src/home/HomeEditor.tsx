import { useT } from "../i18n";
import { updateSettings } from "../settings";
import { moveCard, toggleCard, type HomeCard, type HomeLayout } from "./layout";

export const CARD_NAMES: Record<HomeCard, string> = {
  lists: "Son baktıkların ve havuzun",
  thisPatch: "Bu yama senin için",
  metaPicks: "Meta seçimler",
  metaMovers: "Yükselenler ve düşenler",
  pros: "Pro build'ler",
};

/** Shows, hides and reorders the Home cards; every change is saved right away. */
export function HomeEditor({ layout, onDone }: { layout: HomeLayout; onDone: () => void }) {
  const t = useT();
  const save = (next: HomeLayout) => updateSettings({ homeLayout: next });
  return (
    <section className="home-editor" aria-label={t("Ana sayfayı düzenle")}>
      <ol className="home-editor__list">
        {[...layout.order.filter((c) => c !== "pros"), "pros" as const].map((card, i, list) => {
          const shown = !layout.hidden.includes(card);
          // The pro panel always sits in the right column, so it only shows or hides.
          const movable = card !== "pros";
          return (
            <li key={card} data-hidden={!shown || undefined}>
              <label className="home-editor__toggle">
                <input type="checkbox" checked={shown} onChange={() => save(toggleCard(layout, card))} />
                <span>{t(CARD_NAMES[card])}</span>
              </label>
              {movable && (
              <span className="home-editor__moves">
                <button type="button" disabled={i === 0} aria-label={t("{card} yukarı", { card: t(CARD_NAMES[card]) })} onClick={() => save(moveCard(layout, card, -1))}>
                  ↑
                </button>
                <button type="button" disabled={i >= list.length - 2} aria-label={t("{card} aşağı", { card: t(CARD_NAMES[card]) })} onClick={() => save(moveCard(layout, card, 1))}>
                  ↓
                </button>
              </span>
              )}
            </li>
          );
        })}
      </ol>
      <button type="button" className="link" onClick={onDone}>
        {t("Bitti")}
      </button>
    </section>
  );
}
