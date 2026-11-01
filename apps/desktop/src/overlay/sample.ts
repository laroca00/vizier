import type { LiveGame } from "./live";

/** A made-up mid game, so every box has something to show while the player arranges them. */
export function sampleGame(): LiveGame {
  const player = (riotId: string, champion: string, team: string, position: string, items: number[], kills: number, cs: number) => ({
    riotId,
    rawChampionName: `game_character_displayname_${champion}`,
    team,
    position,
    level: 9,
    items: items.map((itemId) => ({ itemId, count: 1 })),
    scores: { kills, deaths: 2, assists: 4, creepScore: cs, wardScore: 9 },
  });
  return {
    gameTime: 842,
    gameMode: "CLASSIC",
    me: "Vizier#TR1",
    level: 9,
    gold: 1150,
    skills: [4, 1, 2, 1],
    players: [
      player("Top#TR1", "Garen", "ORDER", "TOP", [3078, 3047], 2, 110),
      player("Ally#TR1", "LeeSin", "ORDER", "JUNGLE", [3071], 8, 70),
      player("Vizier#TR1", "Ahri", "ORDER", "MIDDLE", [6655, 1056, 3020], 4, 101),
      player("Bot#TR1", "Jinx", "ORDER", "BOTTOM", [3031, 3006], 3, 120),
      player("Sup#TR1", "Thresh", "ORDER", "UTILITY", [3190], 0, 20),
      player("Enemy1#TR1", "Darius", "CHAOS", "TOP", [6631, 3047, 1028], 3, 104),
      player("Other#TR1", "Vi", "CHAOS", "JUNGLE", [6692], 2, 80),
      player("Enemy#TR1", "Zed", "CHAOS", "MIDDLE", [3142, 1036, 3158], 3, 110),
      player("Enemy4#TR1", "Kaisa", "CHAOS", "BOTTOM", [3115, 3006], 1, 98),
      player("Enemy5#TR1", "Leona", "CHAOS", "UTILITY", [3109, 3047], 1, 18),
    ],
    events: [
      { name: "DragonKill", time: 700, dragonType: "Fire", inhibKilled: null, killerName: "Ally" },
      { name: "InhibKilled", time: 760, dragonType: null, inhibKilled: "Barracks_T2_C1", killerName: "Vizier" },
    ],
  };
}
