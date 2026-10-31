import { useEffect, useState } from "react";
import { getLiveGame, type LiveGameInfo, type LivePlayer } from "../api";
import { championIconUrl, champions, latestVersion, type Champion } from "../data/ddragon";
import { useLang, useT } from "../i18n";
import { tierLabel } from "../labels";
import type { Platform } from "../lcu";

// Riot lists the game a little after the loading screen appears.
const RETRY_MS = 4000;

function useLiveGameInfo(player: { puuid: string; platform: Platform } | null, fixture: LiveGameInfo | null) {
  const [info, setInfo] = useState<LiveGameInfo | null>(fixture);
  useEffect(() => {
    if (!player || fixture) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const attempt = async () => {
      const result = await getLiveGame(player.puuid, player.platform).catch(() => null);
      if (stopped) return;
      if (result) setInfo(result);
      else timer = setTimeout(attempt, RETRY_MS);
    };
    attempt();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [player?.puuid, player?.platform, fixture]);
  return info;
}

const thousands = (n: number) => (n >= 1000 ? `${Math.round(n / 1000)}k` : String(n));

export function Scouting({ player, fixture }: { player: { puuid: string; platform: Platform } | null; fixture: LiveGameInfo | null }) {
  const t = useT();
  const info = useLiveGameInfo(player, fixture);
  const [data, setData] = useState<{ version: string; champions: Map<number, Champion> } | null>(null);
  useEffect(() => {
    Promise.all([latestVersion(), champions()]).then(([version, byKey]) => setData({ version, champions: byKey }), () => {});
  }, []);
  if (!info || !data) return null;

  const myTeam = info.players.find((p) => p.you)?.teamId;
  // The enemy team comes first: they are who the player knows least about.
  const teams = [...new Set(info.players.map((p) => p.teamId))].sort((a, b) => Number(a === myTeam) - Number(b === myTeam));

  return (
    <section className="overlay__card scouting">
      {teams.map((team) => (
        <div key={team} className="scouting__team">
          <p className="overlay__caption">{team === myTeam ? t("Takımın") : t("Rakip takım")}</p>
          <ul className="scouting__list">
            {info.players
              .filter((p) => p.teamId === team)
              .map((p, i) => (
                <PlayerRow key={`${p.riotId}-${i}`} player={p} champion={data.champions.get(p.championId)} version={data.version} />
              ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

function PlayerRow({ player, champion, version }: { player: LivePlayer; champion: Champion | undefined; version: string }) {
  const t = useT();
  const lang = useLang();
  const name = player.riotId?.split("#")[0] ?? "Bot";
  const solo = player.solo;
  const games = solo ? solo.wins + solo.losses : 0;
  return (
    <li className="scouting__player">
      {champion ? <img src={championIconUrl(version, champion.id)} alt="" width={30} height={30} /> : <span className="scouting__blank" />}
      <span className="scouting__who">
        <span className="scouting__name">{name}</span>
        <span className="scouting__rank">
          {solo
            ? t("{rank}, %{rate} / {games} maç", { rank: tierLabel(solo.tier, solo.rank, lang), rate: Math.round((solo.wins / Math.max(1, games)) * 100), games })
            : t("Bu sezon derecesiz")}
        </span>
      </span>
      <span className="scouting__mastery">{player.mastery ? t("{points} ustalık", { points: thousands(player.mastery.points) }) : t("İlk maçı")}</span>
    </li>
  );
}
