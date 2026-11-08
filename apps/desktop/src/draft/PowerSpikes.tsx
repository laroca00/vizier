import { getBuild } from "../api";
import { abilityIconUrl, championDetail, itemIconUrl, items as loadItems, type Champion } from "../data/ddragon";
import { SPIKE_LEVELS, spikesFor } from "../data/spikes";
import { useLang, useT } from "../i18n";
import { useAsync } from "../useAsync";

type Props = { champion: Champion; opponent: Champion; position: string; version: string };

async function load(champion: Champion, opponent: Champion, position: string, lang: "tr" | "en") {
  const [detail, build, itemList] = await Promise.all([
    championDetail(champion.id, lang),
    getBuild(champion.key, position, opponent.key),
    loadItems(),
  ]);
  const core = build?.coreItems ?? null;
  return { abilities: detail.abilities, spikes: spikesFor(build?.skills?.firstLevels), core: core && { ...core, items: core.ids.map((id) => ({ id, name: itemList.get(id)?.name ?? "" })) } };
}

function Row({ champion, opponent, position, version }: Props) {
  const t = useT();
  const lang = useLang();
  const [state] = useAsync(`spikes:${lang}:${champion.key}:${opponent.key}:${position}`, () => load(champion, opponent, position, lang));
  if (state.status !== "done") return null;
  const { abilities, spikes, core } = state.value;
  return (
    <div className="spikes__row">
      <p className="spikes__name">{champion.name}</p>
      <ol className="spikes__levels">
        {SPIKE_LEVELS.map((level) => {
          const spike = spikes.find((s) => s.level === level);
          const ability = spike && abilities.find((a) => a.key === spike.slot);
          return (
            <li key={level}>
              <span className="spikes__level">{t("Sv. {level}", { level })}</span>
              {spike && ability ? (
                <img src={abilityIconUrl(version, ability.image)} alt={ability.name} title={`${spike.slot} (${spike.rank})`} width={28} height={28} loading="lazy" />
              ) : (
                <span className="spikes__none">–</span>
              )}
            </li>
          );
        })}
      </ol>
      {core ? (
        <>
          <ol className="spikes__items" aria-label={t("Çekirdek eşyalar")}>
            {core.items.map((item, i) => (
              <li key={item.id}>
                <span className="spikes__level">{i + 1}.</span>
                <img src={itemIconUrl(version, item.id)} alt={item.name} title={item.name} width={28} height={28} loading="lazy" />
              </li>
            ))}
          </ol>
          <p className="build__note">{t("{games} maçta en sık çekirdek eşyalar, sırayla", { games: core.games })}</p>
        </>
      ) : (
        <p className="build__note">{t("Çekirdek eşyalar için yeterli maç yok.")}</p>
      )}
    </div>
  );
}

/** Level spikes and core items of both champions, one row each. Item rows are in buy order; no minutes are known. */
export function PowerSpikes(props: Props) {
  const t = useT();
  return (
    <section aria-label={t("Güç eşikleri")}>
      <h2 className="draft__heading">{t("Güç eşikleri")}</h2>
      <Row {...props} />
      <Row {...props} champion={props.opponent} opponent={props.champion} position={props.position} />
    </section>
  );
}
