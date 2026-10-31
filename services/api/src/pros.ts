import { runeKey } from "./crawler.ts";
import { PRO_PLAYERS, type ProGroup, type ProPlayer } from "./proPlayers.ts";
import { regionOf, type Platform, type RiotClient } from "./riot/client.ts";
import { patchOf, type Account, type Match } from "./riot/types.ts";
import { buildPaths, type Timeline } from "./timeline.ts";

const RANKED_SOLO = 420;
const DAY = 86_400_000;
const LOOKBACK = 7 * DAY;
// Each game costs a match and a timeline call; two per run keeps the pro
// crawl to about five calls next to the stats crawler's ten.
const MATCHES_PER_RUN = 2;
const MIN_DURATION_SECONDS = 300;

export type ProBuild = {
  matchId: string;
  player: string;
  team: string;
  group: ProGroup;
  platform: string;
  patch: string;
  gameStart: number;
  duration: number;
  championId: number;
  opponentChampionId: number | null;
  position: string;
  win: boolean;
  kills: number;
  deaths: number;
  assists: number;
  cs: number;
  gold: number;
  /** Same key format as the stats crawler: "primary:sub:p1,p2,p3,p4:s1,s2:shards". */
  runes: string;
  spells: number[];
  items: number[];
  startItems: number[];
  /** Skill slots 1-4 in level-up order. */
  skillOrder: number[];
  purchases: number[];
};

const ids = (csv: string | null) => (csv ? csv.split(",").filter(Boolean).map(Number) : []);

export class ProCrawler {
  private db: D1Database;
  private riot: RiotClient;
  private now: () => number;
  private players: ProPlayer[];

  constructor(db: D1Database, riot: RiotClient, now: () => number = Date.now, players: ProPlayer[] = PRO_PLAYERS) {
    this.db = db;
    this.riot = riot;
    this.now = now;
    this.players = players;
  }

  /** Resolves every listed Riot ID to a PUUID. Accounts that no longer exist are skipped. */
  async syncAccounts(): Promise<number> {
    const statements = [];
    for (const player of this.players) {
      for (const { riotId, platform } of player.accounts) {
        const [gameName, tagLine] = riotId.split("#");
        // account-v1 answers for every account on any regional host.
        const account = await this.riot.get<Account>(
          "europe",
          "/riot/account/v1/accounts/by-riot-id",
          `/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`,
        );
        if (!account) continue;
        statements.push(
          this.db
            .prepare(
              `INSERT INTO pro_accounts (puuid, player, team, role, platform, riot_id, grp) VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT (puuid) DO UPDATE SET player = excluded.player, team = excluded.team, role = excluded.role,
                  platform = excluded.platform, riot_id = excluded.riot_id, grp = excluded.grp`,
            )
            .bind(account.puuid, player.name, player.team, player.role, platform, riotId, player.group ?? "worlds"),
        );
      }
    }
    if (statements.length > 0) await this.db.batch(statements);
    return statements.length;
  }

  /** Saves new solo queue games of the account crawled longest ago. */
  async run(): Promise<number> {
    // A fresh database learns the accounts on its first run, not a day later.
    const any = await this.db.prepare("SELECT 1 AS found FROM pro_accounts LIMIT 1").first();
    if (!any) await this.syncAccounts();
    const account = await this.db
      .prepare("SELECT puuid, player, team, platform, grp FROM pro_accounts ORDER BY last_crawled_at LIMIT 1")
      .first<{ puuid: string; player: string; team: string; platform: Platform; grp: string }>();
    if (!account) return 0;
    await this.db.prepare("UPDATE pro_accounts SET last_crawled_at = ? WHERE puuid = ?").bind(this.now(), account.puuid).run();

    const region = regionOf(account.platform);
    const startTime = Math.floor((this.now() - LOOKBACK) / 1000);
    const matchIds =
      (await this.riot.get<string[]>(
        region,
        "/lol/match/v5/matches/by-puuid/ids",
        `/lol/match/v5/matches/by-puuid/${account.puuid}/ids?queue=${RANKED_SOLO}&startTime=${startTime}&start=0&count=10`,
      )) ?? [];
    if (matchIds.length === 0) return 0;

    const { results: known } = await this.db
      .prepare(`SELECT match_id FROM pro_matches WHERE puuid = ? AND match_id IN (${matchIds.map(() => "?").join(",")})`)
      .bind(account.puuid, ...matchIds)
      .all<{ match_id: string }>();
    const seen = new Set(known.map((k) => k.match_id));
    let saved = 0;
    for (const id of matchIds.filter((m) => !seen.has(m)).slice(0, MATCHES_PER_RUN)) {
      const match = await this.riot.get<Match>(region, "/lol/match/v5/matches", `/lol/match/v5/matches/${id}`);
      if (!match) continue;
      const timeline = await this.riot.get<Timeline>(region, "/lol/match/v5/matches/timeline", `/lol/match/v5/matches/${id}/timeline`);
      if (await this.save(match, timeline, account)) saved++;
    }
    return saved;
  }

