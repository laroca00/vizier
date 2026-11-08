import { championDetail, type Champion } from "../data/ddragon";
import { DUEL_LEVELS, DUEL_STATS, duel, type DuelStat } from "../data/duel";
import { useLang, useT } from "../i18n";
import { useAsync } from "../useAsync";

const STAT_LABELS: Record<DuelStat, string> = {
  hp: "Can",
  attackdamage: "Saldırı gücü",
  armor: "Zırh",
  spellblock: "Büyü direnci",
  attackspeed: "Saldırı hızı",
  attackrange: "Menzil",
};

const format = (stat: DuelStat, value: number) => (stat === "attackspeed" ? value.toFixed(2) : Math.round(value).toString());

/** Base stats of both champions at key levels; the one ahead is marked. Nothing here depends on games played. */
export function StatsDuel({ champion, opponent }: { champion: Champion; opponent: Champion }) {
  const t = useT();
  const lang = useLang();
  const [pair] = useAsync(`duel:${lang}:${champion.id}:${opponent.id}`, () => Promise.all([championDetail(champion.id, lang), championDetail(opponent.id, lang)]));
  if (pair.status !== "done") return null;
  const rows = duel(pair.value[0].stats, pair.value[1].stats);
  return (
    <section aria-label={t("Temel istatistikler")}>
      <h2 className="draft__heading">{t("Temel istatistikler")}</h2>
      <table className="duel">
        <caption className="visually-hidden">{t("{champion} ve {opponent} temel istatistikleri", { champion: champion.name, opponent: opponent.name })}</caption>
        <thead>
          <tr>
            <th scope="col" />
            {DUEL_LEVELS.map((level) => (
              <th key={level} scope="col">
                {t("Seviye {level}", { level })}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {DUEL_STATS.map((stat) => (
            <tr key={stat}>
              <th scope="row">{t(STAT_LABELS[stat])}</th>
              {DUEL_LEVELS.map((level) => {
                const cell = rows[stat][level];
                return (
                  <td key={level}>
                    <span data-ahead={cell.ahead === "a" || undefined}>{format(stat, cell.a)}</span>
                    {" · "}
                    <span data-ahead={cell.ahead === "b" || undefined}>{format(stat, cell.b)}</span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="build__note">{t("{champion} · {opponent}; öndeki kalın yazılır.", { champion: champion.name, opponent: opponent.name })}</p>
    </section>
  );
}
