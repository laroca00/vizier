import type { Match } from "./riot/types.ts";

export type DropReason = "surrender" | "afk";

// A player who was in the game for less than this share of it left (or was disconnected for good).
const LEFT_SHARE = 0.75;
// From this length on, a player with no kills, assists or real damage and little gold was not playing.
const AFK_AFTER_MINUTES = 10;
const AFK_DAMAGE = 200;
const AFK_GOLD_PER_MINUTE = 250;

type Info = Match["info"];

/**
 * Why a ranked game should not count, or null when it should. Early
 * surrenders (remakes) and games where somebody left or was away from the
 * keyboard say little about champions or builds, and they cost the other nine
 * players a normal game too, so the whole game is dropped.
 */
export function dropReason(info: Pick<Info, "gameDuration" | "participants">): DropReason | null {
  const minutes = info.gameDuration / 60;
  if (info.participants.some((p) => p.gameEndedInEarlySurrender || p.teamEarlySurrendered)) return "surrender";
  for (const p of info.participants) {
    if (p.timePlayed !== undefined && p.timePlayed > 0 && p.timePlayed < info.gameDuration * LEFT_SHARE) return "afk";
    if (minutes < AFK_AFTER_MINUTES) continue;
    // Fields Riot leaves out are unknown, not zero.
    if (p.totalDamageDealtToChampions === undefined || p.goldEarned === undefined) continue;
    const involved = (p.kills ?? 0) + (p.assists ?? 0);
    if (involved === 0 && p.totalDamageDealtToChampions < AFK_DAMAGE && p.goldEarned / minutes < AFK_GOLD_PER_MINUTE) return "afk";
  }
  return null;
}
