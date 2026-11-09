import { useState } from "react";
import { getCounters, getTierList } from "../api";
import { patchOf } from "../data/confidence";
import { latestVersion, championIconUrl } from "../data/ddragon";
import { bestBlind, buildMatrix, MATRIX_MAX_CHAMPIONS, MATRIX_OPPONENTS, STATE_MARK, STATE_TEXT, type CellState } from "../counterMatrix";
import { formatPercent, useLang, useT } from "../i18n";
import { POSITIONS } from "../labels";
import { loadErrorMessage } from "../loadError";
import { useOpenMatchup } from "../matchupLink";
import { usePersonal } from "../personal";
import type { Matchups } from "../poolCoverage";
import { poolByRole } from "../poolCoverage";
import { DataBadge } from "../ui/DataBadge";
import { FilterChips, Select, Toggle } from "../ui/Fields";
import { LiquidGlass } from "../ui/LiquidGlass";
import { PageHeader } from "../ui/Page";
import { EmptyState, ErrorState, Skeleton } from "../ui/States";
import { useAsync } from "../useAsync";
import { useOnline } from "../useOnline";
import { loadChampionRoles, type ChampionRoles } from "./ChampionsPage";
import "./MatrixPage.css";

export type MatrixRoute = { page: "matrix"; position: string };
type Props = { route: MatrixRoute; onChange: (next: MatrixRoute) => void };

/** Pool champions against the role's most played opponents; cells say who has the edge only when the interval clears 50%. */
export function MatrixPage({ route, onChange }: Props) {
  const t = useT();
  const online = useOnline();
  const [data, retry] = useAsync("champion-roles", loadChampionRoles);
  return (
    <LiquidGlass className="panel tiers matrix" radius={28} strength={2.5} scroll>
      <PageHeader
        title={t("Karşı seçim matrisi")}
        subtitle={t("Havuzundaki şampiyonlar, rolün en çok oynanan rakiplerine karşı: kime karşı rahat, kime karşı zor.")}
        toolbar={
          <Select
            label={t("Rol")}
            value={route.position}
            options={Object.entries(POSITIONS).map(([value, label]) => ({ value, label: t(label) }))}
            onChange={(position) => onChange({ ...route, position })}
          />
        }
      />
      {data.status === "error" ? (
        <ErrorState message={t(loadErrorMessage(data.error, online))} onRetry={retry} />
      ) : data.status !== "done" ? (
        <Skeleton lines={6} label={t("Yükleniyor")} />
      ) : (
        <MatrixBody key={route.position} data={data.value} position={route.position} />
      )}
    </LiquidGlass>
  );
}

async function loadMatrix(role: string, ids: number[]) {
  const [tiers, version, ...counters] = await Promise.all([getTierList(role), latestVersion(), ...ids.map((id) => getCounters(id, role).catch(() => null))]);
  const opponents = [...tiers.champions].sort((a, b) => b.pickRate - a.pickRate).slice(0, MATRIX_OPPONENTS);
  const docs = new Map<number, NonNullable<(typeof counters)[number]>>();
  ids.forEach((id, i) => counters[i] && docs.set(id, counters[i]!));
  return { opponents, docs, version };
}

function MatrixBody({ data, position }: { data: ChampionRoles; position: string }) {
  const t = useT();
  const lang = useLang();
  const personal = usePersonal();
  const poolIds = poolByRole(personal.pool, data.roles).get(position) ?? [];
  const [chosen, setChosen] = useState<number[] | null>(null);
  const [currentOnly, setCurrentOnly] = useState(false);
  const picked = (chosen ?? poolIds).filter((id) => poolIds.includes(id)).slice(0, MATRIX_MAX_CHAMPIONS);
  const [state] = useAsync(picked.length ? `matrix:${position}:${picked.join(",")}` : null, () => loadMatrix(position, picked));
  const nameOf = (id: number) => data.champions.get(id)?.name ?? String(id);
  const icon = (id: number, size: number) => {
    const champion = data.champions.get(id);
    return champion ? <img src={championIconUrl(data.version, champion.id)} alt="" width={size} height={size} /> : null;
  };

  if (poolIds.length === 0) {
    return <EmptyState title={t("Bu rolde havuzun boş")}>{t("Şampiyonlar sayfasında havuzuna bu rolden şampiyon ekle; matris onlarla dolar.")}</EmptyState>;
  }
  const chips = poolIds.map((id) => ({ id: String(id), label: nameOf(id) }));
  return (
    <>
      <FilterChips
        label={t("Matristeki şampiyonlar")}
        chips={chips}
        selected={picked.map(String)}
        onChange={(ids) => setChosen(ids.map(Number).slice(-MATRIX_MAX_CHAMPIONS))}
      />
      <Toggle label={t("Yalnızca güncel yama verisi")} hint={t("Eski yamadan kalan satırlar matristen çıkar.")} checked={currentOnly} onChange={setCurrentOnly} />
      {picked.length === 0 ? (
        <EmptyState title={t("Bir şampiyon seç")}>{t("Matris için havuzundan en çok beş şampiyon seçebilirsin.")}</EmptyState>
      ) : state.status !== "done" ? (
        <Skeleton lines={6} label={t("Yükleniyor")} />
      ) : (
        <MatrixTable
          picked={picked}
          position={position}
          loaded={state.value}
          currentOnly={currentOnly}
          nameOf={nameOf}
          icon={icon}
          percent={(n) => formatPercent(n, lang, 0)}
          version={state.value.version}
        />
      )}
    </>
  );
}

