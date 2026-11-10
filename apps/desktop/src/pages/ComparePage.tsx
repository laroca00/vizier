import { BRACKETS, BRACKET_LABELS, type Bracket } from "@vizier/shared/brackets";
import { getStatsBoardAt, getTierListAt } from "../api";
import { addPick, compareCell, COMPARE_STATS, leaderOf, MAX_COMPARED, type CompareStat, type Pick } from "../data/compare";
import { championIconUrl, latestVersion } from "../data/ddragon";
import { joinStats, type StatsRow } from "../data/statsTable";
import { formatPercent, useLang, useT } from "../i18n";
import { POSITIONS } from "../labels";
import { loadLibraryData } from "../library/data";
import { loadErrorMessage } from "../loadError";
import { Button } from "../ui/Button";
import { Select } from "../ui/Fields";
import { LiquidGlass } from "../ui/LiquidGlass";
import { PageHeader } from "../ui/Page";
import { EmptyState, ErrorState, Skeleton } from "../ui/States";
import { sampleTitle } from "../ui/sampleTitle";
import { useAsync } from "../useAsync";
import { useOnline } from "../useOnline";
import { ChampionField } from "./MatchupPage";
import { useState } from "react";
import "./ComparePage.css";

export type CompareRoute = { page: "compare"; picks: Pick[] };
type Props = { route: CompareRoute; onChange: (next: CompareRoute) => void };

const ROLES = ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"];
const LABELS: Record<CompareStat, string> = {
  winRate: "Kazanma",
  pickRate: "Seçilme",
  banRate: "Yasaklanma",
  games: "Maç",
  kda: "KDA",
  csPerMinute: "CS/dk",
  goldDiff15: "Altın farkı 15",
  lateWinRate: "35+ dk kazanma",
  minutes: "Süre",
};

type Rows = Map<string, StatsRow | undefined>;

/** Every pick in every bracket: one tier list and one board per role and bracket. */
async function load(picks: Pick[]) {
  const roles = [...new Set(picks.map((p) => p.position))];
  const rows: Rows = new Map();
  await Promise.all(
    roles.flatMap((role) =>
      BRACKETS.map(async (bracket) => {
        const [list, board] = await Promise.all([getTierListAt(role, bracket), getStatsBoardAt(role, bracket).catch(() => null)]);
        for (const row of joinStats(role, list.champions, board)) rows.set(`${row.championId}:${role}:${bracket}`, row);
      }),
    ),
  );
  return { rows, version: await latestVersion() };
}

