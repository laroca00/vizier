import { getAugments } from "../api";
import { formatPercent, useLang, useT } from "../i18n";
import { useAsync } from "../useAsync";
import { augmentInfo, pickOrder } from "./data";

const SHOWN = 8;

/** The champion's best augments in Arena or ARAM Mayhem, best tier first. */
export function ChampionAugments({ championId, queue, limit = SHOWN, title, hideEmpty = false }: { championId: number; queue: number; limit?: number; title?: string; hideEmpty?: boolean }) {
  const t = useT();
  const lang = useLang();
  const [stats] = useAsync(`augments:${queue}:${championId}`, () => getAugments(queue, championId));
  const [info] = useAsync(`augment-info:${lang}`, () => augmentInfo(lang));
  if (stats.status !== "done" || !stats.value) return null;
  const names = info.status === "done" ? info.value : new Map();
  const best = limit === SHOWN ? stats.value.augments.slice(0, SHOWN) : pickOrder(stats.value.augments, limit);
  if (hideEmpty && best.length === 0) return null;
  return (
    <section className="champion-augments enter" aria-label={title ?? t("En iyi augment'ler")}>
      <h2 className="draft__heading">{title ?? t("En iyi augment'ler")}</h2>
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
      {title && best.length > 0 && <p className="build__note">{t("{games} oyunluk veriden", { games: stats.value.games })}</p>}
    </section>
  );
}
