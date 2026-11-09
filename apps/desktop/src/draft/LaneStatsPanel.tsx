import { getLaneStats } from "../api";
import { formatPercent, useLang, useT } from "../i18n";
import { useAsync } from "../useAsync";
import { laneLines, signedNumber } from "./laneStats";

const LABELS = {
  cs10: "10. dakikada CS farkı",
  cs15: "15. dakikada CS farkı",
  gold10: "10. dakikada altın farkı",
  gold15: "15. dakikada altın farkı",
} as const;

/** How the lane tends to stand at 10 and 15 minutes, from games with timelines. */
export function LaneStats({
  championId,
  position,
  opponentId,
}: {
  championId: number;
  position: string;
  opponentId: number;
}) {
  const t = useT();
  const lang = useLang();
  const [stat] = useAsync(`lane:${championId}:${position}:${opponentId}`, () =>
    getLaneStats(championId, position, opponentId),
  );
  if (stat.status !== "done") return null;
  const lines = laneLines(stat.value);
  if (lines === null) return null;
  return (
    <section aria-label={t("Koridor farkı")}>
      <h2 className="draft__heading">{t("Koridor farkı")}</h2>
      <>
        <dl className="figures">
          {lines.map((line) => (
            <div key={line.key}>
              <dt>{t(LABELS[line.key])}</dt>
              <dd
                data-trend={
                  line.value === 0 ? undefined : line.value > 0 ? "up" : "down"
                }
              >
                {signedNumber(line.value, line.key.startsWith("cs") ? 1 : 0)}
              </dd>
            </div>
          ))}
          {stat.value.firstBloodRate !== undefined && (
            <div>
              <dt>{t("İlk kan oranı")}</dt>
              <dd>{formatPercent(stat.value.firstBloodRate, lang, 0)}</dd>
            </div>
          )}
        </dl>
        <p className="build__note">
          {t("{games} maçın ortalaması; artı, senin lehine.", {
            games: stat.value.games,
          })}
        </p>
      </>
    </section>
  );
}
