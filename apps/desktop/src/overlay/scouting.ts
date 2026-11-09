import type { ScoutPlayer } from "../api";
import type { Champion } from "../data/ddragon";
import { teamDamage, type DamageProfile } from "../data/traits";

export type RosterPlayer = { puuid: string; championId: number; position: string; team: 1 | 2 };

const PLATFORMS: Record<string, string> = { TR: "tr1", EUW: "euw1", KR: "kr", NA: "na1" };

/** The Riot platform of the client's server, or null for one Vizier does not read. */
export const platformOf = (region: string | null | undefined) => (region ? (PLATFORMS[region.toUpperCase()] ?? null) : null);

/** Mastery points from which a player counts as a main of the champion. */
export const MAIN_POINTS = 100_000;
/** Below this the player has barely touched the champion. */
export const NEW_POINTS = 5_000;

export type ScoutTag = "main" | "firstTime" | "winStreak";

/** Neutral facts about a player, never a judgement; each one is stated by Riot's own numbers. */
export function scoutTags(player: Pick<ScoutPlayer, "mastery" | "rank">): ScoutTag[] {
  const tags: ScoutTag[] = [];
  if (!player.mastery || player.mastery.points < NEW_POINTS) tags.push("firstTime");
  else if (player.mastery.points >= MAIN_POINTS) tags.push("main");
  if (player.rank?.winStreak) tags.push("winStreak");
  return tags;
}

export const rankGames = (rank: NonNullable<ScoutPlayer["rank"]>) => rank.wins + rank.losses;

export type ScoutRow = { player: RosterPlayer; champion: Champion | undefined; scout: ScoutPlayer | null };

/** Each side's rows, the local player's side first. */
export function scoutSides(roster: RosterPlayer[], mine: 1 | 2, champions: Map<number, Champion>, scouted: ScoutPlayer[]) {
  const byPuuid = new Map(scouted.map((s) => [s.puuid, s]));
  const rows = (team: 1 | 2): ScoutRow[] =>
    roster.filter((p) => p.team === team).map((player) => ({ player, champion: champions.get(player.championId), scout: byPuuid.get(player.puuid) ?? null }));
  const ours = rows(mine);
  const theirs = rows(mine === 1 ? 2 : 1);
  const damage = (side: ScoutRow[]): DamageProfile => teamDamage(side.flatMap((r) => (r.champion ? [r.champion] : [])));
  return { ours, theirs, ourDamage: damage(ours), theirDamage: damage(theirs) };
}
