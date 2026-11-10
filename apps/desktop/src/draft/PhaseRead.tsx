import { getChampion } from "../api";
import { phaseCurve, curveRead, PHASE_TEXT, type Phase } from "../data/traits";
import type { Champion } from "../data/ddragon";
import { pooled } from "../data/confidence";
import { lengthsAreThick, phaseRates, type LengthBucket } from "../data/lengthStats";
import { formatPercent, useLang, useT } from "../i18n";
import { DataBadge } from "../ui/DataBadge";
import { useAsync } from "../useAsync";

const PHASES: Phase[] = ["early", "mid", "late"];
const MAX = 4;

/**
 * Early, mid and late game of both champions. A champion with enough ranked games
 * in every phase shows its win rate by game length; the others keep Vizier's
 * hand-kept bars, labelled as such.
 */
export function PhaseRead({ champion, opponent, position }: { champion: Champion; opponent: Champion; position: string }) {
  const t = useT();
  const lang = useLang();
  const [mineLengths] = useAsync(`phase:${champion.key}:${position}`, () => lengthsOf(champion.key, position));
  const [theirLengths] = useAsync(`phase:${opponent.key}:${position}`, () => lengthsOf(opponent.key, position));
  const mine = phaseCurve(champion);
  const theirs = phaseCurve(opponent);
  const read = curveRead(mine, theirs);
  const lengths = [mineLengths, theirLengths].map((s) => (s.status === "done" ? s.value.lengths : undefined));
  // The written read compares the hand-kept curves, so it only stands when both sides use them.
  const bothData = lengths.every((l) => lengthsAreThick(l));
  return (
    <section aria-label={t("Erken, orta ve geç oyun")}>
      <h2 className="draft__heading">{t("Erken, orta ve geç oyun")}</h2>
      <div className="academy__phases">
        {[champion, opponent].map((c, row) => {
          const data = lengths[row];
          const thick = lengthsAreThick(data);
          const rates = phaseRates(data);
          const source = row === 0 ? mineLengths : theirLengths;
          const patches = source.status === "done" ? source.value.patches : [];
          const all = pooled(Object.values(rates).flatMap((r) => (r ? [r] : [])));
          return (
            <div key={c.id}>
              <p className="build__stat">
                {c.name}{" "}
                {thick ? (
                  <DataBadge {...all} patches={patches} source={t("Vizier crawler, oyun süresine göre kazanma")} />
                ) : (
                  <DataBadge editorial />
                )}
              </p>
              <ul>
                {PHASES.map((phase) => {
                  const rate = rates[phase];
                  if (thick && rate) {
                    return (
                      <li key={phase}>
                        <span>{t(PHASE_TEXT[phase])}</span>
                        <span className="build__stat">
                          {formatPercent(rate.winRate, lang, 1)} · {t("{games} maç", { games: rate.games.toLocaleString() })}
                        </span>
                      </li>
                    );
                  }
                  const value = (row === 0 ? mine : theirs)[phase];
                  return (
                    <li key={phase}>
                      <span>{t(PHASE_TEXT[phase])}</span>
                      <span className="academy__bar" role="img" aria-label={`${value} / ${MAX}`}>
                        <span style={{ width: `${(value / MAX) * 100}%` }} data-side={row === 0 ? "me" : "them"} />
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
      {read && !bothData && <p className="build__note">{t(read)}</p>}
    </section>
  );
}

async function lengthsOf(championId: number, position: string): Promise<{ lengths: LengthBucket[] | undefined; patches: string[] }> {
  const overview = await getChampion(championId, position).catch(() => null);
  // A role the champion has few games in answers with its main role, whose lengths are not this role's.
  return { lengths: overview?.position === position ? overview.lengths : undefined, patches: overview?.patches ?? [] };
}