type Loaded = Awaited<ReturnType<typeof loadMatrix>>;

function MatrixTable({
  picked,
  position,
  loaded,
  currentOnly,
  nameOf,
  icon,
  percent,
  version,
}: {
  picked: number[];
  position: string;
  loaded: Loaded;
  currentOnly: boolean;
  nameOf: (id: number) => string;
  icon: (id: number, size: number) => React.ReactNode;
  percent: (n: number) => string;
  version: string;
}) {
  const t = useT();
  const openMatchup = useOpenMatchup();
  const current = patchOf(version);
  const usable = picked.filter((id) => {
    const doc = loaded.docs.get(id);
    return doc && (!currentOnly || doc.patches.map(patchOf).includes(current));
  });
  const matchups = new Map<number, Matchups>(usable.map((id) => [id, loaded.docs.get(id)!.matchups]));
  const opponentIds = loaded.opponents.map((o) => o.championId);
  const rows = buildMatrix(usable, opponentIds, matchups);
  const blind = bestBlind(rows);
  if (rows.length === 0) return <EmptyState title={t("Veri yok")}>{t("Seçtiğin şampiyonlar için bu yamada eşleşme verisi bulunamadı.")}</EmptyState>;
  return (
    <>
      {blind && (
        <p className="matrix__blind">
          {icon(blind.championId, 24)}
          <span>
            {t("Kör seçim için en rahatı {champion}: {known} rakibin {bad} tanesinde aleyhine, {good} tanesinde lehine; {games} maç.", {
              champion: nameOf(blind.championId),
              known: blind.known,
              bad: blind.unfavourable,
              good: blind.favourable,
              games: blind.games.toLocaleString(),
            })}
          </span>
        </p>
      )}
      <div className="matrix__scroll">
        <table className="matrix__table">
          <caption className="visually-hidden">{t("Havuz şampiyonları ve rakipleri")}</caption>
          <thead>
            <tr>
              <th scope="col">{t("Şampiyon")}</th>
              {loaded.opponents.map((o) => (
                <th key={o.championId} scope="col" title={nameOf(o.championId)}>
                  {icon(o.championId, 28)}
                  <span className="matrix__name">{nameOf(o.championId)}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const doc = loaded.docs.get(row.championId)!;
              return (
                <tr key={row.championId}>
                  <th scope="row">
                    <span className="matrix__champion">
                      {icon(row.championId, 28)}
                      {nameOf(row.championId)}
                    </span>
                    <DataBadge games={doc.games} winRate={0.5} patches={doc.patches} updatedAt={doc.updatedAt} source={t("Eşleşme verisi")} />
                  </th>
                  {row.cells.map((cell, i) => {
                    const opponentId = opponentIds[i];
                    const text = cell
                      ? t("{opponent} karşısında {state}: {rate}, {games} maç", {
                          opponent: nameOf(opponentId),
                          state: t(STATE_TEXT[cell.state]),
                          rate: percent(cell.winRate),
                          games: cell.games,
                        })
                      : t("{opponent} karşısında veri yok", { opponent: nameOf(opponentId) });
                    const state: CellState = cell?.state ?? "insufficient";
                    return (
                      <td key={opponentId} className="matrix__cell" data-state={state} title={text}>
                        {cell ? (
                          <button type="button" className="matrix__open" aria-label={text} onClick={() => openMatchup(row.championId, opponentId, position)}>
                            {STATE_MARK[state]} {state === "insufficient" ? "" : percent(cell.winRate)}
                          </button>
                        ) : (
                          <span aria-label={text}>–</span>
                        )}
                        {cell && <span className="matrix__games">{cell.games}</span>}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <ul className="matrix__legend">
        {(["favourable", "neutral", "unfavourable", "insufficient"] as CellState[]).map((s) => (
          <li key={s} data-state={s}>
            {STATE_MARK[s]} {t(STATE_TEXT[s])}
          </li>
        ))}
      </ul>
      <p className="build__note">{t("Bir hücre ancak %95 aralığı %50'nin bir yanında kalıyorsa lehine ya da aleyhine sayılır; altındaki sayı o eşleşmenin maç sayısı.")}</p>
    </>
  );
}
