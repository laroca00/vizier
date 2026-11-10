import { useSyncExternalStore } from "react";
import { getStatsBoard, getTierList, type StatsBoard, type TierList } from "../api";
import { pooled } from "../data/confidence";
import { championIconUrl, champions, latestVersion, roleIconUrl } from "../data/ddragon";
import {
  averageSolid,
  goldDiffSolid,
  joinStats,
  viewStats,
  winRateSolid,
  type StatsColumn,
  type StatsRow,
} from "../data/statsTable";
import { formatPercent, useLang, useT } from "../i18n";
import { POSITIONS } from "../labels";
import { loadErrorMessage } from "../loadError";
import { useOpenChampion } from "../championLink";
import { rankLabel, useBracket } from "../rank";
import { activeRegion, subscribeRank } from "../rankChoice";
import { DataBadge } from "../ui/DataBadge";
import { SearchInput, Select } from "../ui/Fields";
import { LiquidGlass } from "../ui/LiquidGlass";
import { PageHeader } from "../ui/Page";
import { RankPicker, RegionPicker } from "../ui/RankPicker";
import { sampleTitle } from "../ui/sampleTitle";
import { EmptyState, ErrorState, Skeleton } from "../ui/States";
import { useAsync } from "../useAsync";
import { useOnline } from "../useOnline";
import "./TierListPage.css";
import "./StatsPage.css";

export type StatsRoute = { page: "stats"; position: string; sort: StatsColumn; desc: boolean; minGames: number; query: string };
type Props = { route: StatsRoute; onChange: (next: StatsRoute) => void };

const ROLES = ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"];
const MIN_GAMES = [0, 100, 300, 1000];
const SHOWN = 200;

async function load(position: string) {
  const roles = position === "ALL" ? ROLES : [position];
  const [version, names, lists, boards] = await Promise.all([
    latestVersion(),
    champions(),
    Promise.all(roles.map((role) => getTierList(role))),
    // The averages are a bonus: without them the table still shows win, pick and ban rates.
    Promise.all(roles.map((role) => getStatsBoard(role).catch((): StatsBoard | null => null))),
  ]);
  const rows = roles.flatMap((role, i) => joinStats(role, lists[i].champions, boards[i]));
  return { version, names, rows, lists, boards };
}

/** Every champion and role in one sortable table: win, pick and ban rates beside the averages the crawler keeps. */
export function StatsPage({ route, onChange }: Props) {
  const t = useT();
  const lang = useLang();
  const online = useOnline();
  const bracket = useBracket();
  const region = useSyncExternalStore(subscribeRank, () => activeRegion() ?? "");
  const [state, retry] = useAsync(`stats:${route.position}:${bracket}:${region}`, () => load(route.position));
  const rank = rankLabel(bracket, lang === "en" ? "en" : "tr");

  return (
    <LiquidGlass className="panel tiers stats" radius={28} strength={2.5} scroll>
      <PageHeader
        title={t("İstatistik gezgini")}
        subtitle={t("Her şampiyon ve rol tek tabloda: kazanma, seçilme ve yasaklanma oranı ile oyun başına ortalamalar. Başlığa basarak sırala.")}
        toolbar={
          <>
            <RankPicker />
            <RegionPicker />
            <Select
              label={t("Rol")}
              value={route.position}
              options={[{ value: "ALL", label: t("Tüm roller") }, ...ROLES.map((value) => ({ value, label: t(POSITIONS[value]) }))]}
              onChange={(position) => onChange({ ...route, position })}
            />
            <Select
              label={t("En az maç")}
              value={String(route.minGames)}
              options={MIN_GAMES.map((n) => ({ value: String(n), label: t("{games} maç", { games: n.toLocaleString() }) }))}
              onChange={(value) => onChange({ ...route, minGames: Number(value) })}
            />
            <SearchInput label={t("Şampiyon ara")} value={route.query} onChange={(query) => onChange({ ...route, query })} placeholder={t("Şampiyon ara")} />
            {state.status === "done" && state.value.rows.length > 0 && (
              <DataBadge {...pooled(state.value.rows)} patches={state.value.lists[0]?.patches} updatedAt={state.value.lists[0]?.updatedAt} ranked source={t("Vizier crawler, dereceli maçlar")} />
            )}
          </>
        }
      />
      {state.status === "error" ? (
        <ErrorState message={t(loadErrorMessage(state.error, online))} onRetry={retry} />
      ) : state.status !== "done" ? (
        <Skeleton lines={8} label={t("Yükleniyor")} />
      ) : (
        <StatsTable route={route} onChange={onChange} data={state.value} rank={rank} />
      )}
    </LiquidGlass>
  );
}

type Loaded = { version: string; names: Map<number, { id: string; name: string }>; rows: StatsRow[]; lists: TierList[] };

