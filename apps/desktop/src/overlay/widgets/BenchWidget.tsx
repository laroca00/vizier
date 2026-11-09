import { sparkline } from "../bench";
import type { WidgetContext } from "./context";

const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : "±"}${Math.abs(n)}`;

export function BenchWidget({ t, bench }: WidgetContext) {
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
      {line && (
        <svg className="overlay__spark" viewBox="0 0 120 24" width="120" height="24" aria-hidden="true">
          <polyline points={line} fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      )}
      <p className="overlay__caption">{t("{games} maçın ortalaması", { games: read.games })}</p>
    </section>
  );
}
