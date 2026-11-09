import { useSyncExternalStore } from "react";
import type { QuizMode, QuizRecord } from "./logic";

// Daily riddle results, kept on this computer for streaks and to resume a day.

const KEY = "vizier.quiz";
const KEPT = 400;
const listeners = new Set<() => void>();

export function parseRecords(raw: string | null): QuizRecord[] {
  try {
    const list = JSON.parse(raw ?? "[]");
    return (Array.isArray(list) ? list : []).filter(
      (r): r is QuizRecord => r && typeof r.day === "string" && typeof r.mode === "string" && Array.isArray(r.guesses),
    );
  } catch {
    return [];
  }
}

function read() {
  try {
    return parseRecords(localStorage.getItem(KEY));
  } catch {
    return [];
  }
}

let current = read();

export function useQuizRecords(): QuizRecord[] {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => current,
  );
}

export function saveRecord(record: QuizRecord) {
  current = [...current.filter((r) => !(r.day === record.day && r.mode === record.mode)), record].slice(-KEPT);
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    // Kept for this session.
  }
  for (const listener of listeners) listener();
}

export const recordFor = (records: QuizRecord[], day: string, mode: QuizMode) => records.find((r) => r.day === day && r.mode === mode);

// The best timed item game score, kept on this computer.
const BEST_KEY = "vizier.quiz.timedBest";

export function readTimedBest(): number | null {
  try {
    const value = Number(localStorage.getItem(BEST_KEY));
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

export function saveTimedBest(score: number) {
  try {
    localStorage.setItem(BEST_KEY, String(score));
  } catch {
    // Kept for this session only.
  }
}

// Exam answers per category, kept on this computer next to the daily results.
const EXAM_KEY = "vizier.quiz.exam";
export type ExamTally = Record<string, { answered: number; correct: number }>;

export function parseExamTally(raw: string | null): ExamTally {
  try {
    const data = JSON.parse(raw ?? "{}");
    const tally: ExamTally = {};
    for (const [category, v] of Object.entries(data && typeof data === "object" ? data : {})) {
      const { answered, correct } = (v ?? {}) as { answered?: unknown; correct?: unknown };
      if (typeof answered === "number" && typeof correct === "number" && answered >= correct && correct >= 0) tally[category] = { answered, correct };
    }
    return tally;
  } catch {
    return {};
  }
}

/** Adds a finished exam's answers to the per-category totals and returns the new totals. */
export function addExamAnswers(tally: ExamTally, answers: { category: string; correct: boolean }[]): ExamTally {
  const next: ExamTally = { ...tally };
  for (const a of answers) {
    const row = next[a.category] ?? { answered: 0, correct: 0 };
    next[a.category] = { answered: row.answered + 1, correct: row.correct + (a.correct ? 1 : 0) };
  }
  return next;
}

export function readExamTally(): ExamTally {
  try {
    return parseExamTally(localStorage.getItem(EXAM_KEY));
  } catch {
    return {};
  }
}

export function recordExam(answers: { category: string; correct: boolean }[]) {
  try {
    localStorage.setItem(EXAM_KEY, JSON.stringify(addExamAnswers(readExamTally(), answers)));
  } catch {
    // Kept for this session only.
  }
}
