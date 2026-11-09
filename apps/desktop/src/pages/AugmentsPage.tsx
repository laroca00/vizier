import { Fragment, useState } from "react";
import { getAugmentChampions, getAugments, getTierList, type AugmentChampion, type AugmentStats } from "../api";
import { augmentInfo, modeAugments, RARITY, type AugmentInfo } from "../augments/data";
import { classChampions, mergeAugmentStats, RARITY_FILTERS } from "../augments/filter";
import { formatDelta, sortAugments, type AugmentColumn } from "../augments/tiers";
import "../augments/augments.css";
import { CLASS_NAMES } from "../ChampionGuide";
import { championIconUrl, champions, latestVersion, type Champion } from "../data/ddragon";
import { formatPercent, useLang, useT } from "../i18n";
import "../library/library.css";
import { SearchInput, Select } from "../ui/Fields";
import { LiquidGlass } from "../ui/LiquidGlass";
import { PageHeader } from "../ui/Page";
import { EmptyState, ErrorState, Skeleton } from "../ui/States";
import { Tabs } from "../ui/Tabs";
import { useAsync } from "../useAsync";
import { sampleTitle } from "../ui/sampleTitle";

const ARENA = 1700;
const MAYHEM = 2400;
const QUEUES = [
  { id: ARENA, label: "Arena" },
  { id: MAYHEM, label: "ARAM: Şamata" },
];
const ALL = "ALL";
const CLASSES = ["Fighter", "Mage", "Assassin", "Marksman", "Support", "Tank"];
// A class view merges the stats of its most played champions; more would mean many more requests.
const CLASS_CHAMPIONS = 12;
const SUITED_PREVIEW = 3;

async function loadClass(queue: number, tag: string, tagsOf: (id: number) => string[] | undefined): Promise<{ stats: AugmentStats | null; champions: number }> {
  const tiers = await getTierList("ALL", queue);
  const ids = classChampions(tiers.champions, tagsOf, tag, CLASS_CHAMPIONS);
  const docs = await Promise.all(ids.map((id) => getAugments(queue, id)));
  const found = docs.filter((d): d is AugmentStats => d !== null && d.games > 0);
  return { stats: found.length ? mergeAugmentStats(found) : null, champions: found.length };
}

const signOf = (delta: number | undefined) => (delta === undefined ? undefined : delta > 0 ? "up" : delta < 0 ? "down" : undefined);

