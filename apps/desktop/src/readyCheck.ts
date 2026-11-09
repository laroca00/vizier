import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow, UserAttentionType } from "@tauri-apps/api/window";
import { useEffect, useRef } from "react";
import { acceptReadyCheck } from "./lcuActions";

/** True on the step into a ready check, not while it stays open. */
export function matchFound(previous: string | null, next: string | null): boolean {
  return next === "ReadyCheck" && previous !== "ReadyCheck";
}

function tone() {
  try {
    const context = new AudioContext();
    const start = context.currentTime;
    // Two rising notes, short enough not to startle.
    for (const [i, hz] of [660, 880].entries()) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = hz;
      gain.gain.setValueAtTime(0.0001, start + i * 0.18);
      gain.gain.exponentialRampToValueAtTime(0.18, start + i * 0.18 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + i * 0.18 + 0.16);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(start + i * 0.18);
      oscillator.stop(start + i * 0.18 + 0.18);
    }
    setTimeout(() => void context.close(), 800);
  } catch {
    // No audio device: the taskbar flash still works.
  }
}

/** Plays a tone and flashes the taskbar when a match is found, if the player turned it on. */
export function useReadyCheckAlert(phase: string | null, enabled: boolean) {
  const previous = useRef<string | null>(phase);
  useEffect(() => {
    if (enabled && matchFound(previous.current, phase)) {
      tone();
      if (isTauri()) void getCurrentWindow().requestUserAttention(UserAttentionType.Critical).catch(() => {});
    }
    previous.current = phase;
  }, [phase, enabled]);
}


/** Accepts the match the moment it is found, if the player turned that on. */
export function useAutoAcceptReady(phase: string | null, enabled: boolean) {
  const previous = useRef<string | null>(phase);
  useEffect(() => {
    if (enabled && isTauri() && matchFound(previous.current, phase)) void acceptReadyCheck().catch(() => {});
    previous.current = phase;
  }, [phase, enabled]);
}
