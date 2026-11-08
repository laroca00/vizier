import { getCounters, getTierList } from "../api";
import { championIconUrl } from "../data/ddragon";
import { formatPercent, useLang, useT } from "../i18n";
import { POSITIONS } from "../labels";
import { MatchupLink } from "../matchupLink";
import { COMMON_OPPONENTS, coverage, gaps, poolByRole, type CoverageRow, type Matchups } from "../poolCoverage";
import { usePersonal } from "../personal";
import { useAsync } from "../useAsync";
import type { ChampionRoles } from "./ChampionsPage";
import "./PoolCoverage.css";

async function loadRole(role: string, ids: number[]) {
  const [tiers, ...counters] = await Promise.all([getTierList(role), ...ids.map((id) => getCounters(id, role).catch(() => null))]);
  const opponents = [...tiers.champions].sort((a, b) => b.pickRate - a.pickRate).slice(0, COMMON_OPPONENTS);
  const pool = new Map<number, Matchups>();
  ids.forEach((id, i) => counters[i] && pool.set(id, counters[i]!.matchups));
  return { opponents, pool };
}

/** For each role of the pool, how it answers the role's most played opponents. */
export function PoolCoverage({ data }: { data: ChampionRoles }) {
  const personal = usePersonal();
  const byRole = poolByRole(personal.pool, data.roles);
  if (byRole.size === 0) return null;
  return (
    <div className="coverage">
      {[...byRole.entries()].map(([role, ids]) => (
        <RoleCoverage key={role} role={role} ids={ids} data={data} />
      ))}
    </div>
  );
}

function RoleCoverage({ role, ids, data }: { role: string; ids: number[]; data: ChampionRoles }) {
  const t = useT();
  const lang = useLang();
  const [state] = useAsync(`pool-coverage:${role}:${ids.join(",")}`, () => loadRole(role, ids));
  const percent = (n: number) => formatPercent(n, lang, 1);
  if (state.status !== "done") return null;
  const { opponents, pool } = state.value;
  if (opponents.length === 0 || pool.size === 0) return null;
  const rows = coverage(opponents.map((o) => o.championId), pool);
  const open = gaps(rows);
  const nameOf = (id: number) => data.champions.get(id)?.name ?? String(id);
  const icon = (id: number, size: number) => {
    const champion = data.champions.get(id);
    return champion ? <img src={championIconUrl(data.version, champion.id)} alt="" width={size} height={size} /> : null;
  };

  return (
    <section className="coverage__role" aria-label={t(POSITIONS[role])}>
      <h2 className="draft__heading">{t("{role}: havuzun kapsaması", { role: t(POSITIONS[role]) })}</h2>
      <p className="build__note">
        {t("En çok oynanan {count} rakipten {covered} tanesine karşı havuzunda %51 ve üstü kazanan biri var.", {
          count: rows.length,
          covered: rows.filter((r) => r.status === "covered").length,
        })}
      </p>
      {open.length > 0 && (
        <p className="coverage__gaps">
          <span className="build__stat">{t("Kimsenin rahat etmediği rakipler")}</span>
          {open.map((r) => (
            <span key={r.opponentId} className="coverage__gap" data-status={r.status} title={r.best ? t("En iyi cevabın {rate} kazanıyor, {games} maç", { rate: percent(r.best.winRate), games: r.best.games }) : t("Havuzun için yeterli maç yok")}>
              {icon(r.opponentId, 18)}
              {nameOf(r.opponentId)}
            </span>
          ))}
        </p>
      )}
      <ul className="coverage__list">
        {rows.map((row) => (
          <CoverageItem key={row.opponentId} row={row} role={role} nameOf={nameOf} icon={icon} percent={percent} pickRate={opponents.find((o) => o.championId === row.opponentId)?.pickRate ?? 0} />
        ))}
      </ul>
    </section>
  );
}

function CoverageItem({
  row,
  role,
  nameOf,
  icon,
  percent,
  pickRate,
}: {
  row: CoverageRow;
  role: string;
  nameOf: (id: number) => string;
  icon: (id: number, size: number) => React.ReactNode;
  percent: (n: number) => string;
  pickRate: number;
}) {
  const t = useT();
  return (
    <li className="coverage__row" data-status={row.status}>
      <span className="coverage__opponent">
        {icon(row.opponentId, 24)}
        {nameOf(row.opponentId)}
        <span className="build__stat">{t("%{rate} seçilme", { rate: (pickRate * 100).toFixed(1) })}</span>
      </span>
      {row.best ? (
        <>
          <span className="coverage__best">
            {icon(row.best.championId, 24)}
            {nameOf(row.best.championId)}
          </span>
          <span className="coverage__rate">{percent(row.best.winRate)}</span>
          <span className="build__stat">{t("{games} maç", { games: row.best.games })}</span>
          <MatchupLink championId={row.best.championId} opponentId={row.opponentId} position={role} />
        </>
      ) : (
        <span className="build__stat coverage__none">{t("Havuzun için yeterli maç yok")}</span>
      )}
    </li>
  );
}
