import { abilityIconUrl, championDetail, type Ability, type Champion } from "../data/ddragon";
import { compareRows, cooldownPair, windowLines } from "../data/abilityCompare";
import { useLang, useT } from "../i18n";
import { useAsync } from "../useAsync";

function Side({ ability, version }: { ability: Ability | null; version: string }) {
  const t = useT();
  const pair = cooldownPair(ability);
  if (!ability) return <td>–</td>;
  return (
    <td>
      <span className="ability-compare__cell" title={ability.name}>
        <img src={abilityIconUrl(version, ability.image)} alt="" width={28} height={28} loading="lazy" />
        <span>
          {pair ? (pair.first === pair.max ? t("{seconds} sn", { seconds: pair.first }) : t("{first} → {max} sn", { first: pair.first, max: pair.max })) : "–"}
        </span>
      </span>
    </td>
  );
}

/** Spell cooldowns at rank 1 and max rank side by side, and when the opponent is open to a trade. */
export function AbilityCompare({ champion, opponent, version }: { champion: Champion; opponent: Champion; version: string }) {
  const t = useT();
  const lang = useLang();
  const [pair] = useAsync(`abilities:${lang}:${champion.id}:${opponent.id}`, () => Promise.all([championDetail(champion.id, lang), championDetail(opponent.id, lang)]));
  if (pair.status !== "done") return null;
  const [mine, theirs] = pair.value;
  const lines = windowLines(theirs.abilities);
  return (
    <section aria-label={t("Yetenek karşılaştırması")}>
      <h2 className="draft__heading">{t("Yetenek karşılaştırması")}</h2>
      <table className="duel ability-compare">
        <thead>
          <tr>
            <th scope="col">{champion.name}</th>
            <th scope="col" />
            <th scope="col">{opponent.name}</th>
          </tr>
        </thead>
        <tbody>
          {compareRows(mine.abilities, theirs.abilities).map((row) => (
            <tr key={row.key}>
              <Side ability={row.a} version={version} />
              <th scope="row">{row.key}</th>
              <Side ability={row.b} version={version} />
            </tr>
          ))}
        </tbody>
      </table>
      {lines.length > 0 && (
        <ul className="matchup__tips">
          {lines.map((line) =>
            line.ultimate ? (
              <li key={line.key}>{t("{opponent} ultisi ({name}) 6. seviyeden gelir ve ilk rankta {seconds} sn bekler; bitince daha rahat girersin.", { opponent: opponent.name, name: line.name, seconds: line.seconds })}</li>
            ) : (
              <li key={line.key}>{t("{opponent} {key} ({name}) ilk rankta {seconds} sn bekler: bekleme sürerken takas yap.", { opponent: opponent.name, key: line.key, name: line.name, seconds: line.seconds })}</li>
            ),
          )}
        </ul>
      )}
    </section>
  );
}
