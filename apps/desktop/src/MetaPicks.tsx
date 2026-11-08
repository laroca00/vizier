import { useState } from "react";
import { getTierList, type TierEntry } from "./api";
import { champions, loadingArtUrl, roleIconUrl, type Champion } from "./data/ddragon";
import { formatPercent, useLang, useT } from "./i18n";
import { POSITIONS } from "./labels";
import { useSplash } from "./ui/Splash";
import { useAsync } from "./useAsync";
import "./MetaPicks.css";

const ROLES = ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"];
// Below this a high win rate is mostly a few one-tricks, not the patch.
const MIN_GAMES = 60;

type Pick = { position: string; entry: TierEntry; champion: Champion };

/** The most played champion among each role's best tier. */
function strongest(list: TierEntry[]) {
  const settled = list.filter((c) => c.games >= MIN_GAMES);
  const best = settled.find((c) => c.tier === "S") ? "S" : settled[0]?.tier;
  return settled.filter((c) => c.tier === best).sort((a, b) => b.pickRate - a.pickRate)[0];
}

async function load() {
  const [lists, byKey] = await Promise.all([Promise.all(ROLES.map((p) => getTierList(p))), champions()]);
  const picks: Pick[] = [];
  ROLES.forEach((position, i) => {
    const entry = strongest(lists[i].champions);
    const champion = entry && byKey.get(entry.championId);
    if (entry && champion) picks.push({ position, entry, champion });
  });
  return { picks, patch: lists.find((l) => l.patches.length)?.patches[0] ?? null };
}

type Props = { onOpenChampion: (championId: number, position: string | null) => void };

export function MetaPicks({ onOpenChampion }: Props) {
  const t = useT();
  const lang = useLang();
  const [state] = useAsync("meta-picks", load);
  const [focused, setFocused] = useState<number | null>(null);
  const picks = state.status === "done" ? state.value.picks : [];
  const featured = focused ?? [...picks].sort((a, b) => b.entry.pickRate - a.entry.pickRate)[0]?.entry.championId ?? null;
  useSplash(featured);

  if (state.status === "error" || (state.status === "done" && picks.length === 0)) return null;

  return (
    <section className="meta enter" aria-labelledby="meta-title">
      <h2 id="meta-title" className="meta__title">
        {state.status === "done" && state.value.patch
          ? t("Yama {patch}, koridorların en güçlüleri", { patch: state.value.patch })
          : t("Koridorların en güçlüleri")}
      </h2>
      <ul className="meta__list" onMouseLeave={() => setFocused(null)}>
        {state.status !== "done"
          ? ROLES.map((p) => <li key={p} className="meta__card meta__card--loading" />)
          : picks.map(({ position, entry, champion }) => (
              <li key={position}>
                <button
                  type="button"
                  className="meta__card"
                  onClick={() => onOpenChampion(champion.key, position)}
                  onMouseEnter={() => setFocused(champion.key)}
                  onFocus={() => setFocused(champion.key)}
                  aria-label={`${champion.name}, ${t(POSITIONS[position])}`}
                >
                  <img className="meta__art" src={loadingArtUrl(champion.id)} alt="" loading="lazy" />
                  <img className="meta__role" src={roleIconUrl(position)} alt="" width={20} height={20} />
                  <span className="tier meta__tier" data-tier={entry.tier}>
                    {entry.tier}
                  </span>
                  <span className="meta__name">{champion.name}</span>
                  <span className="meta__stat">{t("{rate} kazanma", { rate: formatPercent(entry.winRate, lang, 1) })}</span>
                </button>
              </li>
            ))}
      </ul>
    </section>
  );
}
