import type { LiveGame } from "./live";

export type Element = "Fire" | "Water" | "Earth" | "Air" | "Hextech" | "Chemtech";
const ELEMENTS: readonly string[] = ["Fire", "Water", "Earth", "Air", "Hextech", "Chemtech"];
/** Names as the Turkish client calls the drakes; run through `t()` where shown. */
export const ELEMENT_NAMES: Record<Element, string> = {
  Fire: "Cehennem",
  Water: "Okyanus",
  Earth: "Dağ",
  Air: "Bulut",
  Hextech: "Hextech",
  Chemtech: "Kemtek",
};
// Four elemental dragons win a team the soul.
const SOUL_AT = 4;

export type DragonRead = {
  ours: Element[];
  theirs: Element[];
  /** The map turns to the third drake's element, and the soul follows it. */
  soul: Element | null;
  /** The team that took the soul, once one has. */
  soulTaken: "ours" | "theirs" | null;
  /** Teams one dragon away from the soul. */
  soulPoint: { ours: boolean; theirs: boolean };
  elders: { ours: number; theirs: number };
};

/**
 * Dragons per team from the game's kill events. The event names the killer
 * by in-game name; a kill we can't place (a name we don't know) is skipped
 * rather than guessed.
 */
export function readDragons(game: LiveGame, myTeam: string): DragonRead | null {
  const teamOf = new Map<string, string>();
  for (const p of game.players) {
    teamOf.set(p.riotId, p.team);
    teamOf.set(p.riotId.split("#")[0], p.team);
  }
  const ours: Element[] = [];
  const theirs: Element[] = [];
  const elders = { ours: 0, theirs: 0 };
  const all: Element[] = [];
  for (const e of game.events) {
    if (e.name !== "DragonKill" || !e.dragonType) continue;
    const elemental = ELEMENTS.includes(e.dragonType);
    if (elemental) all.push(e.dragonType as Element);
    const team = e.killerName ? teamOf.get(e.killerName) : undefined;
    if (!team) continue;
    const side = team === myTeam ? "ours" : "theirs";
    if (e.dragonType === "Elder") elders[side]++;
    else if (elemental) (side === "ours" ? ours : theirs).push(e.dragonType as Element);
  }
  if (all.length === 0 && elders.ours + elders.theirs === 0) return null;
  const soulTaken = ours.length >= SOUL_AT ? "ours" : theirs.length >= SOUL_AT ? "theirs" : null;
  return {
    ours,
    theirs,
    soul: all.length >= 3 ? all[2] : null,
    soulTaken,
    soulPoint: { ours: !soulTaken && ours.length === SOUL_AT - 1, theirs: !soulTaken && theirs.length === SOUL_AT - 1 },
    elders,
  };
}
