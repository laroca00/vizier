import { LENGTH_LABELS, type LengthBucket } from "../data/lengthStats";
import { hasEnoughGames } from "../data/confidence";
import { formatPercent, useLang, useT } from "../i18n";
import { DataBadge } from "../ui/DataBadge";
import { sampleTitle } from "../ui/sampleTitle";
import "./LengthPanel.css";

/** Win rate by game length: one bar per bucket around the 50% line, games under each. */
export function LengthPanel({ lengths, patches, updatedAt, ranked = true }: { lengths: LengthBucket[]; patches: string[]; updatedAt?: number; ranked?: boolean }) {
  const t = useT();
  const lang = useLang();
  const total = lengths.reduce((sum, l) => sum + l.games, 0);
  if (total === 0) return null;
  const byBucket = new Map(lengths.map((l) => [l.bucket, l]));
  const winRate = lengths.reduce((sum, l) => sum + l.games * l.winRate, 0) / total;
  // Bars grow from the 50% line, 10 points either way fills half the track.
  const SPAN = 0.1;
  return (
    <section className="enter length" aria-label={t("Oyun süresine göre")}>
      <h2 className="draft__heading">
        {t("Oyun süresine göre")} <DataBadge games={total} winRate={winRate} patches={patches} updatedAt={updatedAt} ranked={ranked} source={ranked ? t("Vizier crawler, dereceli maçlar") : t("Vizier crawler, ARAM maçları")} />
      </h2>
      <ul className="length__bars">
        {LENGTH_LABELS.map((label, bucket) => {
          const row = byBucket.get(bucket);
          const enough = !!row && hasEnoughGames(row.games, row.winRate);
          const offset = row ? Math.max(-1, Math.min(1, (row.winRate - 0.5) / SPAN)) : 0;
          return (
            <li key={label} data-enough={enough} title={row ? sampleTitle(t, lang, { ...row, patches, updatedAt }) : undefined}>
              <span className="length__rate">{row ? (enough ? formatPercent(row.winRate, lang, 1) : t("az maç")) : "–"}</span>
              <span className="length__track" aria-hidden="true">
                <span className="length__bar" data-side={offset >= 0 ? "up" : "down"} style={{ height: `${Math.abs(offset) * 50}%` }} />
              </span>
              <span className="length__label">{t("{minutes} dk", { minutes: label })}</span>
              <span className="length__games">{row ? t("{games} maç", { games: row.games.toLocaleString() }) : ""}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
