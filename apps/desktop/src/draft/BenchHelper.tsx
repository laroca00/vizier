import { getTierList } from "../api";
import { championIconUrl, type Champion } from "../data/ddragon";
import { formatPercent, useLang, useT } from "../i18n";
import { useAsync } from "../useAsync";
import { rankBench, type BenchSource } from "./bench";

const SOURCE_TEXT: Record<BenchSource, string> = { current: "Senin", bench: "Sırada", ally: "Takım arkadaşı" };

type Props = { current: number; bench: number[]; allies: number[]; champions: Map<number, Champion>; version: string };

/** ARAM win rates for the player's champion, the bench and the team, with a hint to swap. */
export function BenchHelper({ current, bench, allies, champions, version }: Props) {
  const t = useT();
  const lang = useLang();
  const [tiers] = useAsync("tiers:ALL:450", () => getTierList("ALL", 450));
  if (tiers.status !== "done") return null;
  const rows = rankBench({ tierList: tiers.value.champions, current, bench, allies });
  if (rows.length === 0) return null;
  return (
    <>
      <h2 className="draft__heading">{t("Sıra ve takım")}</h2>
      <ol className="picks bench">
        {rows.map((row) => {
          const champion = champions.get(row.championId);
          if (!champion) return null;
          return (
            <li key={row.championId} className="picks__row" data-take={row.take || undefined}>
              <img src={championIconUrl(version, champion.id)} alt="" width={40} height={40} />
              <div className="picks__body">
                <p className="picks__name">
                  {champion.name} <span className="picks__pool">· {t(SOURCE_TEXT[row.source])}</span>
                </p>
                <ul className="picks__reasons">
                  <li>
                    {row.winRate !== null
                      ? t("ARAM: {rate} kazanma, {games} maç", { rate: formatPercent(row.winRate, lang, 1), games: row.games })
                      : t("ARAM: yeterli maç yok ({games} maç)", { games: row.games })}
                  </li>
                  {row.take && <li data-kind="counter">{t("Sıradan bunu al")}</li>}
                </ul>
              </div>
            </li>
          );
        })}
      </ol>
    </>
  );
}
