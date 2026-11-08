import type { Platform, Region, RiotClient } from "./riot/client.ts";
import { buildPaths, csByMinute, type BuildPath, type Timeline } from "./timeline.ts";
import { patchOf, type LeagueEntryWithPuuid, type LeagueList, type Match, type Participant } from "./riot/types.ts";

const RANKED_SOLO = 420;
export const ARAM = 450;
export const ARENA = 1700;
export const MAYHEM = 2400;
// URF and ARURF come and go with rotations; their games are kept when they show up.
const URF = [900, 1900];
/** Queues whose games are stored. Only ranked solo has roles, timelines and bans. */
export const STORED_QUEUES = new Set([RANKED_SOLO, ARAM, MAYHEM, ARENA, ...URF]);
// Asked for in turns, one per run, from one of that run's players.
const EXTRA_QUEUES = [ARAM, MAYHEM, ARENA, ...URF];
const DAY = 86_400_000;
const RESEED_AFTER = DAY;
const LOOKBACK = 3 * DAY;
// Ranked players play the other modes rarely, so those look further back.
const EXTRA_LOOKBACK = 14 * DAY;
// Remakes end before five minutes and say nothing about a build.
const MIN_DURATION_SECONDS = 300;

const APEX_LEAGUES = [
  ["CHALLENGER", "/lol/league/v4/challengerleagues/by-queue/RANKED_SOLO_5x5"],
  ["GRANDMASTER", "/lol/league/v4/grandmasterleagues/by-queue/RANKED_SOLO_5x5"],
  ["MASTER", "/lol/league/v4/masterleagues/by-queue/RANKED_SOLO_5x5"],
] as const;

// Emerald+ should look like the ladder, not its top: every division of
// Emerald and Diamond (a page holds 205 players), and a capped sample of
// Master and above, which as whole leagues would outnumber the rest.
// Roughly 2,500 Emerald, 1,600 Diamond and 600 apex players per platform.
const DIVISION_PAGES = [
  ...divisionPages("EMERALD", 3),
  ...divisionPages("DIAMOND", 2),
] as const;
const APEX_SAMPLE = 600;

function divisionPages(tier: string, pages: number): [string, string][] {
  return ["I", "II", "III", "IV"].flatMap((division) =>
    Array.from({ length: pages }, (_, i): [string, string] => [tier, `/lol/league/v4/entries/RANKED_SOLO_5x5/${tier}/${division}?page=${i + 1}`]),
  );
}

function sample<T>(items: T[], size: number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, size);
}

export type CrawlResult = { seeded: number; matches: number };

export type CrawlOptions = {
  /** match-v5 host the players' games live on. */
  region: Region;
  /** Where the seed players come from; all must belong to `region`. */
  platforms: Platform[];
  /** Challenger only, every apex league, or apex plus the top Diamond and Emerald pages. */
  leagues: "challenger" | "apex" | "emerald+";
  playersPerRun: number;
  matchesPerRun: number;
  /** Games from the other stored queues, on top of ranked. */
  extraMatchesPerRun: number;
  timelinesPerRun: number;
};

