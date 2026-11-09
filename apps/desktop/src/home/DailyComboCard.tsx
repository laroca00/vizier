import { ComboCard } from "../combos/ComboCard";
import { COMBOS, combosOf } from "../data/combos";
import type { Champion } from "../data/ddragon";
import { useT } from "../i18n";
import { usePersonal } from "../personal";
import type { Route } from "../router";
import { dailyCombo, localDay } from "./dailyTip";

/** One combo a day, from the player's pool when it has any written up. */
export function DailyComboCard({ champions, version, onNavigate }: { champions: Map<number, Champion>; version: string | null; onNavigate: (route: Route) => void }) {
  const t = useT();
  const { pool } = usePersonal();
  if (!version || champions.size === 0) return null;
  const poolIds = pool.flatMap((p) => {
    const c = champions.get(p.championId);
    return c ? [c.id] : [];
  });
  const pick = dailyCombo(
    localDay(new Date()),
    poolIds,
    COMBOS.champions.map((c) => c.championId),
    combosOf,
  );
  const champion = pick ? [...champions.values()].find((c) => c.id === pick.championId) : undefined;
  if (!pick || !champion) return null;
  return (
    <section className="home__daily enter" aria-label={t("Günün kombosu")}>
      <h2 className="section-title">
        {t("Günün kombosu: {champion}", { champion: champion.name })}{" "}
        <button type="button" className="link" onClick={() => onNavigate({ page: "combos" })}>
          {t("Bütün kombolar")}
        </button>
      </h2>
      <ComboCard champion={champion} version={version} combo={pick.combo} patch={COMBOS.writtenFor} />
    </section>
  );
}
