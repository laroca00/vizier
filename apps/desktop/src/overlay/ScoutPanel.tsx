import { useEffect, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { getScout, type ScoutPlayer } from "../api";
import { scoutingFixture } from "../dev/fixtures";
import { champions as loadChampions, championIconUrl, latestVersion } from "../data/ddragon";
import { formatPercent, useLang, useT } from "../i18n";
import type { LcuStatus } from "../lcu";
import { useAsync } from "../useAsync";
import { platformOf, rankGames, scoutSides, scoutTags, type RosterPlayer, type ScoutRow, type ScoutTag } from "./scouting";
import "./ScoutPanel.css";

const TAG_TEXT: Record<ScoutTag, string> = { main: "Ana şampiyonu", firstTime: "İlk kez oynuyor", winStreak: "Galibiyet serisinde" };

type Loaded = { roster: RosterPlayer[]; mine: 1 | 2; platform: string | null };

/** Dev only: `?fixture=scouting` shows the panel with made-up players. */
const sample = (): { loaded: Loaded; scouted: ScoutPlayer[] } => {
  const roster = Array.from({ length: 10 }, (_, i) => ({ puuid: `sample-${i}`, championId: [103, 64, 238, 22, 412, 1, 11, 157, 51, 89][i], position: "", team: (i < 5 ? 1 : 2) as 1 | 2 }));
  return {
    loaded: { roster, mine: 1, platform: "tr1" },
    scouted: roster.map((p, i) => ({
      puuid: p.puuid,
      championId: p.championId,
      rank: i % 4 === 3 ? null : { tier: "EMERALD", division: "II", lp: 40 + i, wins: 60 + i, losses: 50, winStreak: i === 2 },
      mastery: i % 3 === 0 ? null : { level: 7, points: i === 4 ? 210000 : 30000 + i * 1000 },
    })),
  };
};

/** Polls the client until the loading screen's players are known. */
function useRoster(): Loaded | null {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  useEffect(() => {
    if (!isTauri()) return;
    let active = true;
    let tries = 0;
    const load = async () => {
      try {
        const [roster, status] = await Promise.all([invoke<RosterPlayer[]>("game_roster"), invoke<LcuStatus>("lcu_status")]);
        if (!active) return;
        if (roster.length > 0 && status.state === "connected") {
          const me = roster.find((p) => p.puuid === status.summoner?.puuid);
          setLoaded({ roster, mine: me?.team ?? 1, platform: platformOf(status.region?.region) });
          return;
        }
      } catch {
        // The client may not answer yet.
      }
      if (active && ++tries < 15) setTimeout(load, 2000);
    };
    void load();
    return () => {
      active = false;
    };
  }, []);
  return loaded;
}

/** The loading screen: both teams with rank and mastery, and each side's damage split. */
export function ScoutPanel() {
  const t = useT();
  const live = useRoster();
  const made = scoutingFixture() ? sample() : null;
  const loaded = made?.loaded ?? live;
  const [data] = useAsync("scout-static", async () => ({ version: await latestVersion(), champions: await loadChampions() }));
  // Without a key on the Worker the answer is 503 and only the damage split shows.
  const [scouted] = useAsync(loaded?.platform && !made ? `scout:${loaded.roster.map((p) => p.puuid).join()}` : null, () =>
    getScout(loaded!.platform!, loaded!.roster.map((p) => ({ puuid: p.puuid, championId: p.championId }))).then((r) => r.players),
  );
  if (!loaded || data.status !== "done") return null;
  const lookups = made?.scouted ?? (scouted.status === "done" ? scouted.value : []);
  const sides = scoutSides(loaded.roster, loaded.mine, data.value.champions, lookups);
  const available = lookups.length > 0;

  return (
    <div className="scout" role="region" aria-label={t("Yükleme ekranı")}>
      <Side title={t("Takımın")} rows={sides.ours} damage={sides.ourDamage} version={data.value.version} available={available} />
      <Side title={t("Rakipler")} rows={sides.theirs} damage={sides.theirDamage} version={data.value.version} available={available} />
      {!available && loaded.platform && scouted.status === "error" && <p className="scout__note">{t("Oyuncu bilgisi şu an alınamıyor; yalnızca hasar dağılımı gösteriliyor.")}</p>}
    </div>
  );
}

function Side({ title, rows, damage, version, available }: { title: string; rows: ScoutRow[]; damage: { ap: number; ad: number; true: number }; version: string; available: boolean }) {
  const t = useT();
  const lang = useLang();
  return (
    <section className="overlay__card scout__side">
      <h2 className="overlay__caption">{title}</h2>
      <div className="scout__damage" role="img" aria-label={t("Hasar dağılımı: büyü {ap}, fiziksel {ad}, gerçek {true}", { ap: formatPercent(damage.ap, lang), ad: formatPercent(damage.ad, lang), true: formatPercent(damage.true, lang) })}>
        <span style={{ flex: damage.ad }} data-kind="ad" />
        <span style={{ flex: damage.ap }} data-kind="ap" />
        <span style={{ flex: damage.true }} data-kind="true" />
      </div>
      <p className="scout__legend">
        {t("Fiziksel {ad} · Büyü {ap} · Gerçek {true}", { ad: formatPercent(damage.ad, lang), ap: formatPercent(damage.ap, lang), true: formatPercent(damage.true, lang) })}
      </p>
      <ol className="scout__rows">
        {rows.map(({ player, champion, scout }) => (
          <li key={player.puuid}>
            {champion && <img src={championIconUrl(version, champion.id)} alt="" width={28} height={28} />}
            <span className="scout__text">
              <span>{champion?.name}</span>
              {available && <Facts scout={scout} />}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Facts({ scout }: { scout: ScoutPlayer | null }) {
  const t = useT();
  const lang = useLang();
  if (!scout) return <span className="scout__fact">{t("Bilgi yok")}</span>;
  const { rank, mastery } = scout;
  return (
    <>
      <span className="scout__fact">
        {rank
          ? t("{tier} {division}, {lp} LP, {rate} kazanma, {games} maç", {
              tier: rank.tier.charAt(0) + rank.tier.slice(1).toLowerCase(),
              division: rank.division,
              lp: rank.lp,
              rate: formatPercent(rank.wins / rankGames(rank), lang),
              games: rankGames(rank),
            })
          : t("Derecesiz")}
      </span>
      <span className="scout__fact">{mastery ? t("Ustalık {level}, {points} puan", { level: mastery.level, points: mastery.points.toLocaleString(lang === "tr" ? "tr-TR" : "en-US") }) : t("Ustalık yok")}</span>
      {scoutTags(scout).map((tag) => (
        <span key={tag} className="scout__tag">
          {t(TAG_TEXT[tag])}
        </span>
      ))}
    </>
  );
}
