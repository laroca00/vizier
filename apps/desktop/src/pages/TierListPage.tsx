import { useState } from "react";
import { getBans, getTierList } from "../api";
import { championIconUrl, champions, latestVersion } from "../data/ddragon";
import { POSITIONS } from "../labels";
import { LiquidGlass } from "../ui/LiquidGlass";
import { useAsync } from "../useAsync";

const ORDER = ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"];
const percent = (n: number) => `%${(n * 100).toFixed(1)}`;

async function load(position: string) {
  const [list, bans, version, championList] = await Promise.all([getTierList(position), getBans(), latestVersion(), champions()]);
  return { list, bans, version, champions: championList };
}

export function TierListPage() {
  const [position, setPosition] = useState("MIDDLE");
  const [state, retry] = useAsync(position, () => load(position));

  return (
    <LiquidGlass className="panel tiers" radius={28} strength={2.5}>
      <header className="draft__header">
        <h1 className="draft__title">Tier listesi</h1>
        {state.status === "done" && (
          <p className="draft__phase">
            Yama {state.value.list.patches[0]}, TR Emerald+ {Math.round(state.value.list.games / 2)} maç
          </p>
        )}
      </header>

      <div className="tiers__tabs" role="tablist" aria-label="Rol">
        {ORDER.map((p) => (
          <button key={p} type="button" role="tab" aria-selected={p === position} className="nav__item" onClick={() => setPosition(p)}>
            {POSITIONS[p]}
          </button>
        ))}
      </div>

      {state.status === "error" ? (
        <div role="alert">
          <p className="coach__note">Tier listesi alınamadı.</p>
          <button type="button" className="button" onClick={retry}>
            Tekrar dene
          </button>
        </div>
      ) : state.status !== "done" ? (
        <p className="coach__note">Yükleniyor</p>
      ) : (
        <div className="tiers__body">
          {state.value.list.champions.length === 0 ? (
            <p className="coach__note">Bu rol için henüz yeterli maç yok. Vizier her gün daha fazla maç topluyor.</p>
          ) : (
            <table className="tiers__table">
              <thead>
                <tr>
                  <th scope="col">Tier</th>
                  <th scope="col">Şampiyon</th>
                  <th scope="col">Kazanma</th>
                  <th scope="col">Seçilme</th>
                  <th scope="col">Maç</th>
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
                      <td className="tiers__champion">
                        {champion && <img src={championIconUrl(state.value.version, champion.id)} alt="" width={26} height={26} />}
                        {champion?.name ?? c.championId}
                      </td>
                      <td>{percent(c.winRate)}</td>
                      <td>{percent(c.pickRate)}</td>
                      <td>{c.games}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          <aside className="tiers__bans" aria-label="Yasak önerileri">
            <h2 className="draft__heading">Yasak önerileri</h2>
            <p className="build__note">Sık seçilip sık kazanan şampiyonlar; yasaklamak rakibin en çok kazandığı seçenekleri kapatır.</p>
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
        </div>
      )}
    </LiquidGlass>
  );
}
