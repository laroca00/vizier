import { useEffect, useState } from "react";
import type { ChampSelect } from "../lcu";
import aram from "../draft/fixtures/aram.json";
import arena from "../draft/fixtures/arena.json";
import blind from "../draft/fixtures/blind.json";
import draft from "../draft/fixtures/draft.json";

/** Recorded sessions, one snapshot per step of the pick order. */
export const MOCK_SESSIONS = { blind, draft, aram, arena } as unknown as Record<string, ChampSelect[]>;

export type MockName = keyof typeof MOCK_SESSIONS;

const STEP_MS = 4000;

/** The snapshot for a step; deadlines are stored as seconds left and resolved against `now`. */
export function mockFrame(name: string, step: number, now: number): ChampSelect | null {
  const frames = MOCK_SESSIONS[name];
  if (!frames?.length) return null;
  const frame = frames[Math.min(Math.max(step, 0), frames.length - 1)];
  return { ...frame, phaseEndsAt: now + frame.phaseEndsAt };
}

export function mockLength(name: string): number {
  return MOCK_SESSIONS[name]?.length ?? 0;
}

/** Dev only: `?mock=draft` (blind, draft, aram, arena) replays a session, one step every few seconds; `&step=3` freezes it. */
export function mockName(): string | null {
  if (!import.meta.env.DEV) return null;
  const name = new URLSearchParams(location.search).get("mock");
  return name && name in MOCK_SESSIONS ? name : null;
}

export function useChampSelectMock(): ChampSelect | null {
  const name = mockName();
  const frozen = new URLSearchParams(location.search).get("step");
  const [step, setStep] = useState(frozen ? Number(frozen) || 0 : 0);
  const [start] = useState(() => Date.now());
  useEffect(() => {
    if (!name || frozen) return;
    const last = mockLength(name) - 1;
    const timer = setInterval(() => setStep((s) => Math.min(s + 1, last)), STEP_MS);
    return () => clearInterval(timer);
  }, [name, frozen]);
  return name ? mockFrame(name, step, start) : null;
}
