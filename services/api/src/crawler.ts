import type { RiotClient } from "./riot/client.ts";
import { patchOf, type LeagueEntryWithPuuid, type LeagueList, type Match, type Participant } from "./riot/types.ts";

const RANKED_SOLO = 420;
const DAY = 86_400_000;

// Sized for the free plans: about 10 Riot calls per run keeps room in a
// development key's 100 per 2 minutes for app traffic, and 8 matches x 11 rows
// every 2 minutes stays under D1's 100k written rows a day.
const PLAYERS_PER_RUN = 2;
const MATCHES_PER_RUN = 8;
const RESEED_AFTER = DAY;
const LOOKBACK = 3 * DAY;
// Remakes end before five minutes and say nothing about a build.
const MIN_DURATION_SECONDS = 300;

const APEX_LEAGUES = [
  ["CHALLENGER", "/lol/league/v4/challengerleagues/by-queue/RANKED_SOLO_5x5"],
  ["GRANDMASTER", "/lol/league/v4/grandmasterleagues/by-queue/RANKED_SOLO_5x5"],
  ["MASTER", "/lol/league/v4/masterleagues/by-queue/RANKED_SOLO_5x5"],
] as const;

const DIVISION_PAGES = [
  ["DIAMOND", "/lol/league/v4/entries/RANKED_SOLO_5x5/DIAMOND/I?page=1"],
  ["EMERALD", "/lol/league/v4/entries/RANKED_SOLO_5x5/EMERALD/I?page=1"],
] as const;

export type CrawlResult = { seeded: number; matches: number };

/** `primary:sub:p1,p2,p3,p4:s1,s2:offense,flex,defense`, or null if incomplete. */
export function runeKey(perks: Participant["perks"]): string | null {
  const primary = perks?.styles.find((s) => s.description === "primaryStyle");
  const sub = perks?.styles.find((s) => s.description === "subStyle");
  if (!perks || !primary || !sub || primary.selections.length !== 4 || sub.selections.length !== 2) return null;
  const { offense, flex, defense } = perks.statPerks;
  return [
    primary.style,
    sub.style,
    primary.selections.map((s) => s.perk).join(","),
    sub.selections.map((s) => s.perk).join(","),
    [offense, flex, defense].join(","),
  ].join(":");
}

function itemsOf(p: Participant): string {
  return [p.item0, p.item1, p.item2, p.item3, p.item4, p.item5].filter((id): id is number => !!id).join(",");
}

export class Crawler {
  private db: D1Database;
  private riot: RiotClient;
  private now: () => number;

  constructor(db: D1Database, riot: RiotClient, now: () => number = Date.now) {
    this.db = db;
    this.riot = riot;
    this.now = now;
  }

  async run(): Promise<CrawlResult> {
    const seeded = await this.seedIfStale();
    const matchIds = await this.collectMatchIds();
    let matches = 0;
    for (const id of matchIds) {
      const match = await this.riot.get<Match>("europe", "/lol/match/v5/matches", `/lol/match/v5/matches/${id}`);
      if (match && (await this.save(match))) matches++;
    }
    return { seeded, matches };
  }

  private async seedIfStale(): Promise<number> {
    const row = await this.db.prepare("SELECT value FROM crawl_state WHERE key = 'seeded_at'").first<{ value: string }>();
    if (row && this.now() - Number(row.value) < RESEED_AFTER) return 0;

    const players: { puuid: string; tier: string }[] = [];
    for (const [tier, path] of APEX_LEAGUES) {
      const league = await this.riot.get<LeagueList>("tr1", path, path);
      for (const entry of league?.entries ?? []) players.push({ puuid: entry.puuid, tier });
    }
    for (const [tier, path] of DIVISION_PAGES) {
      const page = await this.riot.get<LeagueEntryWithPuuid[]>("tr1", "/lol/league/v4/entries", path);
      for (const entry of page ?? []) players.push({ puuid: entry.puuid, tier });
    }

    const insert = this.db.prepare("INSERT OR IGNORE INTO crawl_players (puuid, tier) VALUES (?, ?)");
    const statements = players.filter((p) => p.puuid).map((p) => insert.bind(p.puuid, p.tier));
    // D1 caps a batch's size; chunk to stay well inside it.
    for (let i = 0; i < statements.length; i += 100) await this.db.batch(statements.slice(i, i + 100));
    await this.db
      .prepare("INSERT OR REPLACE INTO crawl_state (key, value) VALUES ('seeded_at', ?)")
      .bind(String(this.now()))
      .run();
    return players.length;
  }