/** Up to three champions side by side across every stat and bracket. */
export function ComparePage({ route, onChange }: Props) {
  const t = useT();
  const lang = useLang();
  const online = useOnline();
  const [bracket, setBracket] = useState<Bracket>("emerald_plus");
  const [fixed] = useAsync("compare-static", loadLibraryData);
  const key = route.picks.map((p) => `${p.championId}:${p.position}`).join(",");
  const [data, retry] = useAsync(route.picks.length > 0 ? `compare:${key}` : null, () => load(route.picks));
  const list = fixed.status === "done" ? [...fixed.value.champions.values()].sort((a, b) => a.name.localeCompare(b.name, lang)) : [];
  const label = lang === "en" ? "en" : "tr";

  const setPick = (index: number, next: Pick) => onChange({ ...route, picks: route.picks.map((p, i) => (i === index ? next : p)) });
  const slots = route.picks.length < MAX_COMPARED ? route.picks.length + 1 : route.picks.length;

  return (
    <LiquidGlass className="panel tiers matchup-page compare" radius={28} strength={2.5} scroll>
      <PageHeader title={t("Karşılaştır")} subtitle={t("En çok üç şampiyonu her istatistikte ve her rankta yan yana koy.")} />
      {fixed.status === "error" ? (
        <ErrorState message={t(loadErrorMessage(fixed.error, online))} onRetry={() => location.reload()} />
      ) : fixed.status !== "done" ? (
        <Skeleton lines={6} label={t("Yükleniyor")} />
      ) : (
        <>
          <div className="compare__slots">
            {Array.from({ length: slots }, (_, i) => {
              const pick = route.picks[i];
              return (
                <div key={i} className="compare__slot">
                  <ChampionField
                    label={t("Şampiyon {n}", { n: i + 1 })}
                    value={pick ? fixed.value.champions.get(pick.championId) : undefined}
                    list={list}
                    version={fixed.value.version}
                    onPick={(id) => (pick ? setPick(i, { ...pick, championId: id }) : onChange({ ...route, picks: addPick(route.picks, { championId: id, position: "MIDDLE" }) }))}
                  />
                  {pick && (
                    <>
                      <Select
                        label={t("Rol")}
                        value={pick.position}
                        options={ROLES.map((value) => ({ value, label: t(POSITIONS[value]) }))}
                        onChange={(position) => setPick(i, { ...pick, position })}
                      />
                      <Button size="small" onClick={() => onChange({ ...route, picks: route.picks.filter((_, j) => j !== i) })}>
                        {t("Çıkar")}
                      </Button>
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {route.picks.length === 0 ? (
            <EmptyState title={t("Şampiyon seç.")}>{t("İstatistik gezgininden ya da şampiyon sayfasından da ekleyebilirsin.")}</EmptyState>
          ) : data.status === "error" ? (
            <ErrorState message={t(loadErrorMessage(data.error, online))} onRetry={retry} />
          ) : data.status !== "done" ? (
            <Skeleton lines={8} label={t("Yükleniyor")} />
          ) : (
            <>
              <Select<Bracket>
                label={t("Lig")}
                value={bracket}
                options={BRACKETS.map((b) => ({ value: b, label: BRACKET_LABELS[b][label] }))}
                onChange={setBracket}
              />
              <div className="stats__scroll">
                <table className="tiers__table compare__table">
                  <caption>{t("{rank} rankında, dereceli maçlar", { rank: BRACKET_LABELS[bracket][label] })}</caption>
                  <thead>
                    <tr>
                      <th scope="col">{t("İstatistik")}</th>
                      {route.picks.map((p) => (
                        <th key={`${p.championId}:${p.position}`} scope="col">
                          <Head pick={p} version={data.value.version} champions={fixed.value.champions} />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {COMPARE_STATS.map((stat) => {
                      const cells = route.picks.map((p) => compareCell(data.value.rows.get(`${p.championId}:${p.position}:${bracket}`), stat));
                      const lead = leaderOf(cells, stat);
                      return (
                        <tr key={stat}>
                          <th scope="row">{t(LABELS[stat])}</th>
                          {cells.map((cell, i) => (
                            <td key={i} data-solid={cell.solid} data-lead={lead === i || undefined} title={cell.games === null ? undefined : t("{games} maç", { games: cell.games.toLocaleString() })}>
                              {format(stat, cell.value, lang)}
                              {cell.games !== null && <small> {t("{games} maç", { games: cell.games.toLocaleString() })}</small>}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <h2 className="draft__heading">{t("Rank'a göre kazanma oranı")}</h2>
              <div className="stats__scroll">
                <table className="tiers__table compare__table">
                  <thead>
                    <tr>
                      <th scope="col">{t("Lig")}</th>
                      {route.picks.map((p) => (
                        <th key={`${p.championId}:${p.position}`} scope="col">
                          <Head pick={p} version={data.value.version} champions={fixed.value.champions} />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {BRACKETS.map((b) => {
                      const cells = route.picks.map((p) => data.value.rows.get(`${p.championId}:${p.position}:${b}`));
                      return (
                        <tr key={b} data-current={b === bracket || undefined}>
                          <th scope="row">{BRACKET_LABELS[b][label]}</th>
                          {cells.map((row, i) => {
                            const cell = compareCell(row, "winRate");
                            return (
                              <td key={i} data-solid={cell.solid} title={row ? sampleTitle(t, lang, { games: row.games, winRate: row.winRate, bracket: BRACKET_LABELS[b][label] }) : undefined}>
                                {format("winRate", cell.value, lang)}
                                {cell.games !== null && <small> {t("{games} maç", { games: cell.games.toLocaleString() })}</small>}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="build__note">{t("Soluk değerler az maçtan geliyor; öne çıkan satır, ancak iki taraf da yeterli veriye sahipse en yükseği gösterir.")}</p>
            </>
          )}
        </>
      )}
    </LiquidGlass>
  );
}

function Head({ pick, version, champions }: { pick: Pick; version: string; champions: Map<number, { key: number; id: string; name: string }> }) {
  const t = useT();
  const champion = champions.get(pick.championId);
  return (
    <span className="compare__head">
      {champion && <img src={championIconUrl(version, champion.id)} alt="" width={26} height={26} />}
      {champion?.name ?? pick.championId}
      <small>{t(POSITIONS[pick.position])}</small>
    </span>
  );
}

function format(stat: CompareStat, value: number | null, lang: "tr" | "en" | string): string {
  if (value === null) return "–";
  switch (stat) {
    case "winRate":
    case "pickRate":
    case "banRate":
    case "lateWinRate":
      return formatPercent(value, lang as never, 1);
    case "games":
      return value.toLocaleString();
    case "kda":
      return value.toFixed(2);
    case "csPerMinute":
    case "minutes":
      return value.toFixed(1);
    case "goldDiff15":
      return `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(value)}`;
  }
}
