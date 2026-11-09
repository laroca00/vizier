import { COMBOS, combosOf } from "../data/combos";
import type { Champion } from "../data/ddragon";
import { useT } from "../i18n";
import { ComboCard } from "./ComboCard";

/** The champion's combos on its page; nothing for champions that are not written up yet. */
export function ComboSection({ champion, version }: { champion: Champion; version: string }) {
  const t = useT();
  const combos = combosOf(champion.id);
  if (combos.length === 0) return null;
  return (
    <section className="enter" aria-label={t("Kombolar")}>
      <h2 className="draft__heading">{t("Kombolar")}</h2>
      <div className="combos__group">
        {combos.map((combo) => (
          <ComboCard key={combo.id} champion={champion} version={version} combo={combo} patch={COMBOS.writtenFor} />
        ))}
      </div>
    </section>
  );
}