export function AugmentsPage({ onOpenChampion }: { onOpenChampion?: (championId: number) => void }) {
  const t = useT();
  const lang = useLang();
  const [queue, setQueue] = useState(ARENA);
  const [champion, setChampion] = useState(ALL);
  const [query, setQuery] = useState("");
  const championId = champion === ALL ? null : Number(champion);
  const [rarity, setRarity] = useState("ALL");
  const [tag, setTag] = useState(ALL);
  const [sort, setSort] = useState<AugmentColumn>("tier");
  const [desc, setDesc] = useState(true);
  const [open, setOpen] = useState<number | null>(null);
  const [championList] = useAsync("champions", champions);
  const byClass = tag !== ALL && championId === null;
  const [overall, retryOverall] = useAsync(`augments:${queue}:${championId}`, () => getAugments(queue, championId));
  const [classView, retryClass] = useAsync(`augments-class:${queue}:${byClass ? tag : ALL}:${championList.status}`, async () => {
    if (!byClass || championList.status !== "done") return null;
    const list = championList.value;
    return loadClass(queue, tag, (id) => list.get(id)?.tags);
  });
  const [suited] = useAsync(`augment-champions:${queue}`, () => getAugmentChampions(queue));
  const [version] = useAsync("version", latestVersion);
  const stats = byClass ? (classView.status === "done" ? { status: "done" as const, value: classView.value?.stats ?? null } : classView) : overall;
  const retry = byClass ? retryClass : retryOverall;
  const [info] = useAsync(`augment-info:${lang}`, () => augmentInfo(lang));
  const options = championList.status === "done" ? [...championList.value.values()].sort((a, b) => a.name.localeCompare(b.name, lang)) : [];
  const rateLabel = queue === ARENA ? t("İlk 4") : t("Kazanma");

  const suitedBy = new Map((suited.status === "done" && suited.value ? suited.value.augments : []).map((a) => [a.augmentId, a.champions]));
  // The champion column only makes sense on the mode-wide list.
  const showSuited = championId === null && !byClass && suitedBy.size > 0;
  const championOf = (id: number): Champion | undefined => (championList.status === "done" ? championList.value.get(id) : undefined);
  const iconOf = (id: number) => {
    const c = championOf(id);
    return c && version.status === "done" ? championIconUrl(version.value, c.id) : null;
  };

  const names = info.status === "done" ? info.value : new Map<number, AugmentInfo>();
  const needle = query.trim().toLocaleLowerCase(lang);
  const filtered =
    stats.status === "done" && stats.value
      ? stats.value.augments.filter((a) => {
          const meta = names.get(a.augmentId);
          if (needle && !(meta?.name ?? "").toLocaleLowerCase(lang).includes(needle)) return false;
          const wanted = RARITY_FILTERS.find((r) => r.value === rarity)?.rarity ?? null;
          return wanted === null || meta?.rarity === wanted;
        })
      : [];
  const rows = sortAugments(filtered, sort, desc, (id) => names.get(id)?.name ?? "", lang);
  const columns = showSuited ? 7 : 6;

  const sortHeader = (column: AugmentColumn, label: string) => (
    <th scope="col" aria-sort={sort === column ? (desc ? "descending" : "ascending") : undefined}>
      <button
        type="button"
        className="tiers__sort"
        onClick={() => {
          if (sort === column) setDesc(!desc);
          else {
            setSort(column);
            setDesc(column !== "name");
          }
        }}
      >
        {label}
        {sort === column && <span aria-hidden="true">{desc ? " ↓" : " ↑"}</span>}
      </button>
    </th>
  );

  return (
    <LiquidGlass className="panel tiers augments" radius={28} strength={2.5} scroll>
      <PageHeader
        title={t("Augment'ler")}
        subtitle={
          stats.status === "done" && stats.value && stats.value.games > 0
            ? t("Yama {patch}, {games} oyuncu-maç", { patch: stats.value.patches[0] ?? "", games: stats.value.games })
            : t("Arena ve ARAM: Şamata augment'lerinin seçilme ve kazanma oranları")
        }
        toolbar={<Tabs label={t("Oyun modu")} items={QUEUES.map((q) => ({ id: q.id, label: t(q.label) }))} value={queue} onChange={setQueue} />}
      />
      <div className="library__filters">
        <SearchInput label={t("Augment ara")} value={query} onChange={setQuery} placeholder={t("Augment ara")} />
        <Select label={t("Nadirlik")} value={rarity} options={RARITY_FILTERS.map((r) => ({ value: r.value, label: t(r.label) }))} onChange={setRarity} />
        <Select
          label={t("Sınıf")}
          value={champion === ALL ? tag : ALL}
          options={[{ value: ALL, label: t("Tüm sınıflar") }, ...CLASSES.map((c) => ({ value: c, label: t(CLASS_NAMES[c]) }))]}
          onChange={(next) => {
            setTag(next);
            setChampion(ALL);
          }}
        />
        <Select
          label={t("Şampiyon")}
          value={champion}
          options={[{ value: ALL, label: t("Tüm şampiyonlar") }, ...options.map((c) => ({ value: String(c.key), label: c.name }))]}
          onChange={(next) => {
            setChampion(next);
            setTag(ALL);
          }}
        />
      </div>
      {byClass && classView.status === "done" && classView.value?.stats && (
        <p className="build__note">
          {t("{champions} şampiyonun birleşik verisi, {games} oyuncu-maç", { champions: classView.value.champions, games: classView.value.stats.games })}
        </p>
      )}
      {championId !== null && stats.status === "done" && stats.value && stats.value.augments.length > 0 && (
        <p className="build__note">{t("Oranın yanındaki sayı, augment'in bu şampiyonu kendi ortalamasına göre kaç puan yukarı ya da aşağı taşıdığını gösterir.")}</p>
      )}
      {stats.status === "error" ? (
        <ErrorState message={t("Augment istatistikleri alınamadı.")} onRetry={retry} />
      ) : stats.status !== "done" ? (
        <Skeleton lines={8} label={t("Yükleniyor")} />
      ) : stats.value === null ? (
        <EmptyState title={t("Augment istatistikleri şu an kapalı")}>{t("Vizier sunucusu bu verileri şimdilik göstermiyor.")}</EmptyState>
      ) : stats.value.augments.length === 0 ? (
        <Catalogue queue={queue} names={names} needle={needle} rarity={rarity} />
      ) : (
        <table className="augments__table">
          <thead>
            <tr>
              {sortHeader("tier", t("Tier"))}
              {sortHeader("name", t("Augment"))}
              <th scope="col">{t("Nadirlik")}</th>
              {sortHeader("pick", t("Seçilme"))}
              {sortHeader("win", rateLabel)}
              {sortHeader("games", t("Maç"))}
              {showSuited && <th scope="col">{t("En iyi olduğu şampiyonlar")}</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => {
              const meta = names.get(a.augmentId);
              const list = suitedBy.get(a.augmentId) ?? [];
              const expanded = open === a.augmentId;
              const delta = championId !== null ? formatDelta(a.delta, lang) : null;
              return (
                <Fragment key={a.augmentId}>
                  <tr data-open={expanded || undefined}>
                    <td>
                      <span className="tier" data-tier={a.tier}>
                        {a.tier}
                      </span>
                    </td>
                    <th scope="row" className="augments__name">
                      {meta && <img src={meta.icon} alt="" width={28} height={28} loading="lazy" />}
                      {meta?.name ?? t("Augment #{id}", { id: a.augmentId })}
                    </th>
                    <td>{meta ? t(RARITY[meta.rarity] ?? "") : ""}</td>
                    <td>{formatPercent(a.pickRate, lang, 1)}</td>
                    <td title={sampleTitle(t, lang, { ...a, patches: stats.value?.patches })}>
                      {formatPercent(a.winRate, lang, 1)}
                      {delta && (
                        <span className="augments__delta" data-sign={signOf(a.delta)}>
                          {" "}
                          {delta}
                        </span>
                      )}
                    </td>
                    <td>{a.games.toLocaleString(lang === "tr" ? "tr" : "en-GB")}</td>
                    {showSuited && (
                      <td>
                        {list.length > 0 ? (
                          <button
                            type="button"
                            className="augments__suited"
                            aria-expanded={expanded}
                            onClick={() => setOpen(expanded ? null : a.augmentId)}
                            title={t("Bu augment'in en iyi olduğu şampiyonlar")}
                          >
                            {list.slice(0, SUITED_PREVIEW).map((c) => {
                              const icon = iconOf(c.championId);
                              return icon ? <img key={c.championId} src={icon} alt={championOf(c.championId)?.name ?? ""} width={24} height={24} loading="lazy" /> : null;
                            })}
                            <span className="augments__more">{expanded ? t("Gizle") : list.length > SUITED_PREVIEW ? `+${list.length - SUITED_PREVIEW}` : t("Aç")}</span>
                          </button>
                        ) : (
                          <span className="augments__muted">{t("Az maç")}</span>
                        )}
                      </td>
                    )}
                  </tr>
                  {expanded && (
                    <tr className="augments__detail">
                      <td colSpan={columns}>
                        <SuitedChampions list={list} rateLabel={rateLabel} nameOf={(id) => championOf(id)?.name ?? `#${id}`} iconOf={iconOf} onOpen={onOpenChampion} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      )}
    </LiquidGlass>
  );
}

/** The champions an augment lifts most, with how far above their own rate it takes them. */
function SuitedChampions({
  list,
  rateLabel,
  nameOf,
  iconOf,
  onOpen,
}: {
  list: AugmentChampion[];
  rateLabel: string;
  nameOf: (id: number) => string;
  iconOf: (id: number) => string | null;
  onOpen?: (championId: number) => void;
}) {
  const t = useT();
  const lang = useLang();
  return (
    <div className="augments__suited-list enter">
      <p className="build__note">
        {t("Augment'in şampiyonun kendi ortalamasına göre en çok fark yarattığı yerler. Sayı, {rate} oranındaki puan farkı.", { rate: rateLabel.toLocaleLowerCase(lang) })}
      </p>
      <ul>
        {list.map((c) => {
          const icon = iconOf(c.championId);
          const delta = formatDelta(c.delta, lang);
          const body = (
            <>
              <span className="tier" data-tier={c.tier}>
                {c.tier}
              </span>
              {icon && <img src={icon} alt="" width={28} height={28} loading="lazy" />}
              <span className="augments__suited-name">{nameOf(c.championId)}</span>
              <span className="augments__suited-stat">
                {formatPercent(c.winRate, lang, 1)}
                {delta && (
                  <span className="augments__delta" data-sign={signOf(c.delta)}>
                    {" "}
                    {delta}
                  </span>
                )}
                <span className="augment-chip__games"> · {t("{games} maç", { games: c.games.toLocaleString(lang === "tr" ? "tr" : "en-GB") })}</span>
              </span>
            </>
          );
          return (
            <li key={c.championId}>
              {onOpen ? (
                <button type="button" className="augments__suited-row" onClick={() => onOpen(c.championId)}>
                  {body}
                </button>
              ) : (
                <span className="augments__suited-row">{body}</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const RARITY_GROUPS = [2, 1, 0, 4];

/** Every augment the mode hands out, from the client's own data, while there are no games to rate them. */
function Catalogue({ queue, names, needle, rarity }: { queue: number; names: Map<number, AugmentInfo>; needle: string; rarity: string }) {
  const t = useT();
  const lang = useLang();
  const [ids] = useAsync(`mode-augments:${queue}`, () => modeAugments(queue === MAYHEM ? "KIWI" : "CHERRY"));
  const wanted = RARITY_FILTERS.find((r) => r.value === rarity)?.rarity ?? null;
  const list = ids.status === "done" ? ids.value.map((id) => names.get(id)).filter((a): a is AugmentInfo => a !== undefined) : [];
  const shown = list.filter((a) => (wanted === null || a.rarity === wanted) && (!needle || a.name.toLocaleLowerCase(lang).includes(needle)));
  return (
    <>
      <p className="build__note">
        {t("Bu mod için henüz yeterli maç yok. Oranlar, mod oyunda açıkken toplanan maçlarla gelir. Şimdilik moddaki {count} augment:", { count: list.length })}
      </p>
      {ids.status === "error" ? (
        <EmptyState title={t("Augment listesi alınamadı")}>{t("CommunityDragon şu an yanıt vermiyor.")}</EmptyState>
      ) : ids.status !== "done" || names.size === 0 ? (
        <Skeleton lines={6} label={t("Yükleniyor")} />
      ) : (
        RARITY_GROUPS.map((group) => {
          const rows = shown.filter((a) => a.rarity === group).sort((a, b) => a.name.localeCompare(b.name, lang));
          if (rows.length === 0) return null;
          return (
            <section key={group} className="augments__catalogue" aria-label={t(RARITY[group] ?? "Özel")}>
              <h2 className="draft__heading">
                {t(RARITY[group] ?? "Özel")} · {rows.length}
              </h2>
              <ul className="champion-augments__list">
                {rows.map((a) => (
                  <li key={a.id}>
                    <img src={a.icon} alt="" width={28} height={28} loading="lazy" />
                    <span className="champion-augments__name">{a.name}</span>
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}
    </>
  );
}
