import { useState } from "react";
import { getAugments } from "../api";
import { augmentInfo, RARITY } from "../augments/data";
import "../augments/augments.css";
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

export function AugmentsPage() {
  const t = useT();
  const lang = useLang();
  const [queue, setQueue] = useState(ARENA);
  const [champion, setChampion] = useState(ALL);
  const [query, setQuery] = useState("");
  const championId = champion === ALL ? null : Number(champion);
  const [stats, retry] = useAsync(`augments:${queue}:${championId}`, () => getAugments(queue, championId));
  const [info] = useAsync(`augment-info:${lang}`, () => augmentInfo(lang));
  const [championList] = useAsync("champions", champions);
  const options = championList.status === "done" ? [...championList.value.values()].sort((a, b) => a.name.localeCompare(b.name, lang)) : [];
  const rateLabel = queue === ARENA ? t("İlk 4") : t("Kazanma");

  const names = info.status === "done" ? info.value : new Map();
  const needle = query.trim().toLocaleLowerCase(lang);
  const rows =
    stats.status === "done" && stats.value
      ? stats.value.augments.filter((a) => !needle || (names.get(a.augmentId)?.name ?? "").toLocaleLowerCase(lang).includes(needle))
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
        <Select label={t("Şampiyon")} value={champion} options={[{ value: ALL, label: t("Tüm şampiyonlar") }, ...options.map((c) => ({ value: String(c.key), label: c.name }))]} onChange={setChampion} />
      </div>
      {stats.status === "error" ? (
        <ErrorState message={t("Augment istatistikleri alınamadı.")} onRetry={retry} />
      ) : stats.status !== "done" ? (
        <Skeleton lines={8} label={t("Yükleniyor")} />
      ) : stats.value === null ? (
        <EmptyState title={t("Augment istatistikleri şu an kapalı")}>{t("Vizier sunucusu bu verileri şimdilik göstermiyor.")}</EmptyState>
      ) : stats.value.augments.length === 0 ? (
        <EmptyState title={t("Henüz yeterli maç yok")}>
          {t("Bu mod oyunda açıkken Vizier maçları topladıkça augment'ler burada görünür. Arena ve ARAM Mayhem her zaman açık olmayabilir.")}
        </EmptyState>
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
