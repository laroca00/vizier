import type { Match, Participant } from "./riot/types.ts";
import { rankOf, type Benchmarks, type Metric } from "./stats.ts";

// Habits across recent games: a metric counts as a habit when it lands on the
// wrong side of the Emerald+ median for the role in most of them.

const HABIT_SHARE = 0.7;
const MIN_GAMES = 5;

export type GameNumbers = {
  matchId: string;
  championId: number;
  position: string;
  win: boolean;
  values: Partial<Record<Metric, number>>;
};

const round = (n: number) => Math.round(n * 100) / 100;

/** The same per-player numbers the crawler stores, read from one match document. */
export function gameNumbers(match: Match, puuid: string): GameNumbers | null {
  const p: Participant | undefined = match.info.participants.find((x) => x.puuid === puuid);
  if (!p || !p.teamPosition) return null;
  const minutes = match.info.gameDuration / 60;
  const c = p.challenges ?? {};
  const cs10 = p.teamPosition === "JUNGLE" ? c.jungleCsBefore10Minutes : c.laneMinionsFirst10Minutes;
  const values: GameNumbers["values"] = {
    cs_pm: round(((p.totalMinionsKilled ?? 0) + (p.neutralMinionsKilled ?? 0)) / minutes),
  };
  if (cs10 !== undefined) values.cs10 = Math.round(cs10);
  if (p.goldEarned !== undefined) values.gold_pm = round(p.goldEarned / minutes);
  if (p.visionScore !== undefined) values.vision_pm = round(p.visionScore / minutes);
  if (c.killParticipation !== undefined) values.kill_participation = round(c.killParticipation);
  if (c.teamDamagePercentage !== undefined) values.damage_share = round(c.teamDamagePercentage);
  if (p.deaths !== undefined) values.deaths = p.deaths;
  return { matchId: match.metadata.matchId, championId: p.championId, position: p.teamPosition, win: p.win, values };
}

type HabitRule = { metric: Metric; lowerIsWorse: boolean; title: string; detail: (bad: number, games: number, median: number) => string; skip?: string[] };

const RULES: HabitRule[] = [
  {
    metric: "cs10",
    lowerIsWorse: true,
    title: "İlk 10 dakikada minyon kaçırıyorsun",
    detail: (bad, games, median) => `Son ${games} maçın ${bad} tanesinde 10. dakikaya kadar Emerald+ medyanı olan ${median} minyonun altında kaldın.`,
    skip: ["UTILITY"],
  },
  {
    metric: "cs_pm",
    lowerIsWorse: true,
    title: "Maç boyunca minyon toplaman düşük",
    detail: (bad, games, median) => `Son ${games} maçın ${bad} tanesinde dakika başına minyonun Emerald+ medyanı olan ${median} değerinin altındaydı.`,
    skip: ["UTILITY"],
  },
  {
    metric: "vision_pm",
    lowerIsWorse: true,
    title: "Görüşe az katkı veriyorsun",
    detail: (bad, games, median) => `Son ${games} maçın ${bad} tanesinde dakika başına görüş skorun Emerald+ medyanı olan ${median} değerinin altındaydı.`,
  },
  {
    metric: "kill_participation",
    lowerIsWorse: true,
    title: "Takım savaşlarına geç katılıyorsun",
    detail: (bad, games, median) => `Son ${games} maçın ${bad} tanesinde öldürmelere katılım oranın Emerald+ medyanı olan %${Math.round(median * 100)} değerinin altındaydı.`,
  },
  {
    metric: "deaths",
    lowerIsWorse: false,
    title: "Çok sık ölüyorsun",
    detail: (bad, games, median) => `Son ${games} maçın ${bad} tanesinde Emerald+ medyanı olan ${median} ölümden fazla öldün.`,
  },
];

export type Habit = { title: string; detail: string };

export type Trends = {
  games: number;
  wins: number;
  habits: Habit[];
  perGame: GameNumbers[];
};

export function findHabits(games: GameNumbers[], benchmarksByPosition: Map<string, Benchmarks>): Trends {
  const habits: Habit[] = [];
  for (const rule of RULES) {
    let considered = 0;
    let bad = 0;
    const medians: number[] = [];
    for (const game of games) {
      if (rule.skip?.includes(game.position)) continue;
      const distribution = benchmarksByPosition.get(game.position)?.metrics[rule.metric];
      const value = game.values[rule.metric];
      if (!distribution || value === undefined) continue;
      considered++;
      medians.push(distribution.quantiles[10]);
      const rank = rankOf(distribution, value);
      if (rule.lowerIsWorse ? rank < 0.5 : rank > 0.5) bad++;
    }
    if (considered >= MIN_GAMES && bad / considered >= HABIT_SHARE) {
      const median = Math.round((medians.reduce((a, b) => a + b, 0) / medians.length) * 100) / 100;
      habits.push({ title: rule.title, detail: rule.detail(bad, considered, median) });
    }
  }
  return { games: games.length, wins: games.filter((g) => g.win).length, habits, perGame: games };
}
