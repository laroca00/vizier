import { getProfile, getRecentMatches, getTrends, type Match, type Profile } from "./api";
import { championIconUrl, champions, latestVersion, profileIconUrl, type Champion } from "./data/ddragon";
import { useLang, useT } from "./i18n";
import { ChampionPool, LpHistory } from "./ProfileExtras";
import { queueLabel, tierLabel, timeAgo } from "./labels";
import type { Platform, Summoner } from "./lcu";
import { LiquidGlass } from "./ui/LiquidGlass";
import { useAsync } from "./useAsync";

const RECENT_MATCHES = 5;

type Loaded = {
  profile: Profile;
  matches: Match[];
  version: string;
  champions: Map<number, Champion>;
};

async function load(summoner: Summoner, platform: Platform): Promise<Loaded> {
  const [profile, version, championList] = await Promise.all([
    getProfile(summoner.gameName, summoner.tagLine, platform),
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

type ProfileProps = { summoner: Summoner; platform: Platform; onCoach: (target: CoachTarget) => void; onOpenMatch: (matchId: string, puuid: string) => void };

export function ProfileCard({ summoner, platform, onCoach, onOpenMatch }: ProfileProps) {
  const t = useT();
  const [state, retry] = useAsync(`${platform}:${summoner.gameName}#${summoner.tagLine}`, () => load(summoner, platform));

  return (
    <LiquidGlass className="panel profile" radius={28} strength={2.5}>
      {state.status === "done" ? (
        <ProfileBody {...state.value} onCoach={onCoach} onOpenMatch={onOpenMatch} />
      ) : state.status === "error" ? (
        <div className="profile__message" role="alert">
          <p>{t("Profil alınamadı. Vizier sunucusuna şu an ulaşılamıyor.")}</p>
          <button type="button" className="button" onClick={retry}>
            {t("Tekrar dene")}
          </button>
        </div>
      ) : (
        <p className="profile__message" aria-live="polite">
          {t("Profil yükleniyor")}
        </p>
      )}
    </LiquidGlass>
  );
}

function Habits({ puuid }: { puuid: string }) {
  const t = useT();
  const [state] = useAsync(puuid, () => getTrends(puuid));
  if (state.status !== "done" || state.value.games === 0) return null;
  const { games, wins, habits } = state.value;
  return (
    <section aria-label={t("Alışkanlıklar")}>
      <h3 className="profile__heading">{t("Son {games} dereceli maç", { games })}</h3>
      <p className="profile__empty">
        {t("{wins} galibiyet, {losses} mağlubiyet.", { wins, losses: games - wins })}
        {habits.length === 0 ? ` ${t("Emerald+ oyuncularına göre belirgin bir zayıf alışkanlık görünmüyor.")}` : ""}
      </p>
      {habits.length > 0 && (
        <ul className="habits">
          {habits.map((h) => (
            <li key={h.title}>
              <p className="coach__point-title">{h.title}</p>
              <p className="coach__point-detail">{h.detail}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ProfileBody({ profile, matches, version, champions, onCoach, onOpenMatch }: Loaded & Omit<ProfileProps, "summoner" | "platform">) {
  const t = useT();
  const lang = useLang();
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
          <p className="profile__empty">{t("Bu sezon dereceli maç yok.")}</p>
        ) : (
          <ul className="ranks">
            {ranks.map((r) => (
              <li key={r.queueType}>
                <span className="ranks__queue">{queueLabel(r.queueType, lang)}</span>
                <span className="ranks__tier">
                  {tierLabel(r.tier, r.rank, lang)}, {r.leaguePoints} LP
                </span>
                <span className="ranks__record">
                  {t("{wins} galibiyet, {losses} mağlubiyet", { wins: r.wins, losses: r.losses })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <LpHistory puuid={puuid} />
      <ChampionPool puuid={puuid} version={version} champions={champions} />
      <Habits puuid={puuid} />

      <section aria-label={t("Son maçlar")}>
        <h3 className="profile__heading">{t("Son maçlar")}</h3>
        {matches.length === 0 ? (
          <p className="profile__empty">{t("Henüz maç yok. Oynadığın maçlar burada görünecek.")}</p>
        ) : (
          <ul className="matches">
            {matches.map((match) => {
              const me = match.info.participants.find((p) => p.puuid === puuid);
              if (!me) return null;
              const champion = champions.get(me.championId);
              return (
                <li key={match.metadata.matchId} data-result={me.win ? "win" : "loss"}>
                  <button
                    type="button"
                    className="matches__open"
                    aria-label={t("{champion} maçının detayını aç", { champion: champion?.name ?? t("Maç") })}
                    onClick={() => onOpenMatch(match.metadata.matchId, puuid)}
                  />
                  {champion && (
                    <img src={championIconUrl(version, champion.id)} alt="" width={32} height={32} className="matches__icon" />
                  )}
                  <span className="matches__champion">{champion?.name ?? t("Bilinmeyen şampiyon")}</span>
                  <span className="matches__result">{me.win ? t("Galibiyet") : t("Mağlubiyet")}</span>
                  <span className="matches__kda">
                    {me.kills}/{me.deaths}/{me.assists}
                  </span>
                  <span className="matches__when">{timeAgo(match.info.gameEndTimestamp, lang)}</span>
                  <button
                    type="button"
                    className="matches__coach"
                    onClick={() =>
                      onCoach({ matchId: match.metadata.matchId, puuid, championName: champion?.name ?? t("Bilinmeyen şampiyon") })
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
