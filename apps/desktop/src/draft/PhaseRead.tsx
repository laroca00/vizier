import { phaseCurve, curveRead, PHASE_TEXT, type Phase } from "../data/traits";
import type { Champion } from "../data/ddragon";
import { useT } from "../i18n";

const PHASES: Phase[] = ["early", "mid", "late"];
const MAX = 4;

/** Early, mid and late game strength of both champions on one scale, from Vizier's hand-kept lists. */
export function PhaseRead({ champion, opponent }: { champion: Champion; opponent: Champion }) {
  const t = useT();
  const mine = phaseCurve(champion);
  const theirs = phaseCurve(opponent);
  const read = curveRead(mine, theirs);
  return (
    <section aria-label={t("Erken, orta ve geç oyun")}>
      <h2 className="draft__heading">{t("Erken, orta ve geç oyun")}</h2>
      <div className="academy__phases">
        {[champion, opponent].map((c, row) => (
          <div key={c.id}>
            <p className="build__stat">{c.name}</p>
            <ul>
              {PHASES.map((phase) => {
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
        ))}
      </div>
      {read && <p className="build__note">{t(read)}</p>}
    </section>
  );
}
