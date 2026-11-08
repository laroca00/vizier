import { getAugments } from "../api";
import { formatPercent, useLang, useT } from "../i18n";
import { useAsync } from "../useAsync";
import { augmentInfo } from "./data";

const SHOWN = 8;

/** The champion's best augments in Arena or ARAM Mayhem, best tier first. */
export function ChampionAugments({ championId, queue }: { championId: number; queue: number }) {
  const t = useT();
  const lang = useLang();
  const [stats] = useAsync(`augments:${queue}:${championId}`, () => getAugments(queue, championId));
  const [info] = useAsync(`augment-info:${lang}`, () => augmentInfo(lang));
  if (stats.status !== "done" || !stats.value) return null;
  const names = info.status === "done" ? info.value : new Map();
  const best = stats.value.augments.slice(0, SHOWN);
  return (
    <section className="champion-augments enter" aria-label={t("En iyi augment'ler")}>
      <h2 className="draft__heading">{t("En iyi augment'ler")}</h2>
      {best.length === 0 ? (
        <p className="build__note">{t("Bu şampiyonla bu modda henüz yeterli maç yok.")}</p>
      ) : (
        <ul className="champion-augments__list">
          {best.map((a) => {
            const meta = names.get(a.augmentId);
            return (
              <li key={a.augmentId}>
                <span className="tier" data-tier={a.tier}>
                  {a.tier}
                </span>
                {meta && <img src={meta.icon} alt="" width={28} height={28} loading="lazy" />}
                <span className="champion-augments__name">{meta?.name ?? t("Augment #{id}", { id: a.augmentId })}</span>
                <span className="build__stat">
                  {t(queue === 1700 ? "{pick} seçilme, {rate} ilk 4" : "{pick} seçilme, {rate} kazanma", {
                    pick: formatPercent(a.pickRate, lang),
                    rate: formatPercent(a.winRate, lang),
                  })}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
