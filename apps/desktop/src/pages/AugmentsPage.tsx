import { useState } from "react";
import { getAugments, getTierList, type AugmentStats } from "../api";
import { augmentInfo, modeAugments, RARITY, type AugmentInfo } from "../augments/data";
import { classChampions, mergeAugmentStats, RARITY_FILTERS } from "../augments/filter";
import "../augments/augments.css";
import { CLASS_NAMES } from "../ChampionGuide";
import { champions } from "../data/ddragon";
import { formatPercent, useLang, useT } from "../i18n";
import "../library/library.css";
import { SearchInput, Select } from "../ui/Fields";
import { LiquidGlass } from "../ui/LiquidGlass";
import { PageHeader } from "../ui/Page";
import { EmptyState, ErrorState, Skeleton } from "../ui/States";
import { Tabs } from "../ui/Tabs";
import { useAsync } from "../useAsync";

const ARENA = 1700;
const MAYHEM = 2400;
const QUEUES = [
  { id: ARENA, label: "Arena" },
  { id: MAYHEM, label: "ARAM Mayhem" },
];
const ALL = "ALL";
const CLASSES = ["Fighter", "Mage", "Assassin", "Marksman", "Support", "Tank"];
// A class view merges the stats of its most played champions; more would mean many more requests.
const CLASS_CHAMPIONS = 12;

async function loadClass(queue: number, tag: string, tagsOf: (id: number) => string[] | undefined): Promise<{ stats: AugmentStats | null; champions: number }> {
  const tiers = await getTierList("ALL", queue);
  const ids = classChampions(tiers.champions, tagsOf, tag, CLASS_CHAMPIONS);
  const docs = await Promise.all(ids.map((id) => getAugments(queue, id)));
  const found = docs.filter((d): d is AugmentStats => d !== null && d.games > 0);
  return { stats: found.length ? mergeAugmentStats(found) : null, champions: found.length };
}

export function AugmentsPage() {
  const t = useT();
  const lang = useLang();
  const [queue, setQueue] = useState(ARENA);
  const [champion, setChampion] = useState(ALL);
  const [query, setQuery] = useState("");
  const championId = champion === ALL ? null : Number(champion);
  const [rarity, setRarity] = useState("ALL");
  const [tag, setTag] = useState(ALL);
  const [championList] = useAsync("champions", champions);
  const byClass = tag !== ALL && championId === null;
  const [overall, retryOverall] = useAsync(`augments:${queue}:${championId}`, () => getAugments(queue, championId));
  const [classView, retryClass] = useAsync(`augments-class:${queue}:${byClass ? tag : ALL}:${championList.status}`, async () => {
    if (!byClass || championList.status !== "done") return null;
    const list = championList.value;
    return loadClass(queue, tag, (id) => list.get(id)?.tags);
  });
  const stats = byClass ? (classView.status === "done" ? { status: "done" as const, value: classView.value?.stats ?? null } : classView) : overall;
  const retry = byClass ? retryClass : retryOverall;
  const [info] = useAsync(`augment-info:${lang}`, () => augmentInfo(lang));
  const options = championList.status === "done" ? [...championList.value.values()].sort((a, b) => a.name.localeCompare(b.name, lang)) : [];
  const rateLabel = queue === ARENA ? t("İlk 4") : t("Kazanma");

  const names = info.status === "done" ? info.value : new Map();
  const needle = query.trim().toLocaleLowerCase(lang);
  const rows =
    stats.status === "done" && stats.value
      ? stats.value.augments.filter((a) => {
          const meta = names.get(a.augmentId);
          if (needle && !(meta?.name ?? "").toLocaleLowerCase(lang).includes(needle)) return false;
          const wanted = RARITY_FILTERS.find((r) => r.value === rarity)?.rarity ?? null;
          return wanted === null || meta?.rarity === wanted;
        })
      : [];

  return (
    <LiquidGlass className="panel tiers augments" radius={28} strength={2.5} scroll>
      <PageHeader
        title={t("Augment'ler")}
        subtitle={
          stats.status === "done" && stats.value && stats.value.games > 0
            ? t("Yama {patch}, {games} oyuncu-maç", { patch: stats.value.patches[0] ?? "", games: stats.value.games })
            : t("Arena ve ARAM Mayhem augment'lerinin seçilme ve kazanma oranları")
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
        <Select label={t("Şampiyon")} value={champion} options={[{ value: ALL, label: t("Tüm şampiyonlar") }, ...options.map((c) => ({ value: String(c.key), label: c.name }))]} onChange={(next) => { setChampion(next); setTag(ALL); }} />
      </div>
      {byClass && classView.status === "done" && classView.value?.stats && (
        <p className="build__note">
          {t("{champions} şampiyonun birleşik verisi, {games} oyuncu-maç", { champions: classView.value.champions, games: classView.value.stats.games })}
        </p>
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
              <th scope="col">{t("Tier")}</th>
              <th scope="col">{t("Augment")}</th>
              <th scope="col">{t("Nadirlik")}</th>
              <th scope="col">{t("Seçilme")}</th>
              <th scope="col">{rateLabel}</th>
              <th scope="col">{t("Maç")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => {
              const meta = names.get(a.augmentId);
              return (
                <tr key={a.augmentId}>
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
                  <td>{formatPercent(a.winRate, lang, 1)}</td>
                  <td>{a.games.toLocaleString(lang === "tr" ? "tr" : "en-GB")}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </LiquidGlass>
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