  async save(
    match: Match,
    timeline: Timeline | null,
    account: { puuid: string; player: string; team: string; platform: string; grp?: string },
  ): Promise<boolean> {
    const { info } = match;
    if (info.queueId !== RANKED_SOLO || info.gameDuration < MIN_DURATION_SECONDS) return false;
    const me = info.participants.find((p) => p.puuid === account.puuid);
    const runes = me && runeKey(me.perks);
    if (!me || !runes || !me.teamPosition) return false;
    const opponent = info.participants.find((o) => o.teamId !== me.teamId && o.teamPosition === me.teamPosition);
    const path = timeline && me.participantId ? buildPaths(timeline).get(me.participantId) : undefined;
    const items = [me.item0, me.item1, me.item2, me.item3, me.item4, me.item5].filter((id): id is number => !!id);
    await this.db
      .prepare(
        `INSERT OR IGNORE INTO pro_matches
          (match_id, puuid, player, team, platform, patch, game_start, duration, champion_id, opponent_champion_id,
           team_position, win, kills, deaths, assists, cs, gold, runes, spells, items, start_items, skill_order, purchase_order, grp)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        match.metadata.matchId,
        account.puuid,
        account.player,
        account.team,
        account.platform,
        patchOf(info.gameVersion),
        info.gameStartTimestamp,
        info.gameDuration,
        me.championId,
        opponent?.championId ?? null,
        me.teamPosition,
        me.win ? 1 : 0,
        me.kills ?? 0,
        me.deaths ?? 0,
        me.assists ?? 0,
        (me.totalMinionsKilled ?? 0) + (me.neutralMinionsKilled ?? 0),
        me.goldEarned ?? 0,
        runes,
        [me.summoner1Id ?? 0, me.summoner2Id ?? 0].join(","),
        items.join(","),
        path ? path.startItems.join(",") : null,
        path ? path.skillOrder.join("") : null,
        path ? path.purchases.join(",") : null,
        account.grp ?? "worlds",
      )
      .run();
    return true;
  }
}

type Row = {
  match_id: string;
  player: string;
  team: string;
  grp: ProGroup;
  platform: string;
  patch: string;
  game_start: number;
  duration: number;
  champion_id: number;
  opponent_champion_id: number | null;
  team_position: string;
  win: number;
  kills: number;
  deaths: number;
  assists: number;
  cs: number;
  gold: number;
  runes: string;
  spells: string;
  items: string;
  start_items: string | null;
  skill_order: string | null;
  purchase_order: string | null;
};

export type ProFilter = { championId?: number; position?: string; team?: string; group?: ProGroup; limit?: number };

/** Newest first. */
export async function proBuilds(db: D1Database, { championId, position, team, group, limit = 30 }: ProFilter = {}): Promise<ProBuild[]> {
  const where = [
    championId ? "champion_id = ?" : "",
    position ? "team_position = ?" : "",
    team ? "team = ?" : "",
    group ? "grp = ?" : "",
  ].filter(Boolean);
  const { results } = await db
    .prepare(
      `SELECT * FROM pro_matches ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY game_start DESC LIMIT ?`,
    )
    .bind(...[championId, position, team, group].filter((v) => v !== undefined), limit)
    .all<Row>();
  return results.map((r) => ({
    matchId: r.match_id,
    player: r.player,
    team: r.team,
    group: r.grp,
    platform: r.platform,
    patch: r.patch,
    gameStart: r.game_start,
    duration: r.duration,
    championId: r.champion_id,
    opponentChampionId: r.opponent_champion_id,
    position: r.team_position,
    win: r.win === 1,
    kills: r.kills,
    deaths: r.deaths,
    assists: r.assists,
    cs: r.cs,
    gold: r.gold,
    runes: r.runes,
    spells: ids(r.spells),
    items: ids(r.items),
    startItems: ids(r.start_items),
    skillOrder: r.skill_order ? [...r.skill_order].map(Number) : [],
    purchases: ids(r.purchase_order),
  }));
}

/** Teams and players with stored games, for the page's filters. */
export async function proTeams(db: D1Database): Promise<{ team: string; group: ProGroup; players: string[] }[]> {
  const { results } = await db
    .prepare("SELECT DISTINCT team, grp, player FROM pro_accounts ORDER BY grp DESC, team, player")
    .all<{ team: string; grp: ProGroup; player: string }>();
  const teams = new Map<string, { group: ProGroup; players: string[] }>();
  for (const r of results) {
    const key = `${r.grp}:${r.team}`;
    const entry = teams.get(key) ?? { group: r.grp, players: [] };
    entry.players.push(r.player);
    teams.set(key, entry);
  }
  return [...teams.entries()].map(([key, { group, players }]) => ({ team: key.slice(group.length + 1), group, players }));
}

// Builds older than this describe last month's game.
const KEEP = 30 * DAY;

export async function pruneOldProMatches(db: D1Database, now = Date.now()) {
  await db.prepare("DELETE FROM pro_matches WHERE game_start < ?").bind(now - KEEP).run();
}
