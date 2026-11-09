import { championIconUrl, itemIconUrl } from "../../data/ddragon";
import type { WidgetContext } from "./context";

// Short notices that an enemy just got stronger: ultimate ranks and finished items.
export function SpikesWidget({ t, spikes, version, items, championName }: WidgetContext) {
  if (spikes.length === 0 || !version) return null;
  return (
    <section className="overlay__card overlay__spikes">
      {spikes.map((s) => (
        <p key={s.id} className="overlay__spike" data-lane={s.lane || undefined}>
          <img src={championIconUrl(version, s.champion)} alt="" width={24} height={24} />
          <span>
            {s.kind === "level"
              ? t("{champion} {level}. seviye", { champion: championName(s.champion), level: s.level })
              : t("{champion}: {item}", { champion: championName(s.champion), item: items?.get(s.itemId)?.name ?? "" })}
          </span>
          {s.kind === "item" ? <img src={itemIconUrl(version, s.itemId)} alt="" width={24} height={24} /> : <span className="overlay__spike-ult">R</span>}
        </p>
      ))}
    </section>
  );
}
