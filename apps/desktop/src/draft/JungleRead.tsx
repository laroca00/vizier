import { getChampion } from "../api";
import { topPath } from "../data/junglePath";
import { championIconUrl, type Champion } from "../data/ddragon";
import { formatPercent, useLang, useT } from "../i18n";
import { DataBadge } from "../ui/DataBadge";
import { useAsync } from "../useAsync";
import "../pages/LengthPanel.css";

const LANE_TEXT = { top: "sonra üst koridor", mid: "sonra orta koridor", bot: "sonra alt koridor", none: "sonra hâlâ orman" } as const;

/** One jungler's usual first route, from the champion's own jungle games; says nothing when the sample is thin. */
function JunglerLine({ champion, version, whose }: { champion: Champion; version: string; whose: "ally" | "enemy" }) {
  const t = useT();
  const lang = useLang();
  const [state] = useAsync(`jungle-route:${champion.key}`, () => getChampion(champion.key, "JUNGLE").catch(() => null));
  if (state.status !== "done" || !state.value) return null;
  const path = topPath(state.value.jungle);
  if (!path || !state.value.jungle) return null;
  const gank = state.value.jungle.gank;
  return (
    <li data-side={whose}>
      <img src={championIconUrl(version, champion.id)} alt="" width={28} height={28} />
      <span>
        <strong>{champion.name}</strong>: {t(path.side === "top" ? "Üst yarıda başla" : "Alt yarıda başla")}, {t(LANE_TEXT[path.lane])}
        {gank ? ` · ${t("ilk gank {minute}. dk", { minute: gank.medianMinute })}` : ""}
      </span>
      <span className="build__stat">
        {formatPercent(path.share, lang, 0)} · {t("{games} maç", { games: path.games.toLocaleString() })}{" "}
        <DataBadge games={path.games} winRate={path.winRate} patches={state.value.patches} updatedAt={state.value.updatedAt} ranked source={t("Vizier crawler, dereceli maçlar")} />
      </span>
    </li>
  );
}

/** In champ select: how the two junglers usually open, from the games of each champion in the jungle. */
export function JungleRead({ ally, enemy, version }: { ally: Champion | null; enemy: Champion | null; version: string }) {
  const t = useT();
  if (!ally && !enemy) return null;
  return (
    <section aria-label={t("Ormancıların ilk turu")}>
      <h2 className="draft__heading">{t("Ormancıların ilk turu")}</h2>
      <ul className="jungle__paths">
        {ally && <JunglerLine champion={ally} version={version} whose="ally" />}
        {enemy && <JunglerLine champion={enemy} version={version} whose="enemy" />}
      </ul>
      <p className="build__note">{t("En çok oynanan ilk rota; rakibin ormancısı tahmin olabilir.")}</p>
    </section>
  );
}
