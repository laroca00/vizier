import { getGoldGraph, getMatch, type Match, type MatchParticipant } from "./api";
import { championIconUrl, champions, itemIconUrl, latestVersion, type Champion } from "./data/ddragon";
import { GoldChart } from "./GoldChart";
import { ReportCard } from "./ReportCard";
import { positionLabel } from "./labels";
import { LiquidGlass } from "./ui/LiquidGlass";
import { useAsync } from "./useAsync";

type Props = { matchId: string; puuid: string; onClose: () => void; onCoach: () => void };

type Loaded = { match: Match; diff: number[] | null; version: string; champions: Map<number, Champion> };

const ITEM_SLOTS = ["item0", "item1", "item2", "item3", "item4", "item5", "item6"] as const;
const POSITION_ORDER = ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"];
const format = new Intl.NumberFormat("tr");

async function load(matchId: string, puuid: string): Promise<Loaded> {
  const [match, version, championList, graph] = await Promise.all([
    getMatch(matchId),
    latestVersion(),
    champions(),
    getGoldGraph(matchId).catch(() => null),
  ]);
  const myTeam = match.info.participants.find((p) => p.puuid === puuid)?.teamId ?? 100;
  // The graph is blue minus red; flip it so positive always means the player's team.
  const diff = graph ? graph.goldDiff.map((v) => (myTeam === 100 ? v : -v)) : null;
  return { match, diff, version, champions: championList };
}

export function MatchDetail({ matchId, puuid, onClose, onCoach }: Props) {
  const [state, retry] = useAsync(`${matchId}:${puuid}`, () => load(matchId, puuid));

  return (
    <LiquidGlass className="panel detail" radius={28} strength={2.5}>
      <header className="coach__header">
        <h2 className="coach__title">Maç detayı</h2>
        <div className="detail__actions">
          <button type="button" className="button" onClick={onCoach}>
            Analiz et
          </button>
          <button type="button" className="button" onClick={onClose}>
            Geri
          </button>
        </div>
      </header>
      {state.status === "done" ? (
        <DetailBody {...state.value} puuid={puuid} />
      ) : state.status === "error" ? (
        <div role="alert">
          <p className="coach__note">Maç yüklenemedi.</p>
          <button type="button" className="button" onClick={retry}>
            Tekrar dene
          </button>
        </div>
      ) : (
        <p className="coach__note">Maç yükleniyor</p>
      )}
    </LiquidGlass>
  );
}

function DetailBody({ match, diff, version, champions, puuid }: Loaded & { puuid: string }) {
  const minutes = Math.round(match.info.gameDuration / 60);
  const me = match.info.participants.find((p) => p.puuid === puuid);
  const teams = [100, 200].map((teamId) =>
    match.info.participants
      .filter((p) => p.teamId === teamId)
      .sort((a, b) => POSITION_ORDER.indexOf(a.teamPosition) - POSITION_ORDER.indexOf(b.teamPosition)),
  );
  // List the player's team first.
  if (me && me.teamId === 200) teams.reverse();

  return (
    <>
      <p className="detail__meta">
        {me ? (me.win ? "Galibiyet" : "Mağlubiyet") : ""}, {minutes} dakika
      </p>
      <ReportCard matchId={match.metadata.matchId} puuid={puuid} />
      {diff && <GoldChart diff={diff} />}
      {teams.map((team, i) => (
        <section key={i} aria-label={i === 0 ? "Takımın" : "Rakip takım"}>
          <h3 className="profile__heading">
            {i === 0 ? "Takımın" : "Rakip takım"}, {team[0]?.win ? "kazandı" : "kaybetti"}
          </h3>
          <ul className="roster">
            {team.map((p) => (
              <PlayerRow key={p.puuid} p={p} version={version} champion={champions.get(p.championId)} minutes={minutes} isMe={p.puuid === puuid} />
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}

function PlayerRow({ p, version, champion, minutes, isMe }: { p: MatchParticipant; version: string; champion?: Champion; minutes: number; isMe: boolean }) {
  const cs = p.totalMinionsKilled + p.neutralMinionsKilled;
  return (
    <li data-me={isMe || undefined}>
      {champion && <img src={championIconUrl(version, champion.id)} alt="" width={28} height={28} className="roster__icon" />}
      <span className="roster__name">
        <span>{p.riotIdGameName ?? champion?.name ?? ""}</span>
        <span className="roster__sub">
          {champion?.name}, {positionLabel(p.teamPosition) ?? ""}
        </span>
      </span>
      <span className="roster__kda">
        {p.kills}/{p.deaths}/{p.assists}
      </span>
      <span className="roster__sub roster__cs">
        {cs} minyon ({(cs / minutes).toFixed(1)}/dk), {format.format(p.goldEarned)} altın
      </span>
      <span className="roster__items">
        {ITEM_SLOTS.map((slot) =>
          p[slot] ? <img key={slot} src={itemIconUrl(version, p[slot])} alt="" width={20} height={20} /> : <span key={slot} className="roster__slot" />,
        )}
      </span>
    </li>
  );
}
