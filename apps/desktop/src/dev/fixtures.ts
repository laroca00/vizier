import type { ChampSelect } from "../lcu";

/** Dev only: `?fixture=champ-select` renders the draft page without a client. */
export function champSelectFixture(): ChampSelect | null {
  if (!import.meta.env.DEV || new URLSearchParams(location.search).get("fixture") !== "champ-select") return null;
  return {
    myTeam: [
      { cellId: 0, championId: 266, pickIntent: 0, position: "top", spells: [4, 12], isLocal: false },
      { cellId: 1, championId: 64, pickIntent: 0, position: "jungle", spells: [11, 4], isLocal: false },
      { cellId: 2, championId: 0, pickIntent: 103, position: "middle", spells: [4, 14], isLocal: true },
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
