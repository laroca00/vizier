import { useState } from "react";
import { getAugments } from "../api";
import { formatPercent, useLang, useT } from "../i18n";
import { Tabs } from "../ui/Tabs";
import { useAsync } from "../useAsync";
import { augmentInfo, RARITY, type AugmentInfo } from "./data";
import { RARITY_FILTERS } from "./filter";
import { formatDelta, tierRows } from "./tiers";

/**
 * The champion's augments as a tier board: each tier a row, rated by how much
 * an augment lifts this champion over their own rate.
 */
export function ChampionAugmentBoard({ championId, championName, queue }: { championId: number; championName: string; queue: number }) {
  const t = useT();
  const lang = useLang();
  const [rarity, setRarity] = useState<string>("ALL");
  const [stats] = useAsync(`augments:${queue}:${championId}`, () => getAugments(queue, championId));
  const [info] = useAsync(`augment-info:${lang}`, () => augmentInfo(lang));
  if (stats.status !== "done" || !stats.value) return null;
  const names: Map<number, AugmentInfo> = info.status === "done" ? info.value : new Map();
  const wanted = RARITY_FILTERS.find((r) => r.value === rarity)?.rarity ?? null;
  const rows = tierRows(stats.value.augments, (a) => wanted === null || names.get(a.augmentId)?.rarity === wanted);
  const rateWord = queue === 1700 ? t("ilk 4") : t("kazanma");

  return (
    <section className="augment-board enter" aria-label={t("{champion} augment tier listesi", { champion: championName })}>
      <div className="augment-board__head">
        <h2 className="draft__heading">{t("{champion} augment tier listesi", { champion: championName })}</h2>
        <Tabs label={t("Nadirlik")} items={RARITY_FILTERS.map((r) => ({ id: r.value as string, label: t(r.value === "ALL" ? "Tümü" : r.label) }))} value={rarity} onChange={setRarity} size="small" />
      </div>
      {stats.value.augments.length === 0 ? (
        <p className="build__note">{t("Bu şampiyonla bu modda henüz yeterli maç yok.")}</p>
      ) : rows.length === 0 ? (
        <p className="build__note">{t("Bu nadirlikte yeterli maçı olan augment yok.")}</p>
      ) : (
        <ol className="augment-board__rows">
          {rows.map((row) => (
            <li key={row.tier} className="augment-board__row">
              <span className="tier augment-board__tier" data-tier={row.tier}>
                {row.tier}
              </span>
              <ul className="augment-board__chips">
                {row.augments.map((a) => {
                  const meta = names.get(a.augmentId);
                  const delta = formatDelta(a.delta, lang);
                  return (
                    <li
                      key={a.augmentId}
                      className="augment-chip"
                      data-rarity={meta?.rarity}
                      title={t("{name}: {rate} {word}, {games} maç", { name: meta?.name ?? "", rate: formatPercent(a.winRate, lang, 1), word: rateWord, games: a.games })}
                    >
                      {meta && <img src={meta.icon} alt="" width={30} height={30} loading="lazy" />}
                      <span className="augment-chip__text">
                        <span className="augment-chip__name">{meta?.name ?? t("Augment #{id}", { id: a.augmentId })}</span>
                        <span className="augment-chip__stat">
                          {formatPercent(a.winRate, lang, 1)}
                          {delta && <span data-sign={a.delta! > 0 ? "up" : a.delta! < 0 ? "down" : undefined}> {delta}</span>}
                          <span className="augment-chip__games"> · {a.games.toLocaleString(lang === "tr" ? "tr" : "en-GB")}</span>
                        </span>
                      </span>
                      {meta && <span className="visually-hidden">{t(RARITY[meta.rarity] ?? "")}</span>}
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ol>
      )}
      <p className="build__note">
        {t("Tier, augment'in bu şampiyonu kendi ortalamasının ne kadar üstüne taşıdığına göre verilir. Oranın yanındaki sayı, {word} oranındaki farkı puan olarak gösterir. {games} oyunluk veri.", {
          word: rateWord,
          games: stats.value.games,
        })}
      </p>
    </section>
  );
}
