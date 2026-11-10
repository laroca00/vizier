import type { Build, Variant } from "./api";
import { hasEnoughGames } from "./data/confidence";
import { itemIconUrl, type Item } from "./data/ddragon";
import { formatPercent, useLang, useT } from "./i18n";

/** The common starting items with their win rate, and when the first boots and first finished item usually come. */
export function StartTiming({ build, items, version }: { build: Build | Variant; items: Map<number, Item>; version: string }) {
  const t = useT();
  const lang = useLang();
  const starts = "startOptions" in build ? (build.startOptions ?? []) : [];
  const timing = "timing" in build ? build.timing : undefined;
  if (starts.length < 2 && !timing) return null;
  return (
    <section className="build__block" aria-label={t("Başlangıç eşyaları")}>
      {starts.length >= 2 && (
        <>
          <p className="build__stat path__label">{t("Başlangıç eşyaları")}</p>
          <ul className="item-tree">
            {starts.map((s) => {
              const enough = hasEnoughGames(s.games, s.winRate);
              return (
                <li key={s.ids.join(",")} data-enough={enough}>
                  <span className="item-tree__node">
                    {s.ids.map((id, i) => (
                      <img key={`${id}-${i}`} src={itemIconUrl(version, id)} alt={items.get(id)?.name ?? ""} title={items.get(id)?.name} width={28} height={28} />
                    ))}
                    <span className="build__stat">
                      {enough ? formatPercent(s.winRate, lang, 1) : t("az maç")} · {t("{games} maç", { games: s.games.toLocaleString() })}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}
      {timing && (timing.boots || timing.firstItem) && (
        <>
          {timing.boots && <p className="build__note">{t("İlk botlar çoğunlukla {minute}. dakikada, {games} oyunda", { minute: timing.boots.medianMinute, games: timing.boots.games.toLocaleString() })}</p>}
          {timing.firstItem && (
            <p className="build__note">{t("İlk tamamlanan eşya çoğunlukla {minute}. dakikada, {games} oyunda", { minute: timing.firstItem.medianMinute, games: timing.firstItem.games.toLocaleString() })}</p>
          )}
          <p className="build__note">{t("Ortanca değer; zaman çizelgesi olan oyunlardan.")}</p>
        </>
      )}
    </section>
  );
}
