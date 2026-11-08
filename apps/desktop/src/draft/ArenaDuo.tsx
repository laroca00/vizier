import { getArenaDuos } from "../api";
import { championIconUrl, type Champion } from "../data/ddragon";
import { formatPercent, useLang, useT } from "../i18n";
import { useAsync } from "../useAsync";
import { duoPicks } from "./arena";

type Props = {
  /** The champion to find partners for: the teammate's, or the player's own while the teammate hasn't chosen. */
  anchor: number;
  partner: boolean;
  taken: Set<number>;
  pool: Set<number>;
  champions: Map<number, Champion>;
  version: string;
};

/** Arena: champions that finish top four most often next to the duo partner. */
export function ArenaDuo({ anchor, partner, taken, pool, champions, version }: Props) {
  const t = useT();
  const lang = useLang();
  const [duos] = useAsync(`arena-duos:${anchor}`, () => getArenaDuos(anchor));
  const anchorName = champions.get(anchor)?.name ?? "";
  if (duos.status !== "done") return null;
  const picks = duoPicks(duos.value, taken, pool);
  return (
    <>
      <h2 className="draft__heading">{partner ? t("{champion} ile eşleşenler", { champion: anchorName }) : t("{champion} için en iyi eş", { champion: anchorName })}</h2>
      {picks.length === 0 ? (
        <p className="build__note">{t("Bu ikili için henüz yeterli Arena maçı yok.")}</p>
      ) : (
        <ol className="picks">
          {picks.map((pick) => {
            const champion = champions.get(pick.championId);
            if (!champion) return null;
            return (
              <li key={pick.championId} className="picks__row">
                <img src={championIconUrl(version, champion.id)} alt="" width={40} height={40} />
                <div className="picks__body">
                  <p className="picks__name">
                    {champion.name} {pick.inPool && <span className="picks__pool">· {t("Havuzunda")}</span>}
                  </p>
                  <ul className="picks__reasons">
                    <li>{t("Birlikte {rate} ilk 4, {games} maç", { rate: formatPercent(pick.winRate, lang, 1), games: pick.games })}</li>
                  </ul>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </>
  );
}
