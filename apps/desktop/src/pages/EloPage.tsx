import { getRankCurve } from "../api";
import { eloShifts, ELO_TAG_TEXT, HIGH_END, LOW_END, sortedShifts, type EloShift } from "../data/eloShift";
import { championIconUrl, champions, latestVersion } from "../data/ddragon";
import { BRACKET_LABELS } from "@vizier/shared/brackets";
import { formatPercent, useLang, useT } from "../i18n";
import { POSITIONS } from "../labels";
import { loadErrorMessage } from "../loadError";
import { useOpenChampion } from "../championLink";
import { DataBadge } from "../ui/DataBadge";
import { Select } from "../ui/Fields";
import { LiquidGlass } from "../ui/LiquidGlass";
import { PageHeader } from "../ui/Page";
import { sampleTitle } from "../ui/sampleTitle";
import { EmptyState, ErrorState, Skeleton } from "../ui/States";
import { useAsync } from "../useAsync";
import { useOnline } from "../useOnline";
import "./EloPage.css";

export type EloRoute = { page: "elo"; position: string; minGames: number };
type Props = { route: EloRoute; onChange: (next: EloRoute) => void };

const MIN_GAMES = [200, 500, 1000, 3000];
const SHOWN = 15;

async function loadStatic() {
  const [version, byKey] = await Promise.all([latestVersion(), champions()]);
  return { version, champions: byKey };
}

/** Which champions gain or lose win rate from Gold and below to Master and above. */
export function EloPage({ route, onChange }: Props) {
  const t = useT();
  const online = useOnline();
  const [curve, retry] = useAsync("rank-curve", getRankCurve);
  const [fixed] = useAsync("elo-static", loadStatic);
  return (
    <LiquidGlass className="panel tiers elo" radius={28} strength={2.5} scroll>
      <PageHeader
        title={t("Elo gezgini")}
        subtitle={t("Rank yükselince kazanma oranı en çok artan ve düşen şampiyonlar: Altın ve altı ile Master ve üstü karşılaştırılır.")}
        toolbar={
          <>
            <Select
              label={t("Rol")}
              value={route.position}
              options={[{ value: "ALL", label: t("Tüm roller") }, ...Object.entries(POSITIONS).map(([value, label]) => ({ value, label: t(label) }))]}
              onChange={(position) => onChange({ ...route, position })}
            />
            <Select
              label={t("En az maç")}
              value={String(route.minGames)}
              options={MIN_GAMES.map((n) => ({ value: String(n), label: t("{games} maç", { games: n.toLocaleString() }) }))}
              onChange={(value) => onChange({ ...route, minGames: Number(value) })}
            />
          </>
        }
      />
      {curve.status === "error" ? (
        <ErrorState message={t(loadErrorMessage(curve.error, online))} onRetry={retry} />
      ) : curve.status !== "done" || fixed.status !== "done" ? (
        <Skeleton lines={6} label={t("Yükleniyor")} />
      ) : (
        <EloBody
          shifts={eloShifts(curve.value, { position: route.position === "ALL" ? null : route.position, minGames: route.minGames })}
          patches={curve.value.patches}
          version={fixed.value.version}
          names={fixed.value.champions}
        />
      )}
    </LiquidGlass>
  );
}

function EloBody({ shifts, patches, version, names }: { shifts: EloShift[]; patches: string[]; version: string; names: Map<number, { id: string; name: string }> }) {
  const t = useT();
  if (shifts.length === 0) return <EmptyState title={t("Bu süzgeçle yeterli veri yok.")}>{t("En az maç sayısını düşür ya da rolü değiştir.")}</EmptyState>;
  return (
    <div className="elo__lists">
      <EloList title={t("Rank yükselince güçlenenler")} rows={sortedShifts(shifts, "rises").slice(0, SHOWN)} patches={patches} version={version} names={names} />
      <EloList title={t("Rank yükselince zayıflayanlar")} rows={sortedShifts(shifts, "falls").slice(0, SHOWN)} patches={patches} version={version} names={names} />
    </div>
  );
}

function EloList({ title, rows, patches, version, names }: { title: string; rows: EloShift[]; patches: string[]; version: string; names: Map<number, { id: string; name: string }> }) {
  const t = useT();
  const lang = useLang();
  const label = lang === "en" ? "en" : "tr";
  const openChampion = useOpenChampion();
  const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : "±"}${(Math.abs(n) * 100).toFixed(1)}`;
  return (
    <section aria-label={title}>
      <h2 className="draft__heading">{title}</h2>
      <ul className="elo__list">
        {rows.map((row) => {
          const champion = names.get(row.championId);
          const thinner = row.low.games <= row.high.games ? row.low : row.high;
          return (
            <li key={`${row.championId}:${row.position}`} className="elo__row">
              <button type="button" className="tiers__champion" onClick={() => openChampion(row.championId, row.position, 420)}>
                {champion && <img src={championIconUrl(version, champion.id)} alt="" width={26} height={26} />}
                {champion?.name ?? row.championId}
                <span className="elo__role">{t(POSITIONS[row.position] ?? row.position)}</span>
              </button>
              <span className="elo__rates">
                <span title={sampleTitle(t, lang, { ...row.low, patches, bracket: BRACKET_LABELS[LOW_END][label] })}>
                  {formatPercent(row.low.winRate, lang, 1)} <small>{t("{games} maç", { games: row.low.games.toLocaleString() })}</small>
                </span>
                <span aria-hidden="true">→</span>
                <span title={sampleTitle(t, lang, { ...row.high, patches, bracket: BRACKET_LABELS[HIGH_END][label] })}>
                  {formatPercent(row.high.winRate, lang, 1)} <small>{t("{games} maç", { games: row.high.games.toLocaleString() })}</small>
                </span>
              </span>
              <span className="elo__change" data-trend={row.change > 0 ? "up" : row.change < 0 ? "down" : undefined}>
                {signed(row.change)} {t("puan")}
              </span>
              {row.verdict && <span className="elo__tag">{t(ELO_TAG_TEXT[row.verdict])}</span>}
              <DataBadge games={thinner.games} winRate={thinner.winRate} patches={patches} source={t("Vizier crawler, rank karşılaştırması")} />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
