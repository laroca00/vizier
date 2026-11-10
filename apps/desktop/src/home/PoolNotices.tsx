import { getChampion } from "../api";
import type { Champion } from "../data/ddragon";
import { formatPercent, useLang, useT } from "../i18n";
import { usePersonal } from "../personal";
import { clearDirection, winRateShift } from "../patches/winRateShift";
import { rankLabel, useBracket } from "../rank";
import { useAsync } from "../useAsync";

// Enough to notice a few; more than this turns a quiet line into a list.
const MAX_CHECKED = 8;

function Notice({ champion, position }: { champion: Champion; position: string | null }) {
  const t = useT();
  const lang = useLang();
  const bracket = useBracket();
  // Same key as the pool card's own fetch, so this costs no extra request.
  const [state] = useAsync(`ally:${champion.key}:${position}`, () => getChampion(champion.key, position));
  const shift = state.status === "done" ? winRateShift(state.value) : null;
  const direction = clearDirection(shift);
  if (!shift || !direction) return null;
  return (
    <li className="state__text">
      {t(direction === "rose" ? "{champion} {rank} rankında yükseldi: {before} → {after} ({beforeGames} ve {afterGames} maç)" : "{champion} {rank} rankında düştü: {before} → {after} ({beforeGames} ve {afterGames} maç)", {
        champion: champion.name,
        rank: rankLabel(bracket, lang === "en" ? "en" : "tr"),
        before: formatPercent(shift.before, lang, 1),
        after: formatPercent(shift.after, lang, 1),
        beforeGames: shift.beforeGames.toLocaleString(),
        afterGames: shift.afterGames.toLocaleString(),
      })}
    </li>
  );
}

/** Quiet lines under the pool when a pick clearly rose or fell since the previous patch in the chosen rank. */
export function PoolNotices({ champions }: { champions: Map<number, Champion> }) {
  const { pool } = usePersonal();
  const picks = pool.slice(0, MAX_CHECKED).flatMap((p) => {
    const champion = champions.get(p.championId);
    return champion ? [{ champion, position: p.position ?? null }] : [];
  });
  if (picks.length === 0) return null;
  return (
    <ul className="home__notices">
      {picks.map(({ champion, position }) => (
        <Notice key={champion.key} champion={champion} position={position} />
      ))}
    </ul>
  );
}
