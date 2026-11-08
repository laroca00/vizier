import { getTierList } from "./api";
import { championIconUrl, champions, latestVersion, roleIconUrl } from "./data/ddragon";
import { useT } from "./i18n";
import { metaMovers, type Mover } from "./movers";
import { changeText, trendOf } from "./pages/trend";
import { useAsync } from "./useAsync";
import "./MetaMovers.css";

const ROLES = ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"];

async function load() {
  const [lists, byKey, version] = await Promise.all([Promise.all(ROLES.map((p) => getTierList(p))), champions(), latestVersion()]);
  const movers = metaMovers(lists.map((l, i) => ({ position: ROLES[i], champions: l.champions })));
  const patches = lists.find((l) => l.patches.length > 1)?.patches ?? [];
  return { movers, byKey, version, patches };
}

/** Who gained or lost the most win rate and pick rate since the previous patch. */
export function MetaMovers({ onOpenChampion }: { onOpenChampion: (championId: number, position: string | null) => void }) {
  const t = useT();
  const [state] = useAsync("meta-movers", load);
  if (state.status !== "done") return null;
  const { movers, byKey, version, patches } = state.value;
  const groups: [string, Mover[]][] = [
    [t("Kazanma oranı yükselenler"), movers.winRateUp],
    [t("Kazanma oranı düşenler"), movers.winRateDown],
    [t("Seçilmesi artanlar"), movers.pickRateUp],
    [t("Seçilmesi azalanlar"), movers.pickRateDown],
  ];
  if (groups.every(([, list]) => list.length === 0)) return null;

  return (
    <section className="movers enter" aria-labelledby="movers-title">
      <h2 id="movers-title" className="movers__title">
        {patches.length > 1 ? t("Yama {patch}, {previous} yamasına göre değişenler", { patch: patches[0], previous: patches[1] }) : t("Yamada en çok değişenler")}
      </h2>
      <div className="movers__grid">
        {groups.map(([title, list]) =>
          list.length === 0 ? null : (
            <div key={title}>
              <h3 className="movers__heading">{title}</h3>
              <ul className="movers__list">
                {list.map((m) => {
                  const champion = byKey.get(m.championId);
                  if (!champion) return null;
                  return (
                    <li key={`${m.championId}-${m.position}`}>
                      <button type="button" className="movers__row" onClick={() => onOpenChampion(m.championId, m.position)}>
                        <img src={championIconUrl(version, champion.id)} alt="" width={24} height={24} />
                        <span className="movers__name">{champion.name}</span>
                        <img src={roleIconUrl(m.position)} alt="" width={14} height={14} />
                        <span className="movers__change" data-trend={trendOf(m.change) ?? undefined}>
                          {changeText(m.change)}
                        </span>
                        <span className="movers__games">{t("{games} maç", { games: m.games.toLocaleString() })}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ),
        )}
      </div>
    </section>
  );
}
