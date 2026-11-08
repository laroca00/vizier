import { useState } from "react";
import { getBuildIndex } from "../api";
import { championIconUrl, champions, latestVersion, runeIconUrl, runes } from "../data/ddragon";
import { formatPercent, useLang, useT } from "../i18n";
import { positionLabel } from "../labels";
import { summarizeKeystones } from "../runeExplorer";
import { LiquidGlass } from "../ui/LiquidGlass";
import { PageHeader } from "../ui/Page";
import { EmptyState, ErrorState, Skeleton } from "../ui/States";
import { useAsync } from "../useAsync";
import "./ItemsPage.css";

const CHAMPIONS_SHOWN = 12;

const load = async () => {
  const [version, styles, championList] = await Promise.all([latestVersion(), runes(), champions()]);
  return { version, styles, champions: championList };
};

/** Every keystone with the champions that take it most and the win rate of those games. */
export function RunesPage({ onOpenChampion }: { onOpenChampion: (championId: number, position: string | null) => void }) {
  const t = useT();
  const lang = useLang();
  const [data, retry] = useAsync("runes-page", load);
  const [index, retryIndex] = useAsync("build-index", getBuildIndex);
  const [selected, setSelected] = useState<number | null>(null);

  if (data.status === "error") return <ErrorState message={t("Oyun verisi alınamadı.")} onRetry={retry} />;
  if (data.status !== "done") return <Skeleton lines={6} label={t("Yükleniyor")} />;

  const summary = index.status === "done" ? summarizeKeystones(index.value.builds) : null;
  const open = selected !== null ? summary?.get(selected) : undefined;

  return (
    <LiquidGlass className="panel tiers items-page" radius={28} strength={2.5} scroll>
      <PageHeader title={t("Rünler")} subtitle={t("Her ana rün, onu en çok alan şampiyonlar ve o maçlardaki kazanma oranı")} />
      {index.status === "error" ? (
        <ErrorState message={t("Build dizini şu an kullanılamıyor.")} onRetry={retryIndex} />
      ) : !summary ? (
        <Skeleton lines={6} label={t("Yükleniyor")} />
      ) : summary.size === 0 ? (
        <EmptyState title={t("Henüz veri yok")}>{t("Sunucu build dizinini yayınlayınca burada görünür.")}</EmptyState>
      ) : (
        <div className="items-page__body">
          <div>
            {[...data.value.styles.values()].map((style) => {
              const keystones = style.slots[0]?.filter((r) => summary.has(r.id)) ?? [];
              if (keystones.length === 0) return null;
              return (
                <section key={style.id} aria-label={style.name}>
                  <h2 className="draft__heading">{style.name}</h2>
                  <ul className="items-page__list">
                    {keystones.map((rune) => {
                      const s = summary.get(rune.id)!;
                      return (
                        <li key={rune.id}>
                          <button type="button" className="items-page__row" aria-pressed={selected === rune.id} onClick={() => setSelected(rune.id)}>
                            <img src={runeIconUrl(rune.icon)} alt="" width={32} height={32} />
                            <span>{rune.name}</span>
                            <span className="state__text">{t("{games} maç", { games: s.games })}</span>
                            <span>{formatPercent(s.winRate, lang, 1)}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}
          </div>
          {open ? (
            <article className="items-page__detail">
              <h2 className="section-title">{keystoneName(data.value.styles, open.keystone)}</h2>
              <p className="state__text">{t("{games} maç, {rate} kazanma", { games: open.games, rate: formatPercent(open.winRate, lang, 1) })}</p>
              <ul className="items-page__builders">
                {open.builds.slice(0, CHAMPIONS_SHOWN).map((b) => {
                  const champion = data.value.champions.get(b.championId);
                  return (
                    <li key={`${b.championId}:${b.position}`}>
                      <button type="button" className="items-page__chip" onClick={() => onOpenChampion(b.championId, b.position)}>
                        {champion && <img src={championIconUrl(data.value.version, champion.id)} alt="" width={24} height={24} />}
                        {champion?.name} {positionLabel(b.position, lang)} · {t("{games} maç, {rate} kazanma", { games: b.games, rate: formatPercent(b.winRate, lang, 1) })}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </article>
          ) : (
            <p className="state__text">{t("Ayrıntı için bir ana rün seç.")}</p>
          )}
        </div>
      )}
    </LiquidGlass>
  );
}

function keystoneName(styles: Awaited<ReturnType<typeof load>>["styles"], id: number) {
  for (const style of styles.values()) for (const rune of style.slots[0] ?? []) if (rune.id === id) return rune.name;
  return String(id);
}
