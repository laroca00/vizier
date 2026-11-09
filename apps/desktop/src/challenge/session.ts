import { SCENARIOS, type Answer, type Category, type Scenario } from "./scenarios";

export type Verdict = "accepted" | "rejected" | "other";

/** Which list the pick falls in. "other" is a pick the scenario has no opinion on, so it is neither right nor wrong. */
export function grade(scenario: Scenario, championId: string): Verdict {
  if (scenario.accepted.some((a) => a.champion === championId)) return "accepted";
  if (scenario.rejected.some((a) => a.champion === championId)) return "rejected";
  return "other";
}

export const answerFor = (scenario: Scenario, championId: string): Answer | undefined =>
  [...scenario.accepted, ...scenario.rejected].find((a) => a.champion === championId);

/** Shuffles with a given random source so tests are repeatable. */
export function shuffled<T>(list: T[], rng: () => number = Math.random): T[] {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** One accepted and up to three rejected-or-accepted others, in random order: the multiple choice options. */
export function choicesOf(scenario: Scenario, rng: () => number = Math.random): string[] {
  const right = shuffled(scenario.accepted, rng)[0];
  const others = shuffled([...scenario.rejected, ...scenario.accepted.filter((a) => a !== right)], rng);
  // Always keep the wrong ones in; fill up with the remaining right ones.
  const wrong = scenario.rejected.length;
  const rest = others.sort((a, b) => Number(scenario.rejected.includes(b)) - Number(scenario.rejected.includes(a))).slice(0, Math.max(wrong, 3));
  return shuffled([right, ...rest].slice(0, 4).map((a) => a.champion), rng);
}

export type Filter = { category: Category | "all"; difficulty: 0 | 1 | 2 | 3 };

export function pick(filter: Filter, scenarios: Scenario[] = SCENARIOS): Scenario[] {
  return scenarios.filter((s) => (filter.category === "all" || s.category === filter.category) && (filter.difficulty === 0 || s.difficulty === filter.difficulty));
}

export type Session = { queue: string[]; index: number; results: Record<string, Verdict> };

export function startSession(scenarios: Scenario[], rng: () => number = Math.random): Session {
  return { queue: shuffled(scenarios, rng).map((s) => s.id), index: 0, results: {} };
}

/** Records the answer for the current scenario (the first answer counts) and returns the new state. */
export function record(session: Session, verdict: Verdict): Session {
  const id = session.queue[session.index];
  if (!id || id in session.results) return session;
  return { ...session, results: { ...session.results, [id]: verdict } };
}

export const advance = (session: Session): Session => ({ ...session, index: Math.min(session.queue.length, session.index + 1) });
export const finished = (session: Session) => session.index >= session.queue.length;

export function summary(session: Session) {
  const verdicts = Object.values(session.results);
  return {
    answered: verdicts.length,
    accepted: verdicts.filter((v) => v === "accepted").length,
    rejected: verdicts.filter((v) => v === "rejected").length,
    other: verdicts.filter((v) => v === "other").length,
    total: session.queue.length,
  };
}

/** A new session over the scenarios answered with a rejected pick, for replay. */
export function replayMissed(session: Session, scenarios: Scenario[] = SCENARIOS, rng: () => number = Math.random): Session | null {
  const missed = scenarios.filter((s) => session.results[s.id] === "rejected");
  return missed.length ? startSession(missed, rng) : null;
}
