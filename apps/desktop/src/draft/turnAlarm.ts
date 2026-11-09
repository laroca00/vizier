import { useEffect, useRef, useState } from "react";
import type { ChampSelect } from "../lcu";

/** Seconds before the pick timer runs out when the warning sounds. */
export const ALARM_SECONDS = 10;

/**
 * The turn a warning is due for, or null. Only the player's own pick turn
 * counts: a pick that runs out dodges the game, a ban that runs out doesn't.
 * The key is the turn's end time, so each turn warns once.
 */
export function alarmDue(draft: Pick<ChampSelect, "turn" | "phaseEndsAt"> | null, now: number): number | null {
  if (!draft?.turn || draft.turn.kind !== "pick" || !draft.turn.mine) return null;
  const left = draft.phaseEndsAt - now;
  return left > 0 && left <= ALARM_SECONDS * 1000 ? draft.phaseEndsAt : null;
}

function tone() {
  try {
    const context = new AudioContext();
    const start = context.currentTime;
    // Three short falling notes: urgent, unlike the rising match-found tone.
    for (const [i, hz] of [988, 784, 988].entries()) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = hz;
      gain.gain.setValueAtTime(0.0001, start + i * 0.14);
      gain.gain.exponentialRampToValueAtTime(0.2, start + i * 0.14 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + i * 0.14 + 0.12);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(start + i * 0.14);
      oscillator.stop(start + i * 0.14 + 0.14);
    }
    setTimeout(() => void context.close(), 800);
  } catch {
    // No audio device; nothing else to do.
  }
}

/** Sounds once per pick turn when the player hasn't locked in with ten seconds left. */
export function useTurnAlarm(draft: ChampSelect | null, enabled: boolean) {
  const heard = useRef<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const active = enabled && !!draft?.turn?.mine && draft.turn.kind === "pick";
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, [active]);
  useEffect(() => {
    if (!enabled) return;
    const due = alarmDue(draft, now);
    if (due !== null && heard.current !== due) {
      heard.current = due;
      tone();
    }
  }, [draft, now, enabled]);
}
