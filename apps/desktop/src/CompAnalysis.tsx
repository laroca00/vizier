import type { Champion } from "./data/ddragon";
import { adviceAgainst, analyzeComp, compDimensions, DIMENSION_NAMES, dimensionText, PHASE_TEXT, WEAKNESS_TEXT, type CompReport } from "./data/traits";
import { formatPercent, useLang, useT } from "./i18n";

const PIPS = [0, 1, 2];

/** AP/AD split, frontline to teamfight with who brings each, and the team's gaps. */
export function CompSummary({ team, report, label }: { team: Champion[]; report: CompReport; label: string }) {
  const t = useT();
  const lang = useLang();
  if (report.champions === 0) return null;
  const extras = [
    { name: "Savaş başlatma", count: report.engage },
    { name: "Koruma", count: report.peel },
    { name: "Geri çekilme", count: report.disengage },
  ];
  return (
    <div className="comp" aria-label={label}>
      <div className="comp__damage" role="img" aria-label={t("Büyü hasarı {magic}, fiziksel hasar {physical}", { magic: formatPercent(report.magic, lang), physical: formatPercent(1 - report.magic, lang) })}>
        <span style={{ width: `${report.magic * 100}%` }} />
        <span style={{ width: `${(1 - report.magic) * 100}%` }} />
      </div>
      <p className="comp__legend">
        <span>{t("Büyü {rate}", { rate: formatPercent(report.magic, lang) })}</span>
        <span>{t("Fiziksel {rate}", { rate: formatPercent(1 - report.magic, lang) })}</span>
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
      <ul className="comp__traits">
        {extras.map((trait) => (
          <li key={trait.name} data-strong={trait.count >= 2 || undefined} data-none={trait.count === 0 || undefined}>
            {t(trait.name)} {trait.count}
          </li>
        ))}
        {report.phase && <li data-strong>{t("En güçlü: {phase}", { phase: t(PHASE_TEXT[report.phase]).toLocaleLowerCase(lang) })}</li>}
      </ul>
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

type Props = { allies: number[]; enemies: number[]; champions: Map<number, Champion> };

/** Both drafts one after the other plus general plans against the enemy one. */
export function CompAnalysis({ allies, enemies, champions }: Props) {
  const t = useT();
  const pick = (ids: number[]) => ids.map((id) => champions.get(id)).filter((c): c is Champion => c !== undefined);
  const ourTeam = pick(allies);
  const theirTeam = pick(enemies);
  const ours = analyzeComp(ourTeam);
  const theirs = analyzeComp(theirTeam);
  const advice = adviceAgainst(theirs, ours);
  return (
    <section aria-label={t("Takım kompozisyonu")}>
      <h2 className="draft__heading">{t("Takımının kompozisyonu")}</h2>
      {ours.champions === 0 ? <p className="draft__empty">{t("Henüz seçim yok")}</p> : <CompSummary team={ourTeam} report={ours} label={t("Takımın")} />}
      {theirs.champions > 0 && (
        <>
          <h2 className="draft__heading">{t("Rakibin kompozisyonu")}</h2>
          <CompSummary team={theirTeam} report={theirs} label={t("Rakip takım")} />
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
