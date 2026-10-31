import { getProfile, getRecentMatches, type Match, type Profile } from "./api";
import { championIconUrl, champions, latestVersion, profileIconUrl, type Champion } from "./data/ddragon";
import { queueLabel, tierLabel, timeAgo } from "./labels";
import type { Summoner } from "./lcu";
import { LiquidGlass } from "./ui/LiquidGlass";
import { useAsync } from "./useAsync";

const RECENT_MATCHES = 5;

type Loaded = {
  profile: Profile;
  matches: Match[];
  version: string;
  champions: Map<number, Champion>;
};

async function load(summoner: Summoner): Promise<Loaded> {
  const [profile, version, championList] = await Promise.all([
    getProfile(summoner.gameName, summoner.tagLine),
    latestVersion(),
    champions(),
  ]);
  const matches = await getRecentMatches(profile.account.puuid, RECENT_MATCHES);
  return { profile, matches, version, champions: championList };
}

export type CoachTarget = {
  matchId: string;
  puuid: string;
  championName: string;
  /** Opened right after a game, before Riot may have published the match. */
  justFinished?: boolean;
};

export function ProfileCard({ summoner, onCoach }: { summoner: Summoner; onCoach: (target: CoachTarget) => void }) {
  const [state, retry] = useAsync(`${summoner.gameName}#${summoner.tagLine}`, () => load(summoner));

  return (
    <LiquidGlass className="panel profile" radius={28} strength={2.5}>
      {state.status === "done" ? (
        <ProfileBody {...state.value} onCoach={onCoach} />
      ) : state.status === "error" ? (
        <div className="profile__message" role="alert">
          <p>Profil alınamadı. Vizier sunucusuna şu an ulaşılamıyor.</p>
          <button type="button" className="button" onClick={retry}>
            Tekrar dene
          </button>
        </div>
      ) : (
        <p className="profile__message" aria-live="polite">
          Profil yükleniyor
        </p>
      )}
    </LiquidGlass>
  );
}

function ProfileBody({ profile, matches, version, champions, onCoach }: Loaded & { onCoach: (target: CoachTarget) => void }) {
  const { account, summoner, ranks } = profile;
  const puuid = account.puuid;

  return (
    <>
      <header className="profile__header">
        {summoner && (
          <img className="profile__icon" src={profileIconUrl(version, summoner.profileIconId)} alt="" width={56} height={56} />
        )}
        <div>
          <h2 className="profile__name">
            {account.gameName}
            <span className="profile__tag">#{account.tagLine}</span>
          </h2>
          {summoner && <p className="profile__level">Seviye {summoner.summonerLevel}</p>}
        </div>
      </header>

      <section aria-label="Dereceler">
        {ranks.length === 0 ? (
          <p className="profile__empty">Bu sezon dereceli maç yok.</p>
        ) : (
          <ul className="ranks">
            {ranks.map((r) => (
              <li key={r.queueType}>
                <span className="ranks__queue">{queueLabel(r.queueType)}</span>
                <span className="ranks__tier">
                  {tierLabel(r.tier, r.rank)}, {r.leaguePoints} LP
                </span>
                <span className="ranks__record">
                  {r.wins} galibiyet, {r.losses} mağlubiyet
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Son maçlar">
        <h3 className="profile__heading">Son maçlar</h3>
        {matches.length === 0 ? (
          <p className="profile__empty">Henüz maç yok. Oynadığın maçlar burada görünecek.</p>
        ) : (
          <ul className="matches">
            {matches.map((match) => {
              const me = match.info.participants.find((p) => p.puuid === puuid);
              if (!me) return null;
              const champion = champions.get(me.championId);
              return (
                <li key={match.metadata.matchId} data-result={me.win ? "win" : "loss"}>
                  {champion && (
                    <img src={championIconUrl(version, champion.id)} alt="" width={32} height={32} className="matches__icon" />
                  )}
                  <span className="matches__champion">{champion?.name ?? "Bilinmeyen şampiyon"}</span>
                  <span className="matches__result">{me.win ? "Galibiyet" : "Mağlubiyet"}</span>
                  <span className="matches__kda">
                    {me.kills}/{me.deaths}/{me.assists}
                  </span>
                  <span className="matches__when">{timeAgo(match.info.gameEndTimestamp)}</span>
                  <button
                    type="button"
                    className="matches__coach"
                    onClick={() =>
                      onCoach({ matchId: match.metadata.matchId, puuid, championName: champion?.name ?? "Bilinmeyen şampiyon" })
                    }
                  >
                    Analiz et
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
