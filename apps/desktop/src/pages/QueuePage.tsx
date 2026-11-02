import { useEffect, useState } from "react";
import { getChampion, getGameLog, getLpHistory, getProfile, type GameRow } from "../api";
import { championIconUrl, champions, latestVersion, type Champion } from "../data/ddragon";
import { GoalsTile, RankTile, SessionTile } from "../Dashboard";
import { byChampion, lpSince, startOfDay, startOfWeek } from "../games";
import { formatPercent, useLang, useT } from "../i18n";
import { POSITIONS } from "../labels";
import type { Platform, Summoner } from "../lcu";
import { clock } from "../overlay/live";
import { championNoteKey, usePersonal, type PoolPick } from "../personal";
import { useAsync } from "../useAsync";

const GUIDES = 4;

async function load(summoner: Summoner, platform: Platform) {
  const [profile, version, byKey] = await Promise.all([getProfile(summoner.gameName, summoner.tagLine, platform), latestVersion(), champions()]);
  return { profile, version, champions: byKey };
}

function useElapsed(since: number) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  return (now - since) / 1000;
}

type Props = {
  summoner: Summoner;
  platform: Platform;
  /** When matchmaking started, for the queue clock. */
  since: number;
  onOpenChampion: (championId: number, position: string | null) => void;
};

/** While the player waits in queue: their form, goals and quick guides for the champions they are likely to play. */
export function QueuePage({ summoner, platform, since, onOpenChampion }: Props) {
  const t = useT();
  const elapsed = useElapsed(since);
  const [state] = useAsync(`queue:${platform}:${summoner.puuid}`, () => load(summoner, platform));
  const [log] = useAsync(`log:${summoner.puuid}`, () => getGameLog(summoner.puuid));
  const [lp] = useAsync(`lp:${summoner.puuid}`, () => getLpHistory(summoner.puuid));
  const games = log.status === "done" ? log.value : null;
  const snapshots = lp.status === "done" ? lp.value : [];

  return (
    <div className="queue">
      <header className="queue__head enter">
        <h1 className="draft__title">{t("Maç aranıyor")}</h1>
        <span className="queue__clock" aria-label={t("Sırada geçen süre")}>
          {clock(elapsed)}
        </span>
      </header>
      {state.status === "done" ? (
        <>
          <RankTile profile={state.value.profile} version={state.value.version} lpToday={lpSince(snapshots, startOfDay())} lpWeek={lpSince(snapshots, startOfWeek())} />
          <SessionTile games={games} />
          <GoalsTile games={games} puuid={summoner.puuid} />
          <Guides games={games} version={state.value.version} champions={state.value.champions} onOpenChampion={onOpenChampion} />
        </>
      ) : (
        <p className="tile__meta">{state.status === "error" ? t("Profil alınamadı. Vizier sunucusuna şu an ulaşılamıyor.") : t("Yükleniyor")}</p>
      )}
    </div>
  );
}

function Guides({
  games,
  version,
  champions,
  onOpenChampion,
}: {
  games: GameRow[] | null;
  version: string;
  champions: Map<number, Champion>;
  onOpenChampion: (championId: number, position: string | null) => void;
}) {
  const t = useT();
  const { pool } = usePersonal();
  const mine = games ? byChampion(games) : [];
  // The player's own pool first, then what they played most lately.
  const picks: PoolPick[] = [...pool];
  for (const line of mine) {
    if (picks.length >= GUIDES) break;
    if (!picks.some((p) => p.championId === line.championId)) {
      const position = games!.find((g) => g.championId === line.championId)?.position || null;
      picks.push({ championId: line.championId, position });
    }
  }
  return (
    <section className="tile tile--guides" aria-label={t("Şampiyon rehberlerin")}>
      <h2 className="tile__title">{t("Oynayacağın şampiyonlar")}</h2>
      {picks.length === 0 ? (
        <p className="tile__meta">{t("Havuzuna şampiyon ekle ya da birkaç dereceli maç oyna; rehberleri burada hazır olur.")}</p>
      ) : (
        <ul className="guides">
          {picks.slice(0, GUIDES + pool.length).map((p) => (
            <Guide
              key={p.championId}
              pick={p}
              champion={champions.get(p.championId)}
              version={version}
              line={mine.find((l) => l.championId === p.championId)}
              onOpen={() => onOpenChampion(p.championId, p.position)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function Guide({
  pick,
  champion,
  version,
  line,
  onOpen,
}: {
  pick: PoolPick;
  champion: Champion | undefined;
  version: string;
  line: ReturnType<typeof byChampion>[number] | undefined;
  onOpen: () => void;
}) {
  const t = useT();
  const lang = useLang();
  const { notes } = usePersonal();
  const [overview] = useAsync(`ally:${pick.championId}:${pick.position}`, () => getChampion(pick.championId, pick.position));
  const note = notes[championNoteKey(pick.championId)];
  const stats = overview.status === "done" ? overview.value : null;
  return (
    <li>
      <div className="guides__head">
        {champion && <img src={championIconUrl(version, champion.id)} alt="" width={40} height={40} />}
        <div>
          <p className="abilities__name">{champion?.name ?? pick.championId}</p>
          <p className="tile__meta">
            {stats
              ? [t(POSITIONS[stats.position ?? ""] ?? ""), stats.tier && `${stats.tier} tier`, t("Emerald+ {rate} kazanma", { rate: formatPercent(stats.winRate, lang, 1) })]
                  .filter(Boolean)
                  .join(", ")
              : "–"}
          </p>
        </div>
      </div>
      <p className="tile__meta">
        {line
          ? t("Senin: {games} maç, {rate} kazanma, {kda} KDA", { games: line.games, rate: formatPercent(line.wins / line.games, lang), kda: line.kda.toFixed(1) })
          : t("Son maçlarında oynamadın.")}
      </p>
      {note && <p className="guides__note">{note}</p>}
      <button type="button" className="button button--small" onClick={onOpen}>
        {t("Rehberi aç")}
      </button>
    </li>
  );
}
