import { useCallback, useState } from "react";
import { emptyDraft, type Draft } from "./store";

export type History = { past: Draft[]; present: Draft; future: Draft[] };

const LIMIT = 100;

const same = (a: Draft, b: Draft) => JSON.stringify(a) === JSON.stringify(b);

export const startHistory = (present: Draft): History => ({ past: [], present, future: [] });

/** A change clears what could be redone; setting the same draft again is not a step. */
export function push(h: History, next: Draft): History {
  if (same(h.present, next)) return h;
  return { past: [...h.past, h.present].slice(-LIMIT), present: next, future: [] };
}

export function undo(h: History): History {
  const previous = h.past[h.past.length - 1];
  return previous ? { past: h.past.slice(0, -1), present: previous, future: [h.present, ...h.future] } : h;
}

export function redo(h: History): History {
  const [next, ...future] = h.future;
  return next ? { past: [...h.past, h.present], present: next, future } : h;
}

export function useDraftHistory() {
  const [history, setHistory] = useState(() => startHistory(emptyDraft()));
  const set = useCallback((next: Draft) => setHistory((h) => push(h, next)), []);
  const back = useCallback(() => setHistory(undo), []);
  const forward = useCallback(() => setHistory(redo), []);
  return { draft: history.present, set, undo: back, redo: forward, canUndo: history.past.length > 0, canRedo: history.future.length > 0 };
}
