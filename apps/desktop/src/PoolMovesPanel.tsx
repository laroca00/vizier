import { getTierList, type TierEntry } from "./api";
import { championIconUrl, champions, latestVersion } from "./data/ddragon";
import { formatPercent, useLang, useT } from "./i18n";
import { POSITIONS } from "./labels";
import { cachedPatchDiff, patchVersions } from "./patches/load";
import { changeText, trendOf } from "./pages/trend";
import { usePersonal } from "./personal";
import { poolMoves } from "./poolMoves";
import { useAsync } from "./useAsync";
import "./PoolMoves.css";

const ROLES = ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"];

async function load() {
  const [lists, byKey, version] = await Promise.all([Promise.all(ROLES.map((p) => getTierList(p).catch(() => null))), champions(), latestVersion()]);
  const entries: Record<string, TierEntry[]> = {};
  ROLES.forEach((role, i) => (entries[role] = lists[i]?.champions ?? []));
  return { entries, byKey, version, patch: lists.find((l) => l?.patches.length)?.patches[0] ?? null };
}

/** How the pool's win rates moved since the previous patch, and which champions the patch touched. */
export function PoolMoves({ onOpenChampion }: { onOpenChampion: (championId: number, position: string | null) => void }) {
  const t = useT();
  const lang = useLang();
  const { pool } = usePersonal();
  const [state] = useAsync(pool.length ? "pool-moves" : null, load);
  const [versions] = useAsync("patch-versions", patchVersions);
  if (pool.length === 0 || state.status !== "done") return null;
  const { entries, byKey, version, patch } = state.value;
  const moves = poolMoves(pool, entries);
  if (moves.length === 0) return null;
  const diff = versions.status === "done" && versions.value.length >= 2 ? cachedPatchDiff(versions.value[1], versions.value[0], lang) : null;
  const touched = new Set(diff?.entries.filter((e) => e.kind === "champion").map((e) => e.id));

  return (
    <section className="poolmoves enter" aria-label={t("Havuzun yamada")}>
      <h2 className="section-title">{patch ? t("Havuzunun kazanma oranı, yama {patch}", { patch }) : t("Havuzunun kazanma oranı")}</h2>
      <ul className="poolmoves__list">
        {moves.map((m) => {
          const champion = byKey.get(m.championId);
          if (!champion) return null;
          return (
            <li key={`${m.championId}:${m.position}`}>
              <button type="button" className="poolmoves__row" onClick={() => onOpenChampion(m.championId, m.position)}>
                <img src={championIconUrl(version, champion.id)} alt="" width={24} height={24} />
                <span className="poolmoves__name">{champion.name}</span>
                <span className="build__stat">{t(POSITIONS[m.position])}</span>
                {touched.has(String(champion.key)) && <span className="poolmoves__tag">{t("yamada değişti")}</span>}
                <span className="poolmoves__rate">{formatPercent(m.winRate, lang, 1)}</span>
                <span className="poolmoves__change" data-trend={trendOf(m.winRateChange) ?? undefined}>
                  {changeText(m.winRateChange)}
                </span>
                <span className="build__stat">{t("{games} maç", { games: m.games.toLocaleString() })}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
