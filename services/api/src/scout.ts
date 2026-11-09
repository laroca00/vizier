import type { Platform, RiotClient } from "./riot/client.ts";
import type { Store } from "./store.ts";

export const SCOUT_TTL_MS = 15 * 60_000;
export const MAX_SCOUTED = 10;

export type ScoutAsk = { puuid: string; championId: number };

export type ScoutPlayer = {
  puuid: string;
  championId: number;
  /** Ranked solo entry; null when unranked this season. */
  rank: { tier: string; division: string; lp: number; wins: number; losses: number; winStreak: boolean } | null;
  /** Mastery on the champion being played; null when the player never played it. */
  mastery: { level: number; points: number } | null;
};

type LeagueEntry = { queueType: string; tier: string; rank: string; leaguePoints: number; wins: number; losses: number; hotStreak?: boolean };
type MasteryEntry = { championLevel: number; championPoints: number };

/** Riot ids in a query string: `puuid:championId` pairs joined by commas. */
export function parseAsks(value: string | undefined): ScoutAsk[] | null {
  if (!value) return null;
  const asks: ScoutAsk[] = [];
  for (const part of value.split(",")) {
    const [puuid, champion] = part.split(":");
    const championId = Number(champion);
    if (!/^[\w-]{20,100}$/.test(puuid ?? "") || !Number.isInteger(championId) || championId <= 0) return null;
    asks.push({ puuid, championId });
  }
  return asks.length > 0 && asks.length <= MAX_SCOUTED ? asks : null;
}

export function soloEntry(entries: LeagueEntry[] | null): ScoutPlayer["rank"] {
  const solo = entries?.find((e) => e.queueType === "RANKED_SOLO_5x5");
  return solo ? { tier: solo.tier, division: solo.rank, lp: solo.leaguePoints, wins: solo.wins, losses: solo.losses, winStreak: solo.hotStreak === true } : null;
}

async function scoutOne(riot: RiotClient, platform: Platform, ask: ScoutAsk): Promise<ScoutPlayer> {
  const [league, mastery] = await Promise.all([
    riot.get<LeagueEntry[]>(platform, "/lol/league/v4/entries/by-puuid/{puuid}", `/lol/league/v4/entries/by-puuid/${ask.puuid}`),
    riot.get<MasteryEntry>(
      platform,
      "/lol/champion-mastery/v4/champion-masteries/by-puuid/{puuid}/by-champion/{championId}",
      `/lol/champion-mastery/v4/champion-masteries/by-puuid/${ask.puuid}/by-champion/${ask.championId}`,
    ),
  ]);
  return {
    puuid: ask.puuid,
    championId: ask.championId,
    rank: soloEntry(league),
    mastery: mastery ? { level: mastery.championLevel, points: mastery.championPoints } : null,
  };
}

/** Looks each player up once per 15 minutes; a failed lookup leaves that player out instead of failing the lot. */
export async function scout(riot: RiotClient, store: Store, platform: Platform, asks: ScoutAsk[]): Promise<ScoutPlayer[]> {
  const found = await Promise.all(
    asks.map(async (ask) => {
      const key = `scout:${platform}:${ask.puuid}:${ask.championId}`;
      const hit = await store.getCached<ScoutPlayer>(key);
      if (hit !== undefined) return hit;
      try {
        const player = await scoutOne(riot, platform, ask);
        await store.putCached(key, player, SCOUT_TTL_MS);
        return player;
      } catch {
        return null;
      }
    }),
  );
  return found.filter((p): p is ScoutPlayer => p !== null);
}
