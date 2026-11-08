import { useState } from "react";
import { useLang, useT } from "../i18n";
import { useAsync } from "../useAsync";
import { direction, verdict, type Verdict } from "./diff";
import { fieldLabel, formatValue } from "./format";
import { championHistory, missingPairs } from "./history";
import { cachedPatchDiff, patchDiff, patchName, patchVersions } from "./load";
import "./patches.css";

const VERDICT_NAMES: Record<Verdict, string> = { buff: "Güçlendirme", nerf: "Zayıflatma", mixed: "Karışık" };

/**
 * What changed for one champion over the recent patches, from the diffs the
 * patch tracker keeps. Older pairs load only when asked: each one downloads
 * two full champion files.
 */
export function ChampionHistory({ championKey, championName }: { championKey: number; championName: string }) {
  const t = useT();
  const lang = useLang();
  const [versions] = useAsync("patch-versions", patchVersions);
  const [loading, setLoading] = useState<{ done: number; total: number } | null>(null);
  const [, setTick] = useState(0);
  if (versions.status !== "done" || versions.value.length < 2) return null;

  const diffOf = (from: string, to: string) => cachedPatchDiff(from, to, lang);
  const { steps, missing } = championHistory(versions.value, diffOf, String(championKey));

  async function loadMissing() {
    const pairs = missingPairs(versions.status === "done" ? versions.value : [], diffOf);
    setLoading({ done: 0, total: pairs.length });
    // One pair at a time keeps the downloads from piling up.
    for (const [i, [from, to]] of pairs.entries()) {
      await patchDiff(from, to, lang).catch(() => null);
      setLoading({ done: i + 1, total: pairs.length });
    }
    setLoading(null);
    setTick((n) => n + 1);
  }

  return (
    <section className="champion-history enter" aria-label={t("{champion} yama geçmişi", { champion: championName })}>
      <h2 className="draft__heading">{t("Yama geçmişi")}</h2>
      {steps.length === 0 ? (
        <p className="build__note">
          {missing === versions.value.length - 1 ? t("Yama takibinde açtığın yamalar burada görünür.") : t("Okunan yamalarda {champion} değişmedi.", { champion: championName })}
        </p>
      ) : (
        <ol className="champion-history__list">
          {steps.map(({ from, to, entry }) => {
            const label = verdict(entry);
            return (
              <li key={to}>
                <p className="champion-history__patch">
                  {t("Yama {patch}", { patch: patchName(to) })}
                  {label && (
                    <span className="patches__verdict" data-verdict={label}>
                      {t(VERDICT_NAMES[label])}
                    </span>
                  )}
                </p>
                <ul className="patches__changes">
                  {entry.changes.map((change) => (
                    <li key={change.field} data-direction={direction(change) ?? undefined}>
                      <span>{fieldLabel(change.field, t)}</span>
                      <span className="patches__values">
                        {formatValue(change, change.before, {}, lang, t)} <span aria-hidden="true">→</span>
                        <span className="visually-hidden">{t("şuna değişti:")}</span> {formatValue(change, change.after, {}, lang, t)}
                      </span>
                    </li>
                  ))}
                </ul>
                <span className="visually-hidden">{patchName(from)}</span>
              </li>
            );
          })}
        </ol>
      )}
      {missing > 0 && (
        <p className="build__note">
          {loading ? (
            t("Yamalar yükleniyor: {done}/{total}", loading)
          ) : (
            <>
              {t("{count} yama henüz okunmadı.", { count: missing })}{" "}
              <button type="button" className="link" onClick={loadMissing}>
                {t("Onları da yükle")}
              </button>
            </>
          )}
        </p>
      )}
    </section>
  );
}
