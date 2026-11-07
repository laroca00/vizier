import { useState } from "react";
import { formatPercent, useLang, useT, type Lang } from "../i18n";
import { getBans, getTierList } from "../api";
import { championIconUrl, champions, latestVersion, roleIconUrl } from "../data/ddragon";
import { POSITIONS } from "../labels";
import { ARENA, QUEUES, RANKED, winLabel } from "../queues";
import { LiquidGlass } from "../ui/LiquidGlass";
import { useAsync } from "../useAsync";
import { Scatter } from "../charts";

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
  const [state, retry] = useAsync(`${queue}:${position}`, () => load(queue, position));
  const ranked = queue === RANKED;

  return (
    <LiquidGlass className="panel tiers" radius={28} strength={2.5} scroll>
      <header className="draft__header">
        <h1 className="draft__title">{t("Tier listesi")}</h1>
        {state.status === "done" && state.value.list.patches.length > 0 && (
          <p className="draft__phase">
            {t("Yama {patch}, TR ve EUW Emerald+ oyuncularından {games} maç", {
              patch: state.value.list.patches[0],
              games: Math.round(state.value.list.games / playersPerGame(queue)),
            })}
          </p>
        )}
      </header>

      <div className="tiers__tabs" role="tablist" aria-label={t("Oyun modu")}>
        {QUEUES.map((q) => (
          <button key={q.id} type="button" role="tab" aria-selected={q.id === queue} className="nav__item" onClick={() => setQueue(q.id)}>
            {t(q.label)}
          </button>
        ))}
      </div>

      {ranked && (
        <div className="tiers__tabs tiers__tabs--roles" role="tablist" aria-label={t("Rol")}>
          {ORDER.map((p) => (
            <button key={p} type="button" role="tab" aria-selected={p === position} className="nav__item" onClick={() => setPosition(p)}>
              <img className="role-icon" src={roleIconUrl(p)} alt="" width={16} height={16} />
              {t(POSITIONS[p])}
            </button>
          ))}
        </div>
      )}

      {state.status === "error" ? (
        <div role="alert">
          <p className="coach__note">{t("Tier listesi alınamadı.")}</p>
          <button type="button" className="button" onClick={retry}>
            {t("Tekrar dene")}
          </button>
        </div>
      ) : state.status !== "done" ? (
        <p className="coach__note">{t("Yükleniyor")}</p>
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
                </tr>
              </thead>
              <tbody>
                {state.value.list.champions.map((c) => {
                  const champion = state.value.champions.get(c.championId);
                  return (
                    <tr key={c.championId}>
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
                        </button>
                      </td>
                      <td>{percent(c.winRate)}</td>
                      <td className="tiers__change" data-trend={c.winRateChange == null ? undefined : c.winRateChange >= 0 ? "up" : "down"}>
                        {c.winRateChange == null ? "–" : signed(c.winRateChange)}
                      </td>
                      <td>{percent(c.pickRate)}</td>
                      {ranked && <td>{c.banRate == null ? "–" : percent(c.banRate)}</td>}
                      <td>{c.games.toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

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
