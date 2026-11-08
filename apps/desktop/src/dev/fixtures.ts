import type { ChampSelect, LcuStatus } from "../lcu";
import { sampleGame } from "../overlay/sample";
import type { LiveGame } from "../overlay/live";

/**
 * Dev only: `?fixture=champ-select` renders the draft page without a client.
 * `&draft=ban`, `&draft=locked` and `&draft=planning` show the other moments.
 */
export function champSelectFixture(): ChampSelect | null {
  const params = new URLSearchParams(location.search);
  if (!import.meta.env.DEV || params.get("fixture") !== "champ-select") return null;
  const moment = params.get("draft");
  const draft: ChampSelect = {
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
    turn: { kind: "pick", mine: true },
    phaseEndsAt: Date.now() + 27_000,
  };
  if (moment === "planning") return { ...draft, phase: "PLANNING", turn: null, theirTeam: draft.theirTeam.map((m) => ({ ...m, championId: 0 })) };
  if (moment === "ban") return { ...draft, turn: { kind: "ban", mine: true } };
  if (moment === "locked") {
    return {
      ...draft,
      phase: "FINALIZATION",
      turn: null,
      myTeam: draft.myTeam.map((m) => (m.isLocal ? { ...m, championId: m.pickIntent } : m)),
      theirTeam: draft.theirTeam.map((m, i) => ({ ...m, championId: [122, 7, 222, 412, 875][i] })),
    };
  }
  return draft;
}

/** Dev only: `?fixture=overlay` renders the in-game overlay mid-game without the game. */
export function overlayFixture(): LiveGame | null {
  if (!import.meta.env.DEV || new URLSearchParams(location.search).get("fixture") !== "overlay") return null;
  return sampleGame();
}

/** Dev only: `?fixture=client` shows a connected client without one. */
export function lcuFixture(): LcuStatus | null {
  if (!import.meta.env.DEV || new URLSearchParams(location.search).get("fixture") !== "client") return null;
  return {
    state: "connected",
    summoner: { gameName: "Vizier", tagLine: "TR1", puuid: "p".repeat(78) },
    phase: "Lobby",
    lastGameId: 1,
    region: { region: "TR", locale: "tr_TR" },
  };
}
