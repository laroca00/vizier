import { MatchupLink } from "../matchupLink";
import { useState } from "react";
import { formatPercent, useLang, useT, type Lang } from "../i18n";
import { getBans, getTierList } from "../api";
import { championIconUrl, champions, latestVersion, roleIconUrl } from "../data/ddragon";
import { POSITIONS } from "../labels";
import { ARENA, QUEUES, RANKED, winLabel } from "../queues";
import { LiquidGlass } from "../ui/LiquidGlass";
import { useAsync } from "../useAsync";
import { usePersonal } from "../personal";
import { Scatter } from "../charts";
import { PageHeader } from "../ui/Page";
import { ErrorState, Skeleton } from "../ui/States";
import { Tabs } from "../ui/Tabs";
import { Toggle } from "../ui/Fields";
import { changeText, trendOf } from "./trend";
import { isThin, sortTiers, THIN_GAMES, withoutThin, type TierSort } from "./tierSort";
import "./TierListPage.css";

// The most picked champions only; past this the plot turns into a pile of icons.
const PLOTTED = 40;

const ORDER = ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"];
const percentIn = (lang: Lang) => (n: number) => formatPercent(n, lang, 1);
const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n * 100).toFixed(1)}`;

/** Rows per game in the tier list: one per role and team on the Rift, every player elsewhere. */
function playersPerGame(queue: number) {
  return queue === RANKED ? 2 : queue === ARENA ? 16 : 10;
}

async function load(queue: number, position: string) {
  const [list, bans, version, championList] = await Promise.all([
    getTierList(queue === RANKED ? position : "ALL", queue),
    queue === RANKED ? getBans() : null,
    latestVersion(),
    champions(),
  ]);
  return { list, bans, version, champions: championList };
}

export function TierListPage({ onOpenChampion }: { onOpenChampion: (championId: number, position: string | null, queue: number) => void }) {
  const lang = useLang();
  const percent = percentIn(lang);
  const t = useT();
  const [queue, setQueue] = useState(RANKED);
  const [position, setPosition] = useState("MIDDLE");
  const [sort, setSort] = useState<TierSort>("tier");
  const [hideThin, setHideThin] = useState(false);
  const [state, retry] = useAsync(`${queue}:${position}`, () => load(queue, position));
  const ranked = queue === RANKED;
  const personal = usePersonal();
  const poolIds = new Set(personal.pool.filter((p) => !ranked || !p.position || p.position === position).map((p) => p.championId));

  return (
    <LiquidGlass className="panel tiers" radius={28} strength={2.5} scroll>
      <PageHeader
        title={t("Tier listesi")}
        subtitle={
          state.status === "done" && state.value.list.patches.length > 0
            ? t("Yama {patch}, TR ve EUW Emerald+ oyuncularından {games} maç", {
                patch: state.value.list.patches[0],
                games: Math.round(state.value.list.games / playersPerGame(queue)),
              })
            : undefined
        }
        toolbar={<Tabs label={t("Oyun modu")} items={QUEUES.map((q) => ({ id: q.id, label: t(q.label) }))} value={queue} onChange={setQueue} />}
      />

      {ranked && (
        <Tabs
          label={t("Rol")}
          className="tiers__roles"
          items={ORDER.map((p) => ({ id: p, label: t(POSITIONS[p]), icon: <img className="role-icon" src={roleIconUrl(p)} alt="" width={16} height={16} /> }))}
          value={position}
          onChange={setPosition}
        />
      )}

      {!ranked && (
        <Tabs
          label={t("Sırala")}
          className="tiers__roles"
          size="small"
          items={[
            { id: "tier" as TierSort, label: t("Tier") },
            { id: "winRate" as TierSort, label: t(winLabel(queue)) },
            { id: "pickRate" as TierSort, label: t("Seçilme") },
          ]}
          value={sort}
          onChange={setSort}
        />
      )}

      {state.status === "error" ? (
        <ErrorState message={t("Tier listesi alınamadı.")} onRetry={retry} />
      ) : state.status !== "done" ? (
        <Skeleton lines={8} label={t("Yükleniyor")} />
      ) : (
        <div className="tiers__body" data-solo={!state.value.bans || undefined}>
          {state.value.list.champions.length > 4 && (
            <section className="tiers__map" aria-label={t("Kazanma ve seçilme haritası")}>
              <h2 className="draft__heading">{t("Kazanma ve seçilme haritası")}</h2>
              <p className="build__note">{t("En çok seçilen {count} şampiyon. Çizgiler %50 kazanmada ve ortanca seçilmede kesişir.", { count: Math.min(PLOTTED, state.value.list.champions.length) })}</p>
              <Scatter
                label={t("Kazanma ve seçilme haritası")}
                xLabel={t("Seçilme")}
                yLabel={t(winLabel(queue))}
                formatX={percent}
                formatY={percent}
                formatTick={(n) => formatPercent(n, lang, 0)}
                quadrants={{
                  topRight: t("Güçlü ve popüler"),
                  topLeft: t("Gözden kaçan güçlü"),
                  bottomRight: t("Popüler ama zayıf"),
                  bottomLeft: t("Zayıf"),
                }}
                legend={[
                  { group: "S", label: "S" },
                  { group: "A", label: "A" },
                  { group: "B", label: "B" },
                  { group: "C", label: "C–D" },
                ]}
                points={[...state.value.list.champions]
                  .filter((c) => !isThin(c))
                  .sort((a, b) => b.pickRate - a.pickRate)
                  .slice(0, PLOTTED)
                  .flatMap((c) => {
                    const champion = state.value.champions.get(c.championId);
                    if (!champion) return [];
                    return [
                      {
                        key: c.championId,
                        x: c.pickRate,
                        y: c.winRate,
                        name: champion.name,
                        icon: championIconUrl(state.value.version, champion.id),
                        group: c.tier === "D" ? "C" : c.tier,
                        detail: (
                          <span className="scatter__tip-foot">
                            <span className="tier" data-tier={c.tier}>
                              {c.tier}
                            </span>
                            {c.banRate != null && <span>{t("%{rate} yasaklanma", { rate: (c.banRate * 100).toFixed(1) })}</span>}
                            {t("{games} maç", { games: c.games.toLocaleString() })}
                          </span>
                        ),
                        onOpen: () => onOpenChampion(c.championId, ranked ? position : null, queue),
                      },
                    ];
                  })}
              />
            </section>
          )}
          <div className="tiers__list">
            {state.value.list.champions.some(isThin) && (
              <Toggle label={t("{games} maçtan azını gizle", { games: THIN_GAMES })} checked={hideThin} onChange={setHideThin} />
            )}
            {state.value.list.champions.length === 0 ? (
              <p className="coach__note">
                {t("{what} için henüz yeterli maç yok. Vizier her gün daha fazla maç topluyor.", {
                  what: ranked ? t("Bu rol") : t(QUEUES.find((q) => q.id === queue)?.label ?? ""),
                })}
              </p>
            ) : (
              <table className="tiers__table">
                <thead>
                  <tr>
                    <th scope="col">Tier</th>
                    <th scope="col">{t("Şampiyon")}</th>
                    <th scope="col">{t(winLabel(queue))}</th>
                    <th scope="col">{t("Değişim")}</th>
                    <th scope="col">{t("Seçilme")}</th>
                    {ranked && <th scope="col">{t("Yasaklanma")}</th>}
                    <th scope="col">{t("Maç")}</th>
                    {ranked && <th scope="col">{t("Eşleşme")}</th>}
                  </tr>
                </thead>
                <tbody>
                  {withoutThin(sortTiers(state.value.list.champions, ranked ? "tier" : sort), hideThin).map((c) => {
                    const champion = state.value.champions.get(c.championId);
                    const mine = poolIds.has(c.championId) ? "pool" : personal.favourites.includes(c.championId) ? "favourite" : undefined;
                    return (
                      <tr key={c.championId} data-mine={mine} data-thin={isThin(c) || undefined}>
                        <td>
                          <span className="tier" data-tier={c.tier}>
                            {c.tier}
                          </span>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="tiers__champion"
                            onClick={() => onOpenChampion(c.championId, ranked ? position : null, queue)}
                          >
                            {champion && <img src={championIconUrl(state.value.version, champion.id)} alt="" width={26} height={26} />}
                            {champion?.name ?? c.championId}
                            {isThin(c) && <span className="tiers__thin">{t("az maç")}</span>}
                            {mine && <span className="tiers__mine">{mine === "pool" ? t("Havuzunda") : t("Favori")}</span>}
                          </button>
                        </td>
                        <td>{percent(c.winRate)}</td>
                        <td className="tiers__change" data-trend={trendOf(c.winRateChange) ?? undefined}
                          title={c.winRateChange == null ? t("Önceki yamada yeterli maç yok.") : t("Önceki yamaya göre {change} puan", { change: signed(c.winRateChange) })}
                        >
                          {changeText(c.winRateChange)}
                        </td>
                        <td>{percent(c.pickRate)}</td>
                        {ranked && <td>{c.banRate == null ? "–" : percent(c.banRate)}</td>}
                        <td>{c.games.toLocaleString()}</td>
                        {ranked && (
                          <td>
                            <MatchupLink championId={c.championId} opponentId={null} position={position} />
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {state.value.bans && (
            <aside className="tiers__bans" aria-label={t("Yasak önerileri")}>
              <h2 className="draft__heading">{t("Yasak önerileri")}</h2>
              <p className="build__note">{t("Sık seçilip sık kazanan şampiyonlar; yasaklamak rakibin en çok kazandığı seçenekleri kapatır.")}</p>
              <ul className="bans">
                {state.value.bans.champions.map((c) => {
                  const champion = state.value.champions.get(c.championId);
                  return (
                    <li key={c.championId}>
                      {champion && <img src={championIconUrl(state.value.version, champion.id)} alt="" width={26} height={26} />}
                      <span>{champion?.name ?? c.championId}</span>
                      <span className="build__stat">{percent(c.winRate)}</span>
                    </li>
                  );
                })}
              </ul>
            </aside>
          )}
        </div>
      )}
    </LiquidGlass>
  );
}
