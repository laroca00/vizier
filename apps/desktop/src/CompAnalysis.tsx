import type { Champion } from "./data/ddragon";
import { adviceAgainst, type PhaseCurve, analyzeComp, curveRead, teamCurve, teamDamage, compDimensions, DIMENSION_NAMES, dimensionText, PHASE_TEXT, WEAKNESS_TEXT, type CompReport } from "./data/traits";
import { aramPlan, ARCHETYPE_NAMES, ARCHETYPE_PLANS, winConditions } from "./draft/winConditions";
import { formatPercent, useLang, useT } from "./i18n";

const PIPS = [0, 1, 2];
const PHASES = ["early", "mid", "late"] as const;

/** AP/AD split, frontline to teamfight with who brings each, and the team's gaps. */
export function CompSummary({ team, report, label }: { team: Champion[]; report: CompReport; label: string }) {
  const t = useT();
  const lang = useLang();
  if (report.champions === 0) return null;
  const damage = teamDamage(team);
  return (
    <div className="comp" aria-label={label}>
      <div
        className="comp__damage"
        role="img"
        aria-label={t("Büyü hasarı {magic}, fiziksel hasar {physical}, sabit hasar {fixed}", {
          magic: formatPercent(damage.ap, lang),
          physical: formatPercent(damage.ad, lang),
          fixed: formatPercent(damage.true, lang),
        })}
      >
        <span data-kind="ap" style={{ width: `${damage.ap * 100}%` }} />
        <span data-kind="ad" style={{ width: `${damage.ad * 100}%` }} />
        {damage.true >= 0.03 && <span data-kind="true" style={{ width: `${damage.true * 100}%` }} />}
      </div>
      <p className="comp__legend">
        <span>{t("Büyü {rate}", { rate: formatPercent(damage.ap, lang) })}</span>
        <span>{t("Fiziksel {rate}", { rate: formatPercent(damage.ad, lang) })}</span>
        {damage.true >= 0.03 && <span>{t("Sabit {rate}", { rate: formatPercent(damage.true, lang) })}</span>}
      </p>
      <ul className="comp__dims">
        {compDimensions(team).map((d) => (
          <li key={d.dimension} data-level={d.level}>
            <span className="comp__dim-name">{t(DIMENSION_NAMES[d.dimension])}</span>
            <span className="comp__pips" role="img" aria-label={t("{count} şampiyon", { count: d.names.length })}>
              {PIPS.map((i) => (
                <span key={i} data-on={i < d.names.length || undefined} />
              ))}
            </span>
            <span className="comp__dim-text">{t(dimensionText(d), { names: d.names.join(", ") })}</span>
          </li>
        ))}
      </ul>
      {report.phase && (
        <ul className="comp__traits">
          <li data-strong>{t("En güçlü: {phase}", { phase: t(PHASE_TEXT[report.phase]).toLocaleLowerCase(lang) })}</li>
        </ul>
      )}
      {report.weaknesses.length > 0 && (
        <ul className="comp__weak">
          {report.weaknesses.map((w) => (
            <li key={w}>{t(WEAKNESS_TEXT[w])}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function WinConditions({ team, aram }: { team: Champion[]; aram?: boolean }) {
  const t = useT();
  const list = winConditions(team, aram);
  if (list.length === 0) return null;
  return (
    <ul className="advice win-conditions">
      {list.map((w) => (
        <li key={w.archetype}>
          <p>{t(ARCHETYPE_NAMES[w.archetype])}</p>
          {ARCHETYPE_PLANS[w.archetype].map((line) => (
            <p key={line}>{t(line, { names: w.names.join(", ") })}</p>
          ))}
        </li>
      ))}
    </ul>
  );
}

type CurveProps = { ours: PhaseCurve; theirs: PhaseCurve; read: string; ourLabel?: string; theirLabel?: string };

/** Early, mid and late strength of two teams as paired bars with a one-line read. */
export function PhaseCurves({ ours, theirs, read, ourLabel, theirLabel }: CurveProps) {
  const t = useT();
  const mine = ourLabel ?? t("sen");
  const other = theirLabel ?? t("rakip");
  return (
    <>
      <ul className="curve" aria-label={t("Oyun evreleri")}>
        {PHASES.map((phase) => (
          <li key={phase}>
            <span className="curve__name">{t(PHASE_TEXT[phase])}</span>
            <span className="curve__bars" role="img" aria-label={t("{phase}: {mine} {ours}, {other} {theirs} (4 üzerinden)", { phase: t(PHASE_TEXT[phase]), mine, other, ours: ours[phase].toFixed(1), theirs: theirs[phase].toFixed(1) })}>
              <span data-side="ours" style={{ width: `${(ours[phase] / 4) * 100}%` }} />
              <span data-side="theirs" style={{ width: `${(theirs[phase] / 4) * 100}%` }} />
            </span>
          </li>
        ))}
      </ul>
      <p className="draft__empty">{t(read)}</p>
    </>
  );
}

type Props = { allies: number[]; enemies: number[]; champions: Map<number, Champion>; aram?: boolean };

/** Both drafts one after the other plus general plans against the enemy one. */
export function CompAnalysis({ allies, enemies, champions, aram }: Props) {
  const t = useT();
  const pick = (ids: number[]) => ids.map((id) => champions.get(id)).filter((c): c is Champion => c !== undefined);
  const ourTeam = pick(allies);
  const theirTeam = pick(enemies);
  const ours = analyzeComp(ourTeam);
  const theirs = analyzeComp(theirTeam);
  const advice = adviceAgainst(theirs, ours);
  const ourCurve = teamCurve(ourTeam);
  const theirCurve = teamCurve(theirTeam);
  const read = curveRead(ourCurve, theirCurve);
  const curve = ourCurve && theirCurve && read ? { ours: ourCurve, theirs: theirCurve, read } : null;
  return (
    <section aria-label={t("Takım kompozisyonu")}>
      <h2 className="draft__heading">{t("Takımının kompozisyonu")}</h2>
      {ours.champions === 0 ? <p className="draft__empty">{t("Henüz seçim yok")}</p> : <CompSummary team={ourTeam} report={ours} label={t("Takımın")} />}
      {aram && aramPlan(ourTeam) && <p className="draft__empty">{t(aramPlan(ourTeam)!.line, { names: aramPlan(ourTeam)!.names.join(", ") })}</p>}
      {ours.champions >= 3 && winConditions(ourTeam, aram).length > 0 && (
        <>
          <h2 className="draft__heading">{t("Takımın nasıl oynamak istediği")}</h2>
          <WinConditions team={ourTeam} aram={aram} />
        </>
      )}
      {theirs.champions > 0 && (
        <>
          <h2 className="draft__heading">{t("Rakibin kompozisyonu")}</h2>
          <CompSummary team={theirTeam} report={theirs} label={t("Rakip takım")} />
        </>
      )}
      {theirs.champions >= 3 && winConditions(theirTeam, aram).length > 0 && (
        <>
          <h2 className="draft__heading">{t("Rakibin nasıl oynamak istediği")}</h2>
          <WinConditions team={theirTeam} aram={aram} />
        </>
      )}
      {curve && (
        <>
          <h2 className="draft__heading">{t("Oyun evreleri")}</h2>
          <PhaseCurves ours={curve.ours} theirs={curve.theirs} read={curve.read} />
        </>
      )}
      {advice.length > 0 && (
        <>
          <h2 className="draft__heading">{t("Rakibe karşı plan")}</h2>
          <ul className="advice">
            {advice.map((a) => (
              <li key={a.title}>
                <p>{t(a.title)}</p>
                <p>{t(a.detail)}</p>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
