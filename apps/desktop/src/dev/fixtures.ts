import type { ChampSelect } from "../lcu";
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
  const player = (riotId: string, champion: string, team: string, position: string, items: number[], kills: number, cs: number) => ({
    riotId,
    rawChampionName: `game_character_displayname_${champion}`,
    team,
    position,
    level: 9,
    items: items.map((itemId) => ({ itemId, count: 1 })),
    scores: { kills, deaths: 2, assists: 4, creepScore: cs },
  });
  return {
    gameTime: 842,
    gameMode: "CLASSIC",
    me: "Vizier#TR1",
    level: 9,
    skills: [4, 1, 2, 1],
    players: [
      player("Vizier#TR1", "Ahri", "ORDER", "MIDDLE", [6655, 1056, 3020], 4, 101),
      player("Ally#TR1", "LeeSin", "ORDER", "JUNGLE", [3071], 8, 70),
      player("Enemy#TR1", "Zed", "CHAOS", "MIDDLE", [3142, 1036, 3158], 3, 110),
      player("Other#TR1", "Vi", "CHAOS", "JUNGLE", [6692], 2, 80),
    ],
    events: [
      { name: "DragonKill", time: 700, dragonType: "Fire", inhibKilled: null, killerName: "Ally" },
      { name: "InhibKilled", time: 760, dragonType: null, inhibKilled: "Barracks_T2_C1", killerName: "Vizier" },
    ],
  };
}
