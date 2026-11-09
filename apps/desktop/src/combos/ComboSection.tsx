import { changedAbilities, comboChangedIn } from "../data/comboCheck";
import { COMBOS, combosOf } from "../data/combos";
import type { Champion } from "../data/ddragon";
import { useLang, useT } from "../i18n";
import { championHistory } from "../patches/history";
import { cachedPatchDiff, patchName, patchVersions } from "../patches/load";
import { useAsync } from "../useAsync";
import { ComboCard } from "./ComboCard";

/** The champion's combos on its page; nothing for champions that are not written up yet. */
export function ComboSection({ champion, version }: { champion: Champion; version: string }) {
  const t = useT();
  const lang = useLang();
  const [versions] = useAsync("patch-versions", patchVersions);
  const combos = combosOf(champion.id);
  if (combos.length === 0) return null;
  // Only diffs the patch tracker already holds are read; nothing is downloaded here.
  const steps = versions.status === "done" ? championHistory(versions.value, (from, to) => cachedPatchDiff(from, to, lang), String(champion.key)).steps : [];
  const changed = changedAbilities(steps, COMBOS.writtenFor);
  return (
    <section className="enter" aria-label={t("Kombolar")}>
      <h2 className="draft__heading">{t("Kombolar")}</h2>
      <div className="combos__group">
        {combos.map((combo) => (
          <ComboCard key={combo.id} champion={champion} version={version} combo={combo} patch={COMBOS.writtenFor} changedIn={(() => { const p = comboChangedIn(combo, changed); return p ? patchName(p) : null; })()} />
        ))}
      </div>
    </section>
  );
}
