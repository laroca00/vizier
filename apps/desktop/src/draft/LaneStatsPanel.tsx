import { useState } from "react";
import { BRACKETS, BRACKET_LABELS } from "@vizier/shared/brackets";
import { getLaneStats, getLaneStatsAt } from "../api";
import { MIN_LANE_AVERAGE_GAMES } from "../data/statsTable";
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
        <LaneByRank championId={championId} position={position} opponentId={opponentId} />
      </>
    </section>
  );
}

/** The same lane figures in every rank, read only when the player opens it. */
function LaneByRank({ championId, position, opponentId }: { championId: number; position: string; opponentId: number }) {
  const t = useT();
  const lang = useLang() === "en" ? "en" : "tr";
  const [open, setOpen] = useState(false);
  const [ranks] = useAsync(open ? `lane-ranks:${championId}:${position}:${opponentId}` : null, () =>
    Promise.all(BRACKETS.map((bracket) => getLaneStatsAt(championId, position, opponentId, bracket).catch(() => null))),
  );
  return (
    <details className="lane-ranks" onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>{t("Rank'a göre koridor farkı")}</summary>
      {ranks.status === "done" && (
        <table className="coverage__table">
          <thead>
            <tr>
              <th scope="col">{t("Lig")}</th>
              <th scope="col">{t("CS 10")}</th>
              <th scope="col">{t("CS 15")}</th>
              <th scope="col">{t("Altın 10")}</th>
              <th scope="col">{t("Altın 15")}</th>
              <th scope="col">{t("Maç")}</th>
            </tr>
          </thead>
          <tbody>
            {BRACKETS.map((bracket, i) => {
              const stat = ranks.value[i];
              const lines = stat ? laneLines(stat) : null;
              const solid = !!stat && stat.games >= MIN_LANE_AVERAGE_GAMES;
              return (
                <tr key={bracket} data-solid={solid} style={solid ? undefined : { opacity: 0.5 }}>
                  <th scope="row">{BRACKET_LABELS[bracket][lang]}</th>
                  {lines ? lines.map((line) => <td key={line.key}>{signedNumber(line.value, line.key.startsWith("cs") ? 1 : 0)}</td>) : <td colSpan={4}>{t("yeterli veri yok")}</td>}
                  <td>{stat?.games ? stat.games.toLocaleString() : "–"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {ranks.status === "loading" && <p className="build__note">{t("Yükleniyor")}</p>}
    </details>
  );
}
