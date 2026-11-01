import type { ChampSelect } from "../lcu";
import { sampleGame } from "../overlay/sample";
import type { LiveGameInfo } from "../api";
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
