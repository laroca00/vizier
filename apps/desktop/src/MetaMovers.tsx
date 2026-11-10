import { useState } from "react";
import { DEFAULT_BRACKET } from "@vizier/shared/brackets";
import { getTierHistory, getTierList } from "./api";
import { championIconUrl, champions, latestVersion, roleIconUrl } from "./data/ddragon";
import { historyMovers, type HistoryMover } from "./data/historyMovers";
import { formatPercent, useLang, useT } from "./i18n";
import { useBracket } from "./rank";
import { Tabs } from "./ui/Tabs";
import { metaMovers, type Mover } from "./movers";
import { changeText, trendOf } from "./pages/trend";
import { useAsync } from "./useAsync";
import "./MetaMovers.css";

const ROLES = ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"];

async function loadHistory() {
  const docs = await Promise.all(ROLES.map((p) => getTierHistory(p).catch(() => null)));
  return historyMovers(ROLES.map((position, i) => ({ position, doc: docs[i] })));
}

async function load() {
  const [lists, byKey, version] = await Promise.all([Promise.all(ROLES.map((p) => getTierList(p))), champions(), latestVersion()]);
  const movers = metaMovers(lists.map((l, i) => ({ position: ROLES[i], champions: l.champions })));
  const patches = lists.find((l) => l.patches.length > 1)?.patches ?? [];
  return { movers, byKey, version, patches };
}

/** Who gained or lost the most win rate and pick rate since the previous patch. */
export function MetaMovers({ onOpenChampion }: { onOpenChampion: (championId: number, position: string | null) => void }) {
  const t = useT();
  const [mode, setMode] = useState<"patch" | "within">("patch");
  const [state] = useAsync("meta-movers", load);
  const bracket = useBracket();
  if (state.status !== "done") return null;
  const { movers, byKey, version, patches } = state.value;
  const modes = (
    <Tabs
      label={t("Değişimin kaynağı")}
      size="small"
      items={[
        { id: "patch" as const, label: t("Geçen yamaya göre") },
        { id: "within" as const, label: t("Yama içinde") },
      ]}
      value={mode}
      onChange={setMode}
    />
  );
  if (mode === "within") {
    return (
      <section className="movers enter" aria-labelledby="movers-title">
        <h2 id="movers-title" className="movers__title">{t("Yama içinde değişenler")}</h2>
        {modes}
        {bracket === DEFAULT_BRACKET ? (
          <WithinPatch byKey={byKey} version={version} onOpenChampion={onOpenChampion} />
        ) : (
          <p className="build__note">{t("Yama içi geçmiş yalnızca Emerald+ için tutuluyor.")}</p>
        )}
      </section>
    );
  }
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
      {modes}
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

function WithinPatch({ byKey, version, onOpenChampion }: { byKey: Map<number, { id: string; name: string }>; version: string; onOpenChampion: (championId: number, position: string | null) => void }) {
  const t = useT();
  const lang = useLang();
  const [state] = useAsync("meta-movers-within", loadHistory);
  if (state.status !== "done") return null;
  const groups: [string, HistoryMover[]][] = [
    [t("Yama içinde yükselenler"), state.value.up],
    [t("Yama içinde düşenler"), state.value.down],
  ];
  if (groups.every(([, list]) => list.length === 0)) return <p className="build__note">{t("Yama içinde net bir değişim yok. Yeterli maç birikince burada görünür.")}</p>;
  return (
    <>
      <p className="build__note">{t("Yamanın ilk günlerindeki maçlarla sonradan eklenen maçlar karşılaştırılır; yalnızca aralıkları ayrışan değişimler gösterilir.")}</p>
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
                      <button
                        type="button"
                        className="movers__row"
                        title={t("{early} → {later}; {earlyGames} ve {laterGames} maç", {
                          early: formatPercent(m.earlyRate, lang, 1),
                          later: formatPercent(m.laterRate, lang, 1),
                          earlyGames: m.earlyGames.toLocaleString(),
                          laterGames: m.laterGames.toLocaleString(),
                        })}
                        onClick={() => onOpenChampion(m.championId, m.position)}
                      >
                        <img src={championIconUrl(version, champion.id)} alt="" width={24} height={24} />
                        <span className="movers__name">{champion.name}</span>
                        <img src={roleIconUrl(m.position)} alt="" width={14} height={14} />
                        <span className="movers__change" data-trend={trendOf(m.change) ?? undefined}>{changeText(m.change)}</span>
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
    </>
  );
}
