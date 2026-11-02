import type { GameRow, LpSnapshot } from "./api";
import type { Goal, GoalMetric } from "./personal";

// Readings of the player's recent ranked games for the dashboard, the queue
// screen and champ select. Everything here is pure so it can be tested.

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
/** A gap longer than this between games ends a play session. */
const SESSION_GAP = 2 * HOUR;

export const kdaOf = (g: { kills: number; deaths: number; assists: number }) => (g.kills + g.assists) / Math.max(1, g.deaths);

export function metricOf(metric: GoalMetric, g: GameRow): number | null {
  switch (metric) {
    case "cs_pm":
      return g.minutes > 0 ? g.cs / g.minutes : null;
    case "vision_pm":
      return g.minutes > 0 ? g.vision / g.minutes : null;
    case "deaths":
      return g.deaths;
    case "kill_participation":
      return g.killParticipation;
    case "kda":
      return kdaOf(g);
  }
}

/** Deaths are the one goal where less is better. */
export const lowerIsBetter = (metric: GoalMetric) => metric === "deaths";

export function meets(goal: Goal, g: GameRow): boolean | null {
  const value = metricOf(goal.metric, g);
  if (value === null) return null;
  return lowerIsBetter(goal.metric) ? value <= goal.target : value >= goal.target;
}

export type GoalReading = { met: number; counted: number; average: number | null; recent: (boolean | null)[] };

/** How the last ten games went against a goal, newest first. */
export function readGoal(goal: Goal, games: GameRow[], last = 10): GoalReading {
  const shown = games.slice(0, last);
  const recent = shown.map((g) => meets(goal, g));
  const values = shown.map((g) => metricOf(goal.metric, g)).filter((v): v is number => v !== null);
  return {
    met: recent.filter((r) => r === true).length,
    counted: recent.filter((r) => r !== null).length,
    average: values.length ? values.reduce((a, b) => a + b, 0) / values.length : null,
    recent,
  };
}

export type Streak = { win: boolean; length: number };

/** The run the newest games are on, and the longest of each kind. */
export function streaks(games: GameRow[]): { current: Streak | null; longestWin: number; longestLoss: number } {
  let longestWin = 0;
  let longestLoss = 0;
  let run = 0;
  let last: boolean | null = null;
  for (const g of [...games].reverse()) {
    run = g.win === last ? run + 1 : 1;
    last = g.win;
    if (g.win) longestWin = Math.max(longestWin, run);
    else longestLoss = Math.max(longestLoss, run);
  }
  if (games.length === 0) return { current: null, longestWin, longestLoss };
  const first = games[0].win;
  const length = games.findIndex((g) => g.win !== first);
  return { current: { win: first, length: length < 0 ? games.length : length }, longestWin, longestLoss };
}

/** The games of the session still going: newest first, broken by a two hour gap. */
export function session(games: GameRow[], now = Date.now()): GameRow[] {
  if (!games.length || now - games[0].at > SESSION_GAP) return [];
  const out = [games[0]];
  for (let i = 1; i < games.length && games[i - 1].at - games[i].at <= SESSION_GAP; i++) out.push(games[i]);
  return out;
}

export type TiltReason = "lossStreak" | "kdaDrop" | "badSession";
export type Tilt = { level: 0 | 1 | 2; reasons: TiltReason[]; lossesInRow: number };

/**
 * Signs that the session is going badly: three or more losses in a row, the
 * last three games well under the player's own KDA, or a session lost by a
 * wide margin. Only finished games count.
 */
export function tilt(games: GameRow[], now = Date.now()): Tilt {
  const today = session(games, now);
  const reasons: TiltReason[] = [];
  const lossesInRow = today.findIndex((g) => g.win) < 0 ? today.length : today.findIndex((g) => g.win);
  if (lossesInRow >= 3) reasons.push("lossStreak");
  if (games.length >= 8 && today.length >= 3) {
    const usual = games.slice(3).reduce((s, g) => s + kdaOf(g), 0) / (games.length - 3);
    const lately = games.slice(0, 3).reduce((s, g) => s + kdaOf(g), 0) / 3;
    if (lately < usual * 0.6 && games.slice(0, 3).filter((g) => !g.win).length >= 2) reasons.push("kdaDrop");
  }
  if (today.length >= 5 && today.filter((g) => g.win).length / today.length < 0.35) reasons.push("badSession");
  const level = lossesInRow >= 4 || reasons.length >= 2 ? 2 : reasons.length ? 1 : 0;
  return { level, reasons, lossesInRow };
}

