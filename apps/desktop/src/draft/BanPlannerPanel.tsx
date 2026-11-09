import { getBans, getCounters } from "../api";
import { championIconUrl, type Champion } from "../data/ddragon";
import { formatPercent, useLang, useT } from "../i18n";
import { useAsync } from "../useAsync";
import { planBans, type BanReason } from "./banPlanner";
import { BanButtons } from "./BanButtons";
import type { DraftTurn } from "../lcu";

type Props = {
  /** The champion hovered, locked or the pool main for the role. */
  subject: number | null;
  role: string | null;
  allies: { championId: number; position: string }[];
  unavailable: Set<number>;
  champions: Map<number, Champion>;
  version: string;
  /** The current turn; ban buttons appear on the player's own ban turn. */
  turn?: DraftTurn | null;
};

/** Ban suggestions with the reason for each: meta, our hard matchups, strong into our team. */
export function BanPlanner({ subject, role, allies, unavailable, champions, version, turn }: Props) {
  const t = useT();
  const lang = useLang();
  const allyKey = allies.map((a) => `${a.championId}:${a.position}`).join(",");
  const [state] = useAsync(`ban-plan:${subject}:${role}:${allyKey}`, async () => {
    const [meta, own, teamCounters] = await Promise.all([
      getBans().catch(() => null),
      subject && role ? getCounters(subject, role).catch(() => null) : null,
      Promise.all(allies.map((a) => getCounters(a.championId, a.position).then((counters) => ({ championId: a.championId, counters })).catch(() => null))),
    ]);
    return { meta, own: own && subject ? { championId: subject, counters: own } : null, allies: teamCounters.filter((x) => x !== null) };
  });
  if (state.status !== "done") return null;
  const bans = planBans({ ...state.value, unavailable });
  if (bans.length === 0) return <p className="draft__empty">{t("Öneri yok")}</p>;
  const name = (id: number) => champions.get(id)?.name ?? "";

  function reasonText(reason: BanReason) {
    switch (reason.kind) {
      case "meta":
        return t("Meta: {rate} kazanma, {games} maç", { rate: formatPercent(reason.winRate, lang, 1), games: reason.games });
      case "hard":
        return t("{champion} bu şampiyona karşı {rate} kazanıyor, {games} maç", { champion: name(reason.vs), rate: formatPercent(reason.winRate, lang), games: reason.games });
      case "team":
        return t("{allies} karşısında güçlü: {rate}, {games} maç", { allies: reason.allies.map(name).join(", "), rate: formatPercent(reason.winRate, lang), games: reason.games });
    }
  }

  return (
    <ol className="picks">
      {bans.map((ban) => {
        const champion = champions.get(ban.championId);
        if (!champion) return null;
        return (
          <li key={ban.championId} className="picks__row">
            <img src={championIconUrl(version, champion.id)} alt="" width={40} height={40} />
            <div className="picks__body">
              <p className="picks__name">{champion.name}</p>
              <ul className="picks__reasons">
                {ban.reasons.map((reason) => (
                  <li key={reason.kind}>{reasonText(reason)}</li>
                ))}
              </ul>
              <BanButtons championId={champion.key} championName={champion.name} turn={turn} />
            </div>
          </li>
        );
      })}
    </ol>
  );
}
