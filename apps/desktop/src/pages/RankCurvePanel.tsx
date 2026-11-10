import { BRACKET_LABELS } from "@vizier/shared/brackets";
import { getRankCurve } from "../api";
import { curveFor, curveVerdict, type CurvePoint } from "../data/rankCurve";
import { formatPercent, useLang, useT } from "../i18n";
import { DataBadge } from "../ui/DataBadge";
import { sampleTitle } from "../ui/sampleTitle";
import { useAsync } from "../useAsync";
import "./RankCurvePanel.css";

const W = 320;
const H = 110;
const PAD_X = 28;
const PAD_Y = 14;

/** Win rate at each rank as a small line, with the games under each point. */
export function RankCurvePanel({ championId, position }: { championId: number; position: string }) {
  const t = useT();
  const lang = useLang();
  const label = lang === "en" ? "en" : "tr";
  const [state] = useAsync("rank-curve", getRankCurve);
  if (state.status !== "done") return null;
  const points = curveFor(state.value, championId, position);
  if (points.length < 2) return null;

  const verdict = curveVerdict(points);
  const rates = points.map((p) => p.winRate);
  // At least four points of range, so a flat champion does not look like a cliff.
  const mid = (Math.min(...rates) + Math.max(...rates)) / 2;
  const half = Math.max(0.02, (Math.max(...rates) - Math.min(...rates)) / 2 + 0.005);
  const x = (i: number) => PAD_X + (i * (W - PAD_X * 2)) / Math.max(1, points.length - 1);
  const y = (rate: number) => PAD_Y + ((mid + half - rate) / (half * 2)) * (H - PAD_Y * 2);
  const solid = points.map((p, i) => ({ p, i })).filter(({ p }) => p.enough);
  const path = solid.map(({ p, i }, n) => `${n === 0 ? "M" : "L"}${x(i).toFixed(1)} ${y(p.winRate).toFixed(1)}`).join(" ");
  const pooled = points.reduce((s, p) => s + p.games, 0);
  const patches = state.value.patches;
  const describe = (p: CurvePoint) => sampleTitle(t, lang, { ...p, patches, bracket: BRACKET_LABELS[p.bracket][label] });

  return (
    <section className="enter rank-curve" aria-label={t("Rank'a göre")}>
      <h2 className="draft__heading">
        {t("Rank'a göre")} <DataBadge games={pooled} winRate={points.reduce((s, p) => s + p.winRate * p.games, 0) / pooled} patches={patches} source={t("Vizier crawler, rank karşılaştırması")} />
      </h2>
      {verdict && (
        <p className="build__note" data-verdict={verdict}>
          {verdict === "better_high" ? t("Yüksek rankta daha iyi") : t("Düşük rankta güçlü")}
        </p>
      )}
      <svg className="rank-curve__chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t("Rank'a göre kazanma oranı")}>
        <line x1={PAD_X} x2={W - PAD_X} y1={y(0.5)} y2={y(0.5)} className="rank-curve__half" data-visible={Math.abs(0.5 - mid) <= half} />
        {path && <path d={path} className="rank-curve__line" fill="none" />}
        {points.map((p, i) => (
          <circle key={p.bracket} cx={x(i)} cy={y(p.winRate)} r={4} className="rank-curve__dot" data-enough={p.enough} data-bracket={p.bracket}>
            <title>{describe(p)}</title>
          </circle>
        ))}
      </svg>
      <ul className="rank-curve__cols">
        {points.map((p) => (
          <li key={p.bracket} data-enough={p.enough} title={describe(p)}>
            <span className="rank-curve__rank">{BRACKET_LABELS[p.bracket][label]}</span>
            <span className="rank-curve__rate">{p.enough ? formatPercent(p.winRate, lang, 1) : t("az maç")}</span>
            <span className="rank-curve__games">{t("{games} maç", { games: p.games.toLocaleString() })}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
