import { getProMeta, type ProGroup } from "../api";
import { championIconUrl, champions, latestVersion } from "../data/ddragon";
import { useT } from "../i18n";
import { META_MIN_GAMES, metaRows } from "../proMeta";
import { useAsync } from "../useAsync";

type Props = { group: ProGroup; patch?: string; position: string | null; onOpenChampion: (championId: number, position: string | null) => void };

/** Most picked champions in pro games with their win rate; every number carries its game count. */
export function ProMeta({ group, patch, position, onOpenChampion }: Props) {
  const t = useT();
  const [meta] = useAsync(`pro-meta:${group}:${patch ?? ""}`, () => getProMeta(group, patch));
  const [data] = useAsync("pro-meta-static", async () => ({ version: await latestVersion(), champions: await champions() }));

  if (meta.status !== "done" || data.status !== "done") return <p className="build__note">{t("Pro maçları yükleniyor")}</p>;
  const rows = metaRows(meta.value, position).slice(0, 25);
  if (rows.length === 0) return <p className="build__note">{t("Bu filtrelerle pro maçı yok. Bir filtreyi kaldır ya da başka bir grup seç.")}</p>;

  return (
    <>
      <p className="build__note">{t("Seçilme oranı pro maçlarına göre; yasaklar kaydedilmiyor. {min} maçın altındaki kazanma oranları soluk.", { min: META_MIN_GAMES })}</p>
      <ul className="pro-meta">
        {rows.map((row) => {
          const champion = data.value.champions.get(row.championId);
          const low = row.games < META_MIN_GAMES;
          return (
            <li key={row.championId}>
              <button type="button" className="pro-meta__row" onClick={() => onOpenChampion(row.championId, position)}>
                {champion && <img src={championIconUrl(data.value.version, champion.id)} alt="" width={30} height={30} />}
                <span className="pro-meta__name">{champion?.name ?? row.championId}</span>
                <span className="build__stat">{t("%{share} seçilme, {games} maç", { share: Math.round(row.share * 100), games: row.games })}</span>
                <span className="pro-meta__rate" data-low={low || undefined}>
                  {t("%{rate} kazanma, {games} maç", { rate: Math.round((row.wins / row.games) * 100), games: row.games })}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}
