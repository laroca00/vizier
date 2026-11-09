import { getArenaItems } from "../api";
import { items as loadItems, itemIconUrl, latestVersion } from "../data/ddragon";
import { formatPercent, useLang, useT } from "../i18n";
import { pooled } from "../data/confidence";
import { DataBadge } from "../ui/DataBadge";
import { useAsync } from "../useAsync";
import { finishedArenaItems } from "./arena";

/** The items bought most in Arena with this champion, with how often a top-four finish followed. */
export function ArenaItems({ championId }: { championId: number }) {
  const t = useT();
  const lang = useLang();
  const [stats] = useAsync(`arena-items:${championId}`, () => getArenaItems(championId));
  const [names] = useAsync("arena-item-names", () => Promise.all([loadItems(), latestVersion()]));
  if (stats.status !== "done" || !stats.value || names.status !== "done") return null;
  const [items, version] = names.value;
  const shown = finishedArenaItems(stats.value, items);
  if (shown.length === 0) return null;
  return (
    <section className="champion-augments enter" aria-label={t("Arena eşyaları")}>
      <h2 className="draft__heading">{t("Arena eşyaları")}</h2>
      <p className="section-badge">
        <DataBadge {...pooled(shown)} patches={stats.value.patches} updatedAt={stats.value.updatedAt} source={t("Vizier crawler, Arena maçları")} />
      </p>
      <ul className="champion-augments__list">
        {shown.map((item) => (
          <li key={item.id}>
            <img src={itemIconUrl(version, item.id)} alt="" width={28} height={28} loading="lazy" />
            <span className="champion-augments__name">{items.get(item.id)?.name}</span>
            <span className="build__stat">
              {t("{pick} alınma, {rate} ilk 4, {games} maç", {
                pick: formatPercent(item.pickRate, lang),
                rate: formatPercent(item.winRate, lang),
                games: item.games,
              })}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
