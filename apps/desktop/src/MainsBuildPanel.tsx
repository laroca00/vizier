import type { Build } from "./api";
import { hasEnoughGames } from "./data/confidence";
import { itemIconUrl, type Item } from "./data/ddragon";
import { mainsDiffer } from "./data/mainsBuild";
import { formatPercent, useLang, useT } from "./i18n";
import { DataBadge } from "./ui/DataBadge";

/** The builds of players with many games on the champion, only when they differ from the popular build. */
export function MainsBuild({ build, items, version }: { build: Build; items: Map<number, Item>; version: string }) {
  const t = useT();
  const lang = useLang();
  const mains = build.mains;
  if (!mains || !mainsDiffer(build, mains)) return null;
  const core = mains.coreItems;
  const list = core ? core.ids : mains.items.slice(0, 4).map((i) => i.id);
  const enough = hasEnoughGames(mains.games, mains.winRate);
  return (
    <section className="build__block" aria-label={t("Çok oynayanlar")}>
      <p className="build__stat path__label">
        {t("Çok oynayanlar")} <DataBadge games={mains.games} winRate={mains.winRate} />
      </p>
      <span className="item-tree__node">
        {list.map((id, i) => (
          <img key={`${id}-${i}`} src={itemIconUrl(version, id)} alt={items.get(id)?.name ?? ""} title={items.get(id)?.name} width={28} height={28} />
        ))}
        <span className="build__stat">
          {enough ? formatPercent(mains.winRate, lang, 1) : t("az maç")} · {t("{games} maç", { games: mains.games.toLocaleString() })}
        </span>
      </span>
      <p className="build__note">{t("Şampiyonu çok oynayan oyuncuların seçimi; isim ya da profil tutulmaz.")}</p>
    </section>
  );
}
