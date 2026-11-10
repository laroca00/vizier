import { getCounters, getTierList } from "../api";
import { championIconUrl } from "../data/ddragon";
import { formatPercent, useLang, useT } from "../i18n";
import { POSITIONS } from "../labels";
import { MatchupLink } from "../matchupLink";
import { suggestForGaps } from "../poolSuggest";
import { EloTag, useEloTags } from "../ui/EloTag";
import { COMMON_OPPONENTS, coverage, gaps, poolByRole, safestBlind, type CoverageRow, type Matchups } from "../poolCoverage";
import { useOpenPage } from "../pageLink";
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
  const openPage = useOpenPage();
  const [state] = useAsync(`pool-coverage:${role}:${ids.join(",")}`, () => loadRole(role, ids));
  const percent = (n: number) => formatPercent(n, lang, 1);
  if (state.status !== "done") return null;
  const { opponents, pool } = state.value;
  if (opponents.length === 0 || pool.size === 0) return null;
  const rows = coverage(opponents.map((o) => o.championId), pool);
  const open = gaps(rows);
  const blind = ids.length > 1 ? safestBlind(rows.map((r) => r.opponentId), pool) : null;
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
      <button type="button" className="matchups__study" onClick={() => openPage({ page: "matrix", position: role })}>
        {t("Karşı seçim matrisini aç")}
      </button>
      {blind && (
        <p className="coverage__blind">
          {icon(blind.championId, 24)}
          <span>
            {t("Kör seçim için en güvenlisi {champion}: {known} yaygın rakipten {bad} tanesine karşı %49'un altında, ortalama {rate}, {games} maç.", {
              champion: nameOf(blind.championId),
              known: blind.known,
              bad: blind.bad,
              rate: percent(blind.winRate),
              games: blind.games.toLocaleString(),
            })}
          </span>
        </p>
      )}
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
      <Suggestions role={role} gapIds={open.map((r) => r.opponentId)} poolIds={ids} data={data} nameOf={nameOf} icon={icon} percent={percent} />
      <ul className="coverage__list">
        {rows.map((row) => (
          <CoverageItem key={row.opponentId} row={row} role={role} nameOf={nameOf} icon={icon} percent={percent} pickRate={opponents.find((o) => o.championId === row.opponentId)?.pickRate ?? 0} />
        ))}
      </ul>
    </section>
  );
}

const CANDIDATES = 12;

/** Champions from the role's tier list that would answer the gaps. */
function Suggestions({
  role,
  gapIds,
  poolIds,
  data,
  nameOf,
  icon,
  percent,
}: {
  role: string;
  gapIds: number[];
  poolIds: number[];
  data: ChampionRoles;
  nameOf: (id: number) => string;
  icon: (id: number, size: number) => React.ReactNode;
  percent: (n: number) => string;
}) {
  const t = useT();
  const eloTag = useEloTags();
  const [state] = useAsync(gapIds.length ? `pool-suggest:${role}:${poolIds.join(",")}:${gapIds.join(",")}` : null, async () => {
    const tiers = await getTierList(role);
    const candidates = tiers.champions
      .filter((c) => !poolIds.includes(c.championId) && data.champions.has(c.championId) && c.games >= 100)
      .slice(0, CANDIDATES)
      .map((c) => ({ championId: c.championId, tier: c.tier, tags: data.champions.get(c.championId)!.tags }));
    const counters = new Map<number, Matchups>();
    await Promise.all(candidates.map((c) => getCounters(c.championId, role).then((r) => counters.set(c.championId, r.matchups), () => {})));
    const poolTags = poolIds.flatMap((id) => data.champions.get(id)?.tags[0] ?? []);
    return suggestForGaps(gapIds, candidates, counters, poolTags);
  });
  if (state.status !== "done" || state.value.length === 0) return null;
  return (
    <div className="coverage__suggest">
      <h3 className="coverage__heading">{t("Boşluğu kapatabilecek şampiyonlar")}</h3>
      <ul className="coverage__list">
        {state.value.map((s) => (
          <li key={s.championId} className="coverage__row coverage__row--suggest">
            <span className="coverage__opponent">
              {icon(s.championId, 24)}
              {nameOf(s.championId)}
              <span className="tier" data-tier={s.tier}>
                {s.tier}
              </span>
              <EloTag verdict={eloTag(s.championId, role)} />
            </span>
            <span className="coverage__rate">{percent(s.winRate)}</span>
            <span className="build__stat">{t("{games} maç", { games: s.games })}</span>
            <span className="build__stat coverage__beats">
              {s.beats.length > 0
                ? t("Karşı: {list}", { list: s.beats.map((b) => `${nameOf(b.opponentId)} ${percent(b.winRate)} (${b.games})`).join(", ") })
                : t("Hiçbirine karşı belirgin üstünlük yok")}
            </span>
            <MatchupLink championId={s.championId} opponentId={s.beats[0]?.opponentId ?? null} position={role} label={t("Aç")} />
          </li>
        ))}
      </ul>
      <p className="build__note">{t("Sıra: boşluk rakiplerine karşı kazanma oranı, tier ve havuzundakilere benzerlik küçük bir ek puan.")}</p>
    </div>
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
