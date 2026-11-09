import { TIER_GROUPS, type TierGroup } from "@vizier/shared/brackets";
const HOUR = 3_600_000;

// Seeds per platform and the share each tier group gets of them. The share is
// of players followed, not of games: the crawl spends games by the same table.
export const SEED_SIZE = 4800;
export const SEED_QUOTA: Record<TierGroup, number> = {
  iron_bronze: 0.1,
  silver: 0.14,
  gold: 0.16,
  platinum: 0.16,
  emerald: 0.16,
  diamond: 0.14,
  master_plus: 0.14,
};
/** Riot tiers behind each group, lowest first; the apex group is read from the league lists. */
export const GROUP_TIERS: Record<TierGroup, string[]> = {
  iron_bronze: ["IRON", "BRONZE"],
  silver: ["SILVER"],
  gold: ["GOLD"],
  platinum: ["PLATINUM"],
  emerald: ["EMERALD"],
  diamond: ["DIAMOND"],
  master_plus: ["MASTER", "GRANDMASTER", "CHALLENGER"],
};


/** Games a host aims to store per hour, spread over the groups by the seed table. */
export const HOURLY_GAMES = 900;

// Share of a group's ranked games that get a timeline. Emerald+ keeps what the
// published timeline docs need; below it a smaller sample is enough.
export const TIMELINE_SHARE: Record<TierGroup, number> = {
  iron_bronze: 0.2,
  silver: 0.2,
  gold: 0.3,
  platinum: 0.4,
  emerald: 1,
  diamond: 1,
  master_plus: 1,
};

export type GroupReport = { group: TierGroup; seeds: number; games: number; timelines: number; calls: number; target: number };

type Counts = Omit<GroupReport, "group" | "target">;
const empty = (): Counts => ({ seeds: 0, games: 0, timelines: 0, calls: 0 });

/**
 * Spends a host's Riot calls by group: which seeds to crawl next, whether a
 * game gets a timeline, and an hourly count per group for the log. Lives in
 * memory; a restart only restarts the hour.
 */
export class GroupBudget {
  private counts = new Map<TierGroup, Counts>();
  private credit = new Map<TierGroup, number>();
  private since: number;

  private now: () => number;
  private hourlyGames: number;
  private weights: Record<TierGroup, number>;
  private timelineShare: Record<TierGroup, number>;

  constructor(
    now: () => number = Date.now,
    hourlyGames = HOURLY_GAMES,
    weights: Record<TierGroup, number> = SEED_QUOTA,
    timelineShare: Record<TierGroup, number> = TIMELINE_SHARE,
  ) {
    this.now = now;
    this.hourlyGames = hourlyGames;
    this.weights = weights;
    this.timelineShare = timelineShare;
    this.since = now();
  }

  private of(group: TierGroup): Counts {
    let c = this.counts.get(group);
    if (!c) this.counts.set(group, (c = empty()));
    return c;
  }

  private target(group: TierGroup) {
    return Math.round(this.hourlyGames * this.weights[group]);
  }

  /**
   * The groups to take the next `n` seeds from, most behind its hourly target
   * first. `available` limits it to groups that still have players to crawl.
   */
  plan(n: number, available: Iterable<TierGroup> = TIER_GROUPS): TierGroup[] {
    this.roll();
    const groups = [...available];
    const planned = new Map<TierGroup, number>();
    const picks: TierGroup[] = [];
    for (let i = 0; i < n && groups.length > 0; i++) {
      // Seeds already planned count for half a game: a seed yields a few new games at most.
      const behind = (g: TierGroup) => (this.of(g).games + 0.5 * (planned.get(g) ?? 0)) / this.target(g);
      const next = groups.reduce((best, g) => (behind(g) < behind(best) ? g : best));
      planned.set(next, (planned.get(next) ?? 0) + 1);
      picks.push(next);
    }
    return picks;
  }

  /** Counts one timeline against a ranked game's group; false once the group's share is spent. */
  wantsTimeline(group: TierGroup | null): boolean {
    const g = group ?? "emerald";
    const credit = (this.credit.get(g) ?? 0) + this.timelineShare[g];
    if (credit < 1) {
      this.credit.set(g, credit);
      return false;
    }
    this.credit.set(g, credit - 1);
    return true;
  }

  seed(group: TierGroup | null) {
    if (group) this.of(group).seeds++;
  }
  call(group: TierGroup | null) {
    if (group) this.of(group).calls++;
  }
  game(group: TierGroup | null) {
    if (group) this.of(group).games++;
  }
  timeline(group: TierGroup | null) {
    if (group) this.of(group).timelines++;
  }

  private roll() {
    if (this.now() - this.since >= HOUR) {
      this.counts = new Map();
      this.since = this.now();
    }
  }

  /** What each group spent since the hour began. */
  report(): GroupReport[] {
    return TIER_GROUPS.map((group) => ({ group, ...(this.counts.get(group) ?? empty()), target: this.target(group) }));
  }

  /** The report as one log line, then a fresh hour. */
  takeLine(): string {
    const line = this.report()
      .map((r) => `${r.group} seeds ${r.seeds} games ${r.games}/${r.target} timelines ${r.timelines} calls ${r.calls}`)
      .join("; ");
    this.counts = new Map();
    this.since = this.now();
    return line;
  }
}
