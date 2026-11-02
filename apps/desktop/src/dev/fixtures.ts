import type { ChampSelect, LcuStatus } from "../lcu";
import { sampleGame } from "../overlay/sample";
import type { GameRow, LiveGameInfo } from "../api";
import type { LiveGame } from "../overlay/live";

/** Dev only: `?fixture=champ-select` renders the draft page without a client. */
export function champSelectFixture(): ChampSelect | null {
  if (!import.meta.env.DEV || new URLSearchParams(location.search).get("fixture") !== "champ-select") return null;
  return {
    myTeam: [
      { cellId: 0, championId: 266, pickIntent: 0, position: "top", spells: [4, 12], isLocal: false },
      { cellId: 1, championId: 64, pickIntent: 0, position: "jungle", spells: [11, 4], isLocal: false },
      { cellId: 2, championId: 0, pickIntent: 84, position: "middle", spells: [4, 14], isLocal: true },
      { cellId: 3, championId: 0, pickIntent: 0, position: "bottom", spells: [4, 7], isLocal: false },
      { cellId: 4, championId: 0, pickIntent: 0, position: "utility", spells: [4, 3], isLocal: false },
    ],
    theirTeam: [
      { cellId: 5, championId: 122, pickIntent: 0, position: "", spells: [0, 0], isLocal: false },
      { cellId: 6, championId: 0, pickIntent: 0, position: "", spells: [0, 0], isLocal: false },
      { cellId: 7, championId: 0, pickIntent: 0, position: "", spells: [0, 0], isLocal: false },
      { cellId: 8, championId: 0, pickIntent: 0, position: "", spells: [0, 0], isLocal: false },
      { cellId: 9, championId: 0, pickIntent: 0, position: "", spells: [0, 0], isLocal: false },
    ],
    bans: [238, 157, 555, 84],
    phase: "BAN_PICK",
    phaseEndsAt: Date.now() + 27_000,
  };
}

/** Dev only: `?fixture=match` opens a stored TR Challenger game on the home page. */
export function matchFixture(): { matchId: string; puuid: string } | null {
  if (!import.meta.env.DEV || new URLSearchParams(location.search).get("fixture") !== "match") return null;
  return {
    matchId: "TR1_1755261501",
    puuid: import.meta.env.VITE_FIXTURE_PUUID ?? "",
  };
}

/** Dev only: `?fixture=overlay` renders the in-game overlay mid-game without the game. */
export function overlayFixture(): LiveGame | null {
  if (!import.meta.env.DEV || new URLSearchParams(location.search).get("fixture") !== "overlay") return null;
  return sampleGame();
}

/** Dev only: `?fixture=scouting` renders the loading screen panel. */
export function scoutingFixture(): LiveGameInfo | null {
  if (!import.meta.env.DEV || new URLSearchParams(location.search).get("fixture") !== "scouting") return null;
  const solo = (tier: string, rank: string, wins: number, losses: number) => ({ tier, rank, leaguePoints: 40, wins, losses });
  const mastery = (points: number) => ({ level: 10, points, lastPlayTime: 0 });
  return {
    gameId: 1,
    queueId: 420,
    players: [
      { riotId: "Vizier#TR1", championId: 103, teamId: 100, you: true, solo: solo("EMERALD", "II", 61, 52), mastery: mastery(184_000) },
      { riotId: "Orman Kedisi#TR1", championId: 64, teamId: 100, you: false, solo: solo("EMERALD", "I", 40, 41), mastery: mastery(52_000) },
      { riotId: "Uzun Bir Oyuncu Adı#TR1", championId: 266, teamId: 100, you: false, solo: null, mastery: null },
      { riotId: "Rakip Orta#TR1", championId: 238, teamId: 200, you: false, solo: solo("DIAMOND", "IV", 88, 70), mastery: mastery(612_000) },
      { riotId: "Destek#TR1", championId: 412, teamId: 200, you: false, solo: solo("PLATINUM", "I", 12, 9), mastery: mastery(9_400) },
    ],
  };
}

/** Dev only: `?fixture=dashboard` or `?fixture=queue` show a connected player without a client or the API. */
export function lcuFixture(): LcuStatus | null {
  const fixture = import.meta.env.DEV ? new URLSearchParams(location.search).get("fixture") : null;
  if (fixture !== "dashboard" && fixture !== "queue") return null;
  return {
    state: "connected",
    summoner: { gameName: "Vizier", tagLine: "TR1", puuid: "p".repeat(78) },
    phase: fixture === "queue" ? "Matchmaking" : "Lobby",
    lastGameId: 1,
    region: { region: "TR", locale: "tr_TR" },
  };
}

const HOUR = 3_600_000;

function sampleRows(): GameRow[] {
  const champs = [103, 103, 238, 84, 103, 134, 238, 103, 84, 7, 103, 238, 134, 103, 84, 103, 238, 7, 103, 134];
  const wins = [false, false, false, true, true, true, false, true, true, false, true, true, false, true, false, true, true, true, false, true];
  return champs.map((championId, i) => ({
    matchId: `TR1_${100 + i}`,
    at: Date.now() - (i * 0.7 + 0.3) * HOUR - (i > 5 ? 20 * HOUR : 0) - (i > 12 ? 50 * HOUR : 0),
    minutes: 26 + (i % 7) * 2,
    championId,
    position: i % 6 === 5 ? "TOP" : "MIDDLE",
    win: wins[i],
    kills: wins[i] ? 7 + (i % 4) : 2 + (i % 3),
    deaths: wins[i] ? 2 + (i % 3) : 6 + (i % 3),
    assists: 6 + (i % 5),
    cs: 190 + i * 3,
    vision: 18 + (i % 6) * 2,
    killParticipation: 0.42 + (i % 5) * 0.05,
    damageShare: 0.25,
  }));
}

/** Stands in for the API while a dashboard fixture is open; null lets the request through. */
export function apiFixture(path: string): unknown {
  if (!lcuFixture()) return null;
  if (path.startsWith("/v1/profiles/"))
    return {
      account: { puuid: "p".repeat(78), gameName: "Vizier", tagLine: "TR1" },
      summoner: { profileIconId: 29, summonerLevel: 214 },
      ranks: [
        { queueType: "RANKED_SOLO_5x5", tier: "EMERALD", rank: "II", leaguePoints: 47, wins: 88, losses: 79 },
        { queueType: "RANKED_FLEX_SR", tier: "PLATINUM", rank: "I", leaguePoints: 12, wins: 14, losses: 10 },
      ],
    };
  if (path.endsWith("/games")) return { games: sampleRows() };
  if (path.includes("/lp")) {
    const now = Date.now();
    const points = [2230, 2251, 2270, 2249, 2268, 2290, 2272, 2252, 2233];
    return {
      snapshots: points.map((p, i) => ({
        queue: "RANKED_SOLO_5x5",
        tier: "EMERALD",
        rank: p >= 2300 ? "I" : "II",
        lp: p % 100,
        wins: 80 + i,
        losses: 75 + i,
        at: now - (points.length - i) * 5 * HOUR,
        points: p,
      })),
    };
  }
  if (path.includes("/trends"))
    return {
      games: 10,
      wins: 5,
      habits: [{ title: "Çok sık ölüyorsun", detail: "", metric: "deaths", target: 5 }],
    };
  return null;
}
