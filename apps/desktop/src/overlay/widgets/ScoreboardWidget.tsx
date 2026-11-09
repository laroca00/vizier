import type { WidgetContext } from "./context";
import { thousands } from "./shared";

export function ScoreboardWidget({ t, rows, rowsTotal, rowGap }: WidgetContext) {
  if (rows.length === 0) return null;
  return (
    <div className="overlay__scoreboard-wrap">
      <ol className="overlay__scoreboard" style={{ gap: `calc(${rowGap * 100}vh - 22px)` }}>
        {rows.map((row) => (
          <li key={row.ally.riotId} data-ahead={row.diff === null ? undefined : row.diff >= 0}>
            {row.diff === null ? "–" : thousands(row.diff)}
          </li>
        ))}
      </ol>
      {rowsTotal !== null && (
        <p className="overlay__scoreboard-total" data-ahead={rowsTotal >= 0}>
          <span>{t("Takım")}</span>
          <span className="overlay__value">{thousands(rowsTotal)}</span>
        </p>
      )}
    </div>
  );
}
