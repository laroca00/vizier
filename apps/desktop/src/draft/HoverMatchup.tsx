import { getCounters } from "../api";
import { championIconUrl, type Champion } from "../data/ddragon";
import { formatPercent, useLang, useT } from "../i18n";
import type { DraftTurn } from "../lcu";
import { LockButtons } from "./LockButtons";
import { useAsync } from "../useAsync";
import { matchupLine } from "./logic";
import { DIFFICULTY_TEXT } from "./MatchupGuide";

type Props = { champion: Champion; role: string; opponent: Champion; guessed: boolean; version: string; turn?: DraftTurn | null; gone?: ReadonlySet<number> };

/** The hovered champion against the lane opponent, so the player can still change their mind. */
export function HoverMatchup({ champion, role, opponent, guessed, version, turn, gone }: Props) {
  const t = useT();
  const lang = useLang();
  const [counters] = useAsync(`counters:${champion.key}:${role}`, () => getCounters(champion.key, role));
  if (counters.status !== "done") return null;
  const line = matchupLine(counters.value, opponent.key);
  return (
    <div className="hover-matchup" data-difficulty={line?.difficulty}>
      <img src={championIconUrl(version, champion.id)} alt="" width={32} height={32} />
      <p>
        {line
          ? t("{champion} - {opponent}: {rate} kazanma, {games} maç. {difficulty}", {
              champion: champion.name,
              opponent: opponent.name,
              rate: formatPercent(line.winRate, lang),
              games: line.games,
              difficulty: t(DIFFICULTY_TEXT[line.difficulty]),
            })
          : t("{champion} - {opponent}: yeterli maç yok.", { champion: champion.name, opponent: opponent.name })}
        {guessed && <span className="hover-matchup__guess"> {t("(rakip tahmini)")}</span>}
      </p>
      <img src={championIconUrl(version, opponent.id)} alt="" width={32} height={32} />
      {turn !== undefined && <LockButtons championId={champion.key} championName={champion.name} turn={turn} gone={gone ?? new Set()} />}
    </div>
  );
}
