import { useState } from "react";
import { DEFAULT_BRACKET } from "@vizier/shared/brackets";
import { getCounters, getCountersAt, getTierList, getTierListAt } from "../api";
import { rankLabel, useBracket } from "../rank";
import { rankNotes } from "./rankReason";
import { championIconUrl, type Champion } from "../data/ddragon";
import { formatPercent, useLang, useT } from "../i18n";
import { usePersonal } from "../personal";
import { useAsync } from "../useAsync";
import { LockButtons } from "./LockButtons";
import type { DraftTurn } from "../lcu";
import { suggestPicks, type Need, type PickReason, type ScoreBreakdown } from "./logic";

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
  /** In champ select, each row gets Seç and Kilitle buttons. */
  turn?: DraftTurn | null;
  /** Fewer rows where space is tight. */
  limit?: number;
};

/** Picks for the player's role from the meta, the lane opponent and what the team lacks. */
export function PickSuggestions({ role, opponentId, allies, unavailable, champions, version, onPick, limit, turn }: Props) {
  const t = useT();
  const lang = useLang();
  const { pool } = usePersonal();
  const [poolFirst, setPoolFirst] = useState(false);
  const [tiers] = useAsync(`tiers:${role}`, () => getTierList(role));
  const [counters] = useAsync(opponentId ? `counters:${opponentId}:${role}` : null, () => getCounters(opponentId!, role));
  // The Emerald+ order, to say where the player's own rank changes it; nothing to compare when the filter is Emerald+.
  const bracket = useBracket();
  const compare = bracket !== DEFAULT_BRACKET;
  const [baseTiers] = useAsync(compare ? `tiers:${role}:base` : null, () => getTierListAt(role, DEFAULT_BRACKET).catch(() => null));
  const [baseCounters] = useAsync(compare && opponentId ? `counters:${opponentId}:${role}:base` : null, () => getCountersAt(opponentId!, role, DEFAULT_BRACKET).catch(() => null));

  if (tiers.status === "error") return null;
  if (tiers.status !== "done" || counters.status === "loading") return <p className="draft__empty">{t("Öneriler hazırlanıyor")}</p>;

  const poolSet = poolFirst ? new Set(pool.filter((p) => !p.position || p.position === role).map((p) => p.championId)) : undefined;
  const picks = suggestPicks({
    tierList: tiers.value.champions,
    opponentCounters: counters.status === "done" ? counters.value : null,
    opponentId,
    allies,
    champions,
    unavailable,
    pool: poolSet,
  }).slice(0, limit);
  const baseline =
    compare && baseTiers.status === "done" && baseTiers.value
      ? suggestPicks({
          tierList: baseTiers.value.champions,
          opponentCounters: baseCounters.status === "done" ? baseCounters.value : null,
          opponentId,
          allies,
          champions,
          unavailable,
          pool: poolSet,
        })
      : null;
  const notes = baseline ? rankNotes(picks, baseline) : new Map();
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

  function breakdownText(b: ScoreBreakdown) {
    const sign = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}`;
    return t("Puan: meta {meta}, eşleşme {counter}, takım ihtiyacı {needs}", { meta: sign(b.meta), counter: sign(b.counter), needs: sign(b.needs) });
  }

  return (
    <>
      {pool.length > 0 && (
        <label className="picks__toggle">
          <input type="checkbox" checked={poolFirst} onChange={(e) => setPoolFirst(e.target.checked)} /> {t("Önce havuzum")}
        </label>
      )}
      {shared.length > 0 && (
        <p className="picks__shared">{t("Takımın ihtiyacı: {needs}", { needs: shared.map((need) => t(NEED_SHORT[need])).join(", ") })}</p>
      )}
      <ol className="picks">
        {picks.map((pick) => {
          const champion = champions.get(pick.championId);
          if (!champion) return null;
          return (
            <li key={pick.championId} className="picks__row" title={breakdownText(pick.breakdown)} data-pool={pick.inPool || undefined} data-pickable={onPick ? true : undefined}>
              {onPick ? (
                <button type="button" className="picks__pick" aria-label={t("{champion} seç", { champion: champion.name })} onClick={() => onPick(pick.championId)}>
                  <img src={championIconUrl(version, champion.id)} alt="" width={40} height={40} />
                </button>
              ) : (
                <img src={championIconUrl(version, champion.id)} alt="" width={40} height={40} />
              )}
              <div className="picks__body">
                <p className="picks__name">{champion.name}{pick.inPool && <span className="picks__pool"> · {t("Havuzunda")}</span>}</p>
                <ul className="picks__reasons">
                  {pick.reasons.filter((reason) => reason.kind !== "need" || !shared.includes(reason.need)).map((reason) => (
                    <li key={reason.kind === "need" ? reason.need : reason.kind} data-kind={reason.kind}>
                      {reasonText(reason)}
                    </li>
                  ))}
                  {notes.get(pick.championId) && (
                    <li data-kind="rank">
                      {notes.get(pick.championId)!.baseline === null
                        ? t("{rank} rankında {place}. sırada; Zümrüt+ önerilerinde yok", { rank: rankLabel(bracket, lang === "en" ? "en" : "tr"), place: notes.get(pick.championId)!.place })
                        : t("{rank} rankında {place}. sırada, Zümrüt+ listesinde {baseline}.", {
                            rank: rankLabel(bracket, lang === "en" ? "en" : "tr"),
                            place: notes.get(pick.championId)!.place,
                            baseline: notes.get(pick.championId)!.baseline!,
                          })}
                    </li>
                  )}
                </ul>
              </div>
              {turn !== undefined && <LockButtons championId={pick.championId} championName={champion.name} turn={turn} gone={unavailable} />}
            </li>
          );
        })}
      </ol>
    </>
  );
}
