import { getTierList, type TierEntry } from "../api";
import { championIconUrl, champions, latestVersion } from "../data/ddragon";
import { formatPercent, useLang, useT } from "../i18n";
import { POSITIONS } from "../labels";
import { changeText, trendOf } from "../pages/trend";
import type { Verdict } from "../patches/diff";
import { fieldLabel, formatValue } from "../patches/format";
import { cachedPatchDiff, patchName, patchVersions } from "../patches/load";
import { usePersonal } from "../personal";
import type { Route } from "../router";
import { useAsync } from "../useAsync";
import { thisPatchRows } from "./thisPatch";
import "../patches/patches.css";

const ROLES = ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"];
const VERDICT_NAMES: Record<Verdict, string> = { buff: "Güçlendirme", nerf: "Zayıflatma", mixed: "Karışık" };

async function load() {
  const [lists, byKey, version] = await Promise.all([Promise.all(ROLES.map((p) => getTierList(p).catch(() => null))), champions(), latestVersion()]);
  const entries: Record<string, TierEntry[]> = {};
  ROLES.forEach((role, i) => (entries[role] = lists[i]?.champions ?? []));
  return { entries, byKey, version };
}

/** The pool at a glance this patch: tier, win rate and its move, and what the patch changed. */
export function ThisPatchCard({ onOpenChampion, onNavigate }: { onOpenChampion: (championId: number, position: string | null) => void; onNavigate: (route: Route) => void }) {
  const t = useT();
  const lang = useLang();
  const { pool } = usePersonal();
  // Shares its cache key with the pool panel, so both read one set of tier lists.
  const [state] = useAsync(pool.length ? "pool-moves-full" : null, load);
  const [versions] = useAsync("patch-versions", patchVersions);
  if (pool.length === 0 || state.status !== "done") return null;
  const [to, from] = versions.status === "done" ? versions.value : [];
  const diff = to && from ? cachedPatchDiff(from, to, lang) : null;
  const rows = thisPatchRows(pool, state.value.entries, diff);
  if (rows.length === 0) return null;
  const { byKey, version } = state.value;

  return (
    <section className="this-patch enter" aria-label={t("Bu yama senin için")}>
      <h2 className="section-title">{to ? t("Yama {patch} senin için", { patch: patchName(to) }) : t("Bu yama senin için")}</h2>
      <ul className="this-patch__list">
        {rows.map((row) => {
          const champion = byKey.get(row.championId);
          if (!champion) return null;
          const first = row.changes[0];
          return (
            <li key={`${row.championId}:${row.position}`}>
              <button type="button" className="this-patch__row" onClick={() => onOpenChampion(row.championId, row.position)}>
                <img src={championIconUrl(version, champion.id)} alt="" width={30} height={30} />
                <span className="this-patch__who">
                  <span className="this-patch__name">{champion.name}</span>
                  <span className="build__stat">{t(POSITIONS[row.position])}</span>
                </span>
                {row.tier && (
                  <span className="tier" data-tier={row.tier}>
                    {row.tier}
                  </span>
                )}
                <span className="this-patch__rate">
                  {formatPercent(row.winRate, lang, 1)}
                  <span className="this-patch__change" data-trend={trendOf(row.winRateChange) ?? undefined}>
                    {changeText(row.winRateChange)}
                  </span>
                  <span className="build__stat">{t("{games} maç", { games: row.games.toLocaleString(lang === "tr" ? "tr" : "en-GB") })}</span>
                </span>
                <span className="this-patch__patch">
                  {row.verdict && (
                    <span className="patches__verdict" data-verdict={row.verdict}>
                      {t(VERDICT_NAMES[row.verdict])}
                    </span>
                  )}
                  {first ? (
                    <span className="build__stat">
                      {fieldLabel(first.field, t)} {formatValue(first, first.before, diff?.itemNames ?? {}, lang, t)} → {formatValue(first, first.after, diff?.itemNames ?? {}, lang, t)}
                      {row.changes.length > 1 ? ` ${t("ve {count} değişiklik daha", { count: row.changes.length - 1 })}` : ""}
                    </span>
                  ) : (
                    diff && <span className="build__stat">{t("Değişmedi")}</span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {!diff && to && (
        <p className="state__text">
          {t("Yama değişikliklerini görmek için yama takibini bir kez aç.")}{" "}
          <button type="button" className="link" onClick={() => onNavigate({ page: "patches" })}>
            {t("Yama takibine git")}
          </button>
        </p>
      )}
    </section>
  );
}
