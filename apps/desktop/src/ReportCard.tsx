import { formatPercent, useLang, useT, type Lang } from "./i18n";
import { useState } from "react";
import { getReport, type GameReport } from "./api";
import { useAsync } from "./useAsync";

const CATEGORY_LABELS: Record<string, string> = {
  farming: "Farm",
  combat: "Savaş",
  survival: "Hayatta kalma",
  vision: "Görüş",
};

const METRIC_LABELS: Record<string, [string, (v: number, lang: Lang) => string | number]> = {
  cs_pm: ["{v} CS/dk", (v) => v.toFixed(1)],
  cs10: ["10. dakikada {v} CS", (v) => v],
  kill_participation: ["{v} skora katkı", (v, lang) => formatPercent(v, lang)],
  damage_share: ["takım hasarında {v} pay", (v, lang) => formatPercent(v, lang)],
  deaths: ["{v} ölüm", (v) => v],
  vision_pm: ["{v} görüş/dk", (v) => v.toFixed(2)],
};

/** Post-game scores and the early CS curve against Emerald+ players on the same champion. */
export function ReportCard({ matchId, puuid }: { matchId: string; puuid: string }) {
  const lang = useLang();
  const t = useT();
  const [state] = useAsync(`${matchId}:${puuid}`, () => getReport(matchId, puuid));
  // A missing report (no role, stats not ready) just leaves the card out.
  if (state.status !== "done" || !state.value || state.value.overall === null) return null;
  const report = state.value;

  return (
    <section className="report" aria-label={t("Maç puanı")}>
      <div className="report__head">
        <p className="report__overall">
          <span className="report__number">{report.overall}</span>
          <span className="report__of">/ 100</span>
        </p>
        <p className="report__basis">
          {report.comparedTo === "champion"
            ? t("Aynı şampiyonu aynı rolde oynayan Emerald+ oyuncularına göre; 50 medyan demek.")
            : t("Aynı roldeki Emerald+ oyuncularına göre; 50 medyan demek.")}
        </p>
      </div>
      <ul className="report__scores">
        {report.scores.map((s) => (
          <li key={s.category}>
            <span className="report__label">{t(CATEGORY_LABELS[s.category] ?? s.category)}</span>
            <span className="report__track" aria-hidden="true">
              <span className="report__fill" style={{ width: `${Math.max(2, s.score)}%` }} />
              <span className="report__median" />
            </span>
            <span className="report__score">{s.score}</span>
            <span className="report__detail">
              {s.metrics
                .map((m) => {
                  const label = METRIC_LABELS[m.metric];
                  return label ? t(label[0], { v: label[1](m.value, lang) }) : `${m.value}`;
                })
                .join(", ")}
            </span>
          </li>
        ))}
      </ul>
      {report.cs.mine.length >= 3 && report.cs.median.length >= 3 && <CsChart cs={report.cs} />}
    </section>
  );
}

const WIDTH = 480;
const HEIGHT = 150;
const PAD = { top: 12, right: 64, bottom: 22, left: 30 };

function CsChart({ cs }: { cs: GameReport["cs"] }) {
  const t = useT();
  const [hover, setHover] = useState<number | null>(null);
  const minutes = Math.min(cs.mine.length, cs.median.length);
  const mine = cs.mine.slice(0, minutes);
  const median = cs.median.slice(0, minutes);
  const top = Math.max(10, ...mine, ...median);
  const innerW = WIDTH - PAD.left - PAD.right;
  const innerH = HEIGHT - PAD.top - PAD.bottom;
  // Minute 1 sits at index 0; the line starts at minute 0 with 0 CS.
  const x = (minute: number) => PAD.left + (minute / minutes) * innerW;
  const y = (value: number) => PAD.top + innerH - (value / top) * innerH;
  const path = (values: number[]) => [`M${x(0)},${y(0)}`, ...values.map((v, i) => `L${x(i + 1).toFixed(1)},${y(v).toFixed(1)}`)].join("");
  const ticks = [0, Math.round(top / 2), top];
  // End labels sit by their line; when the lines end close together the higher one moves up.
  const labelShift = (value: number, other: number, upOnTie: boolean) =>
    Math.abs(y(value) - y(other)) >= 14 ? 4 : value > other || (value === other && upOnTie) ? -3 : 11;

  function onMove(event: React.PointerEvent<SVGSVGElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    const at = ((event.clientX - box.left) / box.width) * WIDTH;
    setHover(Math.max(1, Math.min(minutes, Math.round(((at - PAD.left) / innerW) * minutes))));
  }

  const last = minutes - 1;
  const behind = cs.weakest.length
    ? ` ${t("En çok geride kaldığın dakikalar: {minutes}.", { minutes: cs.weakest.join(", ") })}`
    : ` ${t("Hiçbir dakikada medyanın gerisinde kalmadın.")}`;
  const summary = `${t("{minute}. dakikada {cs} CS, Emerald+ medyanı {median}.", { minute: minutes, cs: mine[last], median: Math.round(median[last]) })}${behind}`;

  return (
    <figure className="cs">
      <figcaption className="cs__legend">
        <span className="cs__key cs__key--mine">{t("Sen")}</span>
        <span className="cs__key cs__key--median">{t("Emerald+ medyanı")}</span>
      </figcaption>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="cs__plot" role="img" aria-label={summary} onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={WIDTH - PAD.right} y1={y(t)} y2={y(t)} className="cs__grid" />
            <text x={PAD.left - 6} y={y(t) + 4} className="cs__tick" textAnchor="end">
              {t}
            </text>
          </g>
        ))}
        {cs.weakest.map((m) => (
          <rect key={m} x={x(m - 1)} y={PAD.top} width={x(m) - x(m - 1)} height={innerH} className="cs__weak" />
        ))}
        <path d={path(median)} className="cs__line cs__line--median" />
        <path d={path(mine)} className="cs__line cs__line--mine" />
        <text x={x(minutes) + 6} y={y(mine[last]) + labelShift(mine[last], median[last], true)} className="cs__end">
          {t("Sen {cs}", { cs: mine[last] })}
        </text>
        <text x={x(minutes) + 6} y={y(median[last]) + labelShift(median[last], mine[last], false)} className="cs__end">
          {t("Medyan {cs}", { cs: Math.round(median[last]) })}
        </text>
        {[5, 10, 15].filter((m) => m <= minutes).map((m) => (
          <text key={m} x={x(m)} y={HEIGHT - 6} className="cs__tick" textAnchor="middle">
            {t("{m}. dk", { m })}
          </text>
        ))}
        {hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + innerH} className="cs__cursor" />
            <circle cx={x(hover)} cy={y(median[hover - 1])} r={4} className="cs__dot cs__dot--median" />
            <circle cx={x(hover)} cy={y(mine[hover - 1])} r={4} className="cs__dot cs__dot--mine" />
          </g>
        )}
      </svg>
      <p className="cs__caption" aria-live="polite">
        {hover !== null
          ? t("{minute}. dakika: sen {mine} CS, medyan {median}", { minute: hover, mine: mine[hover - 1], median: Math.round(median[hover - 1]) })
          : cs.weakest.length
            ? t("Gölgeli dakikalar medyanın en çok gerisinde kaldığın anlar.")
            : t("İlk {minutes} dakika boyunca medyanın gerisine düşmedin.", { minutes })}
      </p>
    </figure>
  );
}