  private async collectMatchIds(): Promise<string[]> {
    const { results: due } = await this.db
      .prepare("SELECT puuid FROM crawl_players ORDER BY last_crawled_at LIMIT ?")
      .bind(PLAYERS_PER_RUN)
      .all<{ puuid: string }>();

    const startTime = Math.floor((this.now() - LOOKBACK) / 1000);
    const candidates = new Set<string>();
    for (const { puuid } of due) {
      const ids = await this.riot.get<string[]>(
        "europe",
        "/lol/match/v5/matches/by-puuid/ids",
        `/lol/match/v5/matches/by-puuid/${puuid}/ids?queue=${RANKED_SOLO}&startTime=${startTime}&start=0&count=20`,
      );
      for (const id of ids ?? []) candidates.add(id);
      await this.db
        .prepare("UPDATE crawl_players SET last_crawled_at = ? WHERE puuid = ?")
        .bind(this.now(), puuid)
        .run();
    }
    if (candidates.size === 0) return [];

    const list = [...candidates];
    const { results: known } = await this.db
      .prepare(`SELECT match_id FROM crawled_matches WHERE match_id IN (${list.map(() => "?").join(",")})`)
      .bind(...list)
      .all<{ match_id: string }>();
    const seen = new Set(known.map((k) => k.match_id));
    return list.filter((id) => !seen.has(id)).slice(0, MATCHES_PER_RUN);
  }

  /** Returns false for games that carry no build signal. */
  async save(match: Match): Promise<boolean> {
    const { info } = match;
    const matchId = match.metadata.matchId;
    const patch = patchOf(info.gameVersion);
    // Recorded either way so a skipped game isn't fetched again.
    const record = this.db
      .prepare("INSERT OR IGNORE INTO crawled_matches (match_id, patch, game_start) VALUES (?, ?, ?)")
      .bind(matchId, patch, info.gameStartTimestamp);
    if (info.queueId !== RANKED_SOLO || info.gameDuration < MIN_DURATION_SECONDS) {
      await record.run();
      return false;
    }

    const insert = this.db.prepare(
      `INSERT OR IGNORE INTO participant_stats
        (match_id, patch, champion_id, team_position, win, runes, spells, items)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const rows = info.participants.flatMap((p) => {
      const runes = runeKey(p.perks);
      if (!runes || !p.teamPosition) return [];
      const spells = [p.summoner1Id ?? 0, p.summoner2Id ?? 0].sort((a, b) => a - b).join(",");
      return [insert.bind(matchId, patch, p.championId, p.teamPosition, p.win ? 1 : 0, runes, spells, itemsOf(p))];
    });
    await this.db.batch([record, ...rows]);
    return true;
  }
}

/** Keeps the two newest patches; older games no longer describe the live game. */
export async function pruneOldPatches(db: D1Database) {
  const { results } = await db
    .prepare("SELECT patch FROM crawled_matches GROUP BY patch ORDER BY MAX(game_start) DESC LIMIT 2")
    .all<{ patch: string }>();
  if (results.length < 2) return;
  const keep = results.map((r) => r.patch);
  await db.batch([
    db.prepare("DELETE FROM participant_stats WHERE patch NOT IN (?, ?)").bind(...keep),
    db.prepare("DELETE FROM crawled_matches WHERE patch NOT IN (?, ?)").bind(...keep),
  ]);
}
