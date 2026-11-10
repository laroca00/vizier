import { getCounters } from "../api";
import { lengthLine, lengthRead } from "../data/matchupLength";
import { useT } from "../i18n";
import { LengthPanel } from "../pages/LengthPanel";
import { useAsync } from "../useAsync";

/** The matchup's win rate by game length, with a plain line only when short and long games disagree. */
export function MatchupLength({ championId, opponentId, position }: { championId: number; opponentId: number; position: string }) {
  const t = useT();
  const [counters] = useAsync(`counters:${championId}:${position}`, () => getCounters(championId, position));
  if (counters.status !== "done") return null;
  const matchup = counters.value.matchups.find((m) => m.championId === opponentId);
  if (!matchup?.lengths || matchup.lengths.length === 0) return null;
  const line = lengthLine(lengthRead(matchup.lengths));
  return (
    <LengthPanel lengths={matchup.lengths} patches={counters.value.patches} updatedAt={counters.value.updatedAt} title={t("Bu eşleşmede oyun süresine göre")}>
      {line && <p className="build__note">{line === "hardThenEasy" ? t("Kısa maçlarda zor, uzun maçlarda senin lehine.") : t("Kısa maçlarda senin lehine, uzun maçlarda zor.")}</p>}
    </LengthPanel>
  );
}
