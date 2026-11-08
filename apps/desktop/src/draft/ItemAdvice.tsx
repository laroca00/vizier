import { getBuild, type Build } from "../api";
import { items as loadItems, latestVersion, type Champion } from "../data/ddragon";
import { useT } from "../i18n";
import { ItemIcon } from "../ui/GameIcons";
import { useAsync } from "../useAsync";
import { itemAdvice } from "./itemAdvice";

/** Every item any of the champion's build styles buys. */
export function buildPool(build: Build): Set<number> {
  const pool = new Set<number>();
  for (const source of [build, ...(build.variants ?? [])]) {
    source.items.forEach((i) => pool.add(i.id));
    source.coreItems?.ids.forEach((id) => pool.add(id));
  }
  return pool;
}

type Props = { championId: number; position: string | null; enemies: Champion[] };

/** Item answers to the enemy draft, drawn from what the champion's builds already buy. */
export function ItemAdvicePanel({ championId, position, enemies }: Props) {
  const t = useT();
  const [state] = useAsync(`item-advice:${championId}:${position}`, async () => {
    const [build, names, version] = await Promise.all([getBuild(championId, position), loadItems(), latestVersion()]);
    return { build, names, version };
  });
  if (state.status !== "done" || !state.value.build) return null;
  const { build, names, version } = state.value;
  const advice = itemAdvice(enemies, buildPool(build));
  if (advice.length === 0) return null;
  return (
    <section aria-label={t("Rakibe karşı eşyalar")}>
      <h2 className="draft__heading">{t("Rakibe karşı eşyalar")}</h2>
      <ul className="advice item-advice">
        {advice.map((a) => (
          <li key={a.rule}>
            <p>{t(a.reason, { names: a.names.join(", "), count: a.names.length })}</p>
            <p className="item-advice__items">
              {a.items.map((id) => (
                <ItemIcon key={id} version={version} itemId={id} name={names.get(id)?.name ?? String(id)} size={30} />
              ))}
            </p>
          </li>
        ))}
      </ul>
      <p className="draft__empty">{t("{games} oyunluk build verisinden, yalnızca bu şampiyonun aldığı eşyalar.", { games: build.games })}</p>
    </section>
  );
}
