import { useState, type ReactNode } from "react";
import { useT } from "./i18n";
import "./charts.css";

// Small hand-written SVG charts. Colors come from the --data-* tokens in
// charts.css (validated on the ink surface); text always stays in glaze.
// Every mark has a hover tooltip, and win or loss is never told by color
// alone: the tooltip names it.

type Tip = { x: number; y: number; content: ReactNode } | null;

function Tooltip({ tip }: { tip: Tip }) {
  if (!tip) return null;
  return (
    <div className="chart__tip" style={{ left: `${tip.x}%`, top: `${tip.y}%` }} role="status">
      {tip.content}
    </div>
  );
}

export type GameBar = { value: number; win: boolean; label: ReactNode };

/** One bar per game, oldest left, colored by result. */
export function GameBars({ bars, format, label }: { bars: GameBar[]; format: (n: number) => string; label: string }) {
  const [tip, setTip] = useState<Tip>(null);
  const W = 300;
  const H = 90;
  const top = Math.max(...bars.map((b) => b.value), 1);
  const slot = W / Math.max(1, bars.length);
  const width = Math.max(3, slot - 2);
  return (
    <figure className="chart" onMouseLeave={() => setTip(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={label} className="chart__plot">
        <line x1={0} x2={W} y1={H - 0.5} y2={H - 0.5} className="chart__axis" />
        {bars.map((b, i) => {
          const h = Math.max(2, (b.value / top) * (H - 6));
          const x = i * slot + (slot - width) / 2;
          return (
            <g key={i}>
              <path d={roundedTop(x, H - h, width, h, Math.min(4, width / 2))} className="chart__bar" data-result={b.win ? "win" : "loss"} />
              <rect
                x={i * slot}
                y={0}
                width={slot}
                height={H}
                className="chart__hit"
                onMouseEnter={() =>
                  setTip({
                    x: ((i + 0.5) / bars.length) * 100,
                    y: ((H - h) / H) * 100,
                    content: (
                      <>
                        {b.label}
                        <strong>{format(b.value)}</strong>
                      </>
                    ),
                  })
                }
              />
            </g>
          );
        })}
      </svg>
      <Tooltip tip={tip} />
    </figure>
  );
}

function roundedTop(x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, h);
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
}

/** A value per game with an optional target line; hovering shows the game. */
export function TrendLine({
  values,
  target,
  format,
  label,
  pointLabel,
}: {
  values: number[];
  target?: number | null;
  format: (n: number) => string;
  label: string;
  pointLabel: (i: number) => ReactNode;
}) {
  const t = useT();
  const [hover, setHover] = useState<number | null>(null);
  const W = 300;
  const H = 90;
  const all = target != null ? [...values, target] : values;
  const lo = Math.min(...all) * 0.9;
  const hi = Math.max(...all) * 1.05 || 1;
  const x = (i: number) => (values.length < 2 ? W / 2 : (i / (values.length - 1)) * W);
  const y = (v: number) => 4 + (H - 8) * (1 - (v - lo) / (hi - lo || 1));
  const line = values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const area = `${line}L${x(values.length - 1)},${H}L${x(0)},${H}Z`;

  function onMove(event: React.PointerEvent<SVGSVGElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    const at = (event.clientX - box.left) / box.width;
    setHover(Math.max(0, Math.min(values.length - 1, Math.round(at * (values.length - 1)))));
  }

  return (
    <figure className="chart" onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={label} className="chart__plot" onPointerMove={onMove}>
        <path d={area} className="chart__area" />
        {target != null && (
          <>
            <line x1={0} x2={W} y1={y(target)} y2={y(target)} className="chart__target" vectorEffect="non-scaling-stroke" />
          </>
        )}
        <path d={line} className="chart__line" vectorEffect="non-scaling-stroke" />
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={0} y2={H} className="chart__cursor" vectorEffect="non-scaling-stroke" />}
      </svg>
      {hover !== null && (
        <span className="chart__dot" style={{ left: `${(x(hover) / W) * 100}%`, top: `${(y(values[hover]) / H) * 100}%` }} aria-hidden="true" />
      )}
      {target != null && <span className="chart__target-label" style={{ top: `${(y(target) / H) * 100}%` }}>{t("Hedef {value}", { value: format(target) })}</span>}
      <Tooltip
        tip={
          hover === null
            ? null
            : {
                x: (x(hover) / W) * 100,
                y: (y(values[hover]) / H) * 100,
                content: (
                  <>
                    {pointLabel(hover)}
                    <strong>{format(values[hover])}</strong>
                  </>
                ),
              }
        }
      />
    </figure>
  );
}

