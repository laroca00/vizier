import raw from "./archetypes.json";

// What kind of player each champion is, in Vizier's own words (archetypes.json).
// Hand-kept and keyed by Data Dragon id: an archetype is a reading, not
// something measured from games, so pages that show it mark it as editorial.
// A champion has one to three archetypes, main one first.

export type Localized = { tr: string; en: string };
export type TeamRole = "front" | "damage" | "support" | "flex";

export type Archetype = {
  id: ArchetypeId;
  role: TeamRole;
  name: Localized;
  description: Localized;
  strength: Localized;
  weakness: Localized;
};

export const ARCHETYPES = raw.archetypes as Archetype[];
export type ArchetypeId =
  | "vanguard"
  | "warden"
  | "juggernaut"
  | "duelist"
  | "skirmisher"
  | "diver"
  | "assassin"
  | "burstmage"
  | "artillery"
  | "controlmage"
  | "battlemage"
  | "hypercarry"
  | "lanebully"
  | "enchanter"
  | "catcher"
  | "engagesup"
  | "splitpusher"
  | "tempo";

export const ARCHETYPE_BY_ID = new Map<string, Archetype>(ARCHETYPES.map((a) => [a.id, a]));

const TABLE = raw.table as Record<string, string>;

/** The champion's archetypes, main one first; empty for a champion not written up yet. */
export function archetypesOf(championId: string): Archetype[] {
  return (TABLE[championId]?.split(" ") ?? []).map((id) => ARCHETYPE_BY_ID.get(id)).filter((a): a is Archetype => !!a);
}

export const ARCHETYPE_CHAMPIONS = Object.keys(TABLE);

/** Data Dragon ids of the champions that have the archetype, in table order. */
export function championsWith(archetypeId: string): string[] {
  return ARCHETYPE_CHAMPIONS.filter((id) => TABLE[id].split(" ").includes(archetypeId));
}
