import { useState } from "react";
import { getBuildIndex, type BuildIndexEntry } from "../api";
import { championIconUrl, champions, itemDetails, itemIconUrl, latestVersion, type ItemDetail } from "../data/ddragon";
import { goldEfficiency, STAT_PRICES } from "../data/itemGold";
import { formatPercent, useLang, useT } from "../i18n";
import { buildersOf, explorable, filterItems, NO_FILTER, offeredStats, sortItems, type ItemSort } from "../itemExplorer";
import { positionLabel } from "../labels";
import { SearchInput, Select } from "../ui/Fields";
import { LiquidGlass } from "../ui/LiquidGlass";
import { PageHeader } from "../ui/Page";
import { EmptyState, ErrorState, Skeleton } from "../ui/States";
import { useAsync } from "../useAsync";
import "./ItemsPage.css";

const ANY = "any";
const PRICES: Record<string, { label: string; min: number; max: number }> = {
  [ANY]: { label: "Her fiyat", min: 0, max: Infinity },
  low: { label: "2000 altı", min: 0, max: 1999 },
  mid: { label: "2000–2999", min: 2000, max: 2999 },
  high: { label: "3000 ve üstü", min: 3000, max: Infinity },
};

const load = async () => {
  const [version, details, championList] = await Promise.all([latestVersion(), itemDetails(), champions()]);
  return { version, details, champions: championList };
};