// EUW and TR Emerald+ players share one pool; both live on the Europe region.
// Sized for a Worker on the free plan: about 10 Riot calls a run, and a
// timeline is ~1 MB of JSON to parse.
export const EUROPE: CrawlOptions = {
  region: "europe",
  platforms: ["tr1", "euw1"],
  leagues: "emerald+",
  playersPerRun: 2,
  matchesPerRun: 6,
  extraMatchesPerRun: 2,
  timelinesPerRun: 2,
};

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
  private options: CrawlOptions;

  constructor(db: D1Database, riot: RiotClient, now: () => number = Date.now, options: CrawlOptions = EUROPE) {
    this.db = db;
    this.riot = riot;
    this.now = now;
    this.options = options;
  }

  async run(): Promise<CrawlResult> {
    const seeded = await this.seedIfStale();
    const matchIds = await this.collectMatchIds();
    let matches = 0;
    let timelines = 0;
    const { region } = this.options;
    for (const id of matchIds) {
      const match = await this.riot.get<Match>(region, "/lol/match/v5/matches", `/lol/match/v5/matches/${id}`);
      if (!match) continue;
      let timeline: Timeline | null = null;
      if (timelines < this.options.timelinesPerRun && match.info.queueId === RANKED_SOLO) {
        timelines++;
        timeline = await this.riot.get<Timeline>(
          region,
          "/lol/match/v5/matches/timeline",
          `/lol/match/v5/matches/${id}/timeline`,
        );
      }
      if (await this.save(match, timeline)) matches++;
    }
    return { seeded, matches };
  }

  private async seedIfStale(): Promise<number> {
    const { region, platforms, leagues } = this.options;
    // Europe keeps the key it had before other regions were crawled.
    const stateKey = region === "europe" ? "seeded_at" : `seeded_at:${region}`;
    const row = await this.db.prepare("SELECT value FROM crawl_state WHERE key = ?").bind(stateKey).first<{ value: string }>();
    if (row && this.now() - Number(row.value) < RESEED_AFTER) return 0;

    const players: { puuid: string; tier: string }[] = [];
    const apex = leagues === "challenger" ? APEX_LEAGUES.slice(0, 1) : APEX_LEAGUES;
    for (const platform of platforms) {
      const top: { puuid: string; tier: string }[] = [];
      for (const [tier, path] of apex) {
        const league = await this.riot.get<LeagueList>(platform, path, path);
        for (const entry of league?.entries ?? []) top.push({ puuid: entry.puuid, tier });
      }
      if (leagues !== "emerald+") {
        players.push(...top);
        continue;
      }
      players.push(...sample(top, APEX_SAMPLE));
      for (const [tier, path] of DIVISION_PAGES) {
        const page = await this.riot.get<LeagueEntryWithPuuid[]>(platform, "/lol/league/v4/entries", path);
        for (const entry of page ?? []) players.push({ puuid: entry.puuid, tier });
      }
    }

    const insert = this.db.prepare("INSERT OR IGNORE INTO crawl_players (puuid, tier, region) VALUES (?, ?, ?)");
    const statements = players.filter((p) => p.puuid).map((p) => insert.bind(p.puuid, p.tier, region));
    // The list is replaced, not added to, so the mix follows the seed above
    // instead of growing towards whoever was seeded before. A failed seed
    // (the key expired, say) keeps the old list.
    if (statements.length > 0) statements.unshift(this.db.prepare("DELETE FROM crawl_players WHERE region = ?").bind(region));
    // D1 caps a batch's size; chunk to stay well inside it.
    for (let i = 0; i < statements.length; i += 100) await this.db.batch(statements.slice(i, i + 100));
    await this.db
      .prepare("INSERT OR REPLACE INTO crawl_state (key, value) VALUES (?, ?)")
      .bind(stateKey, String(this.now()))
      .run();
    return players.length;
  }

  private async collectMatchIds(): Promise<string[]> {
    const { region, playersPerRun, matchesPerRun, extraMatchesPerRun } = this.options;
    const { results: due } = await this.db
      .prepare("SELECT puuid FROM crawl_players WHERE region = ? ORDER BY last_crawled_at LIMIT ?")
      .bind(region, playersPerRun)
      .all<{ puuid: string }>();

    const since = (lookback: number) => Math.floor((this.now() - lookback) / 1000);
    const ids = (puuid: string, queue: number, count: number) =>
      this.riot.get<string[]>(
        region,
        "/lol/match/v5/matches/by-puuid/ids",
        `/lol/match/v5/matches/by-puuid/${puuid}/ids?queue=${queue}&startTime=${since(queue === RANKED_SOLO ? LOOKBACK : EXTRA_LOOKBACK)}&start=0&count=${count}`,
      );
    const candidates = new Set<string>();
    const extras = new Set<string>();
    for (const [i, { puuid }] of due.entries()) {
      for (const id of (await ids(puuid, RANKED_SOLO, 20)) ?? []) candidates.add(id);
      if (extraMatchesPerRun > 0) {
        // Each player looks at a different mode, and the modes shift every run, so every mode is checked often.
        const queue = EXTRA_QUEUES[(Math.floor(this.now() / 120_000) + i) % EXTRA_QUEUES.length];
        for (const id of (await ids(puuid, queue, 10)) ?? []) extras.add(id);
      }
      await this.db
        .prepare("UPDATE crawl_players SET last_crawled_at = ? WHERE puuid = ?")
        .bind(this.now(), puuid)
        .run();
    }
    const list = [...candidates, ...extras];
    if (list.length === 0) return [];

    const { results: known } = await this.db
      .prepare(`SELECT match_id FROM crawled_matches WHERE match_id IN (${list.map(() => "?").join(",")})`)
      .bind(...list)
      .all<{ match_id: string }>();
    const seen = new Set(known.map((k) => k.match_id));
    const fresh = (set: Set<string>, limit: number) => [...set].filter((id) => !seen.has(id)).slice(0, limit);
    for (const id of candidates) extras.delete(id);
    return [...fresh(candidates, matchesPerRun), ...fresh(extras, extraMatchesPerRun)];
  }

  /** Returns false for games that carry no build signal. */
  async save(match: Match, timeline: Timeline | null = null): Promise<boolean> {
    const { info } = match;
    const matchId = match.metadata.matchId;
    const patch = patchOf(info.gameVersion);
    const ranked = info.queueId === RANKED_SOLO;
    const bans = ranked ? (info.teams ?? []).flatMap((t) => t.bans ?? []).map((b) => b.championId).filter((id) => id > 0) : [];
    // Recorded either way so a skipped game isn't fetched again.
    const record = this.db
      .prepare("INSERT OR IGNORE INTO crawled_matches (match_id, patch, game_start, queue_id, bans) VALUES (?, ?, ?, ?, ?)")
      .bind(matchId, patch, info.gameStartTimestamp, info.queueId, ranked ? bans.join(",") : null);
    if (!STORED_QUEUES.has(info.queueId) || info.gameDuration < MIN_DURATION_SECONDS) {
      await record.run();
      return false;
    }

    const insert = this.db.prepare(
      `INSERT OR IGNORE INTO participant_stats
        (match_id, patch, champion_id, team_position, win, runes, spells, items,
         opponent_champion_id, duration, deaths, cs10, cs_pm, gold_pm, vision_pm,
         kill_participation, damage_share, start_items, skill_order, purchase_order, cs_minutes,
         queue_id, team_id, augments)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const paths = timeline ? buildPaths(timeline) : new Map<number, BuildPath>();
    const pace = timeline ? csByMinute(timeline) : new Map<number, number[]>();
    const minutes = info.gameDuration / 60;
    const round = (n: number) => Math.round(n * 100) / 100;
    const rows = info.participants.flatMap((p) => {
      // Arena has no rune pages; every other stored queue does.
      const runes = info.queueId === ARENA ? "" : runeKey(p.perks);
      if (runes === null || (ranked && !p.teamPosition)) return [];
      const position = ranked ? p.teamPosition : "";
      // In Arena a top-four finish is the win.
      const win = info.queueId === ARENA ? (p.placement ?? 9) <= 4 : p.win;
      const augments = [p.playerAugment1, p.playerAugment2, p.playerAugment3, p.playerAugment4, p.playerAugment5, p.playerAugment6].filter(
        (id): id is number => !!id,
      );
      const spells = [p.summoner1Id ?? 0, p.summoner2Id ?? 0].sort((a, b) => a - b).join(",");
      const opponent = ranked ? info.participants.find((o) => o.teamId !== p.teamId && o.teamPosition === p.teamPosition) : undefined;
      const c = p.challenges ?? {};
      const cs = (p.totalMinionsKilled ?? 0) + (p.neutralMinionsKilled ?? 0);
      const cs10 = p.teamPosition === "JUNGLE" ? c.jungleCsBefore10Minutes : c.laneMinionsFirst10Minutes;
      const path = p.participantId ? paths.get(p.participantId) : undefined;
      const csMinutes = p.participantId ? pace.get(p.participantId) : undefined;
      return [
        insert.bind(
          matchId,
          patch,
          p.championId,
          position,
          win ? 1 : 0,
          runes,
          spells,
          itemsOf(p),
          opponent?.championId ?? null,
          info.gameDuration,
          p.deaths ?? null,
          cs10 === undefined ? null : Math.round(cs10),
          round(cs / minutes),
          p.goldEarned === undefined ? null : round(p.goldEarned / minutes),
          p.visionScore === undefined ? null : round(p.visionScore / minutes),
          c.killParticipation === undefined ? null : round(c.killParticipation),
          c.teamDamagePercentage === undefined ? null : round(c.teamDamagePercentage),
          path ? path.startItems.join(",") : null,
          path ? path.skillOrder.join("") : null,
          path ? path.purchases.join(",") : null,
          csMinutes?.length ? csMinutes.join(",") : null,
          info.queueId,
          p.teamId ?? null,
          augments.length ? augments.join(",") : null,
        ),
      ];
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
