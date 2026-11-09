import type { WidgetContext } from "./context";
import { thousands } from "./shared";

export function ScoreboardWidget({ rows, rowGap }: WidgetContext) {
  if (rows.length === 0) return null;
  return (
    <ol className="overlay__scoreboard" style={{ gap: `calc(${rowGap * 100}vh - 22px)` }}>
      {rows.map((row) => (
        <li key={row.ally.riotId} data-ahead={row.diff === null ? undefined : row.diff >= 0}>
          {row.diff === null ? "–" : thousands(row.diff)}
        </li>
      ))}
    </ol>
  );
}
