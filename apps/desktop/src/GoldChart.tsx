import { useId, useState } from "react";

const WIDTH = 480;
const HEIGHT = 150;
const PAD = { top: 12, right: 8, bottom: 22, left: 8 };

const format = new Intl.NumberFormat("tr");

function describe(diff: number) {
  if (diff === 0) return "eşit";
  return diff > 0 ? `takımın ${format.format(diff)} altın önde` : `rakip ${format.format(-diff)} altın önde`;
}

/** `diff` is the player's team minus the enemy team, one value per minute. */
export function GoldChart({ diff }: { diff: number[] }) {
  const id = useId().replace(/[^\w-]/g, "");
  const [hover, setHover] = useState<number | null>(null);
  if (diff.length < 2) return null;

  const extent = Math.max(1000, ...diff.map(Math.abs));
  const innerW = WIDTH - PAD.left - PAD.right;
  const innerH = HEIGHT - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (i / (diff.length - 1)) * innerW;
  const y = (v: number) => PAD.top + innerH / 2 - (v / extent) * (innerH / 2);
  const zero = y(0);
  const line = diff.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const area = `${line}L${x(diff.length - 1)},${zero}L${x(0)},${zero}Z`;
  const peak = diff.reduce((best, v, i) => (Math.abs(v) > Math.abs(diff[best]) ? i : best), 0);
  const ticks = diff.map((_, i) => i).filter((i) => i % 5 === 0);

  function onMove(event: React.PointerEvent<SVGSVGElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    const ratio = ((event.clientX - box.left) / box.width) * WIDTH;
    const i = Math.round(((ratio - PAD.left) / innerW) * (diff.length - 1));
    setHover(Math.max(0, Math.min(diff.length - 1, i)));
  }

  const summary = `Altın farkı ${diff.length - 1} dakika boyunca. En büyük fark ${peak}. dakikada, ${describe(diff[peak])}. Maç sonunda ${describe(diff[diff.length - 1])}.`;

  return (
    <figure className="gold">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="gold__plot"
        role="img"
        aria-label={summary}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        <defs>
          <clipPath id={`${id}-above`}>
            <rect x="0" y="0" width={WIDTH} height={zero} />
          </clipPath>
          <clipPath id={`${id}-below`}>
            <rect x="0" y={zero} width={WIDTH} height={HEIGHT - zero} />
          </clipPath>
        </defs>
        <path d={area} className="gold__area gold__area--ahead" clipPath={`url(#${id}-above)`} />
        <path d={area} className="gold__area gold__area--behind" clipPath={`url(#${id}-below)`} />
        <line x1={PAD.left} x2={WIDTH - PAD.right} y1={zero} y2={zero} className="gold__zero" />
        <path d={line} className="gold__line" />
        <text x={PAD.left + 2} y={PAD.top + 10} className="gold__label">Takımın önde</text>
        <text x={PAD.left + 2} y={HEIGHT - PAD.bottom - 4} className="gold__label">Rakip önde</text>
        {ticks.map((i) => (
          <text key={i} x={x(i)} y={HEIGHT - 6} className="gold__tick" textAnchor="middle">
            {i}
          </text>
        ))}
        {hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={HEIGHT - PAD.bottom} className="gold__cursor" />
            <circle cx={x(hover)} cy={y(diff[hover])} r={4} className="gold__dot" />
          </g>
        )}
      </svg>
      <figcaption className="gold__caption" aria-live="polite">
        {hover !== null ? `${hover}. dakika: ${describe(diff[hover])}` : `Dakika başına altın farkı. ${summary.split(". ").slice(1).join(". ")}`}
      </figcaption>
      <details className="gold__table">
        <summary>Tablo olarak göster</summary>
        <table>
          <thead>
            <tr>
              <th scope="col">Dakika</th>
              <th scope="col">Fark</th>
            </tr>
          </thead>
          <tbody>
            {diff.map((v, i) => (
              <tr key={i}>
                <td>{i}</td>
                <td>{describe(v)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
