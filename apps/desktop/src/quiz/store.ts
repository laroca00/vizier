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