export type HBar = { key: string | number; label: ReactNode; value: number; note?: ReactNode; emphasis?: boolean };

/** Ranked horizontal bars on a shared 0-max scale; one series, one color. */
export function HBars({ bars, max, format }: { bars: HBar[]; max?: number; format: (n: number) => string }) {
  const top = max ?? Math.max(...bars.map((b) => b.value), 0.0001);
  return (
    <ul className="hbars">
      {bars.map((b) => (
        <li key={b.key} data-emphasis={b.emphasis || undefined}>
          <span className="hbars__label">{b.label}</span>
          <span className="hbars__track" aria-hidden="true">
            <span style={{ width: `${Math.max(1.5, (b.value / top) * 100)}%` }} />
          </span>
          <span className="hbars__value">{format(b.value)}</span>
          {b.note && <span className="hbars__note">{b.note}</span>}
        </li>
      ))}
    </ul>
  );
}

export type Segment = { key: string; label: string; value: number; icon?: string };

/** Part of a whole, up to six parts, labelled in a legend below. */
export function SegmentBar({ segments, format, label }: { segments: Segment[]; format: (n: number) => string; label: string }) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  return (
    <figure className="segbar" aria-label={label}>
      <div className="segbar__bar">
        {segments.map((s, i) => (
          <span key={s.key} style={{ flexGrow: s.value / total }} data-slot={i} title={`${s.label}: ${format(s.value / total)}`} />
        ))}
      </div>
      <figcaption className="segbar__legend">
        {segments.map((s, i) => (
          <span key={s.key}>
            <i data-slot={i} aria-hidden="true" />
            {s.icon && <img src={s.icon} alt="" width={14} height={14} />}
            {s.label} {format(s.value / total)}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}

export type ScatterPoint = { key: number; x: number; y: number; icon: string; name: string; detail: ReactNode; onOpen?: () => void };

/**
 * Two measures of the same entities: pick rate across, win rate up. Dashed
 * lines mark 50% and the median pick rate so the quadrants read at a glance.
 */
export function Scatter({
  points,
  xLabel,
  yLabel,
  formatX,
  formatY,
  label,
}: {
  points: ScatterPoint[];
  xLabel: string;
  yLabel: string;
  formatX: (n: number) => string;
  formatY: (n: number) => string;
  label: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  if (points.length === 0) return null;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const xMax = Math.max(...xs) * 1.08;
  const yLo = Math.min(0.46, Math.min(...ys) - 0.01);
  const yHi = Math.max(0.54, Math.max(...ys) + 0.01);
  const px = (v: number) => (v / xMax) * 100;
  const py = (v: number) => (1 - (v - yLo) / (yHi - yLo)) * 100;
  const sorted = [...xs].sort((a, b) => a - b);
  const medianX = sorted[Math.floor(sorted.length / 2)];
  const shown = hover === null ? null : points.find((p) => p.key === hover);

  return (
    <figure className="scatter" aria-label={label} onMouseLeave={() => setHover(null)}>
      <div className="scatter__plot">
        <span className="scatter__rule scatter__rule--y" style={{ top: `${py(0.5)}%` }}>
          <em>{formatY(0.5)}</em>
        </span>
        <span className="scatter__rule scatter__rule--x" style={{ left: `${px(medianX)}%` }} />
        {points.map((p) => (
          <button
            key={p.key}
            type="button"
            className="scatter__point"
            style={{ left: `${px(p.x)}%`, top: `${py(p.y)}%` }}
            aria-label={`${p.name}, ${yLabel} ${formatY(p.y)}, ${xLabel} ${formatX(p.x)}`}
            data-active={hover === p.key || undefined}
            onMouseEnter={() => setHover(p.key)}
            onFocus={() => setHover(p.key)}
            onClick={p.onOpen}
          >
            <img src={p.icon} alt="" width={24} height={24} loading="lazy" />
          </button>
        ))}
        {shown && (
          <div className="chart__tip" style={{ left: `${px(shown.x)}%`, top: `${py(shown.y)}%` }} role="status">
            <span>{shown.name}</span>
            <strong>
              {formatY(shown.y)}, {formatX(shown.x)}
            </strong>
            {shown.detail}
          </div>
        )}
      </div>
      <figcaption className="scatter__axes">
        <span>{xLabel} →</span>
        <span>↑ {yLabel}</span>
      </figcaption>
    </figure>
  );
}
