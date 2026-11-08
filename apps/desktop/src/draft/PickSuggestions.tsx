import { getCounters, getTierList } from "../api";
import { championIconUrl, type Champion } from "../data/ddragon";
import { formatPercent, useLang, useT } from "../i18n";
import { useAsync } from "../useAsync";
import { suggestPicks, type Need, type PickReason } from "./logic";

const NEED_TEXT: Record<Need, string> = {
  ap: "Takıma büyü hasarı katar",
  ad: "Takıma fiziksel hasar katar",
  frontline: "Eksik ön hattı tamamlar",
  engage: "Savaşı başlatabilir",
  peel: "Taşıyıcıyı korur",
};

const NEED_SHORT: Record<Need, string> = {
  ap: "büyü hasarı",
  ad: "fiziksel hasar",
  frontline: "ön hat",
  engage: "savaş başlatan",
  peel: "koruyucu",
};

type Props = {
  role: string;
  opponentId: number | null;
  allies: Champion[];
  unavailable: Set<number>;
  champions: Map<number, Champion>;
  version: string;
  /** Makes each row a button, as in the draft simulator. */
  onPick?: (championId: number) => void;
  /** Fewer rows where space is tight. */
  limit?: number;
};

/** Picks for the player's role from the meta, the lane opponent and what the team lacks. */
export function PickSuggestions({ role, opponentId, allies, unavailable, champions, version, onPick, limit }: Props) {
  const t = useT();
  const lang = useLang();
  const [tiers] = useAsync(`tiers:${role}`, () => getTierList(role));
  const [counters] = useAsync(opponentId ? `counters:${opponentId}:${role}` : null, () => getCounters(opponentId!, role));

  if (tiers.status === "error") return null;
  if (tiers.status !== "done" || counters.status === "loading") return <p className="draft__empty">{t("Öneriler hazırlanıyor")}</p>;

  const picks = suggestPicks({
    tierList: tiers.value.champions,
    opponentCounters: counters.status === "done" ? counters.value : null,
    opponentId,
    allies,
    champions,
    unavailable,
  }).slice(0, limit);
  if (picks.length === 0) return <p className="draft__empty">{t("Şu an öne çıkan bir seçim yok.")}</p>;

  // A gap every pick fills is said once above the list instead of on every row.
  const hasNeed = (reasons: PickReason[], need: Need) => reasons.some((r) => r.kind === "need" && r.need === need);
  const shared = (Object.keys(NEED_TEXT) as Need[]).filter((need) => picks.length > 1 && picks.every((p) => hasNeed(p.reasons, need)));

  function reasonText(reason: PickReason) {
    switch (reason.kind) {
      case "counter":
        return t("{opponent} karşısında {rate}, {games} maç", {
          opponent: champions.get(reason.vs)?.name ?? "",
          rate: formatPercent(reason.winRate, lang),
          games: reason.games,
        });
      case "need":
        return t(NEED_TEXT[reason.need]);
      case "meta":
        return t("{tier} tier, {rate} kazanma", { tier: reason.tier, rate: formatPercent(reason.winRate, lang, 1) });
    }
  }

  return (
    <>
      {shared.length > 0 && (
        <p className="picks__shared">{t("Takımın ihtiyacı: {needs}", { needs: shared.map((need) => t(NEED_SHORT[need])).join(", ") })}</p>
      )}
      <ol className="picks">
        {picks.map((pick) => {
          const champion = champions.get(pick.championId);
          if (!champion) return null;
          return (
            <li key={pick.championId} className="picks__row" data-pickable={onPick ? true : undefined}>
              {onPick ? (
                <button type="button" className="picks__pick" aria-label={t("{champion} seç", { champion: champion.name })} onClick={() => onPick(pick.championId)}>
                  <img src={championIconUrl(version, champion.id)} alt="" width={40} height={40} />
                </button>
              ) : (
                <img src={championIconUrl(version, champion.id)} alt="" width={40} height={40} />
              )}
              <div className="picks__body">
                <p className="picks__name">{champion.name}</p>
                <ul className="picks__reasons">
                  {pick.reasons.filter((reason) => reason.kind !== "need" || !shared.includes(reason.need)).map((reason) => (
                    <li key={reason.kind === "need" ? reason.need : reason.kind} data-kind={reason.kind}>
                      {reasonText(reason)}
                    </li>
                  ))}
                </ul>
              </div>
            </li>
          );
        })}
      </ol>
    </>
  );
}
