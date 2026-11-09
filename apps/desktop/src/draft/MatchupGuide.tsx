import { getBuild, getCounters } from "../api";
import { standInMatchup } from "../matchupFallback";
import { abilityIconUrl, champions, championDetail, championIconUrl, itemIconUrl, items, type Champion } from "../data/ddragon";
import { formatPercent, useLang, useT } from "../i18n";
import { DataBadge } from "../ui/DataBadge";
import { useAsync } from "../useAsync";
import { difficultyOf, matchupItems, type Difficulty } from "./logic";

export const DIFFICULTY_TEXT: Record<Difficulty, string> = {
  hard: "Zor eşleşme",
  even: "Dengeli eşleşme",
  easy: "Rahat eşleşme",
};

const MIN_GAMES = 40;
const SHOWN_TIPS = 2;

type Props = {
  championId: number;
  position: string;
  opponent: Champion;
  version: string;
};

/** How the lane tends to go, what the opponent brings, and what to buy for it. */
export function MatchupGuide({ championId, position, opponent, version }: Props) {
  const t = useT();
  const lang = useLang();
  const role = position.toUpperCase();
  const [counters] = useAsync(`counters:${championId}:${role}`, () => getCounters(championId, role));
  const [detail] = useAsync(`detail:${lang}:${opponent.id}`, () => championDetail(opponent.id, lang));
  const [roster] = useAsync("champions", champions);
  const [buys] = useAsync(`matchup-items:${championId}:${role}:${opponent.key}`, async () => {
    const [general, versus, itemList] = await Promise.all([getBuild(championId, role), getBuild(championId, role, opponent.key), items()]);
    if (!general || !versus || versus.vs === null) return [];
    const finished = (list: { id: number; games: number }[]) => list.filter((i) => itemList.get(i.id)?.complete);
    return matchupItems({ games: general.games, items: finished(general.items) }, { games: versus.games, items: finished(versus.items) })
      .slice(0, 4)
      .map((id) => ({ id, name: itemList.get(id)?.name ?? "" }));
  });

  const matchup = counters.status === "done" ? counters.value.matchups.find((m) => m.championId === opponent.key) : undefined;
  const known = matchup && matchup.games >= MIN_GAMES ? matchup : undefined;
  const difficulty = known ? difficultyOf(known.winRate) : null;
  const standIn =
    !known && counters.status === "done" && roster.status === "done" ? standInMatchup(counters.value.matchups, opponent, roster.value.values()) : null;

  return (
    <section className="matchup" aria-label={t("Eşleşme rehberi")}>
      <div className="matchup__head">
        <img src={championIconUrl(version, opponent.id)} alt="" width={44} height={44} />
        <div>
          <p className="matchup__difficulty" data-difficulty={difficulty ?? undefined}>
            {difficulty ? t(DIFFICULTY_TEXT[difficulty]) : t("{opponent} eşleşmesi", { opponent: opponent.name })}
          </p>
          <p className="build__note">
            {known
              ? t("{opponent} karşısında {rate} kazanma, {games} maç", { opponent: opponent.name, rate: formatPercent(known.winRate, lang, 1), games: known.games })
              : standIn
                ? t("Bu eşleşme için az maç var; benzer rakiplere karşı toplam {rate} kazanma, {games} maç", { rate: formatPercent(standIn.winRate, lang, 1), games: standIn.games })
                : counters.status === "done"
                ? t("Bu eşleşme için yeterli maç yok.")
                : t("Yükleniyor")}
            {standIn && counters.status === "done" && (
              <>
                {" "}
                <DataBadge games={standIn.games} winRate={standIn.winRate} patches={counters.value.patches} source={t("Vizier crawler, benzer rakiplere karşı toplanmış maçlar")} />
              </>
            )}
            {matchup && !standIn && counters.status === "done" && (
              <>
                {" "}
                <DataBadge games={matchup.games} winRate={matchup.winRate} patches={counters.value.patches} source={t("Vizier crawler, dereceli maçlar")} />
              </>
            )}
          </p>
        </div>
      </div>

      {detail.status === "done" && (
        <ul className="matchup__abilities" aria-label={t("{opponent} yetenekleri", { opponent: opponent.name })}>
          {detail.value.abilities.map((a) => (
            <li key={a.key} title={`${a.name}: ${a.description}`}>
              <img src={abilityIconUrl(version, a.image)} alt="" width={32} height={32} loading="lazy" />
              <span className="matchup__key">{a.key === "P" ? t("Pasif") : a.key}</span>
              {a.cooldowns.length > 0 && <span className="matchup__cooldown">{t("{seconds} sn", { seconds: a.cooldowns[0] })}</span>}
            </li>
          ))}
        </ul>
      )}

      {buys.status === "done" && buys.value.length > 0 && (
        <div className="matchup__items">
          <p className="build__stat">{t("Bu rakibe karşı daha sık alınanlar")}</p>
          <div className="build__row">
            {buys.value.map((item) => (
              <img key={item.id} src={itemIconUrl(version, item.id)} alt={item.name} title={item.name} width={28} height={28} />
            ))}
          </div>
        </div>
      )}

      {detail.status === "done" && detail.value.enemyTips.length > 0 && (
        <ul className="matchup__tips">
          {detail.value.enemyTips.slice(0, SHOWN_TIPS).map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
