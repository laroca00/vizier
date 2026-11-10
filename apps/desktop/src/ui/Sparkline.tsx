import "./Sparkline.css";

const W = 64;
const H = 20;

/** A line of a few numbers with no axes; the label says what it is for people who cannot see it. */
export function Sparkline({ values, label }: { values: number[]; label: string }) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  // At least two points of range, so a flat champion does not look like a cliff.
  const mid = (min + max) / 2;
  const half = Math.max(0.01, (max - min) / 2);
  const x = (i: number) => 2 + (i * (W - 4)) / Math.max(1, values.length - 1);
  const y = (v: number) => H / 2 - ((v - mid) / half) * (H / 2 - 3);
  const last = values[values.length - 1];
  return (
    <svg className="spark" viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={label}>
      <title>{label}</title>
      <polyline className="spark__line" points={values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ")} />
      <circle className="spark__end" cx={x(values.length - 1)} cy={y(last)} r={2} />
    </svg>
  );
}
