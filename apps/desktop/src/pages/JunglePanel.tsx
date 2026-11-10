import type { ChampionOverview } from "../api";
import { hasEnoughGames } from "../data/confidence";
import { formatPercent, useLang, useT } from "../i18n";
import { DataBadge } from "../ui/DataBadge";
import { sampleTitle } from "../ui/sampleTitle";
import "./LengthPanel.css";

type Jungle = NonNullable<ChampionOverview["jungle"]>;

const LANE_TEXT = { top: "sonra üst koridor", mid: "sonra orta koridor", bot: "sonra alt koridor", none: "sonra hâlâ orman" } as const;

/** The first minutes of the jungle: where the clear starts, which lane comes first, and when the first gank lands. */
export function JunglePanel({ jungle, patches, updatedAt }: { jungle: Jungle; patches: string[]; updatedAt?: number }) {
  const t = useT();
  const lang = useLang();
  const winRate = jungle.paths.reduce((sum, p) => sum + p.games * p.winRate, 0) / Math.max(1, jungle.paths.reduce((sum, p) => sum + p.games, 0));
  return (
    <section className="enter" aria-label={t("İlk tur")}>
      <h2 className="draft__heading">
        {t("İlk tur")} <DataBadge games={jungle.games} winRate={winRate} patches={patches} updatedAt={updatedAt} ranked source={t("Vizier crawler, dereceli maçlar")} />
      </h2>
      <ul className="jungle__paths">
        {jungle.paths.map((p) => {
          const enough = hasEnoughGames(p.games, p.winRate);
          return (
            <li key={`${p.side}:${p.lane}`} data-enough={enough} title={sampleTitle(t, lang, { ...p, patches, updatedAt })}>
              <span>
                {t(p.side === "top" ? "Üst yarıda başla" : "Alt yarıda başla")}, {t(LANE_TEXT[p.lane])}
              </span>
              <span className="build__stat">
                {formatPercent(p.games / jungle.games, lang, 0)} · {t("{games} maç", { games: p.games.toLocaleString() })} · {enough ? formatPercent(p.winRate, lang, 1) : t("az maç")}
              </span>
            </li>
          );
        })}
      </ul>
      {jungle.gank && <p className="build__note">{t("İlk gank ortalama {minute}. dakikada, {games} oyunda", { minute: jungle.gank.medianMinute, games: jungle.gank.games.toLocaleString() })}</p>}
    </section>
  );
}
