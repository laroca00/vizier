import { sparkline } from "../bench";
import type { WidgetContext } from "./context";

const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : "±"}${Math.abs(n)}`;

export function BenchWidget({ t, bench, me }: WidgetContext) {
  if (!bench) return null;
  const { read, history } = bench;
  const line = sparkline(history, 120, 24);
  return (
    <section className="overlay__card">
      <p className="overlay__caption">{t("Karşılaştırma")}</p>
      <p className="overlay__row" data-ahead={read.csDiff >= 0}>
        <span>{t("Minyon, ortalama {cs}", { cs: read.cs })}</span>
        <span className="overlay__value">{signed(read.csDiff)}</span>
      </p>
      <p className="overlay__row" data-ahead={read.levelDiff >= 0}>
        <span>{t("Seviye, ortalama {level}", { level: read.level })}</span>
        <span className="overlay__value">{signed(read.levelDiff)}</span>
      </p>
      {read.kda && (
        <p className="overlay__row">
          <span>{t("K/D/A, ortalama {kda}", { kda: `${read.kda.kills}/${read.kda.deaths}/${read.kda.assists}` })}</span>
          <span className="overlay__value">{`${me.scores.kills}/${me.scores.deaths}/${me.scores.assists}`}</span>
        </p>
      )}
      {read.kp && read.kp.own !== null && read.kp.diff !== null && (
        <p className="overlay__row" data-ahead={read.kp.diff >= 0}>
          <span>{t("Kill katılımı, ortalama %{kp}", { kp: read.kp.avg })}</span>
          <span className="overlay__value">{`%${read.kp.own}`}</span>
        </p>
      )}
      {line && (
        <svg className="overlay__spark" viewBox="0 0 120 24" width="120" height="24" aria-hidden="true">
          <polyline points={line} fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      )}
      <p className="overlay__caption">
        {t("{games} maçın ortalaması, {rank}", {
          games: Math.min(read.games, read.kda?.games ?? Infinity, read.kp?.games ?? Infinity),
          rank: bench.bracketLabel,
        })}
      </p>
    </section>
  );
}