function StatsTable({ route, onChange, data, rank }: { route: StatsRoute; onChange: (next: StatsRoute) => void; data: Loaded; rank: string }) {
  const t = useT();
  const lang = useLang();
  const openChampion = useOpenChampion();
  const nameOf = (id: number) => data.names.get(id)?.name ?? String(id);
  const all = viewStats(data.rows, route, nameOf);
  const rows = all.slice(0, SHOWN);
  const patches = data.lists[0]?.patches;
  const percent = (n: number) => formatPercent(n, lang, 1);

  const sortHeader = (column: StatsColumn, label: string, hint?: string) => (
    <th scope="col" aria-sort={route.sort === column ? (route.desc ? "descending" : "ascending") : undefined} title={hint}>
      <button type="button" className="tiers__sort" onClick={() => onChange(route.sort === column ? { ...route, desc: !route.desc } : { ...route, sort: column, desc: column !== "name" })}>
        {label}
        {route.sort === column && <span aria-hidden="true">{route.desc ? " ↓" : " ↑"}</span>}
      </button>
    </th>
  );

  if (data.rows.length === 0) return <EmptyState title={t("Henüz veri yok.")}>{t("Bu rank için tablo yayınlandığında burada görünür.")}</EmptyState>;
  if (all.length === 0) return <EmptyState title={t("Bu süzgeçle şampiyon yok.")}>{t("En az maç sayısını düşür ya da aramayı temizle.")}</EmptyState>;

  const averageTitle = (row: StatsRow, what: string) =>
    row.board ? t("{what}: {games} maçtan; {rank}", { what, games: row.board.games.toLocaleString(), rank }) : t("Bu şampiyon ve rol için henüz ortalama yok.");
  return (
    <div className="tiers__list stats__scroll">
      <table className="tiers__table stats__table">
        <thead>
          <tr>
            {sortHeader("name", t("Şampiyon"))}
            {sortHeader("winRate", t("Kazanma"))}
            {sortHeader("pickRate", t("Seçilme"))}
            {sortHeader("banRate", t("Yasaklanma"))}
            {sortHeader("games", t("Maç"))}
            {sortHeader("kda", "KDA", t("(öldürme + asist) / ölüm, oyun başına ortalamalardan"))}
            {sortHeader("csPerMinute", t("CS/dk"))}
            {sortHeader("goldDiff15", t("Altın farkı 15"), t("15. dakikada kendi hat rakibine göre altın farkı; zaman çizelgesi olan oyunlardan"))}
            {sortHeader("minutes", t("Süre"), t("Ortalama oyun süresi, dakika"))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const sample = { games: row.games, winRate: row.winRate, bracket: rank, patches };
            const solid = winRateSolid(row);
            const averages = averageSolid(row);
            return (
              <tr key={`${row.championId}:${row.position}`}>
                <td>
                  <button type="button" className="tiers__champion" onClick={() => openChampion(row.championId, row.position, 420)}>
                    {data.names.get(row.championId) && <img src={championIconUrl(data.version, data.names.get(row.championId)!.id)} alt="" width={26} height={26} />}
                    {nameOf(row.championId)}
                    {route.position === "ALL" && <img className="role-icon" src={roleIconUrl(row.position)} alt={t(POSITIONS[row.position])} title={t(POSITIONS[row.position])} width={16} height={16} />}
                  </button>
                </td>
                <td data-solid={solid} title={sampleTitle(t, lang, sample, t("Vizier crawler, dereceli maçlar"))}>
                  {percent(row.winRate)}
                </td>
                <td title={t("{games} maç", { games: row.games.toLocaleString() })}>{percent(row.pickRate)}</td>
                <td title={t("{games} maç", { games: row.games.toLocaleString() })}>{row.banRate === null ? "–" : percent(row.banRate)}</td>
                <td>{row.games.toLocaleString()}</td>
                <td data-solid={averages} title={averageTitle(row, "KDA")}>
                  {row.board ? row.board.kda.toFixed(2) : "–"}
                </td>
                <td data-solid={averages} title={averageTitle(row, t("CS/dk"))}>
                  {row.board ? row.board.csPerMinute.toFixed(1) : "–"}
                </td>
                <td
                  data-solid={goldDiffSolid(row)}
                  title={row.board?.goldDiff15 ? t("{what}: {games} maçtan; {rank}", { what: t("Altın farkı 15"), games: row.board.goldDiff15.games.toLocaleString(), rank }) : t("Bu şampiyon ve rol için henüz ortalama yok.")}
                >
                  {row.board?.goldDiff15 ? `${row.board.goldDiff15.value > 0 ? "+" : row.board.goldDiff15.value < 0 ? "−" : ""}${Math.abs(row.board.goldDiff15.value)}` : "–"}
                </td>
                <td data-solid={averages} title={averageTitle(row, t("Süre"))}>
                  {row.board ? row.board.minutes.toFixed(1) : "–"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {all.length > SHOWN && <p className="build__note">{t("İlk {count} satır gösteriliyor; süzgeci daralt.", { count: SHOWN })}</p>}
      <p className="build__note">{t("Soluk değerler az maçtan geliyor. Ortalamalar tüm bölgelerin; bölge seçimi yalnızca kazanma, seçilme ve yasaklanma oranını değiştirir.")}</p>
    </div>
  );
}