export type Period = { games: number; wins: number; kda: number | null };

export function period(games: GameRow[], from: number): Period {
  const shown = games.filter((g) => g.at >= from);
  const sum = shown.reduce((s, g) => ({ k: s.k + g.kills, d: s.d + g.deaths, a: s.a + g.assists }), { k: 0, d: 0, a: 0 });
  return { games: shown.length, wins: shown.filter((g) => g.win).length, kda: shown.length ? kdaOf({ kills: sum.k, deaths: sum.d, assists: sum.a }) : null };
}

export function startOfDay(now = Date.now()) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Monday 00:00 of this week, local time. */
export function startOfWeek(now = Date.now()) {
  const d = new Date(startOfDay(now));
  return d.getTime() - ((d.getDay() + 6) % 7) * DAY;
}

export type RoleLine = { position: string; games: number; wins: number; kda: number; csPerMinute: number };

export function byRole(games: GameRow[]): RoleLine[] {
  const roles = new Map<string, GameRow[]>();
  for (const g of games) if (g.position) roles.set(g.position, [...(roles.get(g.position) ?? []), g]);
  return [...roles.entries()]
    .map(([position, list]) => {
      const sum = list.reduce((s, g) => ({ k: s.k + g.kills, d: s.d + g.deaths, a: s.a + g.assists, cs: s.cs + g.cs, m: s.m + g.minutes }), {
        k: 0,
        d: 0,
        a: 0,
        cs: 0,
        m: 0,
      });
      return {
        position,
        games: list.length,
        wins: list.filter((g) => g.win).length,
        kda: kdaOf({ kills: sum.k, deaths: sum.d, assists: sum.a }),
        csPerMinute: sum.m ? sum.cs / sum.m : 0,
      };
    })
    .sort((a, b) => b.games - a.games);
}

/** The role with the best record among those with at least three games. */
export function bestRole(roles: RoleLine[]): RoleLine | null {
  const played = roles.filter((r) => r.games >= 3);
  return played.sort((a, b) => b.wins / b.games - a.wins / a.games || b.games - a.games)[0] ?? null;
}

export type ChampionLine = { championId: number; games: number; wins: number; kda: number };

export function byChampion(games: GameRow[]): ChampionLine[] {
  const map = new Map<number, GameRow[]>();
  for (const g of games) map.set(g.championId, [...(map.get(g.championId) ?? []), g]);
  return [...map.entries()]
    .map(([championId, list]) => {
      const sum = list.reduce((s, g) => ({ k: s.k + g.kills, d: s.d + g.deaths, a: s.a + g.assists }), { k: 0, d: 0, a: 0 });
      return { championId, games: list.length, wins: list.filter((g) => g.win).length, kda: kdaOf({ kills: sum.k, deaths: sum.d, assists: sum.a }) };
    })
    .sort((a, b) => b.games - a.games || b.wins - a.wins);
}

export type Decline = { championId: number; before: ChampionLine; lately: ChampionLine };

/**
 * Champions with at least four games whose newer half went clearly worse
 * than the older half: 25 points less win rate, or a third less KDA.
 */
export function declining(games: GameRow[]): Decline[] {
  const out: Decline[] = [];
  for (const line of byChampion(games)) {
    if (line.games < 4) continue;
    const list = games.filter((g) => g.championId === line.championId);
    const half = Math.floor(list.length / 2);
    const [lately] = byChampion(list.slice(0, half));
    const [before] = byChampion(list.slice(half));
    const rate = (l: ChampionLine) => l.wins / l.games;
    if (rate(before) - rate(lately) >= 0.25 || lately.kda < before.kda * 0.67) out.push({ championId: line.championId, before, lately });
  }
  return out;
}

/** LP won or lost since `from`, measured from the last reading before it. */
export function lpSince(snapshots: LpSnapshot[], from: number): number | null {
  if (snapshots.length < 2) return null;
  const last = snapshots[snapshots.length - 1];
  if (last.at < from) return 0;
  const before = [...snapshots].reverse().find((s) => s.at < from) ?? snapshots[0];
  return last.points - before.points;
}

/** Net wins after each game, oldest first, for the form chart. */
export function netWins(games: GameRow[]): number[] {
  let net = 0;
  return [...games].reverse().map((g) => (net += g.win ? 1 : -1));
}