/** Every finished item with its stats, recipe, gold efficiency and the champions that build it. */
export function ItemsPage({ onOpenChampion }: { onOpenChampion: (championId: number, position: string | null) => void }) {
  const t = useT();
  const lang = useLang();
  const [data, retry] = useAsync("items-page", load);
  const [index] = useAsync("build-index", getBuildIndex);
  const [query, setQuery] = useState("");
  const [stat, setStat] = useState(ANY);
  const [price, setPrice] = useState(ANY);
  const [sort, setSort] = useState<ItemSort>("price");
  const [selected, setSelected] = useState<number | null>(null);

  if (data.status === "error") return <ErrorState message={t("Oyun verisi alınamadı.")} onRetry={retry} />;
  if (data.status !== "done") return <Skeleton lines={6} label={t("Yükleniyor")} />;

  const all = [...data.value.details.values()].filter(explorable);
  const range = PRICES[price];
  const shown = sortItems(filterItems(all, { ...NO_FILTER, query, stat: stat === ANY ? null : stat, minPrice: range.min, maxPrice: range.max }, lang), sort, lang);
  const open = selected !== null ? data.value.details.get(selected) : undefined;
  const builds = index.status === "done" ? index.value.builds : [];

  return (
    <LiquidGlass className="panel tiers items-page" radius={28} strength={2.5} scroll>
      <PageHeader
        title={t("Eşyalar")}
        subtitle={t("Bitmiş eşyalar, istatistikleri ve altın verimleri · {count} eşya", { count: shown.length })}
        toolbar={
          <>
            <SearchInput label={t("Eşya ara")} value={query} onChange={setQuery} />
            <Select
              label={t("Özellik")}
              value={stat}
              options={[{ value: ANY, label: t("Her özellik") }, ...offeredStats(all).map((key) => ({ value: key, label: t(STAT_PRICES[key].label) }))]}
              onChange={setStat}
            />
            <Select label={t("Fiyat")} value={price} options={Object.entries(PRICES).map(([value, p]) => ({ value, label: t(p.label) }))} onChange={setPrice} />
            <Select
              label={t("Sıralama")}
              value={sort}
              options={[
                { value: "price" as ItemSort, label: t("Fiyat") },
                { value: "efficiency" as ItemSort, label: t("Altın verimi") },
                { value: "name" as ItemSort, label: t("Ad") },
              ]}
              onChange={setSort}
            />
          </>
        }
      />
      {shown.length === 0 ? (
        <EmptyState title={t("Eşleşen eşya yok")}>{t("Filtreleri gevşetmeyi dene.")}</EmptyState>
      ) : (
        <div className="items-page__body">
          <ul className="items-page__list">
            {shown.map((item) => {
              const eff = goldEfficiency(item.stats, item.gold.total);
              return (
                <li key={item.id}>
                  <button type="button" className="items-page__row" aria-pressed={selected === item.id} onClick={() => setSelected(item.id)}>
                    <img src={itemIconUrl(data.value.version, item.id)} alt="" width={32} height={32} loading="lazy" />
                    <span>{item.name}</span>
                    <span className="state__text">{eff === null ? "–" : formatPercent(eff, lang, 0)}</span>
                    <span>{item.gold.total}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <Detail
            item={open}
            data={data.value}
            builds={builds}
            onOpenItem={setSelected}
            onOpenChampion={onOpenChampion}
          />
        </div>
      )}
    </LiquidGlass>
  );
}

type Loaded = Awaited<ReturnType<typeof load>>;
const BUILDERS_SHOWN = 10;

function Detail({
  item,
  data,
  builds,
  onOpenItem,
  onOpenChampion,
}: {
  item: ItemDetail | undefined;
  data: Loaded;
  builds: BuildIndexEntry[];
  onOpenItem: (id: number) => void;
  onOpenChampion: (championId: number, position: string | null) => void;
}) {
  const t = useT();
  const lang = useLang();
  if (!item) return <p className="state__text">{t("Ayrıntı için bir eşya seç.")}</p>;
  const eff = goldEfficiency(item.stats, item.gold.total);
  const stats = Object.entries(item.stats).filter(([key, value]) => STAT_PRICES[key] && value);
  const chip = (id: number) => {
    const part = data.details.get(id);
    return (
      part && (
        <li key={id}>
          <button type="button" className="items-page__chip" onClick={() => onOpenItem(id)}>
            <img src={itemIconUrl(data.version, id)} alt="" width={24} height={24} />
            {part.name} · {part.gold.total}
          </button>
        </li>
      )
    );
  };
  const builders = buildersOf(item.id, builds, BUILDERS_SHOWN);

  return (
    <article className="items-page__detail" aria-label={item.name}>
      <div className="items-page__title">
        <img src={itemIconUrl(data.version, item.id)} alt="" width={48} height={48} />
        <div>
          <h2 className="section-title">{item.name}</h2>
          <p className="state__text">
            {t("{gold} altın", { gold: item.gold.total })}
            {eff !== null && ` · ${t("Özellik değeri altın fiyatının {rate}'i", { rate: formatPercent(eff, lang, 0) })}`}
          </p>
        </div>
      </div>
      {item.plaintext && <p>{item.plaintext}</p>}
      {stats.length > 0 && (
        <ul className="items-page__stats">
          {stats.map(([key, value]) => (
            <li key={key}>
              +{STAT_PRICES[key].percent ? `${Math.round(value * 100)}%` : value} {t(STAT_PRICES[key].label)}
            </li>
          ))}
        </ul>
      )}
      {item.from.length > 0 && (
        <section aria-label={t("Tarif")}>
          <h3 className="draft__heading">{t("Tarif")}</h3>
          <ul className="items-page__recipe">{[...new Set(item.from)].map(chip)}</ul>
          {item.gold.base > 0 && <p className="state__text">{t("Birleştirme ücreti {gold} altın", { gold: item.gold.base })}</p>}
        </section>
      )}
      <section aria-label={t("Bu eşyayı alan şampiyonlar")}>
        <h3 className="draft__heading">{t("Bu eşyayı build'ine alan şampiyonlar")}</h3>
        {builders.length === 0 ? (
          <p className="state__text">{t("Sık alınan build'lerde yer almıyor.")}</p>
        ) : (
          <ul className="items-page__builders">
            {builders.map((b) => {
              const champion = data.champions.get(b.championId);
              return (
                <li key={`${b.championId}:${b.position}`}>
                  <button type="button" className="items-page__chip" onClick={() => onOpenChampion(b.championId, b.position)}>
                    {champion && <img src={championIconUrl(data.version, champion.id)} alt="" width={24} height={24} />}
                    {champion?.name} {positionLabel(b.position, lang)} · {t("{games} maç", { games: b.games })}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </article>
  );
}
